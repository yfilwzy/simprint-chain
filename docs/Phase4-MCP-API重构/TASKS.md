# Phase 4 任务拆解（15 个任务，5 个波次）

> 依据：REQUIREMENTS.md 的 20 条验收标准
> 执行原则：波次内并行、波次间串行，每波次后验证，全部 20 条验收通过才允许提交

---

## 波次 1：根治拦截器架构（T1-T2，最高优先级）

### T1 MainServerRequestClient 层全局拦截
- 在 `infrastructure/main_server/client.rs` 的 `post`/`post_with_headers` 等方法前置 `try_intercept`
- 命中本地端点即短路返回 JsonRespnse，不再发远程请求
- 一次性根治 LocalApiManager、McpManager 及未来所有内部调用绕过拦截器的问题
- **验收 S1**

### T2 补全 local-api/update / reset-api-key 端点 mock
- `local_interceptor/mod.rs` 新增 `local-api/update` 分支（按 payload 覆盖 enabled/port，回显 mock 配置）
- 新增 `local-api/reset-api-key` 分支（回显新 key）
- **支撑 A1/M1**

---

## 波次 2：修复 API 服务控制（T3-T4）

### T3 LocalApiManager 错误处理修正
- `runtime.rs:31-34` 网络错误不再 `return Ok(())`，改为返回 Err 或降级用拦截器 mock
- 确认 T1 全局拦截后 refresh_from_server 能拿到 mock 配置并真正拉起 axum server
- **验收 A1/A2/A4**

### T4 API server 鉴权加强
- `middleware/auth.rs` 校验 sp-api-key 值与 config.api_key（mock=`simprint-local-mock-key-v1`）相等
- 当前只校验存在性，任意字符串都能过 → 安全漏洞
- **验收 A3**

---

## 波次 3：修复 MCP 服务控制（T5-T7）

### T5 McpManager 接入拦截器验证
- T1 全局拦截后，fetch_local_api_runtime_config 自动命中 mock → api_key 非空
- 确认 start_with_config 能跑到 spawn_mcp_server
- **验收 M1/M2**

### T6 MCP server 工具完整性审计
- 读取 `mcp/tools/` 全部模块，列出暴露给 AI 的工具清单
- 确认至少含 environments/groups/tags/proxies 四类
- 确认工具执行走 bridge → try_intercept → 本地 SQLite（Phase 3 已接入）
- **验收 M4/M5**

### T7 MCP health + StreamableHttp 端点验证
- 确认 `/health` 返回 200，`/mcp` 响应 rmcp StreamableHttp
- **验收 M3**

---

## 波次 4：修复机场订阅（T8-T10）

### T8 订阅请求健壮性
- `subscription.rs` 设默认 UA（`clash-verge/v1.0`）+ `redirect::Policy::limited(5)` + 失败重试 1 次
- convert.rs 的 reqwest 错误给出可读中文（区分重定向溢出/超时/连接失败）
- **验收 P1**

### T9 订阅错误透传到 UI
- `service.rs:165` 不再用 `let _ =` 吞错，刷新失败时把 last_error 写入订阅记录
- `proxy-chain-panel.tsx` 展示选中订阅的 last_error（前端已有该字段，只是没显示）
- **验收 P2/P3**

### T10 代理链启动错误增强
- start() 失败时错误信息包含「订阅 X 节点数 0，last_error: ...」
- **支撑 P3**

---

## 波次 5：AI 工具对接文档 + 验收测试 + 打包（T11-T15）

### T11 API server 端点完整性确认
- 确认 routes 暴露 ≥6 类端点
- **验收 A5**

### T12 AI 工具对接文档
- 编写 zcode / codex / Claude Code 三种连接 Simprint MCP server 的配置指南
- 包含端口、api_key、工具清单、使用示例
- **验收 E2**

### T13 20 条验收自动化验证脚本
- 编写 Python/PowerShell 脚本验证 A1-A5/M1-M5/S1-S3 等可自动化的标准
- **支撑全部验收**

### T14 执行全部 20 条验收 + 修复不通过项
- 逐条验证，不通过的修复后重验
- **全部 20 条通过才进入 T15**

### T15 清理 + cargo check + pnpm build + release 构建 + 推送 GitHub
- **验收 S2/S3/E1**
- 清理临时文件，git push，创建 Release
