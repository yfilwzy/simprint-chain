use std::fmt::Debug;

use base64::Engine;
use rsa::{
    Pkcs1v15Encrypt, RsaPrivateKey, RsaPublicKey,
    pkcs1::{DecodeRsaPublicKey, EncodeRsaPublicKey},
};

#[derive(Debug, Clone)]
pub struct RsaSecret {
    pub private_key: RsaPrivateKey,
    pub public_key: RsaPublicKey,
}

impl RsaSecret {
    pub fn new() -> Result<Self, anyhow::Error> {
        let mut rng = rsa::rand_core::OsRng::default();

        let bits = 2048;
        let private_key = RsaPrivateKey::new(&mut rng, bits)?;
        let public_key = private_key.to_public_key();

        Ok(RsaSecret {
            private_key,
            public_key,
        })
    }

    /// 获取公钥对
    pub fn get_public_key(&self) -> Result<String, anyhow::Error> {
        self.public_key.to_pkcs1_pem(rsa::pkcs8::LineEnding::LF).map_err(|e| {
            log::error!("Failed to encode public key: {:?}", e);
            anyhow::anyhow!("Failed to encode public key")
        })
    }

    /// 获取私钥对
    pub fn get_private_key(&self) -> RsaPrivateKey {
        self.private_key.clone()
    }

    /// 解密为默认的&[u8]
    pub fn decrypt(&self, data: &str) -> Result<Vec<u8>, anyhow::Error> {
        // base64 解码
        let data = base64::engine::general_purpose::STANDARD.decode(data).map_err(|e| {
            log::error!("Failed to decode base64: {:?}", e);
            anyhow::anyhow!("Failed to decode base64")
        })?;

        let private_key = &self.private_key;
        let decrypted_data = private_key.decrypt(Pkcs1v15Encrypt, &data)?;

        Ok(decrypted_data)
    }

    /// 使用公钥加密
    pub fn encrypt(&self, data: &[u8]) -> Result<String, anyhow::Error> {
        let public_key = &self.private_key.to_public_key();

        let mut rng = rsa::rand_core::OsRng::default();
        let encrypted_data = public_key.encrypt(&mut rng, Pkcs1v15Encrypt, data).map_err(|e| {
            log::error!("Failed to encrypt data: {:?}", e);
            anyhow::anyhow!("Failed to encrypt data")
        })?;

        let encoded_data = base64::engine::general_purpose::STANDARD.encode(&encrypted_data);

        Ok(encoded_data)
    }

    /// 使用公钥加密, 根据接收到的公钥
    pub fn encrypt_with_public_key(data: &[u8], public_key: &str) -> Result<String, anyhow::Error> {
        let public_key = rsa::RsaPublicKey::from_pkcs1_pem(public_key).map_err(|e| {
            log::error!("Failed to parse public key: {:?}", e);
            anyhow::anyhow!("Failed to parse public key")
        })?;

        let mut rng = rsa::rand_core::OsRng::default();
        let encrypted_data = public_key.encrypt(&mut rng, Pkcs1v15Encrypt, data).map_err(|e| {
            log::error!("Failed to encrypt data: {:?}", e);
            anyhow::anyhow!("Failed to encrypt data")
        })?;

        let encoded_data = base64::engine::general_purpose::STANDARD.encode(&encrypted_data);

        Ok(encoded_data)
    }
}
