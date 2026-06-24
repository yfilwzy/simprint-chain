/// 加密解密辅助模块
use crate::app::context::AppContext;
use crate::infrastructure::http::encryption::AesSecret;
use serde::{Deserialize, Serialize};
use serde_json::Value;

/// 加密的数据结构
#[derive(Debug, Deserialize, Serialize)]
pub struct EncryptedData {
    pub encrypted: bool,
    #[serde(default)]
    pub data: String,
    #[serde(default)]
    pub key: String,
}

/// 解密加密的数据
pub fn decrypt_if_encrypted(encrypted_data: &EncryptedData) -> Result<Value, String> {
    // 如果没有加密，直接解析 data 字段
    if !encrypted_data.encrypted {
        return serde_json::from_str(&encrypted_data.data)
            .map_err(|_| "Failed to parse data".to_string());
    }

    let ctx = AppContext::get();

    // 解密 AES 密钥
    let aes_key_bytes = ctx
        .rsa_keypair
        .decrypt(&encrypted_data.key)
        .map_err(|_| "Failed to decrypt AES key")?;

    let aes_key_str =
        std::str::from_utf8(&aes_key_bytes).map_err(|_| "Failed to convert AES key to string")?;

    // 创建 AES 实例
    let aes_secret =
        AesSecret::try_from(aes_key_str).map_err(|_| "Failed to create AES instance")?;

    // 解密数据
    let decrypted_bytes =
        aes_secret.decrypt(&encrypted_data.data).map_err(|_| "Failed to decrypt data")?;

    // 解析为 JSON
    let decrypted_value: Value =
        serde_json::from_slice(&decrypted_bytes).map_err(|_| "Failed to parse decrypted data")?;

    Ok(decrypted_value)
}
