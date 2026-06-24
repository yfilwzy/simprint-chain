use base64::{Engine as _, engine::general_purpose};
use chrono::Utc;
use serde_json::{Map, Value, json};
use sha2::{Digest, Sha256};

use crate::core::error::{Error, Result};

use super::redact::MASK;
use super::types::{ProxyNode, ProxySubscription, SubscriptionUpdateResult};

pub async fn fetch_and_parse_subscription(
    subscription: &ProxySubscription,
) -> (Vec<ProxyNode>, SubscriptionUpdateResult) {
    let mut result = SubscriptionUpdateResult {
        subscription_id: subscription.id.clone(),
        fetched: false,
        parsed: 0,
        skipped: 0,
        updated_at: None,
        error: None,
    };

    match fetch_subscription_body(subscription).await {
        Ok(body) => {
            result.fetched = true;
            let (nodes, skipped) = parse_subscription_nodes(subscription, &body);
            result.parsed = nodes.len();
            result.skipped = skipped;
            result.updated_at = Some(Utc::now());
            if nodes.is_empty() {
                result.error = Some("订阅内容未解析出可用 Mihomo 节点".to_string());
            }
            (nodes, result)
        }
        Err(error) => {
            result.error = Some(error.to_string());
            (Vec::new(), result)
        }
    }
}

async fn fetch_subscription_body(subscription: &ProxySubscription) -> Result<String> {
    if subscription.url.contains(MASK) || subscription.url.trim().is_empty() {
        return Err(Error::InvalidArgument.log_with("订阅 URL 为空或已脱敏"));
    }

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build()?;
    let mut request = client.get(subscription.url.trim());
    if let Some(user_agent) = subscription.user_agent.as_deref() {
        if !user_agent.trim().is_empty() {
            request = request.header(reqwest::header::USER_AGENT, user_agent.trim());
        }
    }

    let response = request.send().await?;
    if !response.status().is_success() {
        return Err(format!("订阅请求失败: HTTP {}", response.status()).into());
    }

    response.text().await.map_err(Into::into)
}

pub fn parse_subscription_nodes(
    subscription: &ProxySubscription,
    body: &str,
) -> (Vec<ProxyNode>, usize) {
    if let Some(nodes) = parse_clash_yaml(subscription, body) {
        let skipped = count_candidate_yaml_proxies(body).saturating_sub(nodes.len());
        return (nodes, skipped);
    }

    let decoded = decode_subscription_lines(body).unwrap_or_else(|| body.to_string());
    let mut nodes = Vec::new();
    let mut skipped = 0;

    for line in decoded.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        match parse_uri_node(subscription, line) {
            Some(node) if node_allowed(subscription, &node.name) => nodes.push(node),
            Some(_) | None => skipped += 1,
        }
    }

    (nodes, skipped)
}

fn parse_clash_yaml(subscription: &ProxySubscription, body: &str) -> Option<Vec<ProxyNode>> {
    let settings = config::Config::builder()
        .add_source(config::File::from_str(body, config::FileFormat::Yaml))
        .build()
        .ok()?;
    let root = settings.try_deserialize::<Value>().ok()?;
    let proxies = root.get("proxies")?.as_array()?;

    let mut nodes = Vec::new();
    for proxy in proxies {
        let mut raw = proxy.clone();
        let Some(object) = raw.as_object_mut() else {
            continue;
        };
        let name = object
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("订阅节点")
            .trim()
            .to_string();
        if name.is_empty() || !node_allowed(subscription, &name) {
            continue;
        }
        object.insert("name".to_string(), Value::String(name.clone()));
        nodes.push(ProxyNode {
            id: stable_node_id(&subscription.id, &name),
            name,
            enabled: true,
            source_subscription_id: Some(subscription.id.clone()),
            raw: Value::Object(object.clone()),
        });
    }

    Some(nodes)
}

