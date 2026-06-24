/// 注册服务
///
/// 封装注册相关的业务逻辑
use crate::app::context::AppContext;
use crate::core::error::Result;
use crate::domain::credential::Credential;
use crate::domain::referral_code::ReferralCode;
use crate::infrastructure::http::client::JsonRespnse;
use crate::infrastructure::persistence::credential::{set_access_token, set_refresh_token};
use crate::services::auth::login::LoginResponse;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::fs;

/// 注册请求
#[derive(Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub referral_code: Option<String>,
}

/// 注册服务
pub struct RegisterService;

impl RegisterService {
    /// 执行注册
    pub async fn register(payload: RegisterRequest) -> Result<JsonRespnse> {
        let ctx = AppContext::get();

        // 1. 获取 RSA 公钥
        let public_key = ctx.rsa_keypair.get_public_key()?;

        // 2. 从邮箱提取 nickname
        let nickname = payload.email.split('@').next().map(|s| s.to_string()).unwrap_or_default();

        // 3. 处理邀请码
        let referral_code = Self::resolve_referral_code(payload.referral_code);

        // 4. 构建注册请求
        let request_payload = Self::build_register_payload(
            payload.email,
            payload.password,
            payload.code,
            nickname,
            public_key,
            referral_code,
        );

        // 5. 发起注册请求
        let result = ctx.main_server_client.post("users/register", &request_payload).await?;

        // 6. 处理注册响应
        if let Some(data) = result.data.clone() {
            Self::handle_register_response(data).await?;
        }

        Ok(result)
    }

    /// 构建注册请求
    fn build_register_payload(
        email: String,
        password: String,
        code: String,
        nickname: String,
        public_key: String,
        referral_code: Option<String>,
    ) -> Value {
        let mut payload = json!({
            "email": email,
            "password": password,
            "code": code,
            "nickname": nickname,
            "public_secret_key": public_key,
        });

        if let Some(code) = referral_code {
            payload["referral_code"] = json!(code);
        }

        payload
    }

    /// 处理注册响应
    async fn handle_register_response(data: Value) -> Result<()> {
        let login_response: LoginResponse = serde_json::from_value(data)?;

        // 使用领域对象创建凭证
        let credential = Credential::new(
            login_response.access_token.clone(),
            login_response.refresh_token.clone(),
        );

        // 验证凭证
        if !credential.is_valid() {
            return Err("注册响应中的凭证无效".into());
        }

        // 保存凭证到存储层
        set_access_token(credential.access_token().to_string());
        set_refresh_token(credential.refresh_token().to_string());
        crate::services::auth::login::sync_runtime_session_state().await?;

        Ok(())
    }

    /// 解析邀请码
    fn resolve_referral_code(user_provided: Option<String>) -> Option<String> {
        // 优先使用用户提供的邀请码
        let code = user_provided
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .or_else(|| {
                // 从安装目录读取邀请码
                Self::read_installed_referral_code().and_then(Self::decode_referral_code)
            });

        code
    }

    /// 解码邀请码（base64url）
    fn decode_referral_code(encoded: String) -> Option<String> {
        // 使用领域对象解码邀请码
        ReferralCode::decode(&encoded)
            .ok()
            .filter(|code| code.is_valid())
            .map(|code| code.code().to_string())
    }

    /// 从统一路径中的 referral 目录读取邀请码
    fn read_installed_referral_code() -> Option<String> {
        let referral_dir = crate::core::paths::PathManager::get_referral_dir().ok()?;

        if !referral_dir.is_dir() {
            return None;
        }

        // 提取邀请码
        let code_opt: Option<String> = (|| {
            let mut entries: Vec<_> =
                fs::read_dir(&referral_dir).ok()?.filter_map(|e| e.ok()).collect();
            entries.sort_by_key(|e| e.file_name());

            let first_entry = entries.into_iter().next()?;
            let path = first_entry.path();
            if !path.is_file() {
                return None;
            }

            let file_name = path.file_name()?.to_string_lossy();
            let re = Regex::new(r"R_(.+)_R").ok()?;
            let cap = re.captures(file_name.as_ref())?;
            cap.get(1).map(|m| m.as_str().to_string())
        })();

        // 清理 referral 目录
        let _ = fs::remove_dir_all(&referral_dir);

        code_opt
    }
}
