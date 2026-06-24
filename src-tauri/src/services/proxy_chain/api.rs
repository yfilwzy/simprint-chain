use serde_json::{Value, json};

use crate::core::error::Result;

use super::types::{MihomoProxyDelayResult, ProxyChainConfig};

pub struct MihomoApiClient {
    base_url: String,
    secret: Option<String>,
    client: reqwest::Client,
}

impl MihomoApiClient {
    pub fn from_config(config: &ProxyChainConfig) -> Result<Self> {
        let base_url = normalize_controller_url(&config.mihomo.external_controller)?;
        let secret = config
            .mihomo
            .external_controller_secret
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let client =
            reqwest::Client::builder().timeout(std::time::Duration::from_secs(15)).build()?;

        Ok(Self {
            base_url,
            secret,
            client,
        })
    }

    pub async fn list_proxies(&self) -> Result<Value> {
        let response = self.authorize(self.client.get(self.url("/proxies"))).send().await?;
        parse_json_response(response).await
    }

    pub async fn delay_proxy(
        &self,
        proxy_name: &str,
        timeout_ms: Option<u64>,
        test_url: &str,
    ) -> Result<MihomoProxyDelayResult> {
        let endpoint = format!("/proxies/{}/delay", percent_encode(proxy_name));
        let timeout = timeout_ms.unwrap_or(5000).to_string();
        let response = self
            .authorize(self.client.get(self.url(&endpoint)))
            .query(&[("timeout", timeout), ("url", test_url.to_string())])
            .send()
            .await;

        let response = match response {
            Ok(response) => response,
            Err(error) => {
                return Ok(MihomoProxyDelayResult {
                    name: proxy_name.to_string(),
                    success: false,
                    delay_ms: None,
                    error: Some(error.to_string()),
                });
            }
        };

        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        if !status.is_success() {
            return Ok(MihomoProxyDelayResult {
                name: proxy_name.to_string(),
                success: false,
                delay_ms: None,
                error: Some(if body.trim().is_empty() {
                    format!("HTTP {}", status)
                } else {
                    body
                }),
            });
        }

        let value: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
        let delay = value.get("delay").and_then(Value::as_u64);
        Ok(MihomoProxyDelayResult {
            name: proxy_name.to_string(),
            success: delay.is_some(),
            delay_ms: delay,
            error: if delay.is_none() {
                Some("Mihomo 响应中缺少 delay 字段".to_string())
            } else {
                None
            },
        })
    }

    pub async fn select_proxy(&self, group_name: &str, proxy_name: &str) -> Result<()> {
        let endpoint = format!("/proxies/{}", percent_encode(group_name));
        let response = self
            .authorize(self.client.put(self.url(&endpoint)))
            .json(&json!({ "name": proxy_name }))
            .send()
            .await?;
        ensure_success(response).await
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    fn authorize(&self, request: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        if let Some(secret) = self.secret.as_deref() {
            request.bearer_auth(secret)
        } else {
            request
        }
    }
}

fn normalize_controller_url(controller: &str) -> Result<String> {
    let trimmed = controller.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Mihomo external-controller 未配置".into());
    }

    let value = if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        trimmed.to_string()
    } else {
        format!("http://{}", trimmed)
    };
    reqwest::Url::parse(&value).map_err(|error| format!("Mihomo API 地址无效: {}", error))?;
    Ok(value)
}

async fn parse_json_response(response: reqwest::Response) -> Result<Value> {
    let status = response.status();
    let body = response.text().await?;
    if !status.is_success() {
        return Err(format!("Mihomo API 请求失败: HTTP {}, {}", status, body).into());
    }
    serde_json::from_str(&body).map_err(Into::into)
}

async fn ensure_success(response: reqwest::Response) -> Result<()> {
    let status = response.status();
    if status.is_success() {
        return Ok(());
    }
    let body = response.text().await.unwrap_or_default();
    Err(format!("Mihomo API 请求失败: HTTP {}, {}", status, body).into())
}

fn percent_encode(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.as_bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            encoded.push(char::from(*byte));
        } else {
            encoded.push_str(&format!("%{:02X}", byte));
        }
    }
    encoded
}
