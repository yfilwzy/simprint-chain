# Phase 3 功能增强需求文档

> 适用版本：Simprint 二开破限本地版 v0.2.26-chain.x
> 日期：2026-06-25
> 目标：在已完成的破限本地化（Phase 1/2）基础上，修复故障模块、删除冗余商业模块、重新设计代理中心、统一网络代理、迁移默认路径至 D 盘、补全本地数据备份能力。

---

## 一、需求清单

### R1 修复 MCP 服务控制开关打不开

**现象**：`API & AI` 页面「MCP 服务控制」开关启用后报错，无法拉起本机 MCP server。

**根因**：`src-tauri/src/mcp/manager.rs:101-112` 的 `fetch_local_api_runtime_config()` 调用 `main_server_client.post("local-api/get")` 取 `api_key`，破限版无远程服务，`api_key` 为空 → `manager.rs:74` 校验失败 → 返回「Local API 凭证无效，请稍后重试」。`local-api/get` 未被 `local_interceptor` 拦截。

**验收标准**：
1. 开关启用后 MCP server 在本机成功拉起（健康检查 `http://127.0.0.1:<port>/health` 200）。
2. 不再出现「Local API 凭证无效」错误。
3. 拦截 `local-api/get` 返回本地伪造的 `LocalApiRuntimeConfig`（含固定 `api_key`、`enabled:true`、合理 `port`）。
4. 伪造 `api_key` 与 `mcp/server`、`local_api/server` 鉴权保持一致。

### R2 修复审计操作日志加载失败

**现象**：审计页加载操作日志与统计均显示「请求失败」。

**根因**：`audit/logs`、`audit/logs/detail`、`audit/logs/export`、`audit/stats` 四端点未被 `local_interceptor` 拦截，fallthrough 到远程 main server 失败。

**验收标准**：
1. 审计页正常打开，操作日志列表显示（本地版无服务端日志，显示空列表 + 提示）。
2. 审计统计正常显示（全部计数为 0）。
3. 四个 `audit/*` 端点均被本地拦截，响应结构匹配前端 `AuditLogsListResponse` / `AuditStatsResponse`。

### R3 删除费用中心与推广计划整个模块

**需求**：「整个模块完整删除掉」。

**删除范围**：
- `plugins/pages/billing-center/`（34 文件）
- `plugins/pages/referral-program/`（29 文件）
- 侧边栏菜单注册（`app-sidebar.tsx`、`default-navigation-slot.tsx`）
- i18n 文案（`app-layout/resources.ts` 4 处 key）
- 解耦 `plan-selection` 对 `billing-center` 的硬编码引用（`coupon-selector-dialog.tsx`）
- 清理 `api-ai` 页面失效的 `/billing` 链接

**保留**：后端 `referral_code`（注册邀请码基础设施，被 register 流程复用，非推广计划页面）。

**验收标准**：
1. 侧边栏不再显示「费用中心」「推广计划」入口。
2. 直接访问 `/billing`、`/referral` 路由 404。
3. `pnpm build` 通过，无编译错误。
4. `plan-selection` 套餐页面正常工作（优惠券功能本地版移除）。

### R4 重新设计代理中心：两种模式

**需求**：提供两种模式 ——
1. **机场订阅直连**：浏览器 → 本地 Mihomo → 机场节点（直接出口）。
2. **机场订阅加落地代理**：浏览器 → 本地 Mihomo → 机场节点（第一跳）→ 落地 SOCKS5（最终出口），保证目标网站看到落地 IP。

**现状**：代理中心已有「机场订阅」+「落地代理」概念，但 `generator.rs:300-304` `validate_chain_inventory` 硬性禁止无落地直连。

