//! 邀请码值对象
//!
//! 封装邀请码的解码和验证逻辑

use crate::core::error::Result;
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;

/// 邀请码值对象
#[derive(Debug, Clone)]
pub struct ReferralCode {
    code: String,
}

impl ReferralCode {
    /// 创建邀请码
    pub fn new(code: String) -> Self {
        Self { code }
    }

    /// 从 base64url 编码的字符串解码
    pub fn decode(encoded: &str) -> Result<Self> {
        let s = encoded.trim();
        if s.is_empty() {
            return Err("邀请码为空".into());
        }

        let decoded = URL_SAFE_NO_PAD.decode(s.as_bytes()).map_err(|_| "邀请码解码失败")?;

        let code = String::from_utf8(decoded).map_err(|_| "邀请码格式无效")?;

        if code.is_empty() {
            return Err("邀请码为空".into());
        }

        Ok(Self { code })
    }

    /// 验证邀请码是否有效
    pub fn is_valid(&self) -> bool {
        !self.code.is_empty()
    }

    /// 获取邀请码
    pub fn code(&self) -> &str {
        &self.code
    }
}
