use std::collections::{HashMap, HashSet};

use serde_json::{Map, Value, json};

use crate::core::error::{Error, Result};

use super::redact::redact_value;
use super::storage;
use super::types::{GeneratedMihomoConfig, LandingSocksConfig, ProxyChainConfig, ProxyChainMode, ProxyPolicy};

/// Mihomo group used by landing SOCKS proxies as `dialer-proxy`.
///
/// The browser connects to local Mihomo, rules go to `PROXY`, `PROXY` goes to
/// landing SOCKS proxies, and each landing SOCKS connection is dialed through
/// this first-hop group. This guarantees the final website sees the landing IP
/// instead of the airport node IP, while the landing server itself is reached
/// through the selected airport node.
pub const FIRST_HOP_SELECTOR_GROUP: &str = "PROXY-CHAIN-FIRST-HOP";
pub const FIRST_HOP_AUTO_GROUP: &str = "PROXY-CHAIN-AUTO";
pub const FIRST_HOP_FALLBACK_GROUP: &str = "PROXY-CHAIN-FALLBACK";
pub const FIRST_HOP_MANUAL_GROUP: &str = "PROXY-CHAIN-MANUAL";
pub const FINAL_PROXY_GROUP: &str = "PROXY";

pub async fn generate_and_write(
    config: &ProxyChainConfig,
    redact_for_return: bool,
) -> Result<GeneratedMihomoConfig> {
    let (mihomo_value, proxy_count, proxy_group_count) = build_mihomo_value(config)?;
    let yaml = to_yaml(&mihomo_value);
    let redacted_yaml = to_yaml(&redact_value(&mihomo_value));

    let config_path = storage::mihomo_config_path(&config.mihomo)?;
    let work_dir = storage::mihomo_work_dir(&config.mihomo)?;
    tokio::fs::create_dir_all(&work_dir).await?;
    storage::write_generated_mihomo_config(&config_path, &yaml).await?;

    Ok(GeneratedMihomoConfig {
        config_path: config_path.to_string_lossy().to_string(),
        work_dir: work_dir.to_string_lossy().to_string(),
        yaml: if redact_for_return {
            redacted_yaml.clone()
        } else {
            yaml
        },
        redacted_yaml,
        proxy_count,
        proxy_group_count,
    })
}

pub fn build_mihomo_value(config: &ProxyChainConfig) -> Result<(Value, usize, usize)> {
    let primary_policy = primary_policy(config);
    let inventory = build_inventory(config, Some(FIRST_HOP_SELECTOR_GROUP));
    let first_hop_names = collect_first_hop_names(&inventory, primary_policy);
    let landing_names = collect_landing_names(&inventory, primary_policy);

    validate_chain_inventory(config.mode, &first_hop_names, &landing_names)?;

    let mut root = Map::new();
    insert_if_some(&mut root, "mixed-port", config.mihomo.mixed_port);
    insert_if_some(&mut root, "socks-port", config.mihomo.socks_port);
    insert_if_some(&mut root, "port", config.mihomo.http_port);
    root.insert(
        "allow-lan".to_string(),
        Value::Bool(config.mihomo.allow_lan),
    );
    root.insert(
        "bind-address".to_string(),
        Value::String(config.mihomo.bind_address.clone()),
    );
    root.insert(
        "mode".to_string(),
        Value::String(config.mihomo.mode.clone()),
    );
    root.insert(
        "log-level".to_string(),
        Value::String(config.mihomo.log_level.clone()),
    );
    root.insert("ipv6".to_string(), Value::Bool(false));
    root.insert("tcp-concurrent".to_string(), Value::Bool(true));
    root.insert("unified-delay".to_string(), Value::Bool(true));

    if !config.mihomo.external_controller.trim().is_empty() {
        root.insert(
            "external-controller".to_string(),
            Value::String(config.mihomo.external_controller.clone()),
        );
    }
    if let Some(secret) = config.mihomo.external_controller_secret.as_deref() {
        if !secret.trim().is_empty() {
            root.insert("secret".to_string(), Value::String(secret.to_string()));
        }
    }
    if let Some(external_ui) = config.mihomo.external_ui.as_deref() {
        if !external_ui.trim().is_empty() {
            root.insert(
                "external-ui".to_string(),
                Value::String(external_ui.to_string()),
            );
        }
    }

    let proxy_count = inventory.proxies.len();
    root.insert(
        "proxies".to_string(),
        Value::Array(inventory.proxies.into_iter().map(|item| item.raw).collect()),
    );

    let proxy_groups = build_proxy_groups(config, primary_policy, first_hop_names, landing_names, config.mode);
    let proxy_group_count = proxy_groups.len();
    root.insert("proxy-groups".to_string(), Value::Array(proxy_groups));
    root.insert(
        "rules".to_string(),
        Value::Array(vec![Value::String(format!("MATCH,{}", FINAL_PROXY_GROUP))]),
    );

    Ok((Value::Object(root), proxy_count, proxy_group_count))
}

