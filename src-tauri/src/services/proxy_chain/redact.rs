use std::collections::HashMap;

use serde_json::Value;

use super::types::ProxyChainConfig;

pub const MASK: &str = "******";

pub fn redact_config(config: &ProxyChainConfig) -> ProxyChainConfig {
    let mut redacted = config.clone();

    if redacted
        .mihomo
        .external_controller_secret
        .as_deref()
        .map(|secret| !secret.trim().is_empty())
        .unwrap_or(false)
    {
        redacted.mihomo.external_controller_secret = Some(MASK.to_string());
    }

    for subscription in &mut redacted.subscriptions {
        subscription.url = redact_url(&subscription.url);
        for node in &mut subscription.nodes {
            node.raw = redact_value(&node.raw);
        }
    }

    for landing in &mut redacted.landing_socks {
        if landing.password.as_deref().is_some_and(|value| !value.is_empty()) {
            landing.password = Some(MASK.to_string());
        }
    }

    redacted
}

pub fn restore_masked_secrets(incoming: &mut ProxyChainConfig, existing: &ProxyChainConfig) {
    if contains_mask(incoming.mihomo.external_controller_secret.as_deref()) {
        incoming.mihomo.external_controller_secret =
            existing.mihomo.external_controller_secret.clone();
    }

    let existing_subscriptions: HashMap<&str, &super::types::ProxySubscription> = existing
        .subscriptions
        .iter()
        .map(|subscription| (subscription.id.as_str(), subscription))
        .collect();
    for subscription in &mut incoming.subscriptions {
        let Some(existing_subscription) = existing_subscriptions.get(subscription.id.as_str())
        else {
            continue;
        };

        if subscription.url.contains(MASK) {
            subscription.url = existing_subscription.url.clone();
        }

        let existing_nodes: HashMap<&str, &super::types::ProxyNode> = existing_subscription
            .nodes
            .iter()
            .map(|node| (node.id.as_str(), node))
            .collect();
        for node in &mut subscription.nodes {
            if contains_masked_value(&node.raw) {
                if let Some(existing_node) = existing_nodes.get(node.id.as_str()) {
                    node.raw = existing_node.raw.clone();
                }
            }
        }
    }

    let existing_landings: HashMap<&str, &super::types::LandingSocksConfig> = existing
        .landing_socks
        .iter()
        .map(|landing| (landing.id.as_str(), landing))
        .collect();
    for landing in &mut incoming.landing_socks {
        if contains_mask(landing.password.as_deref()) {
            if let Some(existing_landing) = existing_landings.get(landing.id.as_str()) {
                landing.password = existing_landing.password.clone();
            }
        }
    }
}

pub fn redact_value(value: &Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut next = serde_json::Map::new();
            for (key, value) in map {
                if is_secret_key(key) {
                    if !value.is_null() {
                        next.insert(key.clone(), Value::String(MASK.to_string()));
                    } else {
                        next.insert(key.clone(), Value::Null);
                    }
                } else {
                    next.insert(key.clone(), redact_value(value));
                }
            }
            Value::Object(next)
        }
        Value::Array(values) => Value::Array(values.iter().map(redact_value).collect()),
        other => other.clone(),
    }
}

pub fn redact_url(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if let Ok(mut url) = reqwest::Url::parse(trimmed) {
        if !url.username().is_empty() {
            let _ = url.set_username(MASK);
        }
        if url.password().is_some() {
            let _ = url.set_password(Some(MASK));
        }
        if url.query().is_some() {
            url.set_query(Some(MASK));
        }
        return url.to_string();
    }

    if trimmed.len() <= 12 {
        MASK.to_string()
    } else {
        let prefix = trimmed.chars().take(6).collect::<String>();
        let suffix = trimmed
            .chars()
            .rev()
            .take(4)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<String>();
        format!("{}{}{}", prefix, MASK, suffix)
    }
}

fn is_secret_key(key: &str) -> bool {
    let key = key.to_ascii_lowercase();
    matches!(
        key.as_str(),
        "password"
            | "passwd"
            | "pass"
            | "secret"
            | "token"
            | "access_token"
            | "refresh_token"
            | "authorization"
            | "auth"
            | "uuid"
            | "private-key"
            | "private_key"
            | "psk"
    ) || key.ends_with("_token")
        || key.ends_with("-token")
        || key.contains("secret")
}

fn contains_mask(value: Option<&str>) -> bool {
    value.is_some_and(|value| value.contains(MASK))
}

fn contains_masked_value(value: &Value) -> bool {
    match value {
        Value::String(value) => value.contains(MASK),
        Value::Array(values) => values.iter().any(contains_masked_value),
        Value::Object(map) => map.values().any(contains_masked_value),
        _ => false,
    }
}
