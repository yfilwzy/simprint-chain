# Phase 5 —— 全功能 AI 开放 + 安全加固 + 深度优化

> 日期：2026-06-26
> 前置：Phase 1-4（破限本地化 + MCP/API 开关根治）
> 目标：让 Simprint 全部功能可通过 zcode/Claude Code 自然语言操作，同时修复安全漏洞、优化代码质量和用户体验，打造最好用的桌面指纹浏览器。

---

## 一、核心矛盾（深度侦察发现）

Phase 4 修好了 MCP/API 开关，但 MCP 工具面**只覆盖 5 个域**（环境/分组/标签/静态代理/内核）。代理链/机场订阅、RPA、浏览器扩展、数据备份、账号中心这些核心功能**完全没有 MCP 工具**——AI 根本碰不到。

**基础设施障碍**：MCP server（`server.rs:19-33`）只持有 `LocalApiBridge`，没有 `app_handle`。而代理链/备份/扩展是 Tauri command，需要 app_handle 才能 invoke。新增工具前必须先注入 app_handle 通道。

---

## 二、安全漏洞（子 Agent 深度排查，3 个严重）

1. **Zip-Slip 路径遍历**（`kernel/utils.rs:38`）：解压内核 zip 不校验 `../`，恶意内核可 RCE。
2. **硬编码 API key**（`local_interceptor/mod.rs:25`）：`LOCAL_API_MOCK_KEY` 编译期常量，等于无鉴权。
3. **RwLock unwrap panic**（`credential/mod.rs:50,55,...`）：8 处 `.unwrap()`，poisoned lock 致全应用崩溃。

---

## 三、技术优化点（16 个，子 Agent 全量排查）

错误处理：store.rs filter_map 吞错（217/322/380/439）、service.rs let _ 吞错（71/166）、process.rs stop 失败忽略（143）。
并发：OnceLock 不可重置（mod.rs:18，导入后需重启）、单 Mutex 全局瓶颈（store.rs:14）。
性能：batch_create 循环 INSERT 无事务（mod.rs:306-328）、update 两次 UPDATE、节点 raw 整体 clone。
资源：mcp server shutdown 不保证回收、ready 检测 4s 可能误判。
配置：mihomo secret 占位常量（storage.rs:191）。

---

## 四、用户体验优化点（15 个）

错误提示：request.ts 吞错返回固定"请求失败"（61-64）、API 文档按钮 TODO 死链。
危险操作：代理链删除无确认（清空全部配置）、导入强制重启无取消。
校验缺失：订阅 URL/落地端口无前端校验。
引导缺失：订阅输入仅 Textarea（未暴露 include/exclude 关键词）、MCP 页面无工具清单/连接状态。
空状态：代理链列表无空状态引导、节点全 -1 无告警。
导航：代理视图切换无 URL 记忆、出口检测双重 toast。

---

## 五、20 条验收标准

### MCP 工具覆盖（6 条）
- MC1. proxy_chain 工具可启动/停止代理链
- MC2. proxy_chain 工具可刷新订阅获取节点
- MC3. backup 工具可导出数据库到指定路径
- MC4. rpa 工具可列出/创建 RPA 任务
- MC5. extensions 工具可列出已安装扩展
- MC6. accounts 工具可列出账号

### 安全（4 条）
- SE1. Zip-Slip 修复：恶意 zip 条目（含 ../）被拒绝
- SE2. API key 非硬编码：首次启动生成随机密钥持久化
- SE3. RwLock poisoned 不 panic（降级处理）
- SE4. 零凭据泄露（grep 验证）

### 代码质量（3 条）
- CQ1. batch_create 用事务（原子性）
- CQ2. store 查询错误不再静默吞掉（有日志）
- CQ3. cargo check + pnpm build 通过

### UX（4 条）
- UX1. 代理链删除有确认弹窗
- UX2. 端口/URL 有前端校验
- UX3. 订阅错误在 UI 可见（last_error 展示）
- UX4. MCP/API 页面显示工具清单和连接状态

### 端到端（3 条）
- EE1. release exe 启动 + MCP/API server 自动启动
- EE2. zcode 通过 MCP 自然语言操作（创建环境/列分组实测）
- EE3. AI 工具对接文档完整（含新增工具）
