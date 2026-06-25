//! MCP 工具注册表（registry）—— 元数据索引层
//!
//! 借鉴 CLI-Anything 的 registry.json / SKILL.md 设计模式，
//! 为 rmcp 工具提供**统一的元数据索引与目录发现能力**。
//!
//! 设计文档：docs/2026-06-24_重构设计文档/04-MCP增强设计.md
//!
//! # 架构定位（重要）
//! 本模块**不替代** rmcp 原生的工具注册（ToolBase + AsyncTool + ToolRouter）。
//! 现有工具继续用 rmcp 原生 trait 注册到 `tools/mod.rs::all_routes()`。
//! 本模块只负责：
//!   1. 收集所有工具的**元数据**（name/category/description），形成可查询的目录
//!   2. 提供 `list_tools_catalog` / `describe_tool` 元工具，让 MCP 客户端先发现再调用
//!
//! 这样既借鉴了 CLI-Anything 的 registry 模式（catalog 发现），
//! 又不破坏 rmcp 的原生工具集成（避免双 trait 并行的重复与冲突）。

use rmcp::schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// 工具分类（借鉴 CLI-Anything category 矩阵）
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema, PartialEq, Eq, Hash)]
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
    /// 环境增强操作（批量/启动/指纹等）
    EnvironmentExtras,
    /// 系统元工具（catalog/describe，借鉴 cli-hub-meta-skill 自描述发现）
    System,
}

impl ToolCategory {
    /// 分类的人类可读名
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Environment => "environment",
            Self::Proxy => "proxy",
            Self::Workspace => "workspace",
            Self::BrowserKernel => "browser_kernel",
            Self::Tag => "tag",
            Self::Group => "group",
            Self::EnvironmentExtras => "environment_extras",
            Self::System => "system",
        }
    }
}

/// 工具元数据（借鉴 CLI-Anything registry.json 条目）
///
/// 每个工具在注册表中对应一个 `ToolEntry`，承载 name/display_name/description/category。
/// description 采用 SKILL.md 风格的分层描述（概览 / 参数 / 示例 / 限制），提升 LLM 调用准确率。
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct ToolEntry {
    /// 工具唯一标识（与 rmcp ToolBase::name 对齐，如 simprint_list_tags）
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

impl ToolEntry {
    /// 便捷构造
    pub fn new(
        name: impl Into<String>,
        display_name: impl Into<String>,
        description: impl Into<String>,
        category: ToolCategory,
    ) -> Self {
        Self {
            name: name.into(),
            display_name: display_name.into(),
            description: description.into(),
            category,
            version: "1.0".to_string(),
        }
    }
}

/// 工具注册表（借鉴 CLI-Anything registry 注册表）
///
/// 纯元数据索引：收集各模块导出的 `metadata()`，支持目录查询。
/// 不持有工具的可调用句柄（调用仍走 rmcp 原生 ToolBase/AsyncTool）。
pub struct ToolRegistry {
    entries: Vec<ToolEntry>,
}

impl ToolRegistry {
    /// 创建空注册表
    pub fn new() -> Self {
        Self { entries: Vec::new() }
    }

    /// 注册一条元数据
    pub fn register(&mut self, entry: ToolEntry) {
        self.entries.push(entry);
    }

    /// 批量注册
    pub fn register_all(&mut self, entries: impl IntoIterator<Item = ToolEntry>) {
        self.entries.extend(entries);
    }

    /// 元工具用：列出全部工具目录（借鉴 cli-hub-meta-skill 自描述发现）
    ///
    /// 返回所有工具的元数据，供 MCP 客户端先发现再调用。
    pub fn list_catalog(&self) -> &[ToolEntry] {
        &self.entries
    }

    /// 按分类查询（借鉴 cli-hub-matrix 矩阵模式）
    pub fn by_category(&self, cat: &ToolCategory) -> Vec<&ToolEntry> {
        self.entries
            .iter()
            .filter(|e| &e.category == cat)
            .collect()
    }

    /// 按 name 查询（describe_tool 元工具用）
    pub fn describe(&self, name: &str) -> Option<&ToolEntry> {
        self.entries.iter().find(|e| e.name == name)
    }

    /// 工具总数
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// 是否为空
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

impl Default for ToolRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// 构建全局工具注册表（聚合各模块 metadata）
///
/// 各模块在 `tools/*.rs` 导出 `pub fn metadata() -> Vec<ToolEntry>`，
/// 本函数聚合它们 + 元工具自身。
/// 配合 catalog.rs 的 ListCatalogTool / DescribeToolTool 使用。
pub fn build_registry() -> ToolRegistry {
    let mut reg = ToolRegistry::new();

    // 业务工具元数据（各模块导出）
    reg.register_all(crate::mcp::tools::browser_kernels::metadata());
    reg.register_all(crate::mcp::tools::environments::metadata());
    reg.register_all(crate::mcp::tools::environments_extras::metadata());
    reg.register_all(crate::mcp::tools::groups::metadata());
    reg.register_all(crate::mcp::tools::proxies::metadata());
    reg.register_all(crate::mcp::tools::tags::metadata());
    reg.register_all(crate::mcp::tools::workspaces::metadata());

    // 元工具自身（自描述发现）
    reg.register_all(crate::mcp::catalog::metadata());

    reg
}
