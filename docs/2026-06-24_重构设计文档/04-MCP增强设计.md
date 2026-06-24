# 04 - MCP 增强设计

> 目标：参考 CLI-Anything 设计模式，用纯 Rust 重构 MCP 工具注册表架构，提升工具暴露的规范性与可扩展性

---

## 一、现状分析

### 1.1 当前 MCP 实现
基于 `rmcp 1.2.0`（features: server/macros/schemars/transport-streamable-http-server）。

**命令层** `src-tauri/src/commands/mcp.rs`（5 命令）：`get_mcp_config` / `update_mcp_config` / `start_mcp_runtime` / `reload_mcp_runtime` / `stop_mcp_runtime`

**核心层** `src-tauri/src/mcp/`：
```
mcp/
├── server.rs       # McpServer(ServerHandler) + spawn_mcp_server(axum + StreamableHttpService)
├── manager.rs      # McpManager：启动前获取 api_key，健康检查轮询
├── bridge.rs       # LocalApiBridge：MCP 工具调用桥接到 Local API（带鉴权）
├── config.rs       # McpConfig{enabled}，DEFAULT_MCP_PORT=37110，存 tauri-plugin-store
├── error.rs
└── tools/
    ├── mod.rs      # all_routes() 硬编码聚合 7 模块
    ├── browser_kernels.rs
    ├── environments.rs
    ├── environments_extras.rs   # 31K，最大
    ├── groups.rs
    ├── proxies.rs
    ├── tags.rs
    └── workspaces.rs
```

**传输层**：streamable-http-server，endpoint `http://127.0.0.1:{port}/mcp`

### 1.2 当前痛点
1. **硬编码聚合**：`tools/mod.rs::all_routes()` 手动 extend 7 个模块，新增工具须改此函数
2. **无元数据描述**：工具缺乏 category/schema 的统一元数据管理
3. **无自描述发现**：MCP 客户端无法先发现工具目录再调用
4. **样板代码重复**：每个工具各自处理参数解析/鉴权/错误归一化

## 二、CLI-Anything 借鉴映射

CLI-Anything（HKUDS/CLI-Anything）全仓 2539 文件仅 1 个提及 MCP，其价值在**设计模式**而非代码。用户选择"只增强 Simprint 自身能力"，故采用纯 Rust 重写模式。

| CLI-Anything 设计点 | 借鉴价值 | 映射到 rmcp 的实现 |
|---------------------|---------|-------------------|
| **registry.json 注册表** | 工具元数据集中管理、可枚举 | `ToolEntry` 结构 + `ToolRegistry`，运行时迭代生成 routes |
| **SKILL.md 机器可读规范** | 工具能力结构化描述，提升 LLM 调用准确率 | rmcp macros + schemars 自动生成 JSON Schema + 分层 description |
| **repl_skin 统一适配层** | 所有工具走同一交互管线 | `McpTool` trait：参数解析→鉴权→执行→序列化→错误归一化 |
| **category 分类矩阵** | 按域分组，避免单一大列表 | `ToolEntry.category` 字段 + `by_category()` 查询 |
| **meta-skill 自描述发现** | 教 Agent 查询目录 | 元工具 `list_tools_catalog` / `describe_tool` |
| **7 阶段 harness SOP** | 新增工具的规范化流程 | Simprint 内部"新增 MCP tool"流程模板 |

## 三、目标架构

### 3.1 核心数据结构

