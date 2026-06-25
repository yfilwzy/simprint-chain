//! 账号中心 MCP 工具模块。
//!
//! 让 AI 工具能列出/创建/管理账号，解 simprint_set_environment_accounts 死链。

use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::mcp::{error::McpToolError, registry::ToolEntry, server::McpServer};

// Value 已在 serde_json import

pub fn metadata() -> Vec<ToolEntry> {
    use crate::mcp::registry::ToolCategory;
    vec![
        ToolEntry::new("simprint_list_accounts", "列出账号", "List all accounts (for set_environment_accounts).", ToolCategory::Account),
        ToolEntry::new("simprint_create_account", "创建账号", "Create an account.", ToolCategory::Account),
    ]
}

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<ListAccountsTool>()
        .with_async_tool::<CreateAccountTool>()
        .into_iter()
        .collect()
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EmptyInput {}

#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
pub struct CreateAccountInput {
    pub platform: Option<String>,
    pub username: Option<String>,
    pub password: Option<String>,
    pub remark: Option<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct AccountsOutput {
    pub items: Value,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SimpleResult {
    pub success: bool,
    pub data: Value,
}

struct ListAccountsTool;
struct CreateAccountTool;

impl ToolBase for ListAccountsTool {
    type Parameter = EmptyInput;
    type Output = AccountsOutput;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_list_accounts".into() }
    fn description() -> Option<Cow<'static, str>> { Some("List all accounts. Use account uuid for set_environment_accounts.".into()) }
}

impl AsyncTool<McpServer> for ListAccountsTool {
    async fn invoke(service: &McpServer, _param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let result: Value = service.bridge().proxy_raw("accounts/list", "accounts.list", &json!({})).await?;
        let total = result.get("total").and_then(|v| v.as_i64()).unwrap_or(0);
        let items = result.get("items").cloned().unwrap_or(json!([]));
        Ok(AccountsOutput { items, total })
    }
}

impl ToolBase for CreateAccountTool {
    type Parameter = CreateAccountInput;
    type Output = SimpleResult;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_create_account".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Create an account.".into()) }
}

impl AsyncTool<McpServer> for CreateAccountTool {
    async fn invoke(service: &McpServer, param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let data: Value = service.bridge().proxy_raw("accounts/create", "accounts.create", &param).await?;
        Ok(SimpleResult { success: true, data })
    }
}
