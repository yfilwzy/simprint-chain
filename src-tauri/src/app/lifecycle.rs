/// 应用生命周期管理
///
/// 管理应用初始化顺序和依赖关系
use anyhow::Result;
use tauri::AppHandle;

use crate::app::context::AppContext;
use crate::core::config;

/// 初始化应用核心组件（早期阶段，不依赖 Tauri）
///
/// 按照正确的依赖顺序初始化所有组件
pub fn init_early() -> Result<()> {
    // 1. 加载配置（最先初始化，其他组件依赖配置）
    let app_config = config::get_or_err()?.clone();

    // 2. 初始化应用上下文（包含 RSA、HTTP 客户端、runtime 管理器）
    AppContext::init_early(app_config)?;

    Ok(())
}

/// 初始化需要 Tauri AppHandle 的组件
///
/// 这些组件依赖 Tauri 运行时，必须在 setup 阶段初始化
pub fn init_tauri_dependent(_app_handle: &AppHandle) -> Result<()> {
    crate::app::handle::init_app_handle(_app_handle.clone())?;
    Ok(())
}

/// 清理资源
pub async fn shutdown() -> Result<()> {
    if let Some(ctx) = AppContext::try_get() {
        ctx.mcp_manager.stop().await;
        ctx.local_api_manager.stop().await;
        ctx.simprint_runtime_manager.stop().await;
    }
    Ok(())
}
