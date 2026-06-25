# AI 工具对接指南 —— 用 zcode / Codex / Claude Code 全自动操作 Simprint

> Phase 5 更新：MCP 工具面大幅扩展，现在覆盖 12 个功能域，全部功能可通过自然语言操作。

---

## 前置：启用服务

打开 Simprint → 左侧菜单「API & AI」→ 启用「API 服务控制」+「MCP 服务控制」。
启用后两个服务自动启动（破限版无需远程服务器）：
- **MCP server**：`http://127.0.0.1:37110/mcp`（AI 工具连接此端点）
- **Local API server**：`http://127.0.0.1:37111`（HTTP API，需 `sp-api-key` 头）

**API Key**：首次启动随机生成，持久化在 `D:\Simprint\config\local_api_key.txt`。

---

## 连接配置

### zcode（项目根 `.mcp.json`，本仓库已预置）
```json
{
  "mcpServers": {
    "simprint": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:37110/mcp"
    }
  }
}
```

### Claude Code（`~/.claude/claude_desktop_config.json`）
```json
{
  "mcpServers": {
    "simprint": {
      "url": "http://127.0.0.1:37110/mcp",
      "transport": "http"
    }
  }
}
```

### Codex（`~/.codex/config.json`）
```json
{
  "mcpServers": {
    "simprint": {
      "type": "http",
      "url": "http://127.0.0.1:37110/mcp"
    }
  }
}
```

---

## MCP 工具清单（12 个功能域，55+ 工具）

### 环境管理（核心）
- `simprint_list_environments` / `simprint_get_environment` — 列出/查环境详情
- `simprint_create_environment` — 创建环境（支持完整指纹配置）
- `simprint_start_environment` / `simprint_stop_environment` — 启动/停止
- `simprint_batch_start_environments` / `simprint_batch_stop_environments` — 批量启停
- `simprint_update_environment` / `simprint_delete_environment` — 更新/删除
- `simprint_batch_delete_environments` / `simprint_batch_get_environments`
- `simprint_get_environment_status` / `simprint_get_environment_cdp_endpoint`

### 环境增强（Cookie/URL/标签/代理/账号/分组）
- 回收站：`simprint_list_recycle_bin_environments` / `simprint_restore_environment` / ...
- 绑定：`simprint_set_environment_proxy` / `simprint_set_environment_accounts` / `simprint_assign_environment_tags`
- Cookie/URL：`simprint_list/add/delete/clear_environment_cookies` / `simprint_list/add/delete/clear_environment_urls`
- 分组：`simprint_move_environment_to_group` / `simprint_batch_move_environments_to_group`

### 代理链（机场订阅 + 落地代理）🆕
- `simprint_get_proxy_chain_status` — 查询代理链运行状态
- `simprint_start_proxy_chain` — 启动代理链（需有有效订阅节点）
- `simprint_stop_proxy_chain` — 停止代理链
- `simprint_refresh_proxy_subscriptions` — 刷新所有机场订阅拉取节点
- `simprint_get_proxy_chain_config` — 查询配置（模式/订阅数/落地数）

### 静态代理
- `simprint_list/get/create/update/delete_proxy` / `simprint_batch_delete_proxies`

### 分组 / 标签 / 账号 / 内核 / 工作区
- `simprint_list/create/update/delete_group`
- `simprint_list/create/update/delete_tag`
- `simprint_list_accounts` / `simprint_create_account` 🆕
- `simprint_list_browser_kernels`
- `simprint_list/get/switch_workspace`

### RPA 自动化 🆕
- `simprint_list_rpa_tasks` — 列出 RPA 任务
- `simprint_run_rpa_task` — 运行 RPA 任务
- `simprint_stop_rpa_task` — 停止 RPA 任务

### 数据备份 🆕
- `simprint_get_database_info` — 查询数据库路径/大小
- `simprint_export_database` — 导出数据库到指定路径（参数：`target_path`）

### 元工具（自描述发现）
- `simprint_list_tools_catalog` / `simprint_describe_tool`

---

## 自然语言操作示例

连接成功后，直接用自然语言对 AI 说：

**环境管理：**
-「创建 10 个浏览器环境，命名为 测试-1 到 测试-10，统一指纹 Windows Chrome」
-「列出所有环境，按创建时间排序」
-「启动环境 abc-123」
-「把环境 X 的代理设置为 ...」
-「删除所有已停止的环境」

**代理链：**
-「查询代理链状态」
-「刷新机场订阅获取最新节点」
-「启动代理链」
-「停止代理链」

**数据备份：**
-「查询本地数据库信息」
-「把数据库导出到 D:/backups/simprint-今天.db」

**RPA：**
-「列出所有 RPA 任务」
-「运行 RPA 任务 task-001」

**组合操作（AI 自主编排）：**
-「创建 5 个环境并全部启动」
-「查询代理链状态，如果没启动就刷新订阅后启动」
-「导出数据库备份，然后告诉我备份大小」

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| MCP 连接失败 | 服务未启动 | 确认开关已启用，检查 127.0.0.1:37110 |
| 工具调用 401 | api_key 错误 | 读 `D:\Simprint\config\local_api_key.txt` 获取正确 key |
| 代理链启动失败 | 订阅节点为空 | 用 `refresh_proxy_subscriptions` 刷新，确认订阅地址有效 |
| 环境启动失败 | 浏览器内核缺失 | 内核需单独下载（见 BUILD-DEPENDENCIES.md） |

---

## 验证连接

连接后对 AI 说「列出可用的 simprint 工具」，应返回 55+ 个工具。
或用 `simprint_list_tools_catalog` 元工具查看完整目录。
