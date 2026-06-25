//! 代理链（机场订阅 + 落地代理）MCP 工具模块。
//!
//! 直接调用 ProxyChainService（不经过 Tauri IPC），让 AI 工具能操作
//! 代理链启停、配置、订阅刷新。

use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    mcp::{error::McpToolError, registry::ToolEntry, server::McpServer},
    services::proxy_chain::ProxyChainService,
};

// SubscriptionUpdateResult 由 ProxyChainService::update_all_subscriptions 返回，
// 类型定义在 proxy_chain 的 service pub use 路径，这里用 impl 块的方式避免直接引用。
type SubUpdateItem = crate::services::proxy_chain::types::SubscriptionUpdateResult;

/// 导出工具元数据（供 registry 索引）
pub fn metadata() -> Vec<ToolEntry> {
    use crate::mcp::registry::ToolCategory;
    vec![
        ToolEntry::new("simprint_get_proxy_chain_status", "查询代理链状态", "Get proxy chain running status (Mihomo).", ToolCategory::Proxy),
        ToolEntry::new("simprint_start_proxy_chain", "启动代理链", "Start the proxy chain (Mihomo). Requires valid subscription nodes.", ToolCategory::Proxy),
        ToolEntry::new("simprint_stop_proxy_chain", "停止代理链", "Stop the running proxy chain.", ToolCategory::Proxy),
        ToolEntry::new("simprint_refresh_proxy_subscriptions", "刷新机场订阅", "Update all enabled airport subscriptions to fetch nodes.", ToolCategory::Proxy),
        ToolEntry::new("simprint_get_proxy_chain_config", "查询代理链配置", "Get proxy chain config including mode, subscriptions, landing socks.", ToolCategory::Proxy),
    ]
}

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<GetStatusTool>()
        .with_async_tool::<StartTool>()
        .with_async_tool::<StopTool>()
        .with_async_tool::<RefreshSubscriptionsTool>()
        .with_async_tool::<GetConfigTool>()
        .into_iter()
        .collect()
}

// ============================================================================
// 输入/输出结构
// ============================================================================

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EmptyInput {}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ProxyChainStatusOutput {
    pub running: bool,
    pub pid: Option<u32>,
    pub started_at: Option<String>,
    pub controller: Option<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SimpleResult {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ProxyChainConfigOutput {
    pub mode: String,
    pub subscriptions_count: usize,
    pub enabled_subscriptions: usize,
    pub landing_socks_count: usize,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SubscriptionRefreshOutput {
    pub success: bool,
    pub total_parsed: usize,
    pub details: Vec<SubscriptionDetail>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SubscriptionDetail {
    pub subscription_id: String,
    pub parsed: usize,
    pub error: Option<String>,
}

// ============================================================================
// 工具实现
// ============================================================================

struct GetStatusTool;
struct StartTool;
struct StopTool;
struct RefreshSubscriptionsTool;
struct GetConfigTool;

impl ToolBase for GetStatusTool {
    type Parameter = EmptyInput;
    type Output = ProxyChainStatusOutput;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_get_proxy_chain_status".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Get proxy chain running status (Mihomo).".into()) }
}

impl AsyncTool<McpServer> for GetStatusTool {
    async fn invoke(_service: &McpServer, _param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let status = ProxyChainService::status().await.map_err(map_err)?;
        Ok(ProxyChainStatusOutput {
            running: status.running,
            pid: status.pid,
            started_at: status.started_at.map(|t| t.to_rfc3339()),
            controller: status.controller,
        })
    }
}

impl ToolBase for StartTool {
    type Parameter = EmptyInput;
    type Output = SimpleResult;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_start_proxy_chain".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Start the proxy chain (Mihomo). Requires valid subscription nodes.".into()) }
}

impl AsyncTool<McpServer> for StartTool {
    async fn invoke(_service: &McpServer, _param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let status = ProxyChainService::start().await.map_err(map_err)?;
        let msg = status.controller
            .map(|c| format!("代理链已启动，控制器 {}", c))
            .unwrap_or_else(|| "代理链已启动".to_string());
        Ok(SimpleResult { success: status.running, message: msg })
    }
}

impl ToolBase for StopTool {
    type Parameter = EmptyInput;
    type Output = SimpleResult;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_stop_proxy_chain".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Stop the running proxy chain.".into()) }
}

impl AsyncTool<McpServer> for StopTool {
    async fn invoke(_service: &McpServer, _param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        ProxyChainService::stop().await.map_err(map_err)?;
        Ok(SimpleResult { success: true, message: "代理链已停止".into() })
    }
}

impl ToolBase for RefreshSubscriptionsTool {
    type Parameter = EmptyInput;
    type Output = SubscriptionRefreshOutput;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_refresh_proxy_subscriptions".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Update all enabled airport subscriptions to fetch nodes.".into()) }
}

impl AsyncTool<McpServer> for RefreshSubscriptionsTool {
    async fn invoke(_service: &McpServer, _param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let results: Vec<SubUpdateItem> =
            ProxyChainService::update_all_subscriptions().await.map_err(map_err)?;
        let total_parsed = results.iter().map(|r| r.parsed).sum();
        let details = results
            .into_iter()
            .map(|r| SubscriptionDetail {
                subscription_id: r.subscription_id,
                parsed: r.parsed,
                error: r.error,
            })
            .collect();
        Ok(SubscriptionRefreshOutput { success: true, total_parsed, details })
    }
}

impl ToolBase for GetConfigTool {
    type Parameter = EmptyInput;
    type Output = ProxyChainConfigOutput;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_get_proxy_chain_config".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Get proxy chain config including mode, subscriptions, landing socks.".into()) }
}

impl AsyncTool<McpServer> for GetConfigTool {
    async fn invoke(_service: &McpServer, _param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let config = ProxyChainService::get_config(true).await.map_err(map_err)?;
        Ok(ProxyChainConfigOutput {
            mode: format!("{:?}", config.mode),
            subscriptions_count: config.subscriptions.len(),
            enabled_subscriptions: config.subscriptions.iter().filter(|s| s.enabled).count(),
            landing_socks_count: config.landing_socks.len(),
        })
    }
}

/// 将核心 Error 转换为 MCP 工具错误。
fn map_err(e: crate::core::error::Error) -> McpToolError {
    McpToolError::internal(e.to_string())
}

/// 占位：保留 Value 引用避免未使用 import（tool 实现 _service 未直接用 Value，但未来扩展可能用）
#[allow(dead_code)]
fn _ensure_value_import(_: &Value) {}