**验收标准**：
1. 代理中心 UI 提供「机场订阅直连」「机场订阅加落地代理」两种模式切换。
2. 直连模式下隐藏落地 SOCKS5 配置，mihomo 配置 PROXY 组直接由机场节点组成，无 `dialer-proxy`。
3. 落地模式保持现有链式代理逻辑（向后兼容）。
4. 模式可保存、切换、生成 mihomo 配置、启动。
5. 配置 schema 新增 `mode` 字段，缺省值 `landing_chain` 保持向后兼容。

### R5 网络代理（系统设置）逻辑对接代理中心

**现状**：`network-panel.tsx` 的代理部分走 `getNetworkSettings/setNetworkSettings` store（`proxyEnabled/proxyAddress/proxyPort`），与代理中心 mihomo 体系完全分离。

**需求**：「网络代理这里的内部逻辑设置成代理中心那里的，链接好」。

**验收标准**：
1. 网络代理卡片显示代理中心当前运行状态（stopped/running）。
2. 提供启停按钮，直接调 `proxy_chain_start/stop`。
3. 提供跳转代理中心配置入口。
4. 保留数据同步设置部分不变。

### R6 系统设置默认路径全部改 D 盘

**需求**：「默认的路径全部给我设置成D盘」。

**现状**：两套独立体系 ——
- 体系 A（应用目录）：`core/paths.rs:42-59` `get_default_root_dir()` → `%LOCALAPPDATA%\Simprint`（C 盘）
- 体系 B（本地 DB）：`local_interceptor/store.rs:463-474` `resolve_db_path()` → `%APPDATA%\lius\Simprint\data\local_data.db`（C 盘）

**验收标准**：
1. 两套体系默认根目录均迁移到 `D:\Simprint`。
2. 应用目录树（cache/logs/profiles/downloads/config/kernels 等）全部在 D 盘下派生。
3. 本地数据库位于 `D:\Simprint\data\local_data.db`。
4. 首次启动时若 D 盘无数据且 C 盘旧路径存在 `local_data.db`，自动迁移（一次性）。

### R7 本地数据备份/导入/导出

**需求**：「因为是本地版，你需要给我配置清楚我的数据备份，设置备份的逻辑，配置清楚导入、导出功能」。

**现状**：完全不存在任何数据备份功能。

**验收标准**：
1. 系统设置存储面板新增「数据备份」卡片。
2. **导出**：弹出文件保存对话框，选择路径后导出 `local_data.db` 的完整副本（先 `wal_checkpoint(TRUNCATE)` 保证一致性）。
3. **导入**：弹出文件打开对话框，选择 `.db` 文件后校验 schema，替换当前数据库（导入后提示重启应用以重建连接）。
4. 导入前自动备份当前 DB（防误操作）。
5. 导出/导入过程有进度反馈和成功/失败提示。

---

## 二、约束与边界

| 约束 | 说明 |
|------|------|
| 浏览器内核 | Chrome 内核（~150MB）不在本地分发，环境「启动」仍依赖内核下载源；本次不解决此限制（Phase 2 既定边界）。 |
| mihomo 二进制 | 不随程序分发，用户需自行放置 `mihomo.exe`（许可证考量）；代理中心 UI 改造照常进行。 |
| OnceLock 单例 | `LocalStore` 用 `OnceLock` 持有，导入数据后无法热重载连接，采用「提示重启」策略。 |
| 向后兼容 | 代理配置新增 `mode` 字段缺省 `landing_chain`，旧配置保持原行为。 |
| AGPLv3 | 二开衍生作品保持 AGPLv3 合规，源码公开。 |

---

## 三、验证策略

1. **静态验证**：`cargo check`（Rust 编译）+ `pnpm generate-imports && pnpm build`（前端构建）。
2. **运行验证**：构建 release exe，删除旧 DB + webview 缓存，首次启动验证主窗口显示。
3. **功能验证**：MCP 开关、审计页、代理中心两模式、网络代理对接、D 盘路径、备份导入导出逐一手工验证。
4. **文档**：本需求文档 + `TASKS.md` 任务拆解文档。
