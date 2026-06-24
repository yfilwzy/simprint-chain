use crate::app::context::AppContext;
/// 安全相关的 Tauri 命令
use crate::app::session_lock::{SessionLockManager, SessionLockStateResponse};
use crate::core::error::Result;
use tauri::{AppHandle, State};

/// 获取客户端公钥
#[tauri::command]
pub fn get_client_public_key() -> Result<String> {
    let ctx = AppContext::get();
    let public_key = ctx.rsa_keypair.get_public_key()?;
    Ok(public_key)
}

/// 上报用户活跃
#[tauri::command]
pub async fn report_user_activity(
    _source: Option<String>,
    state: State<'_, SessionLockManager>,
) -> Result<()> {
    state.report_activity().await;
    Ok(())
}

/// 获取当前会话锁定状态
#[tauri::command]
pub async fn get_session_lock_state(
    state: State<'_, SessionLockManager>,
) -> Result<SessionLockStateResponse> {
    Ok(state.get_state().await)
}

/// 解锁当前会话
#[tauri::command]
pub async fn unlock_session(app: AppHandle, state: State<'_, SessionLockManager>) -> Result<()> {
    state.unlock(&app).await;
    Ok(())
}
