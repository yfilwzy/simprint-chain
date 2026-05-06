/// 更新相关的 Tauri 命令
///
/// 提供检查更新和下载的功能，由主程序调用
use crate::core::error::Result;
use crate::services::updater::{CheckResult, DownloadResult, PreparedUpdateInfo, UpdateService};
use tauri::AppHandle;

/// 简单检查是否有可用更新（仅检查，不缓存计划，不发送事件）
///
/// 用于设置页面的「检查更新」按钮，返回布尔值。具体更新逻辑由重启时自动完成。
#[tauri::command]
pub async fn check_update_available() -> Result<bool> {
    UpdateService::check_update_available().await
}

/// 检查更新（仅检查，不下载）
///
/// 检查是否有可用更新，并将更新计划缓存到内存
///
/// # 参数
/// - `app_handle`: Tauri 应用句柄，用于 emit 事件
///
/// # 返回
/// 返回检查结果，包含是否有更新、更新数量以及计划是否可用
#[tauri::command]
pub async fn check_updates(app_handle: AppHandle) -> Result<CheckResult> {
    UpdateService::check_updates(app_handle).await
}

/// 下载更新（执行下载，支持进度）
///
/// 从内存中的更新计划读取任务，执行下载和校验，实时发送进度事件
///
/// # 参数
/// - `app_handle`: Tauri 应用句柄，用于 emit 事件
/// # 返回
/// 返回下载结果，包含任务文件路径和成功数量
#[tauri::command]
pub async fn download_updates(
    app_handle: AppHandle,
    plan_file: Option<String>,
) -> Result<DownloadResult> {
    UpdateService::download_updates(app_handle, plan_file).await
}

/// 启动更新安装并退出主程序
///
/// # 参数
/// - `app_handle`: Tauri 应用句柄
///
/// # 说明
/// 启动 updater.exe install 命令，然后退出主程序
/// 任务文件路径由统一路径层提供（update_tasks.json）
#[tauri::command]
pub async fn start_update_install(app_handle: AppHandle) -> Result<()> {
    UpdateService::start_update_install(app_handle).await
}

#[tauri::command]
pub async fn start_prepared_update_install(
    app_handle: AppHandle,
    kind: Option<String>,
) -> Result<()> {
    UpdateService::start_prepared_update_install(app_handle, kind).await
}

#[tauri::command]
pub async fn get_prepared_update() -> Result<Option<PreparedUpdateInfo>> {
    UpdateService::get_prepared_update().await
}
