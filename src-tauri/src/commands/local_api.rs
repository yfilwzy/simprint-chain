use crate::app::context::AppContext;
use crate::core::error::Result;

#[tauri::command]
pub fn get_local_api_runtime_running() -> bool {
    AppContext::get().local_api_manager.is_running()
}

#[tauri::command]
pub async fn start_local_api_runtime() -> Result<()> {
    let ctx = AppContext::get();
    ctx.local_api_manager.refresh_from_server().await?;
    Ok(())
}

#[tauri::command]
pub async fn reload_local_api_runtime() -> Result<()> {
    let ctx = AppContext::get();
    ctx.local_api_manager.refresh_from_server().await?;
    Ok(())
}

#[tauri::command]
pub async fn stop_local_api_runtime() -> Result<()> {
    let ctx = AppContext::get();
    ctx.local_api_manager.stop().await;
    Ok(())
}
