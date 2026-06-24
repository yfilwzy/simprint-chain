use crate::app::init_state::AppInitState;
use serde::Deserialize;
use tauri::{AppHandle, Manager};

pub struct StartupService;

const GENERAL_SETTINGS_STORE_KEY: &str = "general";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeneralSettingsSnapshot {
    start_minimized: Option<bool>,
}

fn should_start_minimized(app: &AppHandle) -> bool {
    crate::infrastructure::persistence::tauri_store::get_store_key(app, GENERAL_SETTINGS_STORE_KEY)
        .and_then(|raw| serde_json::from_value::<GeneralSettingsSnapshot>(raw).ok())
        .and_then(|settings| settings.start_minimized)
        .unwrap_or(false)
}

impl StartupService {
    /// 设置应用为更新状态
    pub async fn set_updating_state() -> Result<(), ()> {
        let mut app_state = AppInitState::default();
        app_state.is_updating = true;
        app_state.is_initialized = false;

        let _ = crate::app::init_state::update_app_init_state(app_state);

        Ok(())
    }

    /// 获取应用状态
    pub async fn get_app_state() -> Result<AppInitState, ()> {
        let app_state = crate::app::init_state::read_app_init_state();
        Ok(app_state)
    }

    /// 完成加载并显示主窗口（关闭加载窗口并显示主窗口）
    pub async fn complete_and_show_main(app: AppHandle) -> Result<(), ()> {
        // 设置为已初始化状态
        {
            let mut app_state = AppInitState::default();
            app_state.is_initialized = true;
            app_state.is_updating = false;
            let _ = crate::app::init_state::update_app_init_state(app_state);
        }

        // 关闭 splashscreen 窗口
        if let Some(splash_window) = app.get_webview_window("splashscreen") {
            let _ = splash_window.close();
        }

        // 按配置决定是否显示主窗口
        if let Some(main_window) = app.get_webview_window("main") {
            if should_start_minimized(&app) {
                log::info!("启动时最小化已启用，主窗口保持隐藏");
            } else {
                let _ = main_window.show();
                let _ = main_window.set_focus();
                log::info!("主窗口已显示");
            }
        }

        Ok(())
    }

    /// 显示主窗口（由前端在内容渲染完成后调用）
    pub async fn show_main_window(app: AppHandle) -> Result<(), ()> {
        if let Some(main_window) = app.get_webview_window("main") {
            if should_start_minimized(&app) {
                log::info!("启动时最小化已启用，跳过主窗口显示");
            } else {
                let _ = main_window.show();
                let _ = main_window.set_focus();
                log::info!("主窗口已显示");
            }
        }
        Ok(())
    }

    /// 通知后端前端 splashscreen 已准备好接收事件
    pub async fn splashscreen_ready() -> Result<(), ()> {
        crate::app::splashscreen::set_frontend_ready();
        Ok(())
    }
}
