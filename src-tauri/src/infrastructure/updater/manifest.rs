/// Manifest 处理模块
///
/// 负责读写 manifest.json 文件，仅用于展示
use crate::infrastructure::updater::types::{ArtifactInfo, ClientInfo, Manifest};
use anyhow::{Context, Result};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

/// 获取 manifest.json 文件路径
fn get_manifest_path() -> Result<PathBuf> {
    crate::core::paths::PathManager::get_manifest_file().context("无法获取 manifest.json 路径")
}

/// 读取 manifest.json
///
/// # 返回
/// 返回 Manifest 结构，如果文件不存在则返回默认值
pub fn read_manifest() -> Result<Manifest> {
    let manifest_path = get_manifest_path()?;

    if !manifest_path.exists() {
        // 文件不存在，返回默认值
        return Ok(Manifest {
            client: ClientInfo {
                version: env!("CARGO_PKG_VERSION").to_string(),
            },
            artifacts: Vec::new(),
            last_updated: Utc::now().to_rfc3339(),
        });
    }

    // 读取文件内容
    let content = fs::read_to_string(&manifest_path)
        .with_context(|| format!("读取 manifest.json 失败: {}", manifest_path.display()))?;

    // 解析 JSON
    let manifest: Manifest = serde_json::from_str(&content)
        .with_context(|| format!("解析 manifest.json 失败: {}", manifest_path.display()))?;

    Ok(manifest)
}

/// 写入 manifest.json
///
/// # 参数
/// - `client_version`: 客户端版本
/// - `artifacts`: 已安装的资源列表
///
/// # 说明
/// manifest.json 仅用于展示，每次更新时都会完全重写
pub fn write_manifest(client_version: &str, artifacts: &[ArtifactInfo]) -> Result<()> {
    let manifest_path = get_manifest_path()?;

    // 构建 manifest 数据
    let artifact_infos: Vec<ArtifactInfo> = artifacts.to_vec();

    let manifest = Manifest {
        client: ClientInfo {
            version: client_version.to_string(),
        },
        artifacts: artifact_infos,
        last_updated: Utc::now().to_rfc3339(),
    };

    // 序列化为 JSON
    let json_content =
        serde_json::to_string_pretty(&manifest).context("序列化 manifest.json 失败")?;

    // 确保目录存在
    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("创建目录失败: {}", parent.display()))?;
    }

    // 写入文件（完全重写）
    fs::write(&manifest_path, json_content)
        .with_context(|| format!("写入 manifest.json 失败: {}", manifest_path.display()))?;

    Ok(())
}
