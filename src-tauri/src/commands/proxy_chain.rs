//! 链式代理命令
//!
//! 命令层只做参数适配；业务逻辑在 services::proxy_chain。

use crate::core::error::Result;
use crate::services::proxy_chain::{
    GeneratedMihomoConfig, MihomoProxyDelayResult, ProxyChainConfig, ProxyChainService,
    RuntimeStatus, SubscriptionUpdateResult,
};
use serde_json::Value;

fn redact_or_default(redact: Option<bool>) -> bool {
    redact.unwrap_or(true)
}

#[tauri::command]
pub async fn proxy_chain_get_config(redact: Option<bool>) -> Result<ProxyChainConfig> {
    ProxyChainService::get_config(redact_or_default(redact)).await
}

#[tauri::command]
pub async fn proxy_chain_save_config(
    config: ProxyChainConfig,
    redact: Option<bool>,
) -> Result<ProxyChainConfig> {
    ProxyChainService::save_config(config, redact_or_default(redact)).await
}

#[tauri::command]
pub async fn proxy_chain_reset_config(redact: Option<bool>) -> Result<ProxyChainConfig> {
    ProxyChainService::reset_config(redact_or_default(redact)).await
}

#[tauri::command]
pub async fn proxy_chain_update_subscription(
    subscription_id: String,
) -> Result<SubscriptionUpdateResult> {
    ProxyChainService::update_subscription(subscription_id).await
}

#[tauri::command]
pub async fn proxy_chain_update_all_subscriptions() -> Result<Vec<SubscriptionUpdateResult>> {
    ProxyChainService::update_all_subscriptions().await
}

#[tauri::command]
pub async fn proxy_chain_generate_mihomo_config(
    redact: Option<bool>,
) -> Result<GeneratedMihomoConfig> {
    ProxyChainService::generate_mihomo_config(redact_or_default(redact)).await
}

#[tauri::command]
pub async fn proxy_chain_start() -> Result<RuntimeStatus> {
    ProxyChainService::start().await
}

#[tauri::command]
pub async fn proxy_chain_stop() -> Result<RuntimeStatus> {
    ProxyChainService::stop().await
}

#[tauri::command]
pub async fn proxy_chain_restart() -> Result<RuntimeStatus> {
    ProxyChainService::restart().await
}

#[tauri::command]
pub async fn proxy_chain_status() -> Result<RuntimeStatus> {
    ProxyChainService::status().await
}

#[tauri::command]
pub async fn proxy_chain_list_mihomo_proxies() -> Result<Value> {
    ProxyChainService::list_mihomo_proxies().await
}

#[tauri::command]
pub async fn proxy_chain_test_mihomo_proxy(
    proxy_name: String,
    timeout_ms: Option<u64>,
    test_url: Option<String>,
) -> Result<MihomoProxyDelayResult> {
    ProxyChainService::test_mihomo_proxy(proxy_name, timeout_ms, test_url).await
}

#[tauri::command]
pub async fn proxy_chain_select_mihomo_proxy(group_name: String, proxy_name: String) -> Result<()> {
    ProxyChainService::select_mihomo_proxy(group_name, proxy_name).await
}
