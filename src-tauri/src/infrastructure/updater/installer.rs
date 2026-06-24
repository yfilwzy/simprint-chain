/// 安装模块
///
/// 负责安全替换文件（备份、原子替换）
use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

/// 检查进程是否正在运行（通过 resource_name 匹配，不检查路径）
fn is_process_running_by_name(resource_name: &str) -> Result<bool> {
    use sysinfo::System;

    let resource_name_lower = resource_name.to_lowercase();
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    // 检查是否有匹配的进程（仅通过名称匹配）
    let found = sys.processes().iter().any(|(_, process)| {
        let process_name = process.name().to_string_lossy().to_lowercase();
        process_name == resource_name_lower
    });

    Ok(found)
}

/// 查找并终止进程（通过 resource_name）
fn kill_process_by_name(resource_name: &str) -> Result<()> {
    use sysinfo::System;

    let resource_name_lower = resource_name.to_lowercase();
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    // 查找所有匹配的进程并终止
    for (_, process) in sys.processes() {
        let process_name = process.name().to_string_lossy().to_lowercase();

        if process_name == resource_name_lower {
            // 使用 sysinfo 的 kill 方法（静默执行，不输出日志）
            let _ = process.kill();
        }
    }

    Ok(())
}

/// 等待进程退出（通过 resource_name 匹配）
/// 最多等待 1.8 秒（每次 0.6 秒，总共 3 次）
/// 每次等待时都尝试终止进程
fn wait_for_process_exit_by_name(resource_name: &str) -> Result<()> {
    // 检查进程是否正在运行
    let is_running = is_process_running_by_name(resource_name).context("检查进程状态失败")?;

    if !is_running {
        return Ok(());
    }

    const MAX_ATTEMPTS: u32 = 3; // 最多尝试 3 次
    const DELAY_MILLIS: u64 = 600; // 每次等待 0.6 秒

    for _attempt in 1..=MAX_ATTEMPTS {
        // 尝试终止进程
        let _ = kill_process_by_name(resource_name);

        // 等待 0.6 秒
        std::thread::sleep(std::time::Duration::from_millis(DELAY_MILLIS));

        // 检查进程是否已退出
        let is_running = is_process_running_by_name(resource_name).context("检查进程状态失败")?;

        if !is_running {
            return Ok(());
        }
    }

    // 最后一次检查（静默处理，不输出日志）
    let _ = is_process_running_by_name(resource_name);

    Ok(())
}

/// 确保文件未被锁定
fn ensure_file_not_locked(file_path: &Path) -> Result<()> {
    // Windows 下，尝试以独占模式打开文件
    // 如果成功，说明文件未被锁定
    #[cfg(target_os = "windows")]
    {
        use std::fs::OpenOptions;
        use std::io::Read;

        // 尝试以只读模式打开文件
        if file_path.exists() {
            let mut file = OpenOptions::new()
                .read(true)
                .open(file_path)
                .with_context(|| format!("无法打开文件（可能被锁定）: {}", file_path.display()))?;

            // 尝试读取一个字节来确认文件未被锁定
            let mut buffer = [0u8; 1];
            file.read_exact(&mut buffer)
                .with_context(|| format!("文件可能被锁定: {}", file_path.display()))?;
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        // 非 Windows 平台暂不检查
    }

    Ok(())
}

/// 直接安装文件（用于 install 模式）
///
/// # 参数
/// - `target_path`: 目标路径
/// - `backup_path`: 备份路径（可选）
/// - `temp_path`: 临时文件路径（已下载并校验通过的文件）
///
/// # 返回
/// 安装成功返回 Ok(()), 否则返回错误
pub fn install_file_direct(
    resource_name: &str,
    target_path: &Path,
    backup_path: Option<&Path>,
    temp_path: &Path,
) -> Result<()> {
    // 尝试退出同名进程（若存在）
    let _ = wait_for_process_exit_by_name(resource_name);

    // 确保目标文件未被锁定
    ensure_file_not_locked(target_path)?;

    replace_file_direct(target_path, backup_path, temp_path)?;

    Ok(())
}

/// 备份原文件
fn backup_file(target_path: &Path, backup_path: &Path) -> Result<()> {
    // 确保备份目录存在
    if let Some(parent) = backup_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("创建备份目录失败: {}", parent.display()))?;
    }

    // 删除旧的备份文件（如果存在）
    if backup_path.exists() {
        fs::remove_file(backup_path)
            .with_context(|| format!("删除旧备份失败: {}", backup_path.display()))?;
    }

    // 复制原文件到备份位置
    fs::copy(target_path, backup_path)
        .with_context(|| format!("备份文件失败: {}", backup_path.display()))?;

    Ok(())
}

