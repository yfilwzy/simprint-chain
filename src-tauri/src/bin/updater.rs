//! 更新器二进制入口点
//!
//! 独立的更新程序，只负责执行文件替换
//! install: 执行文件替换

// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use simprint_lib::core::config;
use simprint_lib::core::logger;
use simprint_lib::infrastructure::updater::types::{ArtifactInfo, InstallTasks};
use simprint_lib::infrastructure::updater::{installer, manifest, planner};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::process;

/// 更新器主函数
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 初始化日志系统（更新器无 Tauri/store，使用兜底目录）
    logger::init_logging(logger::bootstrap_log_dir());

    // 解析命令行参数
    let args: Vec<String> = env::args().collect();
    let mode = args.get(1).map(|s| s.as_str()).unwrap_or_else(|| {
        process::exit(1);
    });

    match mode {
        "install" => {
            let tasks_file = args.get(2).cloned().unwrap_or_else(|| {
                simprint_lib::core::paths::PathManager::get_update_tasks_file()
                    .unwrap_or_else(|_| PathBuf::from("update_tasks.json"))
                    .to_string_lossy()
                    .to_string()
            });
            run_install(&tasks_file).await?;
        }
        "install-package" => {
            let installer_path = args.get(2).cloned().unwrap_or_else(|| {
                process::exit(1);
            });
            run_install_package(&installer_path)?;
        }
        _ => {
            process::exit(1);
        }
    }

    Ok(())
}

fn run_install_package(installer_path: &str) -> Result<(), Box<dyn std::error::Error>> {
    let installer = PathBuf::from(installer_path);
    if !installer.exists() {
        return Err(format!("安装包不存在: {}", installer.display()).into());
    }

    use std::process::Command;

    Command::new(&installer)
        .arg("/P")
        .arg("/UPDATE")
        .arg("/R")
        .spawn()
        .map_err(|e| format!("启动安装包失败: {}", e))?;

    Ok(())
}

/// 安装模式
///
/// 从 JSON 文件读取安装任务，执行文件替换
async fn run_install(tasks_file: &str) -> Result<(), Box<dyn std::error::Error>> {
    // 读取任务文件
    let tasks_content = fs::read_to_string(tasks_file)
        .map_err(|e| format!("读取任务文件失败: {} - {}", tasks_file, e))?;

    let install_tasks: InstallTasks = serde_json::from_str(&tasks_content)
        .map_err(|e| format!("解析任务文件失败: {} - {}", tasks_file, e))?;

    if install_tasks.tasks.is_empty() {
        log::warn!("任务文件为空");
        return Ok(());
    }

    // 初始化配置（用于 manifest）
    if let Err(e) = config::init() {
        log::error!("配置初始化失败: {}", e);
        return Err(format!("配置初始化失败: {}", e).into());
    }

    let mut success_count = 0;
    let mut failed_count = 0;
    let mut installed_artifacts: Vec<ArtifactInfo> = Vec::new();

    // 遍历所有任务执行安装
    for install_task in &install_tasks.tasks {
        let resource_name = install_task.resource_name.clone();

        // 再次校验文件哈希（确保文件未被篡改）
        let temp_path = PathBuf::from(&install_task.temp_path);
        let actual_hash = planner::calculate_file_hash(&temp_path)
            .map_err(|e| format!("计算文件哈希失败: {}", e))?;

        if actual_hash.to_lowercase() != install_task.expected_hash.to_lowercase() {
            log::error!(
                "文件哈希不匹配: {} (期望: {}, 实际: {})",
                resource_name,
                install_task.expected_hash,
                actual_hash
            );
            failed_count += 1;
            continue;
        }

        // 执行安装
        let target_path = PathBuf::from(&install_task.target_path);
        let backup_path = install_task.backup_path.as_ref().map(|p| PathBuf::from(p));

        match installer::install_file_direct(
            &resource_name,
            &target_path,
            backup_path.as_deref(),
            &temp_path,
        ) {
            Ok(_) => {
                success_count += 1;
                installed_artifacts.push(ArtifactInfo {
                    resource_name: resource_name.clone(),
                    version: install_task.version.clone(),
                });
            }
            Err(e) => {
                log::error!("{} - 安装失败: {}", resource_name, e);

                // 尝试回滚
                if let Some(ref backup_path) = backup_path {
                    if backup_path.exists() {
                        let _ = installer::rollback_from_backup(&target_path, backup_path);
                    }
                }

                failed_count += 1;
            }
        }
    }

    // 更新 manifest.json
    if !installed_artifacts.is_empty() {
        let current_version = env!("CARGO_PKG_VERSION");

        if let Err(e) = manifest::write_manifest(current_version, &installed_artifacts) {
            log::error!("更新 manifest.json 失败: {}", e);
        }
    }

    // 清理任务文件
    if let Err(e) = fs::remove_file(tasks_file) {
        log::warn!("删除任务文件失败: {}", e);
    }

    // 设置最终状态
    if failed_count == 0 {
        log::info!("安装完成，共更新 {} 个文件", success_count);
    } else if success_count > 0 {
        log::warn!(
            "部分安装完成：成功 {}, 失败 {}",
            success_count,
            failed_count
        );
    } else {
        log::error!("所有安装失败");
        process::exit(1);
    }

    // 检查是否更新了主程序，如果是则重启主程序
    if success_count > 0 {
        if let Err(e) = restart_main_app() {
            log::error!("重启主程序失败: {}", e);
        }
    }

    // 确保日志刷新
    log::logger().flush();

    Ok(())
}

/// 重启主程序
fn restart_main_app() -> Result<(), Box<dyn std::error::Error>> {
    // 获取当前可执行文件目录（updater 与主程序同目录）
    let current_exe = env::current_exe()?;
    let exe_dir = current_exe.parent().ok_or_else(|| "无法获取可执行文件目录")?;

    // 主程序名与 Cargo [package] name 一致，扩展名随平台（Windows: .exe）
    let main_app_name = format!("{}{}", env!("CARGO_PKG_NAME"), std::env::consts::EXE_SUFFIX);
    let main_app_exe = exe_dir.join(&main_app_name);

    if !main_app_exe.exists() {
        return Err(format!("找不到主程序: {}", main_app_exe.display()).into());
    }

    // 使用 std::process::Command 启动主程序
    // 由于 updater.exe 已有管理员权限，可以直接启动需要管理员权限的主程序
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::process::Stdio;

        Command::new(&main_app_exe)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("启动主程序失败: {}", e))?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        use std::process::Stdio;

        Command::new(&main_app_exe)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("启动主程序失败: {}", e))?;
    }

    Ok(())
}
