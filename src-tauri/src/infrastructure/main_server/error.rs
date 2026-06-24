/// 错误处理模块
use thiserror::Error;

/// HTTP 响应错误类型
#[derive(Debug, Error)]
pub enum ResponseError {
    /// 未授权错误 (401)
    #[error("未授权访问 (401): {message}")]
    Unauthorized { message: String },

    /// 请求参数错误 (400)
    #[error("请求参数错误 (400): {message}")]
    BadRequest { message: String },

    /// 公钥过期错误 (422 + LASDE)
    #[error("公钥已过期 (422): 需要重新获取公钥")]
    PublicKeyExpired,

    /// 无法处理的实体错误 (422)
    #[error("无法处理的请求 (422): {message}")]
    UnprocessableEntity { message: String },

    /// 响应体为空
    #[error("服务器响应为空 ({status}): 服务器未返回任何数据")]
    EmptyResponse { status: u16 },

    /// JSON 解析失败
    #[error("JSON 解析失败 ({status}): {parse_error}. {detail}")]
    JsonParseError {
        status: u16,
        parse_error: String,
        detail: String,
    },

    /// 读取响应失败
    #[error("读取响应失败: {0}")]
    ReadResponseFailed(String),

    /// 解析加密数据失败
    #[error("解析加密数据失败: {0}")]
    ParseEncryptedDataFailed(String),

    /// 解密失败
    #[error("解密失败: {0}")]
    DecryptFailed(String),

    /// 解析响应失败
    #[error("解析响应失败: {0}")]
    ParseResponseFailed(String),
}

/// 检查是否是 401 未授权错误
pub fn is_unauthorized_error(err: &anyhow::Error) -> bool {
    err.downcast_ref::<ResponseError>()
        .map(|e| matches!(e, ResponseError::Unauthorized { .. }))
        .unwrap_or(false)
        || err.to_string().contains("StatusCode(401)")
}

/// 检查是否是公钥过期错误（422 + LASDE）
pub fn is_public_key_expired_error(err: &anyhow::Error) -> bool {
    err.downcast_ref::<ResponseError>()
        .map(|e| matches!(e, ResponseError::PublicKeyExpired))
        .unwrap_or(false)
        || err.to_string().contains("StatusCode(422):LASDE")
}