```rust
// src-tauri/src/mcp/registry/mod.rs

use rmcp::handler::server::router::tool::ToolRoute;
use rmcp::model::Tool;
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 工具分类（借鉴 CLI-Anything category 矩阵）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ToolCategory {
    Environment,    // 浏览器环境
    Proxy,          // 代理资源
    Workspace,      // 工作区
    BrowserKernel,  // 浏览器内核
    Tag,            // 标签
    Group,          // 分组
    System,         // 系统元工具（catalog/describe）
}

/// 工具元数据（借鉴 CLI-Anything registry.json 条目）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolEntry {
    pub name: String,
    pub display_name: String,
    /// SKILL.md 风格的分层描述：概览 / 参数 / 示例 / 限制
    pub description: String,
    pub category: ToolCategory,
    pub version: String,
}

/// 工具调用会话上下文（借鉴 CLI-Anything utils/sqlite session）
pub struct Session {
    pub access_token: Option<String>,
    pub api_key: String,
    pub local_api_base: String,
    // 可扩展：当前工程、最近操作、撤销栈等有状态上下文
}

/// 统一适配 trait（借鉴 repl_skin，所有工具走同一管线）
#[async_trait::async_trait]
pub trait McpTool: Send + Sync {
    /// 工具元数据
    fn meta(&self) -> &ToolEntry;

    /// 执行工具调用（统一管线：参数解析→鉴权→执行→序列化→错误归一化）
    async fn invoke(&self, ctx: &Session, args: serde_json::Value)
        -> Result<serde_json::Value, McpError>;

    /// 生成 MCP Tool 定义（rmcp Tool，含 schemars 自动生成的 JSON Schema）
    fn to_tool(&self) -> Tool {
        // 由 rmcp macros + schemars 生成
        unimplemented!()
    }
}

/// MCP 错误归一化（repl_skin 模式：统一错误格式）
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
```

### 3.2 注册表

```rust
// src-tauri/src/mcp/registry/registry.rs

pub struct ToolRegistry {
    tools: Vec<Box<dyn McpTool>>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self { tools: Vec::new() }
    }

    /// 注册工具（新增工具只需实现 McpTool trait 并注册）
    pub fn register(&mut self, tool: Box<dyn McpTool>) {
        self.tools.push(tool);
    }

    /// 生成所有 rmcp routes（替代原 all_routes 硬编码）
    pub fn all_routes(&self) -> Vec<ToolRoute<McpServer>> {
        self.tools.iter()
            .map(|t| build_route(t.as_ref()))
            .collect()
    }

    /// 元工具：列出工具目录（借鉴 cli-hub-meta-skill 自描述发现）
    pub fn list_catalog(&self) -> Vec<ToolEntry> {
        self.tools.iter().map(|t| t.meta().clone()).collect()
    }

    /// 按分类查询（借鉴 cli-hub-matrix 矩阵模式）
    pub fn by_category(&self, cat: ToolCategory) -> Vec<&dyn McpTool> {
        self.tools.iter()
            .filter(|t| t.meta().category == cat)
            .map(|t| t.as_ref())
            .collect()
    }

    /// 按 name 查询（describe_tool 元工具用）
    pub fn describe(&self, name: &str) -> Option<&dyn McpTool> {
        self.tools.iter()
            .find(|t| t.meta().name == name)
            .map(|t| t.as_ref())
    }
}
```

### 3.3 工具实现示例（现有 environments 适配）

```rust
// src-tauri/src/mcp/registry/builtins/environments.rs

pub struct ListEnvironmentsTool;

#[async_trait::async_trait]
impl McpTool for ListEnvironmentsTool {
    fn meta(&self) -> &ToolEntry {
        &ToolEntry {
            name: "list_environments".into(),
            display_name: "列出浏览器环境".into(),
            description: "列出当前用户的所有浏览器工作环境。\n\n## 参数\n- limit: 可选，返回数量上限\n\n## 示例\nlist_environments(limit=10)".into(),
            category: ToolCategory::Environment,
            version: "1.0".into(),
        }
    }

    async fn invoke(&self, ctx: &Session, args: serde_json::Value)
        -> Result<serde_json::Value, McpError>
    {
        // 参数解析（统一管线第一步）
        let limit = args.get("limit")
            .and_then(|v| v.as_u64())
            .unwrap_or(50);

        // 走 LocalApiBridge（保持现有桥接机制）
        let result = LocalApiBridge::new(ctx)
            .get("environments", limit)
            .await
            .map_err(|e| McpError::LocalApiFailed(e.to_string()))?;

        // 序列化（统一管线最后一步）
        Ok(result)
    }
}
```

### 3.4 元工具实现（自描述发现）

