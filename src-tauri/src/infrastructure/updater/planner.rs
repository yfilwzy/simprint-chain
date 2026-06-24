use crate::app::context::AppContext;
/// 更新计划生成模块
///
/// 负责对比本地文件 SHA256 与服务器版本，生成更新任务
use crate::infrastructure::updater::types::{Artifact, CheckResponse, UpdateTask};
use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

/// 计算文件的完整 SHA256 哈希
pub fn calculate_file_hash(file_path: &Path) -> Result<String> {
    let mut file =
        File::open(file_path).with_context(|| format!("无法打开文件: {}", file_path.display()))?;

    let mut hasher = Sha256::new();
    let mut buffer = vec![0; 8192]; // 8KB 缓冲区

    loop {
        let bytes_read = file
            .read(&mut buffer)
            .with_context(|| format!("读取文件失败: {}", file_path.display()))?;

        if bytes_read == 0 {
            break;
        }

        hasher.update(&buffer[..bytes_read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

/// 获取资源文件的默认路径（当前 exe 同目录）
fn get_resource_path(resource_name: &str) -> Result<PathBuf> {
    let current_exe = std::env::current_exe().context("无法获取当前可执行文件路径")?;
    let exe_dir = current_exe.parent().context("无法获取可执行文件目录")?;
    Ok(exe_dir.join(resource_name))
}

/// 获取下载临时目录
/// 优先读取配置 `updater.updater_temp_dir`（相对路径基于统一根目录），
/// 未配置则使用统一根目录下的 `updates`
fn get_temp_dir() -> Result<PathBuf> {
    let ctx = AppContext::get();
    if let Some(ref custom) = ctx.config.updater.updater_temp_dir {
        let p = PathBuf::from(custom);
        let root_dir = crate::core::paths::PathManager::get_root_dir()?;
        let dir = if p.is_absolute() { p } else { root_dir.join(p) };
        std::fs::create_dir_all(&dir).ok();
        return Ok(dir);
    }

    crate::core::paths::PathManager::get_updater_dir()
}

/// 根据 artifact 获取目标路径
/// 优先使用 install_path，如果为空则使用当前目录 + resource_name
fn get_target_path(artifact: &Artifact) -> Result<PathBuf> {
    if let Some(ref install_path) = artifact.install_path {
        let path = PathBuf::from(install_path);

        // 规范化路径，防止路径攻击
        let normalized_path = path.canonicalize().or_else(|_| {
            if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
                return Err(anyhow::anyhow!("路径包含非法组件: {}", install_path));
            }
            Ok(path)
        })?;

        // 使用服务器提供的 install_path
        Ok(normalized_path)
    } else {
        // 使用当前 exe 同级目录 + resource_name
        get_resource_path(&artifact.resource_name)
    }
}

/// 检查资源文件是否存在且哈希匹配
fn check_resource_file(artifact: &Artifact) -> Result<bool> {
    let target_path = get_target_path(artifact)?;

    // 文件不存在，需要更新
    if !target_path.exists() {
        return Ok(true);
    }

    // 计算本地文件哈希
    let local_hash = calculate_file_hash(&target_path)?;
    let remote_hash = artifact.hash.to_lowercase();

    // 哈希不匹配，需要更新
    Ok(local_hash.to_lowercase() != remote_hash)
}

/// 生成更新计划
///
/// # 参数
/// - `check_response`: 服务器检查响应
///
/// # 返回
/// 返回需要更新的任务列表
pub fn plan_updates(check_response: &CheckResponse) -> Result<Vec<UpdateTask>> {
    let mut tasks = Vec::new();

    // 遍历所有版本类型
    for (_version_type, artifacts) in &check_response.data.versions {
        for artifact in artifacts {
            // 检查是否需要更新
            let needs_update = check_resource_file(artifact)?;

            if needs_update {
                // 获取目标路径（优先使用 install_path，为空则使用当前目录）
                let target_path = get_target_path(artifact)?;
                let temp_dir = get_temp_dir()?;
                let temp_path = temp_dir.join(format!("{}.tmp", artifact.resource_name));
                let backup_path = temp_dir.join(format!("{}.bak", artifact.resource_name));

                tasks.push(UpdateTask {
                    artifact: artifact.clone(),
                    target_path: target_path.clone(),
                    backup_path: Some(backup_path),
                    temp_path,
                });
            }
        }
    }

    Ok(tasks)
}
