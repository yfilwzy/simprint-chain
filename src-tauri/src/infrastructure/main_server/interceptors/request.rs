/// 请求拦截器模块
use reqwest::header::AUTHORIZATION;
use serde_json::Value;

use crate::app::context::AppContext;
use crate::infrastructure::http::encryption::{AesSecret, RsaSecret};

use crate::infrastructure::persistence::credential::{CREDENTIAL, SERVER_PUBLIC_KEY};

/// 加密拦截器
pub async fn encrypt(
    rb: reqwest::RequestBuilder,
) -> core::result::Result<reqwest::RequestBuilder, reqwest::Error> {
    // 获取请求的 URL，检查是否是获取公钥的请求
    let url = rb
        .try_clone()
        .and_then(|r| r.build().ok())
        .and_then(|req| Some(req.url().to_string()))
        .unwrap_or_default();

    // 如果是获取公钥的请求，直接返回，不加密
    if url.contains("/secret/public/key") {
        return Ok(rb);
    }

    // 尝试获取并提取请求体
    let cloned_rb = match rb.try_clone() {
        Some(r) => r,
        None => return Ok(rb), // 无法克隆，直接返回原请求
    };

    // 检查是否有 JSON 请求体
    let built_request = match cloned_rb.build() {
        Ok(req) => req,
        Err(_) => return Ok(rb),
    };

    let body = match built_request.body() {
        Some(b) => b.as_bytes().unwrap_or(&[]),
        None => return Ok(rb),
    };

    if body.is_empty() {
        return Ok(rb);
    }

    // 解析请求体为 JSON
    let mut json_body: Value = match serde_json::from_slice(body) {
        Ok(v) => v,
        Err(_) => return Ok(rb), // 不是 JSON，不处理
    };

    // 添加 api_secret
    if let Some(obj) = json_body.as_object_mut() {
        let ctx = AppContext::get();
        obj.insert(
            "api_secret".to_string(),
            Value::String(ctx.config.server.secret_key.clone()),
        );
    }

    // 获取服务器公钥（必须已初始化）
    let public_key = match SERVER_PUBLIC_KEY.read().unwrap().clone() {
        Some(key) => key,
        None => {
            return Ok(rb); // 公钥未初始化，不加密
        }
    };

    // 加密数据
    let encrypted_body = match encrypt_request_body(&json_body, &public_key) {
        Ok(body) => body,
        Err(_) => {
            return Ok(rb); // 加密失败，返回原请求
        }
    };

    // 重新构建带加密数据的请求
    Ok(rb.json(&encrypted_body))
}

/// 认证拦截器
pub async fn auth(
    rb: reqwest::RequestBuilder,
) -> core::result::Result<reqwest::RequestBuilder, reqwest::Error> {
    let mut headers = reqwest::header::HeaderMap::new();

    if let Ok(cred) = CREDENTIAL.read() {
        if let Some(token) = cred.get_access_token() {
            if let Ok(token) = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", token))
            {
                headers.insert(AUTHORIZATION, token);
            }
        }
    }

    Ok(rb.headers(headers))
}

/// 加密请求体
fn encrypt_request_body(data: &Value, public_key: &str) -> Result<Value, String> {
    // 创建 AES 密钥
    let aes_secret = AesSecret::new();

    // 序列化数据
    let json_string = serde_json::to_string(data).map_err(|_| "Failed to serialize data")?;

    // AES 加密数据
    let encrypted_data = aes_secret
        .encrypt(json_string.as_bytes())
        .map_err(|_| "AES encryption failed")?;

    // RSA 加密 AES 密钥
    let encrypted_key =
        RsaSecret::encrypt_with_public_key(aes_secret.get_key_as_base64().as_bytes(), public_key)
            .map_err(|_| "RSA encryption failed")?;

    Ok(serde_json::json!({
        "data": encrypted_data,
        "encrypted": true,
        "key": encrypted_key
    }))
}
