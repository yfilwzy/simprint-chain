/// 更新服务模块
///
/// 提供更新相关的公共辅助函数，消除代码重复
use crate::core::config;
use crate::infrastructure::updater::types::{
    ErrorPayload, InstallTask, InstallTasks, UpdateEvent, UpdatePlan, UpdatePlanTask, UpdateTask,
};
use anyhow::{Context, Result, anyhow};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};

/// 锁获取结果
pub enum LockResult {
    Acquired(tokio::sync::MutexGuard<'static, ()>),
    Busy,
}

/// 尝试获取更新检查和下载任务锁（非阻塞）
///
/// # 返回
/// - `LockResult::Acquired(guard)` - 成功获取锁
/// - `LockResult::Busy` - 锁已被占用
pub async fn acquire_update_lock() -> LockResult {
    match crate::infrastructure::updater::state::try_acquire_update_check_and_download_lock().await
    {
        Some(guard) => LockResult::Acquired(guard),
        None => LockResult::Busy,
    }
}

/// 初始化更新器配置
pub fn init_updater_config() -> crate::core::error::Result<()> {
    // 检查配置是否已初始化，如果已初始化则直接返回
    if config::get().is_some() {
        return Ok(());
    }
    // 从嵌入的加密配置中加载并初始化配置
    config::init()
}

/// 获取可执行文件目录
///
/// # 返回
/// 返回可执行文件所在目录的 PathBuf
pub fn get_exe_directory() -> Result<PathBuf> {
    let current_exe = std::env::current_exe().with_context(|| "获取当前可执行文件路径失败")?;
    current_exe
        .parent()
        .ok_or_else(|| anyhow::anyhow!("无法获取可执行文件目录"))
        .map(|p| p.to_path_buf())
}

/// 获取安装任务文件路径
///
/// # 返回
/// 返回安装任务文件的完整路径
pub fn get_tasks_file_path() -> Result<PathBuf> {
    crate::core::paths::PathManager::get_update_tasks_file()
}

/// 发送更新事件
///
/// # 参数
/// - `app_handle`: Tauri 应用句柄
/// - `event`: 更新事件
pub fn emit_event(app_handle: &AppHandle, event: UpdateEvent) {
    let _ = app_handle.emit(event.event_type(), event);
}

/// 发送错误事件
///
/// # 参数
/// - `app_handle`: Tauri 应用句柄
/// - `code`: 错误代码
/// - `error_message`: 错误消息
pub fn emit_error_event(app_handle: &AppHandle, code: i32, error_message: String) {
    let error_event = UpdateEvent::CheckFailed {
        code,
        payload: ErrorPayload { error_message },
    };
    emit_event(app_handle, error_event);
}

/// 将 UpdateTask 转换为 UpdatePlanTask
///
/// # 参数
/// - `tasks`: UpdateTask 列表
///
/// # 返回
/// 返回 UpdatePlanTask 列表
pub fn update_tasks_to_plan_tasks(tasks: &[UpdateTask]) -> Vec<UpdatePlanTask> {
    tasks
        .iter()
        .map(|task| UpdatePlanTask {
            artifact: task.artifact.clone(),
            target_path: task.target_path.to_string_lossy().to_string(),
            backup_path: task.backup_path.as_ref().map(|p| p.to_string_lossy().to_string()),
            temp_path: task.temp_path.to_string_lossy().to_string(),
        })
        .collect()
}

/// 将 UpdatePlanTask 转换为 UpdateTask
///
/// # 参数
/// - `plan_tasks`: UpdatePlanTask 列表
///
/// # 返回
/// 返回 UpdateTask 列表
pub fn plan_tasks_to_update_tasks(plan_tasks: &[UpdatePlanTask]) -> Vec<UpdateTask> {
    plan_tasks
        .iter()
        .map(|plan_task| UpdateTask {
            artifact: plan_task.artifact.clone(),
            target_path: PathBuf::from(&plan_task.target_path),
            backup_path: plan_task.backup_path.as_ref().map(|p| PathBuf::from(p)),
            temp_path: PathBuf::from(&plan_task.temp_path),
        })
        .collect()
}

/// 将 UpdateTask 转换为 InstallTask
///
/// # 参数
/// - `task`: UpdateTask
///
/// # 返回
/// 返回 InstallTask
pub fn update_task_to_install_task(task: &UpdateTask) -> InstallTask {
    InstallTask {
        resource_name: task.artifact.resource_name.clone(),
        version: task.artifact.version.clone(),
        target_path: task.target_path.to_string_lossy().to_string(),
        backup_path: task.backup_path.as_ref().map(|p| p.to_string_lossy().to_string()),
        temp_path: task.temp_path.to_string_lossy().to_string(),
        expected_hash: task.artifact.hash.clone(),
    }
}

/// 缓存更新计划
pub async fn store_update_plan(tasks: &[UpdateTask]) -> Result<()> {
    let plan_tasks = update_tasks_to_plan_tasks(tasks);
    let update_plan = UpdatePlan { tasks: plan_tasks };
    crate::infrastructure::updater::state::store_update_plan(update_plan).await;
    Ok(())
}

/// 取出更新计划（内存缓存）
pub async fn take_update_plan() -> Result<UpdatePlan> {
    crate::infrastructure::updater::state::take_update_plan()
        .await
        .ok_or_else(|| anyhow!("更新计划不存在，请重新执行检查"))
}

pub async fn store_installer_package_path(path: String) {
    crate::infrastructure::updater::state::store_installer_package_path(path).await;
}

pub async fn take_installer_package_path() -> Option<String> {
    crate::infrastructure::updater::state::take_installer_package_path().await
}

pub async fn clear_installer_package_path() {
    crate::infrastructure::updater::state::clear_installer_package_path().await;
}

/// 保存安装任务到文件
///
/// # 参数
/// - `install_tasks`: InstallTask 列表
///
/// # 返回
/// 返回保存的文件路径
pub fn save_install_tasks(install_tasks: &[InstallTask]) -> Result<PathBuf> {
    let install_tasks_data = InstallTasks {
        tasks: install_tasks.to_vec(),
    };

    let tasks_json =
        serde_json::to_string_pretty(&install_tasks_data).with_context(|| "序列化安装任务失败")?;

    let file_path = get_tasks_file_path()?;

    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("创建安装任务目录失败: {}", parent.display()))?;
    }

    fs::write(&file_path, tasks_json)
        .with_context(|| format!("写入安装任务文件失败: {}", file_path.display()))?;

    Ok(file_path)
}
