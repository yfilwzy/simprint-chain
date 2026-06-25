# 免登录版改造任务文档

> 目标：删除登录注册功能 + 删除更新功能，做成纯本地免登录版，安装即用，不依赖服务器连接。
> 基线：merge/v0.2.26 分支（C:\Users\ADMIN\simprint-fix）
> 日期：2026-06-25

---

## 一、需求背景

用户安装官方版/自托管版均报"服务器连接失败"（splashscreen 阶段公钥拉取失败导致不创建主窗口）。用户要求做成**免登录版**：删除登录注册、删除更新，安装即用。

## 二、改造方案（方案 B：免登录本地启动 + 删除更新）

保留业务功能架构（服务器在则用，不在优雅降级），但：
1. **splashscreen 跳过服务器连接 + 更新检查**，直接创建主窗口
2. **前端 isAuthenticated 默认 true**，initAuth 跳过服务器调用
3. **绕过登录注册路由**，直接进主界面
4. **删除更新功能**（splashscreen update 段 + 相关命令/菜单项）

## 三、改造点清单（6 项，含文件+改法+验收）

### 改造 1：splashscreen 跳过服务器连接 + 更新（核心，解决报错源头）
**文件**：`src-tauri/src/app/splashscreen.rs`
**改法**：`init_startup` 函数中，删除/跳过：
- 步骤4「连接服务器」（118-140 行 init_server_public_key 检查 + connection_failed）
- 步骤4.1「检查更新」（142-208 行 check_updates/download/install）
改为：步骤3 完成后直接 emit "服务器连接成功"（伪造状态）→ 创建主窗口 → ready
**验收**：splashscreen 不再因服务器失败阻塞，直接进主窗口

### 改造 2：前端 useAuthStore 免登录
**文件**：`plugins/services/store/src/stores/auth/auth-store.ts`
**改法**：
- `isAuthenticated` 初始值改 `true`
- `user` 给一个本地默认用户对象（避免组件因 user=null 崩溃）
- `initAuth` 改为直接返回（不调 get_remembered_credential / tryAutoLogin）
**验收**：前端不调服务器登录，isAuthenticated 恒 true

### 改造 3：绕过登录注册路由拦截
**文件**：路由守卫相关（app-layout 插件 / useRouteConfig）
**改法**：找到拦截未登录跳 /auth/login 的逻辑，改为放行
**验收**：未登录也能进主界面，不跳登录页

### 改造 4：删除更新功能
**文件**：
- `src-tauri/src/app/splashscreen.rs`（已在改造1删除 update 段）
- `src-tauri/src/commands/updater.rs`（注销命令或保留但不调用）
- 前端「检查更新」入口（托盘菜单 prepared-update-button / 系统设置更新页）
**改法**：托盘菜单去掉「检查更新」项，前端隐藏更新相关 UI
**验收**：无更新检查触发，无更新 UI

### 改造 5：托盘菜单去除更新项
**文件**：`src-tauri/src/app/components/tray.rs`
**改法**：menu() 去掉 check_update 菜单项（本小姐之前加的）
**验收**：托盘右键无「检查更新」

### 改造 6：user-menu 退出登录处理
**文件**：`plugins/layouts/app-layout/src/components/titlebar/user-menu.tsx`
**改法**：退出登录改为直接退出应用（clearUser 会把 isAuthenticated 设 false 导致卡死，免登录版不应退出登录）
**验收**：用户菜单不导致 isAuthenticated=false 卡死

## 四、执行顺序（依赖关系）

```
改造1（splashscreen，独立）─┐
改造2（auth-store，独立）───┼─→ cargo check + pnpm build 验证
改造3（路由，依赖2）─────────┤
改造4/5（更新删除，独立）────┤
改造6（user-menu，依赖2）────┘
```

## 五、验收标准（Definition of Done）

1. cargo check 零错误
2. pnpm build 零错误
3. release exe 启动直接进主窗口（无"服务器连接失败"）
4. 无登录界面、无更新检查
5. 主界面核心功能可访问（环境/代理等页面能进）
6. 安装包构建成功 + 上传 GitHub

## 六、风险

- 业务功能（创建环境等）若依赖服务器会在免登录下失败 → 优雅降级（不崩溃）
- user=null 可能导致部分组件崩溃 → 改造2给默认 user 对象兜底

## 七、补丁记录：WebView2Loader.dll 缺失修复（2026-06-25）

### 问题现象
安装免登录版安装包后，启动 `simprint.exe` 弹出系统错误：
```
simprint.exe - 系统错误
由于找不到 WebView2Loader.dll，无法继续执行代码。重新安装程序可能会解决此问题。
```

### 根因分析（systematic-debugging 四阶段法）
1. **现象采集**：错误对话框明确指向 `WebView2Loader.dll` 缺失（非 WebView2 Runtime 缺失）。
2. **证据链**：
   - `target/release/WebView2Loader.dll`（160320 字节）存在，是 `webview2-com-sys-0.38.2` crate 自带 native 库（SHA256: `8427b1fc...`），build.rs 将其复制到 OUT_DIR 供链接，但运行期需作为外部 DLL 分发。
   - `tauri.conf.json` 的 `bundle.resources` 仅声明 `simprint-runtime.exe`，**未声明 WebView2Loader.dll**。
   - NSIS 模板 `{{#each resources}}` 只遍历配置中声明的资源 → DLL 未被打进安装包。
   - 渲染后 `target/release/nsis/x64/installer.nsi` 仅有 `simprint-runtime.exe` 一条 `File` 指令。
   - 用户安装目录 `D:\Program Files (x86)\Simprint\` 实测无 DLL。
3. **根因结论**：wry 0.53.5 / webview2-com-sys 默认将 WebView2Loader.dll 作为外部文件输出，而 Tauri 打包配置遗漏了它，导致安装包缺 DLL、程序启动即崩溃。

### 修复方案（三层）
| 层 | 改动 | 文件 |
|---|---|---|
| 资源层 | `WebView2Loader.dll` 复制到 `src-tauri/resources/` | `src-tauri/resources/WebView2Loader.dll`（新增） |
| 配置层 | `tauri.conf.json` 的 `bundle.resources` 增加 DLL 声明 | `src-tauri/tauri.conf.json` |
| 构建层 | `build.rs` 新增 `webview2_loader` 模块，构建期自动从 webview2-com-sys crate 源码同步最新版 DLL 到 resources/，避免未来版本错配 | `src-tauri/build.rs` |

### 验证证据
- cargo check 零错误（build.rs webview2_loader 模块编译通过）
- 重新构建后渲染 NSIS 第 649 行出现：`File /a "/oname=WebView2Loader.dll" "...resources\WebView2Loader.dll"`
- 安装包大小 41718762 → 41781000 字节（增加约 62KB，DLL LZMA 压缩后体积）
- 卸载旧版 → 安装新版 → 安装目录实测含 `WebView2Loader.dll`（160320 字节）
- 启动 simprint.exe 进程稳定存活（不再崩溃）
- 运行日志确认：`Server connection skipped (login-free mode)` → `主窗口已显示`
