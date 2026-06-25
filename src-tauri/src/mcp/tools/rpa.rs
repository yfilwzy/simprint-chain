//! RPA 工作流 MCP 工具模块。
//!
//! 让 AI 工具能列出/创建/运行/停止 RPA 自动化任务流。

use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::mcp::{error::McpToolError, registry::ToolEntry, server::McpServer};

pub fn metadata() -> Vec<ToolEntry> {
    use crate::mcp::registry::ToolCategory;
    vec![
        ToolEntry::new("simprint_list_rpa_tasks", "列出RPA任务", "List all RPA workflow tasks.", ToolCategory::Rpa),
        ToolEntry::new("simprint_run_rpa_task", "运行RPA任务", "Run an RPA task by id.", ToolCategory::Rpa),
        ToolEntry::new("simprint_stop_rpa_task", "停止RPA任务", "Stop a running RPA task.", ToolCategory::Rpa),
    ]
}

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<ListTasksTool>()
        .with_async_tool::<RunTaskTool>()
        .with_async_tool::<StopTaskTool>()
        .into_iter()
        .collect()
}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EmptyInput {}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct TaskIdInput {
    pub task_id: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct TasksOutput {
    pub items: Value,
    pub total: i64,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct SimpleResult {
    pub success: bool,
    pub message: String,
}

struct ListTasksTool;
struct RunTaskTool;
struct StopTaskTool;

impl ToolBase for ListTasksTool {
    type Parameter = EmptyInput;
    type Output = TasksOutput;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_list_rpa_tasks".into() }
    fn description() -> Option<Cow<'static, str>> { Some("List all RPA workflow tasks.".into()) }
}

impl AsyncTool<McpServer> for ListTasksTool {
    async fn invoke(service: &McpServer, _param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let result: Value = service.bridge().proxy_raw("rpa/tasks", "rpa.list", &json!({})).await?;
        let total = result.get("total").and_then(|v| v.as_i64()).unwrap_or(0);
        let items = result.get("items").cloned().unwrap_or(json!([]));
        Ok(TasksOutput { items, total })
    }
}

impl ToolBase for RunTaskTool {
    type Parameter = TaskIdInput;
    type Output = SimpleResult;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_run_rpa_task".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Run an RPA task by id.".into()) }
}

impl AsyncTool<McpServer> for RunTaskTool {
    async fn invoke(service: &McpServer, param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let _: Value = service.bridge().proxy_raw("rpa/tasks/run", "rpa.run", &json!({ "task_id": param.task_id })).await?;
        Ok(SimpleResult { success: true, message: format!("RPA 任务 {} 已启动", param.task_id) })
    }
}

impl ToolBase for StopTaskTool {
    type Parameter = TaskIdInput;
    type Output = SimpleResult;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_stop_rpa_task".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Stop a running RPA task.".into()) }
}

impl AsyncTool<McpServer> for StopTaskTool {
    async fn invoke(service: &McpServer, param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let _: Value = service.bridge().proxy_raw("rpa/tasks/stop", "rpa.stop", &json!({ "task_id": param.task_id })).await?;
        Ok(SimpleResult { success: true, message: format!("RPA 任务 {} 已停止", param.task_id) })
    }
}