```rust
// src-tauri/src/mcp/registry/builtins/meta.rs

pub struct ListCatalogTool { registry: Arc<ToolRegistry> }
pub struct DescribeToolTool { registry: Arc<ToolRegistry> }

// list_catalog：返回所有工具的元数据目录
// describe_tool：按 name 返回单个工具的详细规格（含 JSON Schema）

impl McpTool for ListCatalogTool {
    fn meta(&self) -> &ToolEntry {
        &ToolEntry {
            name: "list_tools_catalog".into(),
            display_name: "列出工具目录".into(),
            description: "发现所有可用的 MCP 工具，返回名称、分类、描述。先调用此工具了解能力，再按需调用具体工具。".into(),
            category: ToolCategory::System,
            version: "1.0".into(),
        }
    }
    async fn invoke(&self, _ctx: &Session, _args: serde_json::Value)
        -> Result<serde_json::Value, McpError>
    {
        Ok(serde_json::to_value(self.registry.list_catalog()).unwrap())
    }
}
```

### 3.5 注册表初始化（替代 tools/mod.rs::all_routes）

```rust
// src-tauri/src/mcp/registry/mod.rs

pub fn build_registry() -> ToolRegistry {
    let mut reg = ToolRegistry::new();

    // 现有 7 模块逐个适配 McpTool trait 后注册
    reg.register(Box::new(builtins::environments::ListEnvironmentsTool));
    reg.register(Box::new(builtins::environments::CreateEnvironmentTool));
    // ... environments_extras / proxies / groups / tags / workspaces / browser_kernels

    // 元工具（自描述发现）
    let arc = Arc::new(reg);
    // 注意：元工具需访问 registry 自身，用 Arc 共享
    // arc.register(Box::new(meta::ListCatalogTool { registry: arc.clone() }));

    // 最终 server.rs 的 build_service 改为：
    // McpRouter::new(server).with_tools(registry.all_routes())

    *arc  // 返回（实际实现需调整所有权，此处示意）
}
```

## 四、迁移路径

### 阶段 1：建立 registry 骨架（不破坏现有）
- 新建 `src-tauri/src/mcp/registry/`（mod.rs / registry.rs / error.rs）
- 定义 ToolEntry / McpTool trait / ToolRegistry
- 不动现有 `tools/` 目录

### 阶段 2：逐模块适配
- 每个现有工具（environments/proxies/...）实现 McpTool trait
- 包成 builtins 模块注册到 ToolRegistry
- 对照原 `tools/*.rs` 逐函数迁移，确保行为一致

### 阶段 3：切换 all_routes
- `server.rs::build_service` 改为从 `ToolRegistry::all_routes()` 取 routes
- 原 `tools/mod.rs::all_routes()` 标记 deprecated

### 阶段 4：增加元工具
- 注册 list_tools_catalog / describe_tool
- 测试 MCP 客户端能否先发现再调用

### 阶段 5：扩展能力（可选）
- category 分组查询
- 有状态 session（跨调用上下文）
- 动态注册（插件热加载，若需要）

## 五、新增工具规范（借鉴 HARNESS.md SOP）

新增一个 MCP 工具的标准流程：

1. **识别能力**：明确工具做什么、输入输出
2. **定义接口**：写 ToolEntry（name/display_name/description/category）
3. **实现适配层**：实现 McpTool trait 的 invoke（走 LocalApiBridge）
4. **生成 schema**：用 schemars 自动生成参数 JSON Schema
5. **测试**：单元测试 invoke 逻辑 + 集成测试 LocalApiBridge 调用
6. **写文档**：description 用 SKILL.md 风格分层描述（含示例）
7. **注册入表**：在 build_registry() 中注册

## 六、验证标准

- [ ] registry 骨架编译通过
- [ ] 现有 7 模块工具全部适配 McpTool trait，行为与原实现一致
- [ ] all_routes 从 ToolRegistry 取，rmcp server 正常启动
- [ ] list_tools_catalog 元工具返回完整工具目录
- [ ] describe_tool 元工具返回单工具详细规格
- [ ] by_category 分类查询可用
- [ ] 新增工具只需实现 trait + 注册，无需改 all_routes
- [ ] MCP 客户端（如 Claude）能发现并调用工具
- [ ] cargo test 全绿
