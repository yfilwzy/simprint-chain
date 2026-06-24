# 链式代理（Mihomo Sidecar）

Simprint 的原生代理仍保持 `http/https/socks5` 单层模型。链式代理功能通过本地 Mihomo sidecar 实现：

```text
Simprint 浏览器环境 -> 127.0.0.1:mixed-port -> 机场节点组 -> 落地 SOCKS5 -> 目标网站
```

## 能力

- 支持多个机场订阅，订阅内容可为 Clash/Mihomo YAML `proxies` 或常见 URI 列表。
- 订阅节点生成首跳组：
  - `PROXY-CHAIN-AUTO`：`url-test` 自动选择低延迟节点。
  - `PROXY-CHAIN-FALLBACK`：节点延迟失败或不可用时按顺序切换。
  - `PROXY-CHAIN-MANUAL`：手动选择节点。
  - `PROXY-CHAIN-FIRST-HOP`：落地 SOCKS 的 `dialer-proxy`，默认按策略选择上述组。
- 落地 SOCKS5 作为最终出口；规则只走 `PROXY`，不生成 `DIRECT` 兜底，避免严格网站看到机场出口。
- 环境创建页可选择链式代理，启动环境时自动确保本地 Mihomo 已启动，并将浏览器代理替换为本地入口。
- 订阅 URL、节点 secret、落地 SOCKS 密码在命令返回和 YAML 预览中默认脱敏。

## 使用流程

1. 打开「代理中心」->「链式代理」。
2. 填写机场订阅，每行一个：`名称|订阅URL`。
3. 填写落地 SOCKS5 host、port、username、password。
4. 保存后点击「同步订阅」。首次启动时如果节点为空，也会自动尝试同步订阅。
5. 点击「启动」或在环境启动时自动启动 sidecar。
6. 在创建/编辑环境的「网络与定位」中选择链式代理。

## Mihomo 可执行文件

默认会按以下顺序查找 Mihomo：

1. 配置中的 `mihomo.binary_path`。
2. 环境变量 `SIMPRINT_MIHOMO_PATH`。
3. Simprint 可执行文件同目录、`resources/`、`bin/` 下的 `mihomo.exe` / `mihomo`。
4. 系统 `PATH` 中的 `mihomo.exe` / `mihomo`。

如果运行机未安装 Mihomo，请先安装并加入 `PATH`，把二进制放到上述目录，或在本地配置文件中写入 `mihomo.binary_path`。

## 关键实现文件

- Rust 后端：`src-tauri/src/services/proxy_chain/`
- Tauri 命令：`src-tauri/src/commands/proxy_chain.rs`
- 浏览器环境启动接入：`src-tauri/src/services/environment/launch_runtime/mod.rs`
- 代理中心前端：`plugins/pages/proxy-center/src/components/proxy-chain-panel.tsx`
- 创建环境选择：`plugins/pages/create-window/src/components/network-location-form.tsx`