#[derive(Debug, Clone)]
struct GeneratedProxy {
    name: String,
    raw: Value,
    source_subscription_id: Option<String>,
    landing_id: Option<String>,
    node_id: Option<String>,
}

#[derive(Debug, Clone, Default)]
struct ProxyInventory {
    proxies: Vec<GeneratedProxy>,
    node_name_by_id: HashMap<String, String>,
    names_by_subscription_id: HashMap<String, Vec<String>>,
    landing_name_by_id: HashMap<String, String>,
    first_hop_names: Vec<String>,
    landing_names: Vec<String>,
}

fn build_inventory(
    config: &ProxyChainConfig,
    landing_dialer_group: Option<&str>,
) -> ProxyInventory {
    let mut proxies = Vec::new();
    let mut used_names = HashSet::new();

    for subscription in config.subscriptions.iter().filter(|subscription| subscription.enabled) {
        for node in subscription.nodes.iter().filter(|node| node.enabled) {
            let mut raw = node.raw.clone();
            if !raw.is_object() {
                continue;
            }

            let base_name = if node.name.trim().is_empty() {
                raw.get("name").and_then(Value::as_str).unwrap_or("订阅节点").to_string()
            } else {
                node.name.clone()
            };
            let name = unique_proxy_name(&base_name, &mut used_names);
            if let Some(object) = raw.as_object_mut() {
                object.insert("name".to_string(), Value::String(name.clone()));
            }

            proxies.push(GeneratedProxy {
                name,
                raw,
                source_subscription_id: Some(subscription.id.clone()),
                landing_id: None,
                node_id: Some(node.id.clone()),
            });
        }
    }

    for landing in config.landing_socks.iter().filter(|landing| landing.enabled) {
        if let Some(proxy) = landing_to_proxy(landing, &mut used_names, landing_dialer_group) {
            proxies.push(proxy);
        }
    }

    let mut inventory = ProxyInventory {
        proxies,
        ..ProxyInventory::default()
    };

    for proxy in &inventory.proxies {
        if let Some(node_id) = proxy.node_id.as_ref() {
            inventory.node_name_by_id.insert(node_id.clone(), proxy.name.clone());
            inventory.first_hop_names.push(proxy.name.clone());
        }
        if let Some(subscription_id) = proxy.source_subscription_id.as_ref() {
            inventory
                .names_by_subscription_id
                .entry(subscription_id.clone())
                .or_default()
                .push(proxy.name.clone());
        }
        if let Some(landing_id) = proxy.landing_id.as_ref() {
            inventory.landing_name_by_id.insert(landing_id.clone(), proxy.name.clone());
            inventory.landing_names.push(proxy.name.clone());
        }
    }

    inventory
}

