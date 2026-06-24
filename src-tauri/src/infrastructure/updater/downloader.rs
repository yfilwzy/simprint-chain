/// 下载模块
///
/// 负责下载更新文件到临时目录，支持重试和进度回调
use crate::infrastructure::updater::types::UpdateTask;
use anyhow::{Context, Result};
use futures::StreamExt;
use reqwest::{Client, header};
use std::fs::File;
use std::io::Write;
use std::time::Duration;

const DOWNLOAD_TIMEOUT_SECS: u64 = 300; // 5 分钟超时
const MAX_RETRIES: u32 = 3;
const RETRY_DELAY_SECS: u64 = 2;

/// 下载单个文件（带进度回调）
///
/// # 参数
/// - `task`: 更新任务
/// - `client`: HTTP 客户端
/// - `on_progress`: 进度回调函数，参数为已下载字节数
///
/// # 返回
/// 返回下载文件的临时路径
pub async fn download_file_with_progress<F>(
    task: &UpdateTask,
    client: &Client,
    mut on_progress: F,
) -> Result<()>
where
    F: FnMut(u64) -> Result<()>,
{
    let mut last_error = None;

    // 重试循环
    for attempt in 1..=MAX_RETRIES {
        match download_file_internal_with_progress(task, client, &mut on_progress).await {
            Ok(_) => return Ok(()),
            Err(e) => {
                last_error = Some(e);

                // 清理临时文件
                if task.temp_path.exists() {
                    let _ = std::fs::remove_file(&task.temp_path);
                }

                if attempt < MAX_RETRIES {
                    tokio::time::sleep(Duration::from_secs(RETRY_DELAY_SECS)).await;
                }
            }
        }
    }

    Err(anyhow::anyhow!(
        "下载文件失败，已达到最大重试次数: {}",
        last_error.unwrap_or_else(|| anyhow::anyhow!("未知错误"))
    ))
}

/// 内部下载实现（带进度回调）
async fn download_file_internal_with_progress<F>(
    task: &UpdateTask,
    client: &Client,
    on_progress: &mut F,
) -> Result<()>
where
    F: FnMut(u64) -> Result<()>,
{
    // 确保临时目录存在
    if let Some(parent) = task.temp_path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("创建临时目录失败: {}", parent.display()))?;
    }

    // 创建临时文件
    let mut file = File::create(&task.temp_path)
        .with_context(|| format!("创建临时文件失败: {}", task.temp_path.display()))?;

    // 发送 HTTP GET 请求
    let response = client
        .get(&task.artifact.url)
        .timeout(Duration::from_secs(DOWNLOAD_TIMEOUT_SECS))
        .header(header::ACCEPT_ENCODING, "identity")
        .send()
        .await
        .with_context(|| format!("发送下载请求失败"))?;

    // 检查 HTTP 状态码
    if !response.status().is_success() {
        return Err(anyhow::anyhow!(
            "服务器返回错误状态码: {}",
            response.status()
        ));
    }

    // 获取内容长度（用于进度跟踪）
    let content_length = response.content_length();
    if let Some(expected_size) = content_length {
        if expected_size != task.artifact.file_size {
            // 静默处理文件大小不匹配，不输出日志
        }
    }

    // 流式下载并写入文件
    let mut stream = response.bytes_stream();
    let mut downloaded: u64 = 0;

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.with_context(|| "读取下载数据块失败")?;

        file.write_all(&chunk).with_context(|| "写入文件失败")?;

        downloaded += chunk.len() as u64;

        // 调用进度回调
        let _ = on_progress(downloaded);
    }

    // 确保文件写入完成
    file.sync_all().with_context(|| "同步文件失败")?;

    // 验证下载的文件大小
    let actual_size = std::fs::metadata(&task.temp_path)
        .with_context(|| "获取下载文件大小失败")?
        .len();

    if actual_size != task.artifact.file_size {
        return Err(anyhow::anyhow!(
            "下载文件大小不匹配: 期望 {}, 实际 {}",
            task.artifact.file_size,
            actual_size
        ));
    }

    Ok(())
}