/// 移除只读属性（Windows 平台）
#[cfg(target_os = "windows")]
fn remove_readonly_attribute(file_path: &Path) -> Result<()> {
    use std::fs::metadata;

    let metadata = metadata(file_path)
        .with_context(|| format!("获取文件元数据失败: {}", file_path.display()))?;

    // 如果文件是只读的，移除只读属性
    if metadata.permissions().readonly() {
        let mut perms = metadata.permissions();
        perms.set_readonly(false);
        fs::set_permissions(file_path, perms)
            .with_context(|| format!("设置文件权限失败: {}", file_path.display()))?;
    }

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn remove_readonly_attribute(_file_path: &Path) -> Result<()> {
    // 非 Windows 平台无需处理
    Ok(())
}

/// 删除旧文件（如果存在）
fn remove_old_file(target_path: &Path) -> Result<()> {
    if !target_path.exists() {
        return Ok(());
    }

    // 移除只读属性
    remove_readonly_attribute(target_path)?;

    // 删除文件
    fs::remove_file(target_path)
        .with_context(|| format!("删除旧文件失败: {}", target_path.display()))?;

    Ok(())
}

/// 移动临时文件到目标位置
fn move_temp_file_to_target(temp_path: &Path, target_path: &Path) -> Result<()> {
    if let Err(_) = fs::rename(temp_path, target_path) {
        // 如果移动失败（可能跨文件系统），尝试复制
        fs::copy(temp_path, target_path)
            .with_context(|| format!("复制文件失败: {}", target_path.display()))?;

        // 删除临时文件
        fs::remove_file(temp_path)
            .with_context(|| format!("删除临时文件失败: {}", temp_path.display()))?;
    }

    Ok(())
}

/// 删除备份文件（如果存在）
fn cleanup_backup_file(backup_path: &Path) {
    if backup_path.exists() {
        let _ = fs::remove_file(backup_path);
    }
}

/// 直接替换文件（用于 install 模式）
fn replace_file_direct(
    target_path: &Path,
    backup_path: Option<&Path>,
    temp_path: &Path,
) -> Result<()> {
    // 1. 备份原文件（如果存在）
    let mut created_backup = false;
    if target_path.exists() {
        if let Some(backup_path) = backup_path {
            backup_file(target_path, backup_path)?;
            created_backup = true;
        }
    }

    // 2. 确保目标目录存在
    if let Some(parent) = target_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("创建目标目录失败: {}", parent.display()))?;
    }

    // 3. 删除旧文件
    remove_old_file(target_path)?;

    // 4. 移动临时文件到目标位置
    move_temp_file_to_target(temp_path, target_path)?;

    // 5. 替换成功后，删除备份文件（仅在替换成功时删除）
    if created_backup {
        if let Some(backup_path) = backup_path {
            cleanup_backup_file(backup_path);
        }
    }

    Ok(())
}

/// 从备份路径回滚（用于 install 模式）
pub fn rollback_from_backup(target_path: &Path, backup_path: &Path) -> Result<()> {
    if backup_path.exists() {
        // 删除当前文件（如果存在）
        if target_path.exists() {
            fs::remove_file(target_path).context("删除失败文件失败")?;
        }

        // 恢复备份
        fs::copy(backup_path, target_path)
            .with_context(|| format!("恢复备份失败: {}", backup_path.display()))?;

        Ok(())
    } else {
        Err(anyhow::anyhow!("备份文件不存在，无法回滚"))
    }
}
