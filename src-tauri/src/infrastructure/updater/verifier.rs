/// 校验模块
///
/// 负责对下载的文件进行 SHA256 校验
use crate::infrastructure::updater::types::UpdateTask;
use anyhow::{Context, Result};
use std::path::Path;

// 重新导出 calculate_file_hash 函数
pub use crate::infrastructure::updater::planner::calculate_file_hash;

/// 内部使用的哈希计算函数
fn calculate_file_hash_internal(file_path: &Path) -> Result<String> {
    crate::infrastructure::updater::planner::calculate_file_hash(file_path)
}

/// 校验下载文件的 SHA256 哈希
///
/// # 参数
/// - `task`: 更新任务
///
/// # 返回
/// 如果哈希匹配返回 Ok(()), 否则返回错误
pub fn verify_file_hash(task: &UpdateTask) -> Result<()> {
    // 计算临时文件的哈希
    let actual_hash = calculate_file_hash_internal(&task.temp_path)
        .with_context(|| format!("计算文件哈希失败: {}", task.temp_path.display()))?;

    // 转换为小写进行比较
    let expected_hash = task.artifact.hash.to_lowercase();
    let actual_hash_lower = actual_hash.to_lowercase();

    if actual_hash_lower != expected_hash {
        return Err(anyhow::anyhow!(
            "文件哈希不匹配: 期望 {}, 实际 {}",
            expected_hash,
            actual_hash
        ));
    }

    Ok(())
}
