//! 数据备份 MCP 工具模块。
//!
//! 让 AI 工具能导出/导入本地数据库（local_data.db），用于数据迁移和备份。

use std::borrow::Cow;

use rmcp::{
    handler::server::router::tool::{AsyncTool, ToolBase, ToolRoute, ToolRouter},
    schemars::JsonSchema,
};
use serde::{Deserialize, Serialize};

use crate::mcp::{error::McpToolError, registry::ToolEntry, server::McpServer};

pub fn metadata() -> Vec<ToolEntry> {
    use crate::mcp::registry::ToolCategory;
    vec![
        ToolEntry::new("simprint_get_database_info", "查询数据库信息", "Get local database path and size.", ToolCategory::System),
        ToolEntry::new("simprint_export_database", "导出数据库", "Export local database to a target path.", ToolCategory::System),
    ]
}

pub fn routes() -> Vec<ToolRoute<McpServer>> {
    ToolRouter::new()
        .with_async_tool::<GetDatabaseInfoTool>()
        .with_async_tool::<ExportDatabaseTool>()
        .into_iter()
        .collect()
}

// ============================================================================
// 输入/输出结构
// ============================================================================

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct EmptyInput {}

#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
pub struct ExportInput {
    /// 导出目标绝对路径，如 D:/backups/simprint-20260626.db
    pub target_path: String,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct DatabaseInfoOutput {
    pub path: String,
    pub size_bytes: u64,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, JsonSchema)]
pub struct ExportOutput {
    pub success: bool,
    pub exported_to: String,
    pub message: String,
}

// ============================================================================
// 工具实现
// ============================================================================

struct GetDatabaseInfoTool;
struct ExportDatabaseTool;

impl ToolBase for GetDatabaseInfoTool {
    type Parameter = EmptyInput;
    type Output = DatabaseInfoOutput;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_get_database_info".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Get local database path and size.".into()) }
}

impl AsyncTool<McpServer> for GetDatabaseInfoTool {
    async fn invoke(_service: &McpServer, _param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        let db_path = crate::local_interceptor::local_db_path();
        let path_str = db_path.to_string_lossy().to_string();
        let meta = std::fs::metadata(&db_path);
        let (exists, size_bytes) = match meta {
            Ok(m) => (true, m.len()),
            Err(_) => (false, 0),
        };
        Ok(DatabaseInfoOutput { path: path_str, size_bytes, exists })
    }
}

impl ToolBase for ExportDatabaseTool {
    type Parameter = ExportInput;
    type Output = ExportOutput;
    type Error = McpToolError;
    fn name() -> Cow<'static, str> { "simprint_export_database".into() }
    fn description() -> Option<Cow<'static, str>> { Some("Export local database to a target absolute path.".into()) }
}

impl AsyncTool<McpServer> for ExportDatabaseTool {
    async fn invoke(_service: &McpServer, param: Self::Parameter) -> Result<Self::Output, Self::Error> {
        if param.target_path.trim().is_empty() {
            return Err(McpToolError::invalid_params("target_path 不能为空".to_string()));
        }

        // 先刷盘确保一致性
        crate::local_interceptor::checkpoint_local_db()
            .map_err(|e| McpToolError::internal(format!("WAL 检查点失败: {}", e)))?;

        let source = crate::local_interceptor::local_db_path();
        let target = std::path::PathBuf::from(&param.target_path);

        // 复制数据库文件
        let target_str = target.to_string_lossy().to_string();
        tokio::task::spawn_blocking(move || -> std::io::Result<()> {
            if let Some(parent) = target.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(&source, &target)?;
            Ok(())
        })
        .await
        .map_err(|e| McpToolError::internal(format!("导出任务失败: {}", e)))?
        .map_err(|e| McpToolError::internal(format!("复制数据库失败: {}", e)))?;

        Ok(ExportOutput {
            success: true,
            exported_to: target_str.clone(),
            message: format!("数据库已导出到 {}", target_str),
        })
    }
}
