# 构建依赖二进制说明

本项目运行依赖以下二进制文件，因体积或许可证原因不纳入 git，需在构建前自行放置到 `src-tauri/resources/` 目录。

## 文件清单

| 文件 | 大小 | 用途 | 获取方式 |
|------|------|------|----------|
| `mihomo.exe` | ~47MB | Mihomo(Clash.Meta) 代理内核，代理中心链式代理运行所需 | 见下文 |
| `simprint-runtime.exe` | ~5.5MB | 浏览器环境运行时管理器（内核启动/停止） | 原项目自带，从 release 包提取 |
| `WebView2Loader.dll` | ~160KB | WebView2 加载器（Tauri 桌面框架依赖） | 由 `webview2-com-sys` crate 自动同步 |

## mihomo.exe 获取

mihomo（Clash.Meta 内核）采用 GPL-3.0 许可证。

```powershell
# 下载 v1.19.27（Windows amd64 兼容版）
Invoke-WebRequest -Uri "https://github.com/MetaCubeX/mihomo/releases/download/v1.19.27/mihomo-windows-amd64-compatible-v1.19.27.zip" -OutFile "mihomo.zip"
Expand-Archive -Path "mihomo.zip" -DestinationPath "src-tauri/resources/" -Force
# 解压后重命名为 mihomo.exe（原文件名含平台后缀）
Rename-Item "src-tauri/resources/mihomo-windows-amd64-compatible.exe" "mihomo.exe"
Remove-Item "mihomo.zip"
```

也可设环境变量 `SIMPRINT_MIHOMO_PATH` 指向系统中已安装的 mihomo.exe，无需放置到 resources 目录。

## 构建命令

```bash
# 前端
pnpm install
pnpm run generate-imports
pnpm run build:production

# 后端（release）
cd src-tauri
cargo build --release
```

产物：`src-tauri/target/release/simprint.exe`

## 运行时数据目录

破限本地版默认数据目录（Windows）：`D:\Simprint\`

- 若 D 盘不可用，自动回退到 `%LOCALAPPDATA%\Simprint`
- 可设环境变量 `SIMPRINT_DATA_DIR` 覆盖
- 首次运行若检测到旧 C 盘路径（`%APPDATA%\lius\Simprint`）有数据，会自动迁移

## 许可证

本项目（Simprint 二开衍生作品）采用 AGPLv3。mihomo 采用 GPL-3.0。
