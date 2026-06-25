# 需求文档：Simprint-Chain 隐私自托管闭环

> 版本：1.0 · 日期：2026-06-25 · 仓库：github.com/yfilwzy/simprint-chain
> 本文档是项目的**权威需求基线**，所有 tasks 文档以此为依据。

---

## 一、项目愿景

将 Simprint 桌面应用（浏览器环境/代理/自动化工作台）改造为**完全自托管**的隐私版本：所有用户数据流向用户自有服务器，禁用一切第三方数据外泄点，同时保留魔改的链式代理能力，并增强 MCP 工具暴露。

## 二、四大核心需求（已定稿）

| 需求 | 状态 | 依据文档 |
|------|------|---------|
| N1 版本同步官方 v0.2.26 | ⏳ 待执行（官方源码未合并） | 01-融合基线对齐 |
| N2 保留魔改（updater/proxy_chain/config 卫生） | ✅ 方案定稿 | 02-魔改保留方案 |
| N3 登录与全部数据指向自建服务器 | ✅ 服务端已上线 | 03/08/09 |
| N4 MCP 注册表架构增强 | ⏳ 骨架完成，待适配 | 04-MCP增强设计 |

## 三、当前真实进度（2026-06-25 实测）

### 已完成 ✅
- 设计文档套件（00-09 共 10 份，覆盖全部决策）
- 自托管服务器**已部署上线**：api.yfilwzy.cc.cd/simprint/* 公钥端点可访问，5 容器全绿，内存充裕
- Go 服务端代码**生产级实现**：加密协议（PKCS1v15+AES-GCM）+ 全端点 + 并发安全 + graceful shutdown + 超时防护，`go test -race` 全过
- 客户端加密协议**逐行实测**（08 文档），与服务端对齐验证通过
- 客户端 config.production.toml 模板就绪（子路径版，secret_key 已填）
- SSH 免密 + tmux 持久会话配置完成
- MCP registry 骨架（registry.rs）已集成进 mcp 模块
- 托盘菜单增强（显示/设置/检查更新/关于/退出）

### 待完成 ⏳
- T1：客户端联调验证（注册/登录/业务请求往返）
- T2：官方 v0.2.26 源码合并（proxy_chain 保留 + 官方新功能同步）
- T3：MCP registry builtins 适配（7 模块工具实现 McpTool trait）
- T4：完整 `pnpm tauri build` 出新安装包，挂 Release
- T5：自更新闭环验证（latest.json 指向新安装包）

## 四、约束与边界

- **AGPLv3**：衍生作品义务（LICENSE/NOTICE 保留，整体继续 AGPLv3）
- **资源**：服务器 2核2G+2G Swap，新增内存 < 500MB
- **隐私**：零第三方数据外泄（已审计确认所有出口收敛于自建服务器）
- **不引入 Python**：MCP 增强纯 Rust

## 五、验收标准（Definition of Done）

1. 客户端能从自建服务器完成注册→登录→创建环境→退出→remember 重新登录
2. 业务数据全部落自建 PostgreSQL（users/sessions/environments 等表有记录）
3. 更新检查指向自建服务器（/simprint/update/*）
4. 仓库零敏感信息泄露（已审计通过）
5. 仓库干净（无过程稿/临时脚本/构建产物）
6. Go 服务端 `go test -race` 全过（已验证）
7. 客户端 `cargo check` 通过（待联调时验证）
