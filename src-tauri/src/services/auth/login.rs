/// 登录服务
///
/// 封装登录相关的业务逻辑
use crate::app::context::AppContext;
use crate::core::error::Result;
use crate::domain::credential::Credential;
use crate::infrastructure::http::client::JsonRespnse;
use crate::infrastructure::persistence::credential::{set_access_token, set_refresh_token};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

/// 基本登录请求（邮箱 + 密码）
#[derive(Serialize, Deserialize)]
pub struct BasicLoginRequest {
    pub email: String,
    pub password: String,
}

/// 记住密码登录请求
#[derive(Serialize, Deserialize)]
pub struct RememberPasswordLoginRequest {
    pub email: String,
    pub refresh_token: String,
}

/// 登录方式
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", content = "data", rename_all = "snake_case")]
pub enum LoginType {
    /// 基本登录（邮箱 + 密码）
    Basic(BasicLoginRequest),
    /// 记住密码登录（邮箱 + refresh_token）
    RememberPassword(RememberPasswordLoginRequest),
}

/// 登录响应
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoginResponse {
    /// 访问令牌
    pub access_token: String,
    /// 刷新令牌
    pub refresh_token: String,
    /// 是否首次登录
    pub is_first_login: Option<bool>,
    /// 用户信息
    #[serde(default)]
    pub user_info: Option<Value>,
    /// 用户额外信息
    #[serde(default)]
    pub user_extra: Option<Value>,
}

/// 登录服务
pub struct LoginService;

impl LoginService {
    /// 执行登录
    pub async fn login(payload: LoginType) -> Result<JsonRespnse> {
        let ctx = AppContext::get();

        // 1. 获取 RSA 公钥
        let public_key = ctx.rsa_keypair.get_public_key()?;

        // 2. 构建登录请求
        let request_payload = Self::build_login_payload(payload, public_key);

        // 3. 发起登录请求
        let result = ctx.main_server_client.post("users/login", &request_payload).await?;

        // 4. 处理登录响应
        if let Some(data) = result.data.clone() {
            Self::handle_login_response(data).await?;
        }

        Ok(result)
    }

    /// 保存凭证
    pub async fn save_credential(
        access_token: Option<String>,
        refresh_token: Option<String>,
    ) -> Result<()> {
        if let Some(access_token) = access_token {
            set_access_token(access_token);
        }
        if let Some(refresh_token) = refresh_token {
            set_refresh_token(refresh_token);
        }

        sync_runtime_session_state().await?;

        Ok(())
    }

    /// 构建登录请求
    fn build_login_payload(payload: LoginType, public_key: String) -> Value {
        match payload {
            LoginType::Basic(request) => json!({
                "login_type": "basic",
                "email": request.email,
                "password": request.password,
                "public_secret_key": public_key,
            }),
            LoginType::RememberPassword(request) => json!({
                "login_type": "remember",
                "email": request.email,
                "refresh_token": request.refresh_token,
                "public_secret_key": public_key,
            }),
        }
    }

    /// 处理登录响应
    async fn handle_login_response(data: Value) -> Result<()> {
        // 解析登录响应
        let login_response: LoginResponse = serde_json::from_value(data)?;

        // 使用领域对象创建凭证
        let credential = Credential::new(
            login_response.access_token.clone(),
            login_response.refresh_token.clone(),
        );

        // 验证凭证
        if !credential.is_valid() {
            return Err("登录响应中的凭证无效".into());
        }

        // 保存凭证到存储层
        set_access_token(credential.access_token().to_string());
        set_refresh_token(credential.refresh_token().to_string());
        sync_runtime_session_state().await?;

        Ok(())
    }
}

pub async fn sync_runtime_session_state() -> Result<()> {
    if let Some(ctx) = AppContext::try_get() {
        ctx.simprint_runtime_manager.sync_session_state().await?;
    }

    Ok(())
}