fn landing_to_proxy(
    landing: &LandingSocksConfig,
    used_names: &mut HashSet<String>,
    dialer_group: Option<&str>,
) -> Option<GeneratedProxy> {
    if landing.host.trim().is_empty() || landing.port == 0 {
        return None;
    }

    let name = unique_proxy_name(&format!("Landing / {}", landing.name), used_names);
    let mut raw = Map::new();
    raw.insert("name".to_string(), Value::String(name.clone()));
    raw.insert("type".to_string(), Value::String("socks5".to_string()));
    raw.insert("server".to_string(), Value::String(landing.host.clone()));
    raw.insert("port".to_string(), json!(landing.port));
    raw.insert("udp".to_string(), Value::Bool(landing.udp));
    if let Some(username) = landing.username.as_deref() {
        if !username.trim().is_empty() {
            raw.insert("username".to_string(), Value::String(username.to_string()));
        }
    }
    if let Some(password) = landing.password.as_deref() {
        if !password.trim().is_empty() {
            raw.insert("password".to_string(), Value::String(password.to_string()));
        }
    }
    if let Some(dialer_group) = dialer_group {
        raw.insert(
            "dialer-proxy".to_string(),
            Value::String(dialer_group.to_string()),
        );
    }

    Some(GeneratedProxy {
        name,
        raw: Value::Object(raw),
        source_subscription_id: None,
        landing_id: Some(landing.id.clone()),
        node_id: None,
    })
}

fn primary_policy(config: &ProxyChainConfig) -> &ProxyPolicy {
    config
        .policies
        .iter()
        .find(|policy| policy.enabled)
        .or_else(|| config.policies.first())
        .expect("storage normalization guarantees at least one policy")
}

fn collect_first_hop_names(inventory: &ProxyInventory, policy: &ProxyPolicy) -> Vec<String> {
    let selects_everything = policy.node_ids.is_empty() && policy.subscription_ids.is_empty();
    if selects_everything {
        return inventory.first_hop_names.clone();
    }

    let mut names = Vec::new();
    let mut seen = HashSet::new();
    for node_id in &policy.node_ids {
        if let Some(name) = inventory.node_name_by_id.get(node_id) {
            push_unique(&mut names, &mut seen, name.clone());
        }
    }
    for subscription_id in &policy.subscription_ids {
        if let Some(subscription_names) = inventory.names_by_subscription_id.get(subscription_id) {
            for name in subscription_names {
                push_unique(&mut names, &mut seen, name.clone());
            }
        }
    }
    names
}

fn collect_landing_names(inventory: &ProxyInventory, policy: &ProxyPolicy) -> Vec<String> {
    if policy.landing_socks_ids.is_empty() {
        return inventory.landing_names.clone();
    }

    let mut names = Vec::new();
    let mut seen = HashSet::new();
    for landing_id in &policy.landing_socks_ids {
        if let Some(name) = inventory.landing_name_by_id.get(landing_id) {
            push_unique(&mut names, &mut seen, name.clone());
        }
    }
    names
}

fn validate_chain_inventory(
    mode: ProxyChainMode,
    first_hop_names: &[String],
    landing_names: &[String],
) -> Result<()> {
    if first_hop_names.is_empty() {
        return Err(Error::ProxyConfigInvalid.log_with(
            "代理链至少需要一个已启用且已成功解析的机场节点；请先更新订阅并确保节点不是 -1",
        ));
    }
    // 仅落地链模式强制要求落地 SOCKS5；直连模式无需落地。
    if matches!(mode, ProxyChainMode::LandingChain) && landing_names.is_empty() {
        return Err(Error::ProxyConfigInvalid.log_with(
            "落地链模式至少需要一个已启用的落地 SOCKS5；为避免严格网站看到机场出口，请切换为「机场订阅直连」模式或添加落地代理",
        ));
    }
    Ok(())
}

