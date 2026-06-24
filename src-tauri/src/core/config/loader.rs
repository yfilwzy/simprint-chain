//! 配置加载和解密
//!
//! 负责从不同来源加载配置并进行解密

use super::encryption;
use super::types::AppConfig;
use crate::core::error::{Error, Result};
use config::{Config, FileFormat};

/// 编译期从 OUT_DIR 中引入加密后的配置二进制
const ENCRYPTED_CONFIG: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/config_encrypted.bin"));

/// 解密配置内容
fn decrypt_config() -> Result<String> {
    let decrypted =
        encryption::decrypt(ENCRYPTED_CONFIG).map_err(|e| Error::ConfigDecryptFailed(e))?;
    String::from_utf8(decrypted).map_err(|e| Error::ConfigDecryptFailed(e.to_string()))
}

/// 从字符串加载配置
pub fn load_from_str(config_str: &str) -> Result<AppConfig> {
    let config = Config::builder()
        .add_source(config::File::from_str(config_str, FileFormat::Toml))
        .add_source(config::File::with_name(".").required(false))
        .add_source(config::Environment::with_prefix("APP"))
        .build()
        .map_err(|e| Error::ConfigLoadFailed(e.to_string()))?;

    config.try_deserialize().map_err(|e| Error::ConfigParseFailed(e.to_string()))
}

/// 从文件路径加载配置
pub fn load_from_path(config_path: &str) -> Result<AppConfig> {
    let config = Config::builder()
        .add_source(config::File::with_name(config_path))
        .add_source(config::File::with_name(".").required(false))
        .add_source(config::Environment::with_prefix("APP"))
        .build()
        .map_err(|e| Error::ConfigLoadFailed(e.to_string()))?;

    config.try_deserialize().map_err(|e| Error::ConfigParseFailed(e.to_string()))
}

/// 加载嵌入的加密配置
pub fn load_embedded() -> Result<AppConfig> {
    let config_str = decrypt_config()?;
    load_from_str(&config_str)
}
