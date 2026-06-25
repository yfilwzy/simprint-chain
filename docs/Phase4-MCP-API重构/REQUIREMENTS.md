# Phase 4 —— MCP/API 服务深度重构 + 机场订阅修复 + AI 工具全开放

> 日期：2026-06-25
> 前置：Phase 1（WebView2Loader 修复）、Phase 2（破限本地化）、Phase 3（功能增强）
> 本阶段目标：彻底修复 API 服务控制 + MCP 服务控制两个开关，修复机场订阅，让全部软件功能通过 MCP/API 开放给 zcode/codex/Claude Code 等 AI 工具。

---

## 一、三个根因（深度侦察铁证）

### 根因 A：API 服务控制开关打不开

双层失败，均源于破限本地化不彻底：

1. **前端第一动作打未 mock 端点**：`useApiService.setEnabled` 第一步调 `post('local-api/update')`，但 `local_interceptor` 只 mock 了 `local-api/get`，`local-api/update` 未 mock → fallthrough 打远程失败 → 开关弹回。证据：`useApiService.ts:66`、`local_interceptor/mod.rs:103`。

2. **manager 绕过拦截器**：`start_local_api_runtime` → `LocalApiManager::refresh_from_server`（`local_api/manager/runtime.rs:29`）直接调 `main_server_client.post("local-api/get")`，**绕过 `local_interceptor`**（拦截器只接入了 `http_post` 命令和 MCP bridge）→ 远程不可达 → 错误被 `return Ok(())` 静默吞掉 → server 永不起。证据：`runtime.rs:29-34`。

### 根因 B：MCP 服务控制开关打不开

`McpManager::fetch_local_api_runtime_config`（`mcp/manager.rs:104`）同样直接调 `main_server_client.post("local-api/get")`，**绕过拦截器**。Phase 3 的 `local-api/get` mock 对 MCP 启动链路无效。`api_key` 永远拿不到 → `start_with_config` 返回 Err → 开关弹回。

### 根因 C：机场订阅没生效 + 逻辑奇怪

1. **订阅 URL 重定向死循环**（实测）：`feed1.chitanda-eru.com` → 301 → `palm1.chika-fujiwara.com` → 301 → 自身（无限循环）。reqwest 默认重定向溢出 → `[020401] NetworkRequestFailed` → 节点为 0 → `validate_chain_inventory` 报错 → 代理链不启动。
2. **错误被静默吞掉**：`service.rs:165` `let _ = Self::update_all_subscriptions().await?;` —— `?` 返回错误却被 `let _` 丢弃，UI 只看到笼统「启动失败」。
3. **UA 未设默认值**：`subscription.rs:49` 订阅请求未设默认 UA，很多机场默认 UA 才返回 yaml/base64。
4. **UI 不显示 last_error**：`proxy-chain-panel.tsx` 完全不展示订阅的 `last_error` 字段。

---

## 二、CLI-Anything 评估结论

**融合价值：低。不融入 Simprint 本体。**

- CLI-Anything（HKUDS，43.7k stars）是"把第三方 GUI 软件（Blender/GIMP/LibreOffice）包装成 Click CLI 给 AI"，与"开放 Simprint 自身功能给 AI"是两个问题域。
- 它输出 Python CLI，不是 MCP server，融入需额外开发桥接层，投入产出比低。
- Simprint 自带 MCP server（暴露环境/分组/标签/代理工具），修好开关即满足需求。
- 用户本地已装 cli-anything skill，作为独立可选能力保留。

---

## 三、核心修复策略

### 策略 1：MainServerRequestClient 层全局拦截（根治 A + B）

在 `infrastructure/main_server/client.rs` 的 `post` 等方法前置 `local_interceptor::try_intercept`，命中即短路返回。一次性根治所有 manager 内部调用绕过拦截器的问题。

### 策略 2：补全 local-api/update 等端点 mock

`local_interceptor` 新增 `local-api/update`、`local-api/reset-api-key` 分支，回显 mock 配置。

### 策略 3：机场订阅健壮性 + 错误透传

- `subscription.rs` 设默认 UA（`clash-verge/v1.0`）+ redirect policy + 重试
- `service.rs` 错误透传，不再静默吞错
- 前端 UI 显示订阅 `last_error`

### 策略 4：API/MCP server 鉴权加强

- auth 中间件校验 `sp-api-key` 值与 config.api_key 相等（当前只校验存在性）
- 文档说明 AI 工具连接方式（zcode/codex/Claude Code）

---

## 四、20 条验收标准

### API 服务控制（5 条）
- A1. API 开关启用后，本地 HTTP API server 在 127.0.0.1:37111 监听（netstat 验证）
- A2. `/api/local/health` 返回 200 + `{"status":"running"}`
- A3. 鉴权：无 sp-api-key 头返回 401，正确 key 返回 200，错误 key 返回 401
- A4. API 开关关闭后端口释放，UI 同步显示关闭
- A5. 暴露 ≥6 类端点（workspaces/environments/groups/tags/proxies/browser_kernels）

### MCP 服务控制（5 条）
- M1. MCP 开关启用后，MCP server 在 127.0.0.1:37110 监听
- M2. MCP `/health` 返回 200
- M3. MCP `/mcp` 响应 StreamableHttp（rmcp 协议握手）
- M4. 暴露工具清单含 environments/groups/tags/proxies（≥4 类）
- M5. MCP 工具执行能读本地 SQLite（list_environments 返回本地环境数据）

### 机场订阅与代理（5 条）
- P1. 订阅请求设默认 UA（提高机场兼容性）
- P2. 订阅失败时 UI 展示具体 last_error（不再静默吞错）
- P3. 代理链启动失败时错误信息含订阅状态（哪些失败、节点数）
- P4. 代理中心两种模式（直连/落地链）正确保存切换
- P5. mihomo 二进制能被正确找到并启动

### 架构与安全（3 条）
- S1. MainServerRequestClient 全局拦截生效（manager 内部调用也命中本地端点）
- S2. 仓库零凭据泄露（grep token/密码/host 全 0 命中）
- S3. cargo check + pnpm build:production 双通过

### 端到端（2 条）
- E1. release exe 启动后主窗口显示，D 盘数据生成
- E2. AI 工具对接文档完整（zcode/codex/Claude Code 三种连接方式）