fn count_candidate_yaml_proxies(body: &str) -> usize {
    let settings = config::Config::builder()
        .add_source(config::File::from_str(body, config::FileFormat::Yaml))
        .build();
    let Ok(settings) = settings else {
        return 0;
    };
    let root = settings.try_deserialize::<Value>();
    let Ok(root) = root else {
        return 0;
    };
    root.get("proxies").and_then(Value::as_array).map(Vec::len).unwrap_or(0)
}

fn decode_subscription_lines(body: &str) -> Option<String> {
    let compact = body.split_whitespace().collect::<String>();
    if compact.is_empty() {
        return None;
    }

    decode_base64(&compact).and_then(|bytes| String::from_utf8(bytes).ok())
}

fn parse_uri_node(subscription: &ProxySubscription, line: &str) -> Option<ProxyNode> {
    if let Some(node) = parse_vmess_uri(subscription, line) {
        return Some(node);
    }

    let url = reqwest::Url::parse(line).ok()?;
    match url.scheme().to_ascii_lowercase().as_str() {
        "socks" | "socks5" | "socks5h" => parse_http_like_proxy(subscription, &url, "socks5"),
        "http" | "https" => parse_http_like_proxy(subscription, &url, "http"),
        "trojan" => parse_trojan_proxy(subscription, &url),
        "ss" => parse_shadowsocks_proxy(subscription, &url, line),
        "vless" => parse_vless_proxy(subscription, &url),
        _ => None,
    }
}

fn parse_http_like_proxy(
    subscription: &ProxySubscription,
    url: &reqwest::Url,
    proxy_type: &str,
) -> Option<ProxyNode> {
    let host = url.host_str()?.to_string();
    let port = url.port()?;
    let name = uri_name(url).unwrap_or_else(|| format!("{}:{}", host, port));

    let mut raw = Map::new();
    raw.insert("name".to_string(), Value::String(name.clone()));
    raw.insert("type".to_string(), Value::String(proxy_type.to_string()));
    raw.insert("server".to_string(), Value::String(host));
    raw.insert("port".to_string(), json!(port));
    raw.insert("udp".to_string(), Value::Bool(true));
    if !url.username().is_empty() {
        raw.insert(
            "username".to_string(),
            Value::String(percent_decode(url.username())),
        );
    }
    if let Some(password) = url.password() {
        raw.insert(
            "password".to_string(),
            Value::String(percent_decode(password)),
        );
    }

    Some(node_from_raw(subscription, name, raw))
}

fn parse_trojan_proxy(subscription: &ProxySubscription, url: &reqwest::Url) -> Option<ProxyNode> {
    let host = url.host_str()?.to_string();
    let port = url.port()?;
    let password = percent_decode(url.username());
    if password.is_empty() {
        return None;
    }
    let name = uri_name(url).unwrap_or_else(|| format!("trojan-{}:{}", host, port));

    let mut raw = Map::new();
    raw.insert("name".to_string(), Value::String(name.clone()));
    raw.insert("type".to_string(), Value::String("trojan".to_string()));
    raw.insert("server".to_string(), Value::String(host));
    raw.insert("port".to_string(), json!(port));
    raw.insert("password".to_string(), Value::String(password));
    raw.insert("udp".to_string(), Value::Bool(true));
    if let Some(sni) = query_param(url, "sni").or_else(|| query_param(url, "peer")) {
        raw.insert("sni".to_string(), Value::String(sni));
    }
    if let Some(network) = query_param(url, "type").or_else(|| query_param(url, "network")) {
        if !network.trim().is_empty() && network != "tcp" {
            raw.insert("network".to_string(), Value::String(network.clone()));
            append_transport_options(&mut raw, url, &network);
        }
    }

    Some(node_from_raw(subscription, name, raw))
}

