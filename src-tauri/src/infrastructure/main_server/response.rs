/// 响应解析和解密模块
use crate::infrastructure::http::client::Client;
use crate::infrastructure::http::client::JsonRespnse;

use crate::infrastructure::main_server::error::ResponseError;
use crate::infrastructure::main_server::interceptors::crypto::{
    EncryptedData, decrypt_if_encrypted,
};

/// 构建完整的 API URL
pub fn build_url(resource: &str) -> Result<reqwest::Url, anyhow::Error> {
    Client::build_url(resource)
}

/// 解析并解密响应（业务层逻辑）
pub async fn parse_and_decrypt_response(
    response: reqwest::Response,
) -> core::result::Result<JsonRespnse, anyhow::Error> {
    let status = response.status();
    let status_code = status.as_u16();

    // 检查 HTTP 401
    if status == reqwest::StatusCode::UNAUTHORIZED {
        let body_text = response.text().await.unwrap_or_default();
        let message =
            extract_error_message(&body_text).unwrap_or_else(|| "请检查登录状态".to_string());
        return Err(ResponseError::Unauthorized { message }.into());
    }

    // 检查 HTTP 400
    if status == reqwest::StatusCode::BAD_REQUEST {
        let body_text = response.text().await.unwrap_or_default();
        let message =
            extract_error_message(&body_text).unwrap_or_else(|| "请求参数错误".to_string());
        return Err(ResponseError::BadRequest { message }.into());
    }

    // 检查 HTTP 422（可能是公钥过期）
    if status == reqwest::StatusCode::UNPROCESSABLE_ENTITY {
        // 先读取响应体
        let body_text = response
            .text()
            .await
            .map_err(|e| ResponseError::ReadResponseFailed(e.to_string()))?;

        // 尝试解析并检查是否是公钥过期错误
        if let Ok(body_json) = serde_json::from_str::<serde_json::Value>(&body_text) {
            if let Some(message) = body_json.get("message").and_then(|m| m.as_str()) {
                if message.contains("LASDE") {
                    // 公钥过期错误
                    return Err(ResponseError::PublicKeyExpired.into());
                }
            }
        }

        // 其他 422 错误，尝试正常解析
        let encrypted_data: EncryptedData =
            serde_json::from_str(&body_text).map_err(|e| ResponseError::UnprocessableEntity {
                message: format!("解析响应失败: {}", e),
            })?;

        return decrypt_response_data(encrypted_data);
    }

    // 正常响应，先解析为 JSON Value 判断是否加密
    let body_text = response
        .text()
        .await
        .map_err(|e| ResponseError::ReadResponseFailed(e.to_string()))?;

    // 检查响应体是否为空
    if body_text.is_empty() {
        return Err(ResponseError::EmptyResponse {
            status: status_code,
        }
        .into());
    }

    // 先解析为通用 JSON
    let body_value: serde_json::Value = serde_json::from_str(&body_text).map_err(|e| {
        let detail = extract_error_message(&body_text).unwrap_or_else(|| {
            format!(
                "响应数据: {}",
                body_text.chars().take(200).collect::<String>()
            )
        });
        ResponseError::JsonParseError {
            status: status_code,
            parse_error: e.to_string(),
            detail,
        }
    })?;

    // 检查是否有 encrypted 字段且为 true
    let is_encrypted = body_value.get("encrypted").and_then(|v| v.as_bool()).unwrap_or(false);
    if is_encrypted {
        // 是加密响应，解析为 EncryptedData 并解密
        let encrypted_data: EncryptedData = serde_json::from_value(body_value)
            .map_err(|e| ResponseError::ParseEncryptedDataFailed(e.to_string()))?;
        decrypt_response_data(encrypted_data)
    } else {
        // 未加密，直接解析为 JsonResponse
        serde_json::from_value(body_value)
            .map_err(|e| ResponseError::ParseResponseFailed(e.to_string()).into())
    }
}

/// 解密响应数据
fn decrypt_response_data(
    encrypted_data: EncryptedData,
) -> core::result::Result<JsonRespnse, anyhow::Error> {
    // 检查是否加密
    if encrypted_data.encrypted {
        // 解密数据
        let decrypted_value = decrypt_if_encrypted(&encrypted_data)
            .map_err(|e| ResponseError::DecryptFailed(e.to_string()))?;

        // 解析为 JsonRespnse
        serde_json::from_value(decrypted_value)
            .map_err(|e| ResponseError::ParseResponseFailed(e.to_string()).into())
    } else {
        // 未加密，直接解析 data 字段
        serde_json::from_str(&encrypted_data.data).map_err(|e| {
            ResponseError::ParseResponseFailed(format!("{}, 数据: {}", e, encrypted_data.data))
                .into()
        })
    }
}

/// 从响应体中提取错误信息
fn extract_error_message(body_text: &str) -> Option<String> {
    if body_text.is_empty() {
        return None;
    }

    serde_json::from_str::<serde_json::Value>(body_text).ok().and_then(|json| {
        json.get("message")
            .and_then(|m| m.as_str())
            .map(|s| s.to_string())
            .or_else(|| json.get("error").and_then(|e| e.as_str()).map(|s| s.to_string()))
    })
}
