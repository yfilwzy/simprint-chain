/// 状态管理模块
///
/// 提供更新检查和下载任务的并发控制锁
use once_cell::sync::Lazy;
use std::sync::Arc;
use tokio::sync::Mutex as TokioMutex;

use crate::infrastructure::updater::types::UpdatePlan;

/// 更新检查和下载任务互斥锁：确保同一时间只有一个检查/下载任务在执行
static UPDATE_CHECK_AND_DOWNLOAD_LOCK: Lazy<Arc<TokioMutex<()>>> =
    Lazy::new(|| Arc::new(TokioMutex::new(())));

/// 内存中的更新计划缓存
static UPDATE_PLAN_CACHE: Lazy<TokioMutex<Option<UpdatePlan>>> =
    Lazy::new(|| TokioMutex::new(None));

/// 安装包升级路径缓存
static INSTALLER_PACKAGE_PATH_CACHE: Lazy<TokioMutex<Option<String>>> =
    Lazy::new(|| TokioMutex::new(None));

/// 尝试获取更新检查和下载任务锁（非阻塞）
///
/// # 返回
/// 如果成功获取锁，返回 `Some(guard)`，否则返回 `None`
///
/// # 说明
/// 使用此锁可以防止并发执行检查更新和下载任务
pub async fn try_acquire_update_check_and_download_lock()
-> Option<tokio::sync::MutexGuard<'static, ()>> {
    UPDATE_CHECK_AND_DOWNLOAD_LOCK.try_lock().ok()
}

/// 将更新计划写入缓存，覆盖旧数据
pub async fn store_update_plan(plan: UpdatePlan) {
    let mut guard = UPDATE_PLAN_CACHE.lock().await;
    *guard = Some(plan);
}

/// 从缓存中取出更新计划（取出后即清空）
pub async fn take_update_plan() -> Option<UpdatePlan> {
    let mut guard = UPDATE_PLAN_CACHE.lock().await;
    guard.take()
}

pub async fn store_installer_package_path(path: String) {
    let mut guard = INSTALLER_PACKAGE_PATH_CACHE.lock().await;
    *guard = Some(path);
}

pub async fn take_installer_package_path() -> Option<String> {
    let mut guard = INSTALLER_PACKAGE_PATH_CACHE.lock().await;
    guard.take()
}

pub async fn clear_installer_package_path() {
    let mut guard = INSTALLER_PACKAGE_PATH_CACHE.lock().await;
    *guard = None;
}
