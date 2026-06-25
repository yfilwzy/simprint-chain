//! 本地数据备份 / 导入 / 导出命令（破限本地版）
//!
//! 提供对 local_data.db 的完整备份与恢复能力：
//! - `export_database`：弹出保存对话框，将当前数据库（含 WAL 刷盘）复制到目标路径
//! - `import_database`：弹出打开对话框，校验源数据库 schema 后替换当前库（导入前自动备份）
//! - `get_database_info`：返回当前数据库路径与大小，供 UI 展示
//!
//! 设计要点：
//! - 导出前执行 `PRAGMA wal_checkpoint(TRUNCATE)` 保证一致性
//! - 导入前自动备份当前库到 `<db>.pre-import-<timestamp>.bak`，防止误操作丢数据
//! - 导入替换后 LocalStore 单例连接仍指向旧文件句柄，需重启应用重建连接
//! - 不引入额外依赖（rusqlite 已有），用文件复制 + schema 校验实现

use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri_plugin_dialog::DialogExt;

use crate::core::error::{Error, Result};
use crate::local_interceptor::{checkpoint_local_db, local_db_path};

#[derive(Debug, Serialize)]
pub struct DatabaseInfo {
    pub path: String,
    pub size_bytes: u64,
    pub exists: bool,
}

/// 返回当前本地数据库的路径、大小信息。
#[tauri::command]
pub async fn get_database_info() -> Result<DatabaseInfo> {
    let db_path = local_db_path();
    let path_for_size = db_path.clone();
    let (exists, size_bytes) = tokio::task::spawn_blocking(move || {
        let meta = fs::metadata(&path_for_size);
        match meta {
            Ok(m) => (true, m.len()),
            Err(_) => (false, 0u64),
        }
    })
    .await
    .map_err(|e| Error::InternalError.log_with(format!("读取数据库信息失败: {e}")))?;

    Ok(DatabaseInfo {
        path: local_db_path().to_string_lossy().to_string(),
        size_bytes,
        exists,
    })
}

/// 导出当前本地数据库到用户选择的路径。
///
/// 流程：弹出保存对话框 → WAL 检查点刷盘 → 复制 db 文件到目标路径。
#[tauri::command]
pub async fn export_database(app: tauri::AppHandle) -> Result<String> {
    // 1. 弹出保存对话框
    let target_path = pick_save_path(&app).await?;
    let target = PathBuf::from(&target_path);

    // 2. 刷盘确保一致性
    checkpoint_local_db().map_err(|e| Error::DbQueryFailed.log_with(format!("WAL 检查点失败: {e}")))?;

    // 3. 复制数据库文件
    let source = local_db_path();
    let source_clone = source.clone();
    tokio::task::spawn_blocking(move || -> std::io::Result<()> {
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(&source_clone, &target)?;
        Ok(())
    })
    .await
    .map_err(|e| Error::InternalError.log_with(format!("导出任务失败: {e}")))?
    .map_err(|e| Error::FileWriteFailed.log_with(format!("复制数据库文件失败: {e}")))?;

    let target_str = PathBuf::from(&target_path).to_string_lossy().to_string();
    log::info!("[Backup] 数据库已导出到 {}", target_str);
    Ok(target_str)
}