fn build_proxy_groups(
    config: &ProxyChainConfig,
    primary_policy: &ProxyPolicy,
    first_hop_names: Vec<String>,
    landing_names: Vec<String>,
    mode: ProxyChainMode,
) -> Vec<Value> {
    let mut groups = Vec::new();
    let url = primary_policy
        .test_url
        .clone()
        .unwrap_or_else(|| config.mihomo.default_test_url.clone());
    let interval = primary_policy.interval_seconds.unwrap_or(300);

    // 机场节点组：自动 / 回落 / 手动 / 优选选择器（两种模式共用）
    groups.push(build_test_group(
        FIRST_HOP_AUTO_GROUP,
        "url-test",
        first_hop_names.clone(),
        &url,
        interval,
    ));
    groups.push(build_test_group(
        FIRST_HOP_FALLBACK_GROUP,
        "fallback",
        first_hop_names.clone(),
        &url,
        interval,
    ));
    groups.push(build_select_group(
        FIRST_HOP_MANUAL_GROUP,
        first_hop_names.clone(),
    ));
    groups.push(build_first_hop_selector(primary_policy, first_hop_names));

    // 最终 PROXY 组：按模式决定指向。
    match mode {
        // 直连模式：PROXY 直接指向机场节点优选组，无落地。
        ProxyChainMode::Direct => {
            groups.push(build_select_group(
                FINAL_PROXY_GROUP,
                vec![FIRST_HOP_SELECTOR_GROUP.to_string()],
            ));
        }
        // 落地链模式：PROXY 指向落地 SOCKS5（每个落地连接经机场节点拨号）。
        ProxyChainMode::LandingChain => {
            groups.push(build_select_group(FINAL_PROXY_GROUP, landing_names));
        }
    }

    groups
}

fn build_first_hop_selector(policy: &ProxyPolicy, first_hop_names: Vec<String>) -> Value {
    use super::types::ProxyPolicyStrategy;

    let mut names = match policy.strategy {
        ProxyPolicyStrategy::Select => vec![
            FIRST_HOP_MANUAL_GROUP.to_string(),
            FIRST_HOP_AUTO_GROUP.to_string(),
            FIRST_HOP_FALLBACK_GROUP.to_string(),
        ],
        ProxyPolicyStrategy::Fallback => vec![
            FIRST_HOP_FALLBACK_GROUP.to_string(),
            FIRST_HOP_AUTO_GROUP.to_string(),
            FIRST_HOP_MANUAL_GROUP.to_string(),
        ],
        ProxyPolicyStrategy::UrlTest | ProxyPolicyStrategy::Relay => vec![
            FIRST_HOP_AUTO_GROUP.to_string(),
            FIRST_HOP_FALLBACK_GROUP.to_string(),
            FIRST_HOP_MANUAL_GROUP.to_string(),
        ],
    };

    // Also expose raw nodes in the selector for quick one-off manual selection from Mihomo UI/API.
    for name in first_hop_names {
        if !names.iter().any(|item| item == &name) {
            names.push(name);
        }
    }

    build_select_group(FIRST_HOP_SELECTOR_GROUP, names)
}

fn build_select_group(name: &str, proxy_names: Vec<String>) -> Value {
    let mut group = Map::new();
    group.insert("name".to_string(), Value::String(name.to_string()));
    group.insert("type".to_string(), Value::String("select".to_string()));
    group.insert(
        "proxies".to_string(),
        Value::Array(proxy_names.into_iter().map(Value::String).collect()),
    );
    Value::Object(group)
}

fn build_test_group(
    name: &str,
    group_type: &str,
    proxy_names: Vec<String>,
    test_url: &str,
    interval_seconds: u64,
) -> Value {
    let mut group = Map::new();
    group.insert("name".to_string(), Value::String(name.to_string()));
    group.insert("type".to_string(), Value::String(group_type.to_string()));
    group.insert(
        "proxies".to_string(),
        Value::Array(proxy_names.into_iter().map(Value::String).collect()),
    );
    group.insert("url".to_string(), Value::String(test_url.to_string()));
    group.insert("interval".to_string(), json!(interval_seconds));
    group.insert("timeout".to_string(), json!(5000));
    if group_type == "url-test" {
        group.insert("tolerance".to_string(), json!(50));
    }
    Value::Object(group)
}

fn push_unique(names: &mut Vec<String>, seen: &mut HashSet<String>, name: String) {
    if seen.insert(name.clone()) {
        names.push(name);
    }
}

fn insert_if_some(map: &mut Map<String, Value>, key: &str, value: Option<u16>) {
    if let Some(value) = value {
        map.insert(key.to_string(), json!(value));
    }
}

fn unique_proxy_name(base_name: &str, used: &mut HashSet<String>) -> String {
    let base = if base_name.trim().is_empty() {
        "Proxy"
    } else {
        base_name.trim()
    };
    unique_named(base, used)
}

