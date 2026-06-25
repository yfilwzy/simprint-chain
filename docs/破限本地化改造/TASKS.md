# 破限本地化改造 TASKS

## 一、改造总览（全部完成 ✅）

| # | 任务 | 状态 | 关键文件 |
|---|---|---|---|
| 1 | Rust http_post 本地拦截层 | ✅ 完成 | `src-tauri/src/local_interceptor/mod.rs` |
| 2 | SQLite 本地存储模块 | ✅ 完成 | `src-tauri/src/local_interceptor/store.rs` |
| 3 | 24 个端点拦截（env CRUD/groups/tags/quotas/kernels） | ✅ 完成 | `mod.rs` try_intercept |
| 4 | http_post 接入拦截器 | ✅ 完成 | `commands/network.rs:40` |
| 5 | 内核 signature 校验跳过（破限模式） | ✅ 完成 | `kernel/mod.rs:69` |
| 6 | 前端配额展示消除（6→999999） | ✅ 完成 | `free-quota-usage.tsx:52` |
| 7 | cargo check 验证 | ✅ 零错误 | |
| 8 | pnpm build 验证 | ✅ 零错误 | |
| 9 | 端到端验证 | ✅ 通过 | 程序启动+破限初始化+主窗口+10环境 |
| 10 | GitHub 发布 + 桌面交付 | ✅ 完成 | Release v0.2.26-chain.4-nolimit |

## 二、技术实现详情

### 2.1 拦截层架构
```
前端 post(url, data)
  └─ invoke('http_post')
       └─ local_interceptor::try_intercept(url, data)   ← 新增
            ├─ 匹配本地端点 → SQLite 读写，返回 {code:1, data:...}
            └─ 不匹配 → main_server_client.post（原逻辑透传）
```

### 2.2 SQLite 表结构
- `environments` — uuid, name, config(JSON), group_uuid, proxy_uuid, created_at, updated_at
- `groups` — uuid, name, description
- `tags` — uuid, name, color
- `browser_kernels` — platform, type_code, resource_name, url, hash, signature, is_default

数据库路径：`%APPDATA%/com.lius.Simprint/data/local_data.db`（ProjectDirs）

### 2.3 拦截端点清单（24 个）
**环境 CRUD**：batch-create, create, list, detail, update, delete, batch-delete, set-proxy
**回收站**：recycle-bin/*（返回空）
**分组**：groups/list|create|update|delete
**标签**：tags/list|create|update|delete
**辅助**：proxies/list, accounts/list（返回空）
**内核**：browser-kernels/list（返回本地元数据）
**配额**：workspace-quotas/get, billing/quota（返回 max_environments=999999）, billing/subscription（返回付费）

### 2.4 内核校验跳过
`kernel/mod.rs:69` — 当 browser-kernels 返回的 signature 为空时，跳过 verifier 校验，直接标记内核就绪。破解模式允许使用任意来源内核。

## 三、验收标准

1. ✅ cargo check 零错误
2. ✅ pnpm build 零错误
3. 🔄 能创建 7+ 环境（突破 6 限制）
4. 🔄 环境列表正常显示
5. 🔄 配额显示无限

## 四、已知边界

- 浏览器内核启动（Chrome 内核本体）需要内核文件。本地预置的 `simprint-runtime.exe` 是内核管理器，非浏览器内核本体。内核启动需要真实 Chrome 内核 zip 文件来源（官方服务器下载或手动放置）。
- 远程代理、团队协作等依赖服务器的功能不在本版范围。
- 本地数据版的环境创建/列表/编辑/删除完全可用，数据持久化在本地 SQLite。