fn parse_shadowsocks_proxy(
    subscription: &ProxySubscription,
    url: &reqwest::Url,
    line: &str,
) -> Option<ProxyNode> {
    let mut host = url.host_str().map(ToOwned::to_owned);
    let mut port = url.port();
    let mut cipher = percent_decode(url.username());
    let mut password = url.password().map(percent_decode);

    if password.is_none() && !cipher.is_empty() {
        if let Some(decoded) = decode_base64_to_string(&cipher) {
            if let Some((decoded_cipher, decoded_password)) = split_auth_pair(&decoded) {
                cipher = decoded_cipher;
                password = Some(decoded_password);
            }
        }
    }

    if host.is_none() || port.is_none() || password.is_none() || cipher.is_empty() {
        if let Some(decoded) = parse_shadowsocks_payload(line) {
            cipher = decoded.0;
            password = Some(decoded.1);
            host = Some(decoded.2);
            port = Some(decoded.3);
        }
    }

    let host = host?;
    let port = port?;
    let password = password?;
    if cipher.is_empty() || password.is_empty() {
        return None;
    }
    let name = uri_name(url).unwrap_or_else(|| format!("ss-{}:{}", host, port));

    let mut raw = Map::new();
    raw.insert("name".to_string(), Value::String(name.clone()));
    raw.insert("type".to_string(), Value::String("ss".to_string()));
    raw.insert("server".to_string(), Value::String(host));
    raw.insert("port".to_string(), json!(port));
    raw.insert("cipher".to_string(), Value::String(cipher));
    raw.insert("password".to_string(), Value::String(password));
    raw.insert("udp".to_string(), Value::Bool(true));

    Some(node_from_raw(subscription, name, raw))
}

fn parse_vless_proxy(subscription: &ProxySubscription, url: &reqwest::Url) -> Option<ProxyNode> {
    let host = url.host_str()?.to_string();
    let port = url.port()?;
    let uuid = percent_decode(url.username());
    if uuid.is_empty() {
        return None;
    }
    let name = uri_name(url).unwrap_or_else(|| format!("vless-{}:{}", host, port));

    let mut raw = Map::new();
    raw.insert("name".to_string(), Value::String(name.clone()));
    raw.insert("type".to_string(), Value::String("vless".to_string()));
    raw.insert("server".to_string(), Value::String(host));
    raw.insert("port".to_string(), json!(port));
    raw.insert("uuid".to_string(), Value::String(uuid));
    raw.insert("udp".to_string(), Value::Bool(true));

    if let Some(flow) = query_param(url, "flow") {
        raw.insert("flow".to_string(), Value::String(flow));
    }

    let security = query_param(url, "security").unwrap_or_default();
    if matches!(security.as_str(), "tls" | "reality") {
        raw.insert("tls".to_string(), Value::Bool(true));
    }
    if let Some(servername) = query_param(url, "sni").or_else(|| query_param(url, "peer")) {
        raw.insert("servername".to_string(), Value::String(servername));
    }
    if let Some(fingerprint) = query_param(url, "fp") {
        raw.insert(
            "client-fingerprint".to_string(),
            Value::String(fingerprint),
        );
    }
    if security == "reality" {
        let mut reality_opts = Map::new();
        if let Some(public_key) = query_param(url, "pbk").or_else(|| query_param(url, "public-key"))
        {
            reality_opts.insert("public-key".to_string(), Value::String(public_key));
        }
        if let Some(short_id) = query_param(url, "sid").or_else(|| query_param(url, "short-id")) {
            reality_opts.insert("short-id".to_string(), Value::String(short_id));
        }
        if !reality_opts.is_empty() {
            raw.insert("reality-opts".to_string(), Value::Object(reality_opts));
        }
    }

    if let Some(network) = query_param(url, "type").or_else(|| query_param(url, "network")) {
        if !network.trim().is_empty() && network != "tcp" {
            raw.insert("network".to_string(), Value::String(network.clone()));
            append_transport_options(&mut raw, url, &network);
        }
    }

    Some(node_from_raw(subscription, name, raw))
}

