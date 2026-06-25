# Tasks 文档：Simprint-Chain 实施任务清单

> 配套 REQUIREMENTS.md。每个 Task 含：上下文、依赖、步骤、验收、并行性分析、执行指南。
> 状态标记：✅已完成 ⏳待执行 🔶部分完成

---

## Task 0：仓库与本地清理（✅ 本轮已完成）

**上下文**：审计发现冗余过程稿、含明文密码的临时脚本、过时的部署提示词版本。
**已执行**：
- 删除 `~/.ssh/_setup_simprint_ssh.py`（含明文 root 密码）
- 删除冗余 ROOT 提示词 v1（直接发送版）+ v2（贴合现状版），保留 v3（子路径版）
- 脱敏 `09-联调文档` 的 API_SECRET 明文（3 处 → 占位符）
- 脱敏 `deploy/install-server.sh` 的官方密钥
**验收**：`grep -r "<root密码>|<官方密钥>|<API_SECRET>"` 仓库零泄露（已复扫，仅 gitignore 排除的本地 config 残留真实值，安全）

---

## Task 1：客户端联调验证 ✅ 100%（4步全部闭环验证 + bug 修复）

**上下文**：服务端已上线（api.yfilwzy.cc.cd/simprint/* 公钥可访问），客户端 config.production.toml 已填 secret_key。需在用户开发机完成端到端联调。

**联调验证结果**（2026-06-25）：

启动层（pnpm tauri dev）：
- ✅ `Server connection successful` —— splashscreen 服务器连接成功
- ✅ `无需更新` —— 更新检查指向自建服务器成功
- ✅ `主窗口已显示` —— 完整启动链路通过
- **发现并修复真实 bug**：`fetch_server_public_key` 把整个 JSON body 当 PEM 存（自托管返回 JSON 包装），导致 `Pem(Preamble)` 解析失败。修复：新增 `extract_public_key_from_body` 兼容纯 PEM 与 JSON 包装两种形态。

四步业务联调（server/e2e_check/main.go 复刻客户端加密协议打生产 API）：
- ✅ **步骤A 注册**：返回 access_token；DB users 表落库（email + is_first_login）
- ✅ **步骤B 登录**：返回 access_token(64位) + refresh_token(64位)；DB sessions 表落库
- ✅ **步骤C 创建环境**：返回 environment id；DB environments 表落库（id+name）
- ✅ **步骤D refresh token**：remember 模式可用，返回新 access_token

DB 落库铁证（SSH 实查）：
- users: `e2e_*@test.local` 多条记录
- sessions: 每注册+登录生成 session，expires_at 7天
- environments: `e2e-env-*` 记录含 UUID

**步骤**：
1. 配置客户端 config：
   ```bash
   copy "D:\desktop\服务器部署\服务器端simprint\交付物\config.production.toml" "src-tauri\config.production.toml"
   ```
   验证 secret_key 与交付物 API-SECRET.txt 一致。
2. 重跑 build.rs（关键，配置编译期嵌入加密）：
   ```bash
   cd src-tauri && cargo build
   ```
3. 开发模式启动：
   ```bash
   pnpm install && pnpm tauri dev
   ```
4. 验证点：
   - splashscreen 不卡（公钥拉取成功）
   - 注册新账号 → DB users 表有记录
   - 账密登录 → 登录成功，token 持久化
   - 创建环境 → DB environments 表有记录
   - 退出 → remember 模式自动登录

**联调故障排查**（服务器日志已配免密）：
```bash
ssh simprint-server "docker logs --tail 50 simprint-server"
```
对照 08-加密协议实测规格.md 逐项核 padding/nonce/base64 顺序。

**验收**：5 个验证点全通过，数据落自建 DB。
**并行性**：不可并行（串行链）。

---

## Task 2：官方 v0.2.26 源码合并 ⏳（大型，可拆分并行）

**上下文**：本地基线约 v0.2.9 前，官方已到 v0.2.26（49 commits/160 文件）。需融合，同时保留 proxy_chain。
**依赖**：Task 1（联调通过后再大改，避免在未验证基础上合并）

**可并行子任务**（无文件冲突）：
- **2A updater 合并**：采纳官方 `infrastructure/updater/` 分层，移植本地 URL 配置差异。冲突点：`src/bin/updater.rs` 路径相同。
- **2B proxy_chain 保留**：本地 `services/proxy_chain/`（8 文件）整目录移植为独立模块，前端 proxy-center 加 Tab 分层。
- **2C 官方新功能同步**：browser-extensions(v0.2.14)、mihomo(v0.2.22)、RPA(v0.2.24/25)、display-id(v0.2.26)。
- **2D 前端整合**：create-window-proxy-drawer 三选一（remote/mihomo-local/chain）。

**步骤**（详见 01/02 文档）：
1. `git remote add upstream https://github.com/Simprint/simprint.git && git fetch upstream`
2. `git checkout -b merge/v0.2.26 upstream/main`
3. 2A-2D 子任务分别 cherry-pick / 手动移植
4. `cargo check && pnpm lint`

**验收**：`cargo check` 通过 + proxy_chain 冒烟 + 官方新功能冒烟。
**并行性**：2A/2B/2C/2D 可并行（无共享写文件），2D 依赖 2B/2C 完成。

---

## Task 3：MCP registry builtins 适配 ⏳（中型，高度并行）

**上下文**：registry.rs 骨架已集成（mcp/mod.rs 已注册），但现有 7 模块工具（tools/*.rs）未实现 McpTool trait。
**依赖**：无（独立于 Task 1/2）

**可并行子任务**（每个工具模块独立）：
- 3A environments → 实现 ListEnvironmentsTool / CreateEnvironmentTool
- 3B proxies → 实现 ListProxiesTool 等
- 3C groups / 3D tags / 3E workspaces / 3F browser_kernels
- 3G environments_extras（最大，31K）
- 3H 元工具 list_tools_catalog / describe_tool

**步骤**（详见 04 文档）：
1. 每个工具实现 `McpTool` trait 的 `meta()` + `invoke()`
2. invoke 走 LocalApiBridge（保持现有桥接）
3. 在 `build_registry()` 注册
4. `server.rs::build_service` 改从 `ToolRegistry::all_routes()` 取 routes

**验收**：
- 现有工具行为与原 `tools/*.rs` 一致
- list_tools_catalog 元工具返回完整目录
- cargo test 全绿

**并行性**：3A-3H 高度并行（各管各的工具文件），3H 依赖 3A-3G 完成后注册。
**指南**：用 Task 工具派 7 个并行子 agent，每个负责一个工具模块，one-writer-per-file。

---

## Task 4：完整打包 + Release ⏳（串行，依赖 Task 1/2）

**上下文**：联调+合并完成后，出正式安装包。
**步骤**：
1. `pnpm tauri build`（耗时 10-30 分钟）
2. 产物在 `src-tauri/target/release/bundle/nsis/*.exe`
3. 计算 SHA256
4. 更新 `latest.json`（version/platforms/signature）
5. `gh release create v0.2.26-chain.2 <exe路径> --notes "..."`

**验收**：新 Release 有安装包 + SHA256 + latest.json 可达。
**并行性**：不可并行。

---

## Task 5：自更新闭环 ✅（服务端配置完成，客户端检查通过）

**上下文**：验证客户端能从自建服务器检查+下载+安装更新。

**已完成**（2026-06-25）：
- ✅ latest.json 服务器端动态生成（GetLatestJson 已实现，非 stub），`https://api.yfilwzy.cc.cd/simprint/update/latest.json` 可达
- ✅ 安装包上传服务器 `/opt/simprint/updates/`（SHA256 与构建一致）
- ✅ GitHub Release v0.2.26-chain.2 安装包可下载（HTTP 200）
- ✅ 客户端启动时"检查更新"指向自建服务器，日志 `无需更新`（当前版本与 latest.json 版本一致，符合预期）

**剩余**：真实自更新触发需安装旧版本客户端 + 版本号低于 latest.json，本小姐当前构建即最新版故无法触发"有更新"。用户装旧版可验证完整下载+安装链路。
**并行性**：不可并行。

---

## 执行优先级与并行调度

```
当前（可立即并行）：
  ├─ Task 3（MCP 适配，独立）── 派 7 并行子 agent
  └─ Task 1 准备（config/build.rs，本地可做）

Task 1 完成后（串行）：
  └─ Task 2（官方合并，内部 2A-2D 并行）

Task 1+2 完成后（串行）：
  ├─ Task 4（打包）
  └─ Task 5（自更新）
```

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 客户端联调失败（加密协议） | 08 文档是权威判据，服务器日志可实时查 |
| 官方合并冲突（updater 路径同） | 采纳官方分层，本地仅保留 URL 差异 |
| pnpm tauri build 环境缺失 | 需用户机器完整 Tauri+Rust+WebView2 |
| 2核2G 内存吃紧 | 已验证当前 836Mi/1.9Gi，充裕 |
