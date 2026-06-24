//! MCP 工具注册表（registry）骨架
//!
//! 借鉴 CLI-Anything 的 registry.json / SKILL.md / repl_skin 设计模式，
//! 用纯 Rust 重构 MCP 工具的注册与发现机制。
//!
//! 设计文档：docs/2026-06-24_重构设计文档/04-MCP增强设计.md
//!
//! 本模块为骨架，定义核心 trait 与数据结构。
//! 现有 `tools/` 目录的工具后续逐个适配 `McpTool` trait 后注册到 `ToolRegistry`，
//! 最终 `server.rs::build_service` 改为从 `ToolRegistry::all_routes()` 取 routes。

use rmcp::handler::server::router::tool::ToolRoute;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use crate::mcp::server::McpServer;

/// 工具分类（借鉴 CLI-Anything category 矩阵）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ToolCategory {
    /// 浏览器环境
    Environment,
    /// 代理资源
    Proxy,
    /// 工作区
    Workspace,
    /// 浏览器内核
    BrowserKernel,
    /// 标签
    Tag,
    /// 分组
    Group,
    /// 系统元工具（catalog/describe，借鉴 cli-hub-meta-skill 自描述发现）
    System,
}

/// 工具元数据（借鉴 CLI-Anything registry.json 条目）
///
/// 每个工具在注册表中对应一个 `ToolEntry`，承载 name/display_name/description/category。
/// description 采用 SKILL.md 风格的分层描述（概览 / 参数 / 示例 / 限制），提升 LLM 调用准确率。
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ToolEntry {
    /// 工具唯一标识，MCP 客户端据此调用
    pub name: String,
    /// 展示名称（人类可读）
    pub display_name: String,
    /// SKILL.md 风格的分层描述：概览 / 参数 / 示例 / 限制
    pub description: String,
    /// 分类，支持按域查询（借鉴 cli-hub-matrix 矩阵模式）
    pub category: ToolCategory,
    /// 工具版本
    pub version: String,
}

/// 工具调用会话上下文（借鉴 CLI-Anything utils/sqlite session）
///
/// 承载跨调用的上下文信息（鉴权、本地 API 地址等），
/// 若未来需要"当前工程/最近操作/撤销栈"等有状态信息，在此扩展。
#[derive(Debug, Clone)]
pub struct Session {
    /// 用户 access_token（经 LocalApiBridge 鉴权用）
    pub access_token: Option<String>,
    /// Local API 的 api_key
    pub api_key: String,
    /// Local API 基地址
    pub local_api_base: String,
}

/// MCP 错误归一化（repl_skin 模式：统一错误格式）
///
/// 所有工具的 `invoke` 失败统一归一为此枚举，
/// 避免各工具各自定义错误类型导致的格式不一致。
#[derive(Debug, thiserror::Error, Serialize)]
pub enum McpError {
    #[error("参数无效: {0}")]
    InvalidParams(String),
    #[error("鉴权失败")]
    Unauthorized,
    #[error("资源未找到: {0}")]
    NotFound(String),
    #[error("Local API 调用失败: {0}")]
    LocalApiFailed(String),
    #[error("内部错误: {0}")]
    Internal(String),
}

/// 统一适配 trait（借鉴 repl_skin，所有工具走同一管线）
///
/// 每个工具实现此 trait 后注册到 `ToolRegistry`。
/// 统一管线：参数解析 → 鉴权校验 → 执行 → 结果序列化 → 错误归一化。
///
/// # 生命周期
/// 1. 识别能力：明确工具做什么、输入输出
/// 2. 定义接口：实现 `meta()` 返回 `ToolEntry`
/// 3. 实现适配层：实现 `invoke()`（走 LocalApiBridge）
/// 4. 生成 schema：由 schemars 自动生成参数 JSON Schema
/// 5. 注册入表：在 `build_registry()` 中注册
pub trait McpTool: Send + Sync {
    /// 工具元数据
    fn meta(&self) -> &ToolEntry;

    /// 执行工具调用（统一管线：参数解析→鉴权→执行→序列化→错误归一化）
    fn invoke(
        &self,
        ctx: &Session,
        args: serde_json::Value,
    ) -> impl std::future::Future<Output = Result<serde_json::Value, McpError>> + Send;
}

/// 工具注册表（借鉴 CLI-Anything registry 注册表）
///
/// 替代原 `tools/mod.rs::all_routes()` 的硬编码聚合。
/// 新增工具只需实现 `McpTool` trait 并调用 `register()`，无需改 `all_routes()`。
pub struct ToolRegistry {
    tools: Vec<Box<dyn McpTool>>,
}

impl ToolRegistry {
    /// 创建空注册表
    pub fn new() -> Self {
        Self { tools: Vec::new() }
    }

    /// 注册工具
    pub fn register(&mut self, tool: Box<dyn McpTool>) {
        self.tools.push(tool);
    }

    /// 生成所有 rmcp routes（替代原 all_routes 硬编码）
    ///
    /// 注意：当前为骨架，返回空 Vec。
    /// 正式实现时迭代 `self.tools`，为每个工具构建 `ToolRoute<McpServer>`。
    /// 构建逻辑依赖 rmcp 的 macros + schemars 自动生成 Tool 定义。
    pub fn all_routes(&self) -> Vec<ToolRoute<McpServer>> {
        // TODO: 迭代 self.tools，为每个工具构建 ToolRoute
        // 当前骨架返回空，现有 tools/mod.rs::all_routes() 仍负责实际路由
        Vec::new()
    }

    /// 元工具：列出工具目录（借鉴 cli-hub-meta-skill 自描述发现）
    ///
    /// 返回所有工具的元数据，供 MCP 客户端先发现再调用。
    pub fn list_catalog(&self) -> Vec<ToolEntry> {
        self.tools.iter().map(|t| t.meta().clone()).collect()
    }

    /// 按分类查询（借鉴 cli-hub-matrix 矩阵模式）
    pub fn by_category(&self, cat: &ToolCategory) -> Vec<&dyn McpTool> {
        self.tools
            .iter()
            .filter(|t| &t.meta().category == cat)
            .map(|t| t.as_ref())
            .collect()
    }

    /// 按 name 查询（describe_tool 元工具用）
    pub fn describe(&self, name: &str) -> Option<&dyn McpTool> {
        self.tools
            .iter()
            .find(|t| t.meta().name == name)
            .map(|t| t.as_ref())
    }

    /// 工具总数
    pub fn len(&self) -> usize {
        self.tools.len()
    }

    /// 是否为空
    pub fn is_empty(&self) -> bool {
        self.tools.is_empty()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// 构建注册表（替代 tools/mod.rs::all_routes）
///
/// 现有 7 个工具模块（browser_kernels/environments/environments_extras/groups/proxies/tags/workspaces）
/// 后续逐个适配 `McpTool` trait 后在此函数注册。
/// 元工具（list_tools_catalog / describe_tool）也在此注册。
pub fn build_registry() -> ToolRegistry {
    let mut reg = ToolRegistry::new();

    // TODO: 注册现有 7 模块工具（适配 McpTool trait 后）
    // reg.register(Box::new(builtins::environments::ListEnvironmentsTool));
    // reg.register(Box::new(builtins::environments::CreateEnvironmentTool));
    // ...

    // TODO: 注册元工具（自描述发现）
    // reg.register(Box::new(builtins::meta::ListCatalogTool));
    // reg.register(Box::new(builtins::meta::DescribeToolTool));

    reg
}