fn parse_vmess_uri(subscription: &ProxySubscription, line: &str) -> Option<ProxyNode> {
    let payload = line.strip_prefix("vmess://")?;
    let bytes = decode_base64(payload)?;
    let vmess: Value = serde_json::from_slice(&bytes).ok()?;
    let object = vmess.as_object()?;

    let name = object
        .get("ps")
        .or_else(|| object.get("name"))
        .and_then(Value::as_str)
        .map(percent_decode)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            let host = object.get("add").and_then(Value::as_str).unwrap_or("vmess");
            let port = object
                .get("port")
                .and_then(|value| value.as_str().or_else(|| value.as_u64().map(|_| "")))
                .unwrap_or("");
            if port.is_empty() {
                host.to_string()
            } else {
                format!("{}:{}", host, port)
            }
        });

    let server = object.get("add")?.as_str()?.to_string();
    let port = value_to_u16(object.get("port")?)?;
    let uuid = object.get("id")?.as_str()?.to_string();

    let mut raw = Map::new();
    raw.insert("name".to_string(), Value::String(name.clone()));
    raw.insert("type".to_string(), Value::String("vmess".to_string()));
    raw.insert("server".to_string(), Value::String(server));
    raw.insert("port".to_string(), json!(port));
    raw.insert("uuid".to_string(), Value::String(uuid));
    raw.insert(
        "alterId".to_string(),
        json!(object.get("aid").and_then(value_to_u16).unwrap_or(0)),
    );
    raw.insert(
        "cipher".to_string(),
        Value::String(object.get("scy").and_then(Value::as_str).unwrap_or("auto").to_string()),
    );
    if let Some(network) = object.get("net").and_then(Value::as_str) {
        if !network.is_empty() {
            raw.insert("network".to_string(), Value::String(network.to_string()));
        }
    }
    if object
        .get("tls")
        .and_then(Value::as_str)
        .is_some_and(|value| value.eq_ignore_ascii_case("tls"))
    {
        raw.insert("tls".to_string(), Value::Bool(true));
    }
    if let Some(servername) = object.get("sni").and_then(Value::as_str) {
        if !servername.is_empty() {
            raw.insert(
                "servername".to_string(),
                Value::String(servername.to_string()),
            );
        }
    }
    raw.insert("udp".to_string(), Value::Bool(true));

    Some(node_from_raw(subscription, name, raw))
}

fn node_from_raw(
    subscription: &ProxySubscription,
    name: String,
    raw: Map<String, Value>,
) -> ProxyNode {
    ProxyNode {
        id: stable_node_id(&subscription.id, &name),
        name,
        enabled: true,
        source_subscription_id: Some(subscription.id.clone()),
        raw: Value::Object(raw),
    }
}

fn node_allowed(subscription: &ProxySubscription, name: &str) -> bool {
    let lower_name = name.to_ascii_lowercase();
    let include_ok = subscription.include_keywords.is_empty()
        || subscription
            .include_keywords
            .iter()
            .any(|keyword| lower_name.contains(&keyword.to_ascii_lowercase()));
    let exclude_hit = subscription
        .exclude_keywords
        .iter()
        .any(|keyword| lower_name.contains(&keyword.to_ascii_lowercase()));

    include_ok && !exclude_hit
}

fn stable_node_id(subscription_id: &str, name: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(b"proxy-chain-node-v1");
    hasher.update(subscription_id.as_bytes());
    hasher.update([0]);
    hasher.update(name.as_bytes());
    let digest = hasher.finalize();
    hex::encode(&digest[..16])
}

fn uri_name(url: &reqwest::Url) -> Option<String> {
    url.fragment().map(percent_decode).filter(|name| !name.trim().is_empty())
}

fn query_param(url: &reqwest::Url, key: &str) -> Option<String> {
    url.query_pairs()
        .find(|(candidate, _)| candidate.as_ref() == key)
        .map(|(_, value)| value.to_string())
        .filter(|value| !value.trim().is_empty())
}

