use tauri::{AppHandle, Emitter};
#[cfg(desktop)]
use tauri_plugin_autostart::MacosLauncher;

/// 注册插件（容错：单个插件失败记录日志但不阻断启动，避免任一插件异常致全应用崩溃）
pub fn register_plugins(app_handle: &AppHandle) {
    // 辅助：注册插件并记录失败（非关键插件失败不 panic）
    let try_register = |name: &str, result: tauri::Result<()>| {
        if let Err(e) = result {
            log::error!("[Setup] 插件「{}」注册失败（不阻断启动）: {}", name, e);
        }
    };

    // Register the single instance plugin
    #[cfg(any(target_os = "windows", target_os = "macos", target_os = "linux"))]
    #[cfg(feature = "production")]
    try_register(
        "single_instance",
        app_handle.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            use tauri::Manager;

            if let Some(main_window) = app.get_webview_window("main") {
                // 如果程序启动期间得到深度链接参数，则将事件传递并传递打开的链接给前端。
                if let Some(arg_1) = argv.get(1) {
                    if arg_1.contains("://") {
                        // 收到 deep link 时，先在本地持久化 referral_code（若有）
                        crate::infrastructure::deeplink::process_arg(arg_1);
                        let _ = main_window.emit("deep-link-open", arg_1);
                    }

                    return;
                }

                let _ = main_window.show();
                let _ = main_window.set_focus();
            }
        })),
    );

    try_register("process", app_handle.plugin(tauri_plugin_process::init()));
    try_register("upload", app_handle.plugin(tauri_plugin_upload::init()));
    try_register("deep_link", app_handle.plugin(tauri_plugin_deep_link::init()));
    try_register("opener", app_handle.plugin(tauri_plugin_opener::init()));
    try_register("dialog", app_handle.plugin(tauri_plugin_dialog::init()));
    try_register(
        "store",
        app_handle.plugin(tauri_plugin_store::Builder::new().build()),
    );
    try_register(
        "clipboard_manager",
        app_handle.plugin(tauri_plugin_clipboard_manager::init()),
    );

    // 自动启动插件
    #[cfg(desktop)]
    try_register(
        "autostart",
        app_handle.plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]), /* 传递给应用程序的任意数量的参数 */
        )),
    );
}

/// 注册深度链接
#[allow(dead_code)]
pub fn register_deep_link(app: AppHandle) -> Result<(), anyhow::Error> {
    #[cfg(any(windows, target_os = "linux"))]
    {
        use tauri_plugin_deep_link::DeepLinkExt;
        app.deep_link().register_all()?;
    };
    Ok(())
}

/// 后台初始化服务器公钥
pub fn init_server_public_key_background(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        match crate::infrastructure::persistence::credential::init_server_public_key().await {
            Ok(_) => {
                log::info!("Server connection successful");
                // 通知前端：服务器连接成功
                let _ = app_handle.emit("server-connected", ());
            }
            Err(e) => {
                log::warn!("Server connection failed: {}", e);
                // 通知前端：服务器连接失败
                let _ = app_handle.emit("server-connection-failed", e);
            }
        }
    });
}

pub fn init_simprint_runtime_background(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        use crate::app::context::AppContext;

        let ctx = AppContext::get();
        ctx.simprint_runtime_manager.set_app_handle(app_handle.clone()).await;
        ctx.runtime_update_service.start_background(app_handle.clone());

        if let Err(error) = ctx.simprint_runtime_manager.start_background().await {
            log::warn!("failed to start simprint-runtime: {}", error);
        }
    });
}
