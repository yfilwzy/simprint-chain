use tauri::AppHandle;

use crate::{
    app::context::AppContext,
    mcp::config::{
        McpRuntimeSnapshot, UpdateMcpConfigRequest, load_config, snapshot_from_config,
        update_config,
    },
};

/// 获取 MCP 运行时配置与当前进程状态快照。
#[tauri::command]
pub async fn get_mcp_config(app: AppHandle) -> Result<McpRuntimeSnapshot, String> {
    let config = load_config(&app)?;
    let status = AppContext::get().mcp_manager.status().await;
    Ok(snapshot_from_config(config, status))
}

/// 更新 MCP 配置，但不直接改变 MCP 服务运行状态。
#[tauri::command]
pub async fn update_mcp_config(
    app: AppHandle,
    payload: UpdateMcpConfigRequest,
) -> Result<McpRuntimeSnapshot, String> {
    let config = update_config(&app, payload)?;
    let status = AppContext::get().mcp_manager.status().await;
    Ok(snapshot_from_config(config, status))
}

/// 启动 MCP 服务。
#[tauri::command]
pub async fn start_mcp_runtime(app: AppHandle) -> Result<(), String> {
    AppContext::get().mcp_manager.start(&app).await
}

/// 按当前配置重载 MCP 服务。
#[tauri::command]
pub async fn reload_mcp_runtime(app: AppHandle) -> Result<(), String> {
    AppContext::get().mcp_manager.reload(&app).await
}

/// 停止 MCP 服务。
#[tauri::command]
pub async fn stop_mcp_runtime() -> Result<(), String> {
    AppContext::get().mcp_manager.stop().await;
    Ok(())
}
