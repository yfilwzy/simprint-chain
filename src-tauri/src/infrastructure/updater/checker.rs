/// 版本检查模块
///
/// 负责调用服务器的版本检查 API 获取更新信息
use crate::app::context::AppContext;
use crate::infrastructure::updater::types::{CheckRequest, CheckResponse};
use anyhow::{Context, Result};
use reqwest::Client;
use std::time::Duration;

const CHECK_TIMEOUT_SECS: u64 = 30;

/// 检查更新
///
/// # 返回
/// 返回服务器检查响应
pub async fn check_updates() -> Result<CheckResponse> {
    let ctx = AppContext::get();
    let url = &ctx.config.updater.check_url;

    // 创建 HTTP 客户端
    let client = Client::builder()
        .timeout(Duration::from_secs(CHECK_TIMEOUT_SECS))
        .build()
        .context("创建 HTTP 客户端失败")?;

    // 构建请求
    let request = CheckRequest {};

    let response = client.post(url).json(&request).send().await.context("发送检查请求失败")?;

    // 检查 HTTP 状态码
    let status = response.status();
    if !status.is_success() {
        return Err(anyhow::anyhow!("服务器返回错误状态码: {}", status));
    }

    let response_json = response.json::<serde_json::Value>().await?;
    // println!("检查响应: {:?}", response_json);

    // 解析响应
    let check_response: CheckResponse =
        serde_json::from_value(response_json).context("解析服务器响应失败")?;

    Ok(check_response)
}
