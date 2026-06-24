/// 认证模块命令
///
/// 命令层仅负责参数解析和响应，业务逻辑由服务层处理
use crate::core::error::Result;
use crate::infrastructure::http::client::JsonRespnse;
use crate::services::auth::{CredentialService, LoginService, RegisterService};

// 重导出类型供外部使用
pub use crate::services::auth::{
    BasicLoginRequest, LoginResponse, LoginType, RegisterRequest, RememberPasswordLoginRequest,
};

// ============================================================================
// 登录相关命令
// ============================================================================

/// 登录命令
#[tauri::command]
pub async fn login(payload: LoginType) -> Result<JsonRespnse> {
    LoginService::login(payload).await
}

/// 保存凭证命令
#[tauri::command]
pub async fn save_credential(
    access_token: Option<String>,
    refresh_token: Option<String>,
) -> Result<()> {
    LoginService::save_credential(access_token, refresh_token).await
}

// ============================================================================
// 注册相关命令
// ============================================================================

/// 注册命令
#[tauri::command]
pub async fn register(payload: RegisterRequest) -> Result<JsonRespnse> {
    RegisterService::register(payload).await
}

// ============================================================================
// 凭证管理命令
// ============================================================================

/// 退出登录
#[tauri::command]
pub async fn logout() -> Result<()> {
    CredentialService::logout().await
}

/// 获取登录凭证（access_token）
#[tauri::command]
pub async fn get_access_token() -> Result<String> {
    CredentialService::get_access_token()
}

/// 检查是否已登录
#[tauri::command]
pub async fn is_logged_in() -> Result<bool> {
    Ok(CredentialService::is_logged_in())
}

/// 保存记住的凭证（用于"记住密码"功能）
#[tauri::command]
pub async fn save_remembered_credential(email: String, refresh_token: String) -> Result<()> {
    CredentialService::save_remembered_credential(email, refresh_token)
}

/// 获取记住的凭证（用于自动登录）
#[tauri::command]
pub async fn get_remembered_credential() -> Result<Option<(String, String)>> {
    CredentialService::get_remembered_credential()
}

/// 清除记住的凭证
#[tauri::command]
pub async fn clear_remembered_credential() -> Result<()> {
    CredentialService::clear_remembered_credential()
}
