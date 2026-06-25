# Phase 3 功能增强发布说明

> 版本：v0.2.26-chain.2（破限本地版）
> 日期：2026-06-25
> 基于 Phase 1（WebView2Loader.dll 修复）+ Phase 2（破限本地化）。

---

## 本次更新内容（Phase 3）

### 1. 修复 MCP 服务控制开关

**问题**：「API & AI」页面的「MCP 服务控制」开关启用后报错，无法拉起本机 MCP server。

**根因**：开关启动时调用 `local-api/get` 向远程 main server 取 API 凭证，破限版无远程服务导致凭证为空。

**修复**：本地拦截器新增 `local-api/get` 端点，返回本地伪造的有效运行时配置（固定 API key、端口 37111），MCP server 可正常拉起。

### 2. 修复审计操作日志加载失败

**问题**：审计页加载操作日志显示「请求失败」。

**根因**：4 个审计端点（`audit/logs`、`audit/logs/detail`、`audit/logs/export`、`audit/stats`）未被本地拦截，fallthrough 到远程服务器失败。

**修复**：本地拦截器新增上述 4 端点，返回空数据（本地版无服务端日志采集），页面正常显示空列表。

### 3. 删除费用中心与推广计划模块

完整删除两个商业模块：
- `plugins/pages/billing-center/`（费用中心，34 文件）
- `plugins/pages/referral-program/`（推广计划，29 文件）

同步清理侧边栏菜单、导航栏、i18n 文案，并解耦 `plan-selection` 对 `billing-center` 的硬编码引用（优惠券功能本地版移除）。

### 4. 重新设计代理中心：两种模式

代理中心新增模式切换，站在用户角度提供两种代理方案：

- **机场订阅直连**：浏览器 → 本地 Mihomo → 机场节点直接出口。适合目标网站不查落地 IP 的场景，配置简单。
- **机场订阅加落地代理**：机场节点做第一跳 → 落地 SOCKS5 做最终出口。目标网站看到落地 IP，适合对 IP 严格的风控场景。

后端 mihomo 配置生成器按模式生成不同 PROXY 组结构；前端 UI 提供可视化模式切换，直连模式自动隐藏落地配置。配置 schema 新增 `mode` 字段，缺省 `landing_chain` 保持向后兼容。

### 5. 网络代理对接代理中心

系统设置「网络与同步」的「网络代理」卡片改为对接代理中心：
- 显示代理中心运行状态（运行中 / 已停止）
- 提供启停按钮（调用 `proxy_chain_start` / `proxy_chain_stop`）
- 提供跳转代理中心配置入口
- 移除原来独立无效的 `proxyEnabled/proxyAddress/proxyPort` 配置

### 6. 默认存储路径迁移至 D 盘

所有默认存储路径从 C 盘迁移到 `D:\Simprint`：
- 应用运行目录（cache / logs / profiles / downloads / config / kernels 等）
- 本地数据库 `D:\Simprint\data\local_data.db`

特性：
- 优先使用 `D:\Simprint`；若 D 盘不可用自动回退到原 C 盘路径保证可用性
- 支持环境变量 `SIMPRINT_DATA_DIR` 覆盖根目录
- 首次启动时自动检测旧 C 盘路径数据并一次性迁移（含 WAL 边文件）

### 7. 本地数据备份 / 导入 / 导出

系统设置「存储与更新」新增「数据备份」卡片：
- **导出备份**：弹出保存对话框，选择路径后导出完整数据库副本（导出前执行 WAL 检查点确保一致性）
- **导入数据**：弹出打开对话框，选择备份文件后校验 schema，替换当前数据库（导入前自动备份当前数据为 `.pre-import-*.bak`）
- 显示当前数据库路径、大小、存在状态
- 导入完成后自动重启应用以重建数据库连接

新增 3 个 Tauri command：`get_database_info`、`export_database`、`import_database`。

---

## 已知限制

| 限制 | 说明 |
|------|------|
| 浏览器内核 | Chrome 内核（~150MB）不在本地分发，环境「启动」仍依赖内核下载源（Phase 2 既定边界）。 |
| mihomo 二进制 | 不随程序分发，代理中心使用前需自行放置 `mihomo.exe`（许可证考量）。 |
| MCP 工具执行 | MCP server 可正常启动（开关可用）；MCP 工具执行阶段（通过 Cursor 调用工具读环境数据）仍依赖远程 Local API server，工具级别的完全本地化作为后续增强。 |

---

## 技术实现

### 后端（Rust）

**local_interceptor 扩展**（`src-tauri/src/local_interceptor/mod.rs`）：
- 新增 5 个拦截端点：`local-api/get`、`audit/logs`、`audit/logs/detail`、`audit/logs/export`、`audit/stats`
- 新增 `local_db_path()`、`checkpoint_local_db()` 公开函数

**LocalStore 增强**（`src-tauri/src/local_interceptor/store.rs`）：
- 新增 `db_path` 字段 + `db_path()` / `checkpoint()` 方法
- `resolve_db_path()` 改为统一走 PathManager 根目录（D 盘），加旧数据自动迁移

**路径体系**（`src-tauri/src/core/paths.rs`）：
- `get_default_root_dir()` Windows 分支改为 D 盘优先 + 环境变量覆盖 + C 盘回退

**代理链生成器**（`src-tauri/src/services/proxy_chain/generator.rs` + `types.rs`）：
- 新增 `ProxyChainMode` 枚举（Direct / LandingChain）
- `validate_chain_inventory` 按模式校验，直连模式不强制落地
- `build_proxy_groups` 按模式生成不同 PROXY 组

**备份命令**（`src-tauri/src/commands/backup.rs`，新增）：
- `get_database_info` / `export_database` / `import_database`

### 前端（React）

**代理中心**（`plugins/pages/proxy-center/`）：
- `api/proxy-chain.ts`：新增 `ProxyChainMode` 类型，`ProxyChainSummary`/`UpsertProxyChainInput` 加 mode 字段
- `components/proxy-chain-panel.tsx`：新增模式切换 UI，直连模式隐藏落地配置

**系统设置**（`plugins/pages/system-settings/`）：
- `components/network-panel.tsx`：网络代理对接代理中心
- `components/storage-panel.tsx`：新增数据备份卡片

**模块删除**：
- 删除 `billing-center`、`referral-program` 两个插件
- `plan-selection/coupon-selector-dialog.tsx` 改为本地空实现
- `app-layout` 清理菜单、导航、i18n

---

## 验证

- ✅ `cargo check` Rust 编译通过
- ✅ `pnpm generate-imports` 插件注册表更新（billing-center / referral-program 已移除）
- ✅ `pnpm build:production` 前端构建通过（3934 模块）
- ✅ `cargo build --release` release 可执行文件构建

## 许可证

AGPLv3（衍生作品保持合规，源码公开）。