fn unique_named(base: &str, used: &mut HashSet<String>) -> String {
    if used.insert(base.to_string()) {
        return base.to_string();
    }

    for index in 2.. {
        let candidate = format!("{} ({})", base, index);
        if used.insert(candidate.clone()) {
            return candidate;
        }
    }

    unreachable!()
}

pub fn to_yaml(value: &Value) -> String {
    let mut out = String::new();
    write_yaml_value(value, 0, &mut out);
    if !out.ends_with('\n') {
        out.push('\n');
    }
    out
}

fn write_yaml_value(value: &Value, indent: usize, out: &mut String) {
    match value {
        Value::Object(map) => write_yaml_object(map, indent, out),
        Value::Array(values) => write_yaml_array(values, indent, out),
        scalar => {
            out.push_str(&yaml_scalar(scalar));
            out.push('\n');
        }
    }
}

fn write_yaml_object(map: &Map<String, Value>, indent: usize, out: &mut String) {
    if map.is_empty() {
        out.push_str("{}\n");
        return;
    }

    for (key, value) in map {
        write_indent(indent, out);
        out.push_str(&yaml_key(key));
        out.push(':');
        if is_scalar(value) || is_empty_collection(value) {
            out.push(' ');
            out.push_str(&yaml_scalar_or_empty(value));
            out.push('\n');
        } else {
            out.push('\n');
            write_yaml_value(value, indent + 2, out);
        }
    }
}

fn write_yaml_array(values: &[Value], indent: usize, out: &mut String) {
    if values.is_empty() {
        write_indent(indent, out);
        out.push_str("[]\n");
        return;
    }

    for value in values {
        match value {
            Value::Object(map) if !map.is_empty() => {
                let mut iter = map.iter();
                let Some((first_key, first_value)) = iter.next() else {
                    continue;
                };
                write_indent(indent, out);
                out.push_str("- ");
                out.push_str(&yaml_key(first_key));
                out.push(':');
                if is_scalar(first_value) || is_empty_collection(first_value) {
                    out.push(' ');
                    out.push_str(&yaml_scalar_or_empty(first_value));
                    out.push('\n');
                } else {
                    out.push('\n');
                    write_yaml_value(first_value, indent + 2, out);
                }
                for (key, value) in iter {
                    write_indent(indent + 2, out);
                    out.push_str(&yaml_key(key));
                    out.push(':');
                    if is_scalar(value) || is_empty_collection(value) {
                        out.push(' ');
                        out.push_str(&yaml_scalar_or_empty(value));
                        out.push('\n');
                    } else {
                        out.push('\n');
                        write_yaml_value(value, indent + 4, out);
                    }
                }
            }
            Value::Array(values) if !values.is_empty() => {
                write_indent(indent, out);
                out.push_str("-\n");
                write_yaml_array(values, indent + 2, out);
            }
            scalar => {
                write_indent(indent, out);
                out.push_str("- ");
                out.push_str(&yaml_scalar_or_empty(scalar));
                out.push('\n');
            }
        }
    }
}

fn write_indent(indent: usize, out: &mut String) {
    for _ in 0..indent {
        out.push(' ');
    }
}

fn is_scalar(value: &Value) -> bool {
    matches!(
        value,
        Value::Null | Value::Bool(_) | Value::Number(_) | Value::String(_)
    )
}

fn is_empty_collection(value: &Value) -> bool {
    match value {
        Value::Array(values) => values.is_empty(),
        Value::Object(map) => map.is_empty(),
        _ => false,
    }
}

fn yaml_scalar_or_empty(value: &Value) -> String {
    match value {
        Value::Array(values) if values.is_empty() => "[]".to_string(),
        Value::Object(map) if map.is_empty() => "{}".to_string(),
        _ => yaml_scalar(value),
    }
}

fn yaml_scalar(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::String(value) => serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string()),
        Value::Array(_) | Value::Object(_) => "null".to_string(),
    }
}

fn yaml_key(key: &str) -> String {
    if key
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '-' | '_' | '.'))
        && !key.is_empty()
    {
        key.to_string()
    } else {
        serde_json::to_string(key).unwrap_or_else(|_| "\"\"".to_string())
    }
}
