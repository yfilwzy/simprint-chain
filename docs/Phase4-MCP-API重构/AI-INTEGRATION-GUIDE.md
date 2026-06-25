# AI 工具对接指南 —— 用 zcode / Codex / Claude Code 控制 Simprint

> Simprint 破限本地版提供两种 AI 接入方式：**MCP server**（推荐）和 **本地 HTTP API**。
> 启用后，AI 工具可以创建/管理浏览器环境、分组、标签、代理等全部功能。

---

## 前置：在 Simprint 中启用服务

打开 Simprint → 左侧菜单「API & AI」页面：

1. **API 服务控制**：开关启用 → 本地 HTTP API server 在 `http://127.0.0.1:37111` 监听
2. **MCP 服务控制**：开关启用 → MCP server 在 `http://127.0.0.1:37110` 监听

两个开关都需启用（MCP server 内部通过 Local API server 操作数据）。

**API Key**（鉴权用）：`simprint-local-mock-key-v1`

---

## 方式一：MCP server（推荐，Cursor/Claude Code/Codex 原生支持）

MCP（Model Context Protocol）是 AI 工具调用外部能力的标准协议。Simprint 的 MCP server 暴露以下工具：

| 工具类别 | 能力 |
|----------|------|
| environments | 列出/创建/启动/停止/删除/批量操作浏览器环境 |
| environments_extras | 环境的 URL、Cookie、标签、分组管理 |
| groups | 分组 CRUD |
| tags | 标签 CRUD |
| proxies | 代理 CRUD |
| browser_kernels | 浏览器内核列表 |
| workspaces | 工作区列表/切换 |

### Claude Code 配置

在 Claude Code 的 MCP 配置文件（`~/.claude/claude_desktop_config.json` 或项目 `.mcp.json`）中添加：

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

重启 Claude Code 后，输入「列出可用的 simprint 工具」即可验证连接。

### Codex 配置

Codex 的 MCP 配置（`~/.codex/config.json` 或项目 `.codex/mcp.json`）：

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

### zcode 配置

zcode 的 MCP 配置（项目 `.mcp.json` 或全局配置）：

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

### 使用示例

连接成功后，AI 工具可以直接用自然语言操作：

- 「帮我创建 10 个浏览器环境，命名为 测试环境-1 到 测试环境-10」
- 「列出所有环境，按创建时间排序」
-「把环境 X 的代理设置为 ...」
- 「创建一个叫"电商"的分组」
-「启动环境 abc-123」

---

## 方式二：本地 HTTP API（适合脚本/自定义集成）

API server 监听 `http://127.0.0.1:37111`，所有请求需带请求头 `sp-api-key: simprint-local-mock-key-v1`。

### 健康检查

```bash
curl http://127.0.0.1:37111/api/local/health
# 返回 {"status":"running"}
```

### 端点清单

| 模块 | 端点前缀 | 示例 |
|------|----------|------|
| environments | `/api/local/environments/*` | `POST /api/local/environments/list` |
| groups | `/api/local/groups/*` | `POST /api/local/groups/list` |
| tags | `/api/local/tags/*` | `POST /api/local/tags/list` |
| proxies | `/api/local/proxies/*` | `POST /api/local/proxies/list` |
| browser_kernels | `/api/local/browser-kernels/*` | `POST /api/local/browser-kernels/list` |
| workspaces | `/api/local/workspaces/*` | `POST /api/local/workspaces/list` |

### 调用示例

```bash
# 列出环境
curl -X POST http://127.0.0.1:37111/api/local/environments/list \
  -H "sp-api-key: simprint-local-mock-key-v1" \
  -H "Content-Type: application/json" \
  -d '{"page":1,"page_size":20}'

# 创建分组
curl -X POST http://127.0.0.1:37111/api/local/groups/create \
  -H "sp-api-key: simprint-local-mock-key-v1" \
  -H "Content-Type: application/json" \
  -d '{"name":"电商"}'
```

---

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| 开关打不开 | 服务启动失败 | 查看 `D:\Simprint\logs\simprint_app.log` |
| MCP 连接超时 | MCP server 未启动 | 确认开关已启用，检查 37110 端口 |
| API 401 | api_key 错误 | 确认用 `simprint-local-mock-key-v1` |
| 代理链启动失败 | 订阅节点为空 | 点「同步订阅」拉取节点，确认订阅地址有效 |
| 环境启动失败 | 浏览器内核缺失 | 内核需单独下载（见 BUILD-DEPENDENCIES.md） |

---

## 关于 CLI-Anything

用户本地已安装 [CLI-Anything](https://github.com/HKUDS/CLI-Anything) skill。它是把第三方 GUI 软件（Blender/GIMP 等）包装成 CLI 的工具，与 Simprint 的 MCP 能力互补但不重叠。如需在 Simprint 工作区中用 AI 操作其他桌面软件，可独立使用 CLI-Anything skill，无需融入 Simprint 本体。
