//! 凭证领域模型
//!
//! 封装凭证相关的业务规则和验证逻辑

use serde::{Deserialize, Serialize};

/// 凭证领域对象
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Credential {
    /// 访问令牌
    pub access_token: String,
    /// 刷新令牌
    pub refresh_token: String,
}

impl Credential {
    /// 创建新凭证
    pub fn new(access_token: String, refresh_token: String) -> Self {
        Self {
            access_token,
            refresh_token,
        }
    }

    /// 验证凭证是否有效
    pub fn is_valid(&self) -> bool {
        !self.access_token.is_empty() && !self.refresh_token.is_empty()
    }

    /// 获取访问令牌
    pub fn access_token(&self) -> &str {
        &self.access_token
    }

    /// 获取刷新令牌
    pub fn refresh_token(&self) -> &str {
        &self.refresh_token
    }
}

/// 记住的凭证（用于自动登录）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RememberedCredential {
    /// 邮箱
    pub email: String,
    /// 刷新令牌
    pub refresh_token: String,
}

impl RememberedCredential {
    /// 创建记住的凭证
    pub fn new(email: String, refresh_token: String) -> Self {
        Self {
            email,
            refresh_token,
        }
    }

    /// 验证是否有效
    pub fn is_valid(&self) -> bool {
        !self.email.is_empty() && !self.refresh_token.is_empty()
    }
}