fn append_transport_options(raw: &mut Map<String, Value>, url: &reqwest::Url, network: &str) {
    match network {
        "ws" | "websocket" => {
            let mut ws_opts = Map::new();
            if let Some(path) = query_param(url, "path") {
                ws_opts.insert("path".to_string(), Value::String(path));
            }
            if let Some(host) = query_param(url, "host") {
                let mut headers = Map::new();
                headers.insert("Host".to_string(), Value::String(host));
                ws_opts.insert("headers".to_string(), Value::Object(headers));
            }
            if !ws_opts.is_empty() {
                raw.insert("ws-opts".to_string(), Value::Object(ws_opts));
            }
        }
        "grpc" => {
            if let Some(service_name) =
                query_param(url, "serviceName").or_else(|| query_param(url, "service_name"))
            {
                let mut grpc_opts = Map::new();
                grpc_opts.insert(
                    "grpc-service-name".to_string(),
                    Value::String(service_name),
                );
                raw.insert("grpc-opts".to_string(), Value::Object(grpc_opts));
            }
        }
        _ => {}
    }
}

fn parse_shadowsocks_payload(line: &str) -> Option<(String, String, String, u16)> {
    let payload = line.strip_prefix("ss://")?;
    let payload = payload.split('#').next().unwrap_or(payload);
    let payload = payload.split('?').next().unwrap_or(payload);

    if let Some((auth, server)) = payload.rsplit_once('@') {
        let auth = decode_base64_to_string(auth).unwrap_or_else(|| percent_decode(auth));
        let (cipher, password) = split_auth_pair(&auth)?;
        let (host, port) = split_host_port(server)?;
        return Some((cipher, password, host, port));
    }

    let decoded = decode_base64_to_string(payload)?;
    let (auth, server) = decoded.rsplit_once('@')?;
    let (cipher, password) = split_auth_pair(auth)?;
    let (host, port) = split_host_port(server)?;
    Some((cipher, password, host, port))
}

fn split_auth_pair(value: &str) -> Option<(String, String)> {
    let (cipher, password) = value.split_once(':')?;
    let cipher = percent_decode(cipher);
    let password = percent_decode(password);
    if cipher.is_empty() || password.is_empty() {
        None
    } else {
        Some((cipher, password))
    }
}

fn split_host_port(value: &str) -> Option<(String, u16)> {
    let value = value.trim();
    if let Some(rest) = value.strip_prefix('[') {
        let (host, tail) = rest.split_once(']')?;
        let port = tail.strip_prefix(':')?.parse().ok()?;
        return Some((host.to_string(), port));
    }

    let (host, port) = value.rsplit_once(':')?;
    let host = host.trim();
    if host.is_empty() {
        return None;
    }
    Some((host.to_string(), port.parse().ok()?))
}

fn value_to_u16(value: &Value) -> Option<u16> {
    if let Some(value) = value.as_u64() {
        return u16::try_from(value).ok();
    }
    value.as_str()?.parse().ok()
}

fn decode_base64(input: &str) -> Option<Vec<u8>> {
    let compact = input.trim().replace('-', "+").replace('_', "/");
    let padded = pad_base64(&compact);
    general_purpose::STANDARD
        .decode(input.trim())
        .or_else(|_| general_purpose::STANDARD_NO_PAD.decode(input.trim()))
        .or_else(|_| general_purpose::URL_SAFE.decode(input.trim()))
        .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(input.trim()))
        .or_else(|_| general_purpose::STANDARD.decode(padded.as_bytes()))
        .ok()
}

fn decode_base64_to_string(input: &str) -> Option<String> {
    decode_base64(&percent_decode(input)).and_then(|bytes| String::from_utf8(bytes).ok())
}

fn pad_base64(input: &str) -> String {
    let mut value = input.to_string();
    while value.len() % 4 != 0 {
        value.push('=');
    }
    value
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'%' if index + 2 < bytes.len() => {
                if let (Some(high), Some(low)) =
                    (from_hex(bytes[index + 1]), from_hex(bytes[index + 2]))
                {
                    output.push((high << 4) | low);
                    index += 3;
                    continue;
                }
                output.push(bytes[index]);
                index += 1;
            }
            b'+' => {
                output.push(b' ');
                index += 1;
            }
            byte => {
                output.push(byte);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&output).to_string()
}

fn from_hex(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}
