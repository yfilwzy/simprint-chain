# Phase 3 任务拆解文档

> 依据：`REQUIREMENTS.md`
> 实施分 5 个波次，波次内并行、波次间串行，每波次后做局部验证。

---

## 波次 A：删除模块 + D 盘路径（快速见效，验证基础设施）

### A1 删除费用中心与推广计划模块
- [x] 解耦 `plan-selection` 对 `billing-center` 的硬编码引用
  - 移除 `coupon-selector-dialog.tsx` 的 `billing-center` 跨插件 import，改为本地空实现
  - 移除 `plan-selection/index.tsx` 对优惠券选择器的调用（本地版不需要）
- [x] 删除 `plugins/pages/billing-center/` 整目录
- [x] 删除 `plugins/pages/referral-program/` 整目录
- [x] 清理 `app-sidebar.tsx` 菜单注册（L497-498）
- [x] 清理 `default-navigation-slot.tsx` 导航注册（L36-37 + import）
- [x] 清理 `app-layout/resources.ts` i18n key（4 处 × 2 语言）
- [x] 清理 `api-ai/ApiInfoCards.tsx` 失效 `/billing` 链接
- [ ] `plugin-imports.generated.ts` 构建时自动重生成（不手动改）

### A2 默认路径迁移 D 盘
- [x] `core/paths.rs:42-59` `get_default_root_dir()` Windows 分支改为 `D:\Simprint`
- [x] `local_interceptor/store.rs:463-474` `resolve_db_path()` 改为 `D:\Simprint\data\local_data.db`
- [x] 首次启动旧 C 盘数据自动迁移检测（一次性）

---

## 波次 B：local_interceptor 扩展（拦截器层面，互不冲突，并行）

### B1 修复 MCP 开关 —— 拦截 `local-api/get`
- [x] `local_interceptor/mod.rs` 新增 `"local-api/get"` 分支
- [x] 返回本地伪造 `LocalApiRuntimeConfig`：固定 `api_key`、`enabled:true`、`port:37111`、`daily_limit:999999`
- [x] 伪造 `api_key` 与 `mcp/server`、`local_api/server` 鉴权一致

### B2 修复审计日志 —— 拦截 4 个 `audit/*` 端点
- [x] 新增 `"audit/logs"` → 空分页 `{items:[], total:0, page:1, page_size:20}`
- [x] 新增 `"audit/logs/detail"` → 空 `{}`
- [x] 新增 `"audit/logs/export"` → 空 `ExportResponse`
- [x] 新增 `"audit/stats"` → 全 0 `AuditStatsResponse`

---

## 波次 C：代理体系（C1 → C2 串行）

### C1 代理中心新增「机场订阅直连」模式
- [x] `generator.rs:294-306` 放宽 `validate_chain_inventory`，支持无落地直连
- [x] `proxy-chain.ts` `ProxyPolicy`/`UpsertProxyChainInput` 新增 `mode` 字段（direct | landing_chain）
- [x] `generator.rs` `build_proxy_groups` 按模式生成不同 PROXY 组
- [x] 前端 `proxy-chain-panel.tsx` 新增模式切换 UI，直连模式隐藏落地配置

### C2 网络代理对接代理中心
- [x] `network-panel.tsx` 代理卡片改为显示代理中心状态 + 启停按钮 + 跳转入口
- [x] 移除独立的 `proxyEnabled/proxyAddress/proxyPort` 配置（或保留但标注由代理中心接管）

---

## 波次 D：本地数据备份/导入/导出

### D1 备份/导入/导出功能
- [x] Rust 新增 `commands/backup.rs`：`export_database`、`import_database`、`get_database_info`
- [x] `Cargo.toml` 无需新增依赖（rusqlite 已有，用 checkpoint+copy 实现，避免加 backup feature）
- [x] `commands.rs` 注册新 command
- [x] `storage-panel.tsx` 新增「数据备份」卡片（导出/导入按钮 + 确认弹窗）
- [x] 新增 i18n 文案（中英）

---

## 波次 E：文档 + 全面验证 + 构建 + 发布

### E1 验证
- [ ] `cargo check` Rust 编译通过
- [ ] `pnpm generate-imports` + `pnpm build` 前端构建通过
- [ ] release exe 构建

### E2 端到端验证
- [ ] 删除旧 DB + webview 缓存，首次启动主窗口显示
- [ ] MCP 开关可启用
- [ ] 审计页正常打开
- [ ] 侧边栏无费用中心/推广计划
- [ ] 代理中心两种模式可切换
- [ ] 网络代理显示代理中心状态
- [ ] 数据目录在 D 盘
- [ ] 备份导出/导入可用

### E3 发布
- [ ] Git 提交（分支）
- [ ] GitHub 发布说明