/// 从用户选择的路径导入数据库，替换当前本地数据库。
///
/// 流程：弹出打开对话框 → 校验源库 schema → 自动备份当前库 → 替换文件。
/// 导入完成后需重启应用以重建 LocalStore 连接。
#[tauri::command]
pub async fn import_database(app: tauri::AppHandle) -> Result<String> {
    // 1. 弹出打开对话框
    let source_path = pick_open_path(&app).await?;
    let source = PathBuf::from(&source_path);

    // 2. 校验源库 schema（必须是有效的 Simprint local_data.db）
    validate_database_schema(&source)
        .await
        .map_err(|e| Error::DbQueryFailed.log_with(e))?;

    // 3. 自动备份当前库并替换
    let current = local_db_path();
    let backup_path = make_pre_import_backup_path(&current);
    let source_clone = source.clone();
    let current_clone = current.clone();
    let backup_path_clone = backup_path.clone();
    tokio::task::spawn_blocking(move || -> std::io::Result<()> {
        if current_clone.exists() {
            fs::copy(&current_clone, &backup_path_clone)?;
        }
        if let Some(parent) = current_clone.parent() {
            fs::create_dir_all(parent)?;
        }
        // 删除可能的 WAL/SHM 边文件，避免与新主库不一致
        let wal = current_clone.with_extension("db-wal");
        let shm = current_clone.with_extension("db-shm");
        let _ = fs::remove_file(&wal);
        let _ = fs::remove_file(&shm);
        fs::copy(&source_clone, &current_clone)?;
        Ok(())
    })
    .await
    .map_err(|e| Error::InternalError.log_with(format!("导入任务失败: {e}")))?
    .map_err(|e| Error::FileWriteFailed.log_with(format!("替换数据库文件失败: {e}")))?;

    let msg = format!(
        "导入完成。导入前备份已保存至 {}。请重启应用以加载新数据。",
        backup_path.to_string_lossy()
    );
    log::info!("[Backup] {}", msg);
    Ok(msg)
}

// ============================================================================
// 内部辅助
// ============================================================================

/// 弹出文件保存对话框，返回用户选择的路径。
async fn pick_save_path(app: &tauri::AppHandle) -> Result<String> {
    let app_clone = app.clone();
    let picked = tokio::task::spawn_blocking(move || -> Option<PathBuf> {
        use std::sync::mpsc;
        let (tx, rx) = mpsc::channel::<Option<tauri_plugin_dialog::FilePath>>();
        app_clone
            .dialog()
            .file()
            .add_filter("SQLite 数据库", &["db"])
            .set_file_name("simprint-backup")
            .save_file(move |path| {
                let _ = tx.send(path);
            });
        rx.recv()
            .ok()
            .flatten()
            .and_then(|fp| fp.into_path().ok())
    })
    .await
    .map_err(|e| Error::InternalError.log_with(format!("保存对话框任务失败: {e}")))?;

    picked
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| Error::OperationCancelled.log_with("未选择导出路径"))
}

/// 弹出文件打开对话框，返回用户选择的路径。
async fn pick_open_path(app: &tauri::AppHandle) -> Result<String> {
    let app_clone = app.clone();
    let picked = tokio::task::spawn_blocking(move || -> Option<PathBuf> {
        use std::sync::mpsc;
        let (tx, rx) = mpsc::channel::<Option<tauri_plugin_dialog::FilePath>>();
        app_clone
            .dialog()
            .file()
            .add_filter("SQLite 数据库", &["db"])
            .pick_file(move |path| {
                let _ = tx.send(path);
            });
        rx.recv()
            .ok()
            .flatten()
            .and_then(|fp| fp.into_path().ok())
    })
    .await
    .map_err(|e| Error::InternalError.log_with(format!("打开对话框任务失败: {e}")))?;

    picked
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| Error::OperationCancelled.log_with("未选择导入文件"))
}

/// 校验源数据库是否为有效的 Simprint local_data.db（含 environments 表）。
async fn validate_database_schema(db_path: &PathBuf) -> std::result::Result<(), String> {
    let path = db_path.clone();
    tokio::task::spawn_blocking(move || -> std::result::Result<(), String> {
        let conn = rusqlite::Connection::open(&path).map_err(|e| e.to_string())?;
        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='environments'",
                [],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if count == 0 {
            return Err("源数据库不包含 environments 表，不是有效的 Simprint 数据库".to_string());
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// 生成导入前自动备份的文件名：`<db>.pre-import-<timestamp>.bak`
fn make_pre_import_backup_path(db_path: &PathBuf) -> PathBuf {
    let timestamp = chrono::Utc::now().format("%Y%m%dT%H%M%SZ");
    let mut name = db_path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "local_data.db".to_string());
    name.push_str(&format!(".pre-import-{}.bak", timestamp));
    match db_path.parent() {
        Some(p) => p.join(&name),
        None => PathBuf::from(name),
    }
}
