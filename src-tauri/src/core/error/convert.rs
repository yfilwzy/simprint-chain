//! 自动错误转换
//!
//! 实现从其他错误类型到应用错误类型的自动转换

use super::Error;

/// 从基础设施层的网络错误转换
impl From<crate::infrastructure::main_server::error::ResponseError> for Error {
    fn from(err: crate::infrastructure::main_server::error::ResponseError) -> Self {
        use crate::infrastructure::main_server::error::ResponseError;
        match err {
            ResponseError::Unauthorized { .. } => Self::AuthTokenInvalid,
            ResponseError::PublicKeyExpired => Self::PublicKeyParseFailed,
            ResponseError::BadRequest { .. } => Self::NetworkRequestFailed,
            ResponseError::UnprocessableEntity { .. } => Self::NetworkRequestFailed,
            ResponseError::EmptyResponse { .. } => Self::NetworkRequestFailed,
            ResponseError::JsonParseError { .. } => Self::DeserializeFailed,
            ResponseError::ReadResponseFailed(_) => Self::NetworkRequestFailed,
            ResponseError::ParseEncryptedDataFailed(_) => Self::DecryptFailed,
            ResponseError::DecryptFailed(_) => Self::DecryptFailed,
            ResponseError::ParseResponseFailed(_) => Self::DeserializeFailed,
        }
    }
}

/// 从 anyhow::Error 转换（兜底转换）
impl From<anyhow::Error> for Error {
    fn from(_err: anyhow::Error) -> Self {
        Self::AppInitFailed
    }
}

/// 从 String 转换
impl From<String> for Error {
    fn from(err: String) -> Self {
        Self::KernelPrepareFailed(err)
    }
}

/// 从 &str 转换
impl From<&str> for Error {
    fn from(err: &str) -> Self {
        Self::KernelPrepareFailed(err.to_string())
    }
}

/// 从 reqwest::Error 转换
impl From<reqwest::Error> for Error {
    fn from(_err: reqwest::Error) -> Self {
        Self::NetworkRequestFailed
    }
}

/// 从 tauri::Error 转换
impl From<tauri::Error> for Error {
    fn from(_err: tauri::Error) -> Self {
        Self::WindowOperationFailed
    }
}

/// 从 zip::result::ZipError 转换
impl From<zip::result::ZipError> for Error {
    fn from(_err: zip::result::ZipError) -> Self {
        Self::KernelInstallFailed
    }
}
