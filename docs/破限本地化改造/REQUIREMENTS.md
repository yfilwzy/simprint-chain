# 破限本地化改造需求文档

## 一、背景

Simprint 浏览器工作区二开版（v0.2.26-chain.1）当前为「免登录版」，所有数据请求经由 Rust `http_post` 命令透传至远程 main server（`https://api.yfilwzy.cc.cd/simprint/api/`）。

main server 在 `environments/batch-create` 接口执行配额校验：免费用户 `max_environments = 6`，超出即拒绝创建。

用户诉求：**解开所有限制，环境数量无上限，纯本地运行，做成可用的破解版。**

## 二、限制真相（深度探索结论）

### 2.1 前端层（纯展示，无拦截）
- `free-quota-usage.tsx:52` — `quota?.max_environments ?? 6`，侧边栏进度条兜底值
- `workspace-switch-dialog.tsx:142` — 工作区卡片 `used/max` 展示
- `use-current-plan.ts:60-69` — 套餐页配额展示
- `batchCreateEnvironments`（create-window/api/index.ts:362）— **无任何创建前配额预检**，直接 `post('environments/batch-create')`
- 路由守卫只校验 `isAuthenticated`，**无套餐门控**

**结论：前端不会拦截创建，"6" 只是展示数字。**

### 2.2 Rust 层（纯透传，无本地校验）
- `http_post`（network.rs:40）→ `main_server_client.post` → 远程服务器
- main server 不可达时，所有数据操作（list/create/detail/delete/启动）全部失败
- `start_environment_by_uuid`（launch_runtime）强依赖 main server 的 `environments/detail` + `browser-kernels/list`
- 底层 `launch_environment`（runtime_bridge.rs:24，传完整参数版）**不依赖 main server**，只校验 exe_path 文件存在性
- 本地无任何环境数据持久化（无 SQLite，store.json 仅存设置）

### 2.3 内核层
- 浏览器内核（Chrome，约 150MB）从 main server `browser-kernels/list` 返回的 url 下载
- `ensure_kernel_ready` 用 signature 校验 chrome.dll 哈希
- 内核管理器 `simprint-runtime.exe`（5.5MB）已打包在 resources/，但浏览器内核本体未预置

**结论：限制根源是 main server 的配额校验 + 数据强依赖。要真正破解，必须将环境数据操作本地化。**

## 三、破解方案

### 3.1 核心机制：Rust http_post 本地拦截层

在 `http_post` 命令（network.rs:40）入口注入本地拦截器。对特定端点用本地逻辑处理（返回本地数据），其余端点透传 main server。

```
前端 post(url, data)
  └─ invoke('http_post')
       └─ local_interceptor(url, data)     ← 新增拦截层
            ├─ 匹配本地端点 → 本地存储读写，返回成功
            └─ 不匹配 → main_server_client.post（原逻辑）
```

### 3.2 本地存储

使用 SQLite（引入 `rusqlite`）持久化环境数据。数据目录：`app_data_dir/Simprint/local_data.db`。

表结构：
- `environments` — uuid, name, config(JSON), group_uuid, proxy_config(JSON), created_at, updated_at
- `groups` — uuid, name, description
- `tags` — uuid, name, color
- `environment_tags` — environment_uuid, tag_uuid

### 3.3 拦截点清单

| 端点 | 本地处理 | 说明 |
|---|---|---|
| `environments/batch-create` | INSERT 本地 + 返回生成的 uuid | 解除创建限制 |
| `environments/create` | 同上 | 单个创建 |
| `environments/list` | SELECT 本地 + 分页 | 列表展示 |
| `environments/detail` | SELECT 本地 | 启动时读取配置（关键） |
| `environments/delete` | DELETE 本地 | |
| `environments/batch-delete` | 批量删除 | |
| `environments/update` | UPDATE 本地 | 编辑环境 |
| `environments/recycle-bin/list` | 返回空（本地不做回收站） | |
| `groups/list` | SELECT 本地 | |
| `groups/create` | INSERT 本地 | |
| `groups/delete` | DELETE 本地 | |
| `tags/list` | SELECT 本地 | |
| `tags/create` | INSERT 本地 | |
| `tags/delete` | DELETE 本地 | |
| `proxies/list` | 返回空数组 | 本地版暂不支持远程代理 |
| `accounts/list` | 返回空数组 | |
| `browser-kernels/list` | 返回本地内核元数据 | 见 3.4 |
| `workspace-quotas/get` | 返回无限配额 | max_environments = 999999 |
| `billing/quota` | 返回无限配额 | |
| `billing/subscription` | 返回付费套餐 | 解锁会员展示 |

### 3.4 内核处理（第二阶段）

`browser-kernels/list` 本地返回内核元数据，url 指向公开下载源。
`ensure_kernel_ready` 的 signature 校验：patch verifier 跳过哈希比对（破解版自用）。

### 3.5 前端展示层修改

- `free-quota-usage.tsx:52` — `?? 6` 改为 `?? 999999`
- `workspace-switch-dialog.tsx:142` — 配额展示改为不显示或显示 ∞

## 四、验收标准

1. cargo check 零错误
2. pnpm build 零错误
3. 能创建 7 个以上环境（突破 6 个限制）
4. 环境列表能正常显示
5. 环境数据持久化（重启不丢失）
6. 配额显示无限 / 不再显示限制

## 五、约束与边界

- 纯本地破解版，自用
- 环境数据存本地 SQLite
- 浏览器内核启动（第二阶段）需要内核文件来源
- 远程代理、团队协作等依赖服务器的功能不在本版范围
