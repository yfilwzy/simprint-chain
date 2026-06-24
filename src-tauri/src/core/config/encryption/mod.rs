//! 配置加密模块
//!
//! 提供配置文件的加密和解密功能，包括密钥派生和多层加密

mod crypto;
mod key_derivation;

// 导出加密/解密函数
pub use crypto::{decrypt, encrypt};
