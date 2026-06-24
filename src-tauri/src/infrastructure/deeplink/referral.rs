use reqwest::Url;

use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;

use super::storage;

/// 从 deep link URL 中提取 `referral_code` 并落盘。
pub fn handle_referral_code(url: &Url) {
    let referral_code = url
        .query_pairs()
        .find_map(|(k, v)| (k == "referral_code").then(|| v.to_string()));

    if let Some(code) = referral_code.and_then(sanitize_referral_code) {
        // 与注册侧提取规则对齐：创建名为 R_{base64url(code)}_R 的空文件
        let encoded = URL_SAFE_NO_PAD.encode(code.as_bytes());
        let marker_name = format!("R_{}_R", encoded);
        let _ = storage::store_referral_code(&marker_name);
    }
}

fn sanitize_referral_code(raw: String) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    // 文件名安全：仅保留字母数字、_、-
    let cleaned: String = trimmed
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '_' || *c == '-')
        .collect();
    (!cleaned.is_empty()).then_some(cleaned)
}
