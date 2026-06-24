use serde_json::Value;

use crate::core::error::{Error, Result};

use super::api::MihomoApiClient;
use super::generator;
use super::process::RUNTIME;
use super::redact::redact_config;
use super::storage;
use super::subscription::fetch_and_parse_subscription;
use super::types::{
    GeneratedMihomoConfig, MihomoProxyDelayResult, ProxyChainConfig, RuntimeStatus,
    SubscriptionUpdateResult,
};

pub struct ProxyChainService;

impl ProxyChainService {
    pub async fn get_config(redact: bool) -> Result<ProxyChainConfig> {
        let config = storage::load_config().await?;
        Ok(if redact {
            redact_config(&config)
        } else {
            config
        })
    }

    pub async fn save_config(config: ProxyChainConfig, redact: bool) -> Result<ProxyChainConfig> {
        let config = storage::save_config(config).await?;
        Ok(if redact {
            redact_config(&config)
        } else {
            config
        })
    }

    pub async fn reset_config(redact: bool) -> Result<ProxyChainConfig> {
        let config = storage::reset_config().await?;
        Ok(if redact {
            redact_config(&config)
        } else {
            config
        })
    }

    pub async fn update_subscription(subscription_id: String) -> Result<SubscriptionUpdateResult> {
        let mut config = storage::load_config().await?;
        let Some(subscription) = config
            .subscriptions
            .iter()
            .find(|subscription| subscription.id == subscription_id)
            .cloned()
        else {
            return Err(Error::ResourceNotFound);
        };

        let (nodes, result) = fetch_and_parse_subscription(&subscription).await;
        if let Some(target) = config
            .subscriptions
            .iter_mut()
            .find(|subscription| subscription.id == subscription_id)
        {
            if result.error.is_none() && !nodes.is_empty() {
                target.nodes = nodes;
                target.last_updated_at = result.updated_at;
                target.last_error = None;
            } else {
                target.last_error = result.error.clone();
            }
        }
        let _ = storage::save_config(config).await?;
        Ok(result)
    }

    pub async fn update_all_subscriptions() -> Result<Vec<SubscriptionUpdateResult>> {
        let config = storage::load_config().await?;
        let subscription_ids = config
            .subscriptions
            .iter()
            .filter(|subscription| subscription.enabled)
            .map(|subscription| subscription.id.clone())
            .collect::<Vec<_>>();

        let mut results = Vec::new();
        for subscription_id in subscription_ids {
            results.push(Self::update_subscription(subscription_id).await?);
        }
        Ok(results)
    }

    pub async fn generate_mihomo_config(redact: bool) -> Result<GeneratedMihomoConfig> {
        let config = storage::load_config().await?;
        generator::generate_and_write(&config, redact).await
    }

    pub async fn start() -> Result<RuntimeStatus> {
        let config = Self::load_config_with_fresh_nodes().await?;
        RUNTIME.start(&config).await
    }

    pub async fn stop() -> Result<RuntimeStatus> {
        RUNTIME.stop().await
    }

    pub async fn restart() -> Result<RuntimeStatus> {
        let config = Self::load_config_with_fresh_nodes().await?;
        RUNTIME.restart(&config).await
    }

    pub async fn status() -> Result<RuntimeStatus> {
        RUNTIME.status().await
    }

    pub async fn list_mihomo_proxies() -> Result<Value> {
        let config = storage::load_config().await?;
        MihomoApiClient::from_config(&config)?.list_proxies().await
    }

    pub async fn test_mihomo_proxy(
        proxy_name: String,
        timeout_ms: Option<u64>,
        test_url: Option<String>,
    ) -> Result<MihomoProxyDelayResult> {
        let config = storage::load_config().await?;
        let url = test_url
            .filter(|url| !url.trim().is_empty())
            .unwrap_or_else(|| config.mihomo.default_test_url.clone());
        MihomoApiClient::from_config(&config)?
            .delay_proxy(&proxy_name, timeout_ms, &url)
            .await
    }

    pub async fn select_mihomo_proxy(group_name: String, proxy_name: String) -> Result<()> {
        let config = storage::load_config().await?;
        MihomoApiClient::from_config(&config)?
            .select_proxy(&group_name, &proxy_name)
            .await
    }

    pub async fn ensure_local_proxy(_chain_id: &str) -> Result<(String, u16)> {
        let config = storage::load_config().await?;
        let port = config.mihomo.mixed_port.or(config.mihomo.http_port).ok_or_else(|| {
            Error::ProxyConfigInvalid.log_with(
                "链式代理需要启用 mixed_port 或 http_port，浏览器才能通过本地 HTTP 入口接入",
            )
        })?;

        let status = RUNTIME.status().await?;
        if !status.running {
            let config = Self::load_config_with_fresh_nodes().await?;
            let _ = RUNTIME.start(&config).await?;
        }

        Ok(("127.0.0.1".to_string(), port))
    }

    async fn load_config_with_fresh_nodes() -> Result<ProxyChainConfig> {
        let mut config = storage::load_config().await?;
        let refresh_needed = config
            .subscriptions
            .iter()
            .any(|subscription| subscription.enabled && subscription.nodes.is_empty());

        if refresh_needed {
            let _ = Self::update_all_subscriptions().await?;
            config = storage::load_config().await?;
        }

        Ok(config)
    }
}
