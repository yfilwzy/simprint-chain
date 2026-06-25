use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};

// 前端就绪标志
static SPLASHSCREEN_FRONTEND_READY: std::sync::OnceLock<Arc<AtomicBool>> =
    std::sync::OnceLock::new();

/// 获取前端就绪标志
fn get_frontend_ready_flag() -> Arc<AtomicBool> {
    SPLASHSCREEN_FRONTEND_READY
        .get_or_init(|| Arc::new(AtomicBool::new(false)))
        .clone()
}

/// 检查前端是否已就绪
fn is_frontend_ready() -> bool {
    get_frontend_ready_flag().load(Ordering::Acquire)
}

/// 设置前端已就绪
pub fn set_frontend_ready() {
    get_frontend_ready_flag().store(true, Ordering::Release);
}

/// 发射加载进度事件到 splashscreen
fn emit_progress(app_handle: &AppHandle, progress: u8, text: &str, status: Option<&str>) {
    if let Some(splash_window) = app_handle.get_webview_window("splashscreen") {
        #[derive(serde::Serialize, Clone)]
        struct ProgressPayload {
            progress: u8,
            text: String,
            status: Option<String>,
        }

        let _ = splash_window.emit(
            "splashscreen-progress",
            ProgressPayload {
                progress,
                text: text.to_string(),
                status: status.map(|s| s.to_string()),
            },
        );
    }
}

/// 发射状态完成事件
fn emit_status_complete(app_handle: &AppHandle, status: &str) {
    if let Some(splash_window) = app_handle.get_webview_window("splashscreen") {
        #[derive(serde::Serialize, Clone)]
        struct StatusCompletePayload {
            status: String,
        }

        let _ = splash_window.emit(
            "splashscreen-status-complete",
            StatusCompletePayload {
                status: status.to_string(),
            },
        );
    }
}

/// 发射加载完成事件
fn emit_ready(app_handle: &AppHandle) {
    // 向 splashscreen 窗口发送加载完成事件
    if let Some(splash_window) = app_handle.get_webview_window("splashscreen") {
        let _ = splash_window.emit("splashscreen-ready", ());
    }
    // 向主窗口发送加载完成事件，通知主窗口加载逻辑已完成
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let _ = main_window.emit("splashscreen-loading-complete", ());
    }
}

/// 发射连接失败事件（公钥初始化失败时调用，停止后续流程）
fn emit_connection_failed(app_handle: &AppHandle) {
    if let Some(splash_window) = app_handle.get_webview_window("splashscreen") {
        let _ = splash_window.emit("splashscreen-connection-failed", ());
    }
}

/// 初始化应用启动流程（显示 splashscreen 并控制加载）
pub fn init_startup(app_handle: AppHandle) {
    // 注意：splashscreen 窗口由前端控制显示，确保内容准备好后再显示
    // 窗口在 tauri.conf.json 中配置为 visible: false，前端会在内容准备好后调用 show()

    // 异步执行加载流程
    tauri::async_runtime::spawn(async move {
        let app_handle_clone = app_handle.clone();

        // 等待前端通知准备就绪（无限期等待，直到前端调用 splashscreen_ready）
        while !is_frontend_ready() {
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }

        // 步骤1: 初始化应用
        emit_progress(&app_handle_clone, 10, "正在初始化...", Some("init"));
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        emit_status_complete(&app_handle_clone, "init");

        // 步骤2: 加载配置
        emit_progress(&app_handle_clone, 30, "加载配置中...", Some("config"));
        tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
        emit_status_complete(&app_handle_clone, "config");

        // 步骤3: 初始化安全上下文
        emit_progress(
            &app_handle_clone,
            50,
            "初始化安全上下文...",
            Some("security"),
        );
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        emit_status_complete(&app_handle_clone, "security");

        // 步骤4: 服务器连接（免登录版：跳过公钥拉取，直接视为成功）
        emit_progress(&app_handle_clone, 70, "准备应用...", Some("server"));
        tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;
        log::info!("Server connection skipped (login-free mode)");
        emit_status_complete(&app_handle_clone, "server");
        emit_progress(&app_handle_clone, 90, "就绪中...", None);

        // 免登录版：跳过更新检查（更新功能已移除）

        // 创建主窗口
        if let Err(e) = crate::commands::window::create_main_window(app_handle_clone.clone()).await
        {
            log::error!("Failed to create main window: {}", e);
        }

        // 破限本地版：自动启用 Local API + MCP server（开箱即用，无需手动开开关）
        {
            let app_for_auto = app_handle_clone.clone();
            tokio::task::spawn(async move {
                let ctx = crate::app::context::AppContext::get();
                // 自动启用 Local API
                if let Err(e) = ctx.local_api_manager.refresh_from_server().await {
                    log::warn!("[AutoStart] Local API server 启动失败: {}", e);
                }
                // 自动启用 MCP（写 enabled=true 配置再启动）
                use crate::infrastructure::persistence::tauri_store::{get_store_key, set_store_key, keys};
                let mcp_enabled = get_store_key(&app_for_auto, keys::MCP)
                    .and_then(|v| v.get("enabled").and_then(|e| e.as_bool()))
                    .unwrap_or(false);
                if !mcp_enabled {
                    let _ = set_store_key(&app_for_auto, keys::MCP, serde_json::json!({"enabled": true}));
                }
                if let Err(e) = ctx.mcp_manager.start(&app_for_auto).await {
                    log::warn!("[AutoStart] MCP server 启动失败: {}", e);
                }
                log::info!("[AutoStart] Local API + MCP server 已自动启用");
            });
        }

        // 步骤5: 准备就绪
        emit_progress(&app_handle_clone, 100, "准备就绪", Some("ready"));
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
        emit_status_complete(&app_handle_clone, "ready");

        // 发射加载完成事件（前端会自动关闭 splashscreen 并显示主窗口）
        emit_ready(&app_handle_clone);
    });
}
