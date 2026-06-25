//! MCP 元工具：工具目录发现（catalog）
//!
//! 借鉴 CLI-Anything 的 cli-hub-meta-skill 自描述发现模式，
//! 提供 list_tools_catalog / describe_tool 两个元工具，
//! 让 MCP 客户端能先发现全部工具的元数据，再按需调用。
//!
//! 这两个元工具本身用 rmcp 原生 ToolBase + AsyncTool 注册，
//! 读取 `registry::build_registry()` 构建的全局目录快照。

use std::borrow::Cow;
use std::sync::OnceLock;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};

use crate::mcp::{error::McpToolError, registry::ToolEntry, server::McpServer};

/// 全局工具目录（OnceLock 保证只构建一次）
static CATALOG: OnceLock<Vec<ToolEntry>> = OnceLock::new();

/// 取全局目录快照（首次调用时构建）
fn catalog() -> &'static [ToolEntry] {
    CATALOG.get_or_init(|| crate::mcp::registry::build_registry().list_catalog().to_vec())
}

/// 导出本模块元工具的元数据（供 registry 索引，避免遗漏自身）
pub fn metadata() -> Vec<ToolEntry> {
    use crate::mcp::registry::ToolCategory;
    vec![
        ToolEntry::new(
            "simprint_list_tools_catalog",
            "列出工具目录",
            "List all available Simprint MCP tools with their name, category and description. Call this first to discover capabilities before invoking specific tools.",
            ToolCategory::System,
        ),
        ToolEntry::new(
            "simprint_describe_tool",
            "描述单个工具",
            "Describe a single Simprint MCP tool by its exact name. Returns full metadata including category and description.",
            ToolCategory::System,
        ),
    ]
}

/// rmcp 路由注册（两个元工具）
pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<ListToolsCatalogTool>()
        .with_async_tool::<DescribeToolTool>()
        .into_iter()
        .collect()
}

// ---------- 元工具 1：列出全部工具目录 ----------

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ListToolsCatalogInput {
    /// 可选：按分类过滤（environment/proxy/workspace/tag/group/browser_kernel/environment_extras/system）
    pub category: Option<String>,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ToolsCatalogOutput {
    pub count: usize,
    pub tools: Vec<ToolEntry>,
}

struct ListToolsCatalogTool;

impl ToolBase for ListToolsCatalogTool {
    type Parameter = ListToolsCatalogInput;
    type Output = ToolsCatalogOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_list_tools_catalog".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("List all available Simprint MCP tools with their name, category and description. Call this first to discover capabilities.".into())
    }
}

impl AsyncTool<McpServer> for ListToolsCatalogTool {
    async fn invoke(
        _service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let all = catalog();
        let tools: Vec<ToolEntry> = match param.category.as_deref() {
            Some(cat) if !cat.trim().is_empty() => all
                .iter()
                .filter(|e| e.category.as_str() == cat.trim())
                .cloned()
                .collect(),
            _ => all.to_vec(),
        };
        let count = tools.len();
        Ok(ToolsCatalogOutput { count, tools })
    }
}

// ---------- 元工具 2：按 name 描述单个工具 ----------

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct DescribeToolInput {
    /// 工具的完整名称（如 simprint_list_tags）
    pub name: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct DescribeToolOutput {
    pub found: bool,
    pub tool: Option<ToolEntry>,
}

struct DescribeToolTool;

impl ToolBase for DescribeToolTool {
    type Parameter = DescribeToolInput;
    type Output = DescribeToolOutput;
    type Error = McpToolError;

    fn name() -> Cow<'static, str> {
        "simprint_describe_tool".into()
    }

    fn description() -> Option<Cow<'static, str>> {
        Some("Describe a single Simprint MCP tool by its exact name. Returns full metadata.".into())
    }
}

impl AsyncTool<McpServer> for DescribeToolTool {
    async fn invoke(
        _service: &McpServer,
        param: Self::Parameter,
    ) -> Result<Self::Output, Self::Error> {
        let name = param.name.trim();
        if name.is_empty() {
            return Err(McpToolError::invalid_params("name is required"));
        }
        let tool = catalog().iter().find(|e| e.name == name).cloned();
        let found = tool.is_some();
        Ok(DescribeToolOutput { found, tool })
    }
}
