/// 凭证服务
///
/// 封装凭证管理相关的业务逻辑
use crate::core::error::Result;
use crate::infrastructure::persistence::credential::remembered;
use crate::infrastructure::persistence::credential::{clear_credential, get_credential, is_login};
use crate::local_api;

/// 凭证服务
pub struct CredentialService;

impl CredentialService {
    /// 退出登录
    pub async fn logout() -> Result<()> {
        clear_credential();
        remembered::clear_remembered_credential()?;
        log::trace!("用户已退出登录");

        if let Some(ctx) = crate::app::context::AppContext::try_get() {
            ctx.simprint_runtime_manager.stop().await;
        }
        local_api::stop_runtime();

        Ok(())
    }

    /// 获取访问令牌
    pub fn get_access_token() -> Result<String> {
        get_credential().get_access_token().ok_or_else(|| "获取登录凭证失败".into())
    }

    /// 检查是否已登录
    pub fn is_logged_in() -> bool {
        is_login()
    }

    /// 保存记住的凭证
    pub fn save_remembered_credential(email: String, refresh_token: String) -> Result<()> {
        remembered::save_remembered_credential(email, refresh_token)?;
        Ok(())
    }

    /// 获取记住的凭证
    pub fn get_remembered_credential() -> Result<Option<(String, String)>> {
        Ok(remembered::get_remembered_credential()?)
    }

    /// 清除记住的凭证
    pub fn clear_remembered_credential() -> Result<()> {
        remembered::clear_remembered_credential()?;
        log::trace!("记住的凭证已清除");
        Ok(())
    }
}
