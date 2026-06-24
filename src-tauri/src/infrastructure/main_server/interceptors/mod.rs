/// 拦截器模块
///
/// 负责请求和响应的拦截处理，包括加密、认证等
pub mod crypto;
pub mod request;

/// 响应拦截器（保持接口，实际解密在 response 模块处理）
pub async fn response_interceptor(
    response: reqwest::Response,
) -> core::result::Result<reqwest::Response, reqwest::Error> {
    // 直接返回，实际解密由 response 模块处理
    Ok(response)
}
