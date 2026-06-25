//! 本地 SQLite 存储层（破限本地化）
//!
//! 持久化环境/分组/标签数据，绕过 main server 配额限制。
//! 数据库路径：app_data_dir/Simprint/local_data.db

use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde_json::{json, Value};
use uuid::Uuid;

/// 本地存储（线程安全的 SQLite 连接）
pub struct LocalStore {
    conn: Mutex<Connection>,
}

impl LocalStore {
    /// 初始化本地存储，自动建表
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let db_path = resolve_db_path()?;
        Self::open_at(&db_path)
    }

    /// 在指定路径打开/创建数据库（供测试和自定义路径使用）
    pub fn open_at(db_path: &std::path::Path) -> Result<Self, Box<dyn std::error::Error>> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        log::info!(
            "[LocalStore] 初始化本地数据库: {}",
            db_path.display()
        );

        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL;")?;
        conn.execute_batch("PRAGMA synchronous=NORMAL;")?;

        Self::init_schema(&conn)?;
        Self::seed_default_kernel(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    /// 建表
    fn init_schema(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS environments (
                uuid TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                config TEXT NOT NULL DEFAULT '{}',
                group_uuid TEXT,
                proxy_uuid TEXT,
                proxy_config TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS groups (
                uuid TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS tags (
                uuid TEXT PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                color TEXT NOT NULL DEFAULT '#808080',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS browser_kernels (
                platform TEXT NOT NULL,
                type_code TEXT NOT NULL,
                resource_name TEXT NOT NULL,
                url TEXT NOT NULL DEFAULT '',
                hash TEXT NOT NULL DEFAULT '',
                signature TEXT NOT NULL DEFAULT '',
                requires_extract INTEGER NOT NULL DEFAULT 1,
                is_default INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (platform, type_code, resource_name)
            );
            ",
        )?;
        Ok(())
    }

    /// 写入默认内核元数据（若表为空）
    fn seed_default_kernel(conn: &Connection) -> Result<(), Box<dyn std::error::Error>> {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM browser_kernels",
            [],
            |row| row.get(0),
        )?;

        if count > 0 {
            return Ok(());
        }

        // 默认内核：chromium-136。url 指向官方公开下载源（第二阶段可改为自建/本地源）。
        // signature/hash 在内核下载后由 verifier 校验；破解版可跳过（见 verifier patch）。
        conn.execute(
            "INSERT INTO browser_kernels (platform, type_code, resource_name, url, hash, signature, requires_extract, is_default)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                "windows",
                "SIMPRINT_KERNEL_CHROMIUM",
                "chromium-136",
                "https://storage.googleapis.com/simprint-release/kernels/chromium-136-windows.zip",
                "",
                "",
                1i32,
                1i32,
            ],
        )?;
        log::info!("[LocalStore] 已写入默认内核元数据: chromium-136");
        Ok(())
    }

    // ========================================================================
    // 环境 CRUD
    // ========================================================================

    /// 创建环境，返回生成的 uuid
    pub fn create_environment(
        &self,
        name: &str,
        config: &Value,
        group_uuid: Option<String>,
        proxy_uuid: Option<String>,
    ) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let uuid = Uuid::new_v4().to_string();
        let config_str = serde_json::to_string(config).map_err(|e| e.to_string())?;

        conn.execute(
            "INSERT INTO environments (uuid, name, config, group_uuid, proxy_uuid) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![uuid, name, config_str, group_uuid, proxy_uuid],
        )
        .map_err(|e| e.to_string())?;

        Ok(uuid)
    }

    /// 列出环境（分页 + 可选关键字/分组过滤）
    pub fn list_environments(
        &self,
        page: i64,
        page_size: i64,
        keyword: Option<String>,
        group_uuid: Option<String>,
    ) -> Result<(Vec<Value>, i64), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let offset = ((page - 1).max(0)) * page_size;
        let limit = page_size.max(1);

        let mut sql = String::from(
            "SELECT uuid, name, config, group_uuid, proxy_uuid, created_at, updated_at FROM environments WHERE 1=1",
        );
        let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(ref kw) = keyword {
            if !kw.trim().is_empty() {
                sql.push_str(" AND name LIKE ?");
                params_vec.push(Box::new(format!("%{}%", kw)));
            }
        }
        if let Some(ref gu) = group_uuid {
            if !gu.trim().is_empty() {
                sql.push_str(" AND group_uuid = ?");
                params_vec.push(Box::new(gu.clone()));
            }
        }

        // 计数
        let count_sql = format!("SELECT COUNT(*) FROM ({})", sql);
        let param_refs: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
        let total: i64 = conn
            .query_row(&count_sql, param_refs.as_slice(), |row| row.get(0))
            .map_err(|e| e.to_string())?;

        // 分页查询
        sql.push_str(" ORDER BY created_at DESC LIMIT ? OFFSET ?");
        params_vec.push(Box::new(limit));
        params_vec.push(Box::new(offset));
        let param_refs2: Vec<&dyn rusqlite::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let items = stmt
            .query_map(param_refs2.as_slice(), row_to_environment_item)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok((items, total))
    }

    /// 获取环境详情（启动时调用，结构需匹配 EnvironmentLaunchDetail）
    pub fn get_environment_detail(&self, uuid: &str) -> Result<Option<Value>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT uuid, name, config, group_uuid, proxy_uuid, created_at, updated_at FROM environments WHERE uuid = ?1",
            )
            .map_err(|e| e.to_string())?;

        let mut rows = stmt.query(params![uuid]).map_err(|e| e.to_string())?;
        if let Some(row) = rows.next().map_err(|e| e.to_string())? {
            let config_str: String = row.get(2).map_err(|e| e.to_string())?;
            let config: Value = serde_json::from_str(&config_str).unwrap_or(json!({}));

            // 构造 EnvironmentLaunchDetail 兼容结构
            let detail = json!({
                "environment": {
                    "uuid": uuid,
                    "name": row.get::<_, String>(1).unwrap_or_default(),
                    "id": 0
                },
                "config": config,
                "cookies": [],
                "urls": [],
                "proxy": null,
                "accounts": [],
                "extensions": []
            });
            return Ok(Some(detail));
        }
        Ok(None)
    }

    /// 更新环境
    pub fn update_environment(&self, uuid: &str, payload: &Value) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let name = payload.get("name").and_then(|v| v.as_str());
        let config = payload.get("config");

        if let Some(name) = name {
            conn.execute(
                "UPDATE environments SET name = ?1, updated_at = datetime('now') WHERE uuid = ?2",
                params![name, uuid],
            )
            .map_err(|e| e.to_string())?;
        }
        if let Some(config) = config {
            let config_str = serde_json::to_string(config).map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE environments SET config = ?1, updated_at = datetime('now') WHERE uuid = ?2",
                params![config_str, uuid],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    /// 删除环境
    pub fn delete_environment(&self, uuid: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM environments WHERE uuid = ?1", params![uuid])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// 设置环境代理
    pub fn set_environment_proxy(
        &self,
        uuid: &str,
        proxy_uuid: Option<String>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE environments SET proxy_uuid = ?1, updated_at = datetime('now') WHERE uuid = ?2",
            params![proxy_uuid, uuid],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ========================================================================
    // 分组
    // ========================================================================

    pub fn list_groups(&self) -> Result<Vec<Value>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT uuid, name, description FROM groups ORDER BY created_at ASC")
            .map_err(|e| e.to_string())?;
        let items = stmt
            .query_map([], |row| {
                Ok(json!({
                    "uuid": row.get::<_, String>(0)?,
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "description": row.get::<_, String>(2).unwrap_or_default()
                }))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(items)
    }

    pub fn create_group(&self, name: &str, description: &str) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let uuid = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO groups (uuid, name, description) VALUES (?1, ?2, ?3)",
            params![uuid, name, description],
        )
        .map_err(|e| e.to_string())?;
        Ok(uuid)
    }

    pub fn update_group(&self, uuid: &str, name: &str, description: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE groups SET name = ?1, description = ?2 WHERE uuid = ?3",
            params![name, description, uuid],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_group(&self, uuid: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM groups WHERE uuid = ?1", params![uuid])
            .map_err(|e| e.to_string())?;
        // 该分组下的环境 group_uuid 置空
        conn.execute(
            "UPDATE environments SET group_uuid = NULL WHERE group_uuid = ?1",
            params![uuid],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ========================================================================
    // 标签
    // ========================================================================

    pub fn list_tags(&self) -> Result<Vec<Value>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT uuid, name, color FROM tags ORDER BY created_at ASC")
            .map_err(|e| e.to_string())?;
        let items = stmt
            .query_map([], |row| {
                Ok(json!({
                    "uuid": row.get::<_, String>(0)?,
                    "id": row.get::<_, String>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "color": row.get::<_, String>(2).unwrap_or_else(|_| "#808080".into())
                }))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        Ok(items)
    }

    pub fn create_tag(&self, name: &str, color: &str) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let uuid = Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO tags (uuid, name, color) VALUES (?1, ?2, ?3)",
            params![uuid, name, color],
        )
        .map_err(|e| e.to_string())?;
        Ok(uuid)
    }

    pub fn update_tag(&self, uuid: &str, name: &str, color: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE tags SET name = ?1, color = ?2 WHERE uuid = ?3",
            params![name, color, uuid],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_tag(&self, uuid: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM tags WHERE uuid = ?1", params![uuid])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // ========================================================================
    // 浏览器内核
    // ========================================================================

    pub fn list_browser_kernels(&self, platform: &str) -> Vec<Value> {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(_) => return vec![],
        };

        let mut stmt = match conn.prepare(
            "SELECT resource_name, url, hash, signature, requires_extract FROM browser_kernels WHERE platform = ?1 AND type_code = 'SIMPRINT_KERNEL_CHROMIUM' ORDER BY is_default DESC, resource_name ASC",
        ) {
            Ok(s) => s,
            Err(_) => return vec![],
        };

        stmt.query_map(params![platform], |row| {
            Ok(json!({
                "resource_name": row.get::<_, String>(0)?,
                "url": row.get::<_, String>(1).unwrap_or_default(),
                "hash": row.get::<_, String>(2).unwrap_or_default(),
                "signature": row.get::<_, String>(3).unwrap_or_default(),
                "requires_extract": row.get::<_, i32>(4).unwrap_or(1) != 0
            }))
        })
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default()
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/// 将数据库行转换为前端环境列表项
fn row_to_environment_item(row: &rusqlite::Row) -> rusqlite::Result<Value> {
    let uuid: String = row.get(0)?;
    let name: String = row.get(1)?;
    let config_str: String = row.get(2)?;
    let group_uuid: Option<String> = row.get(3)?;
    let proxy_uuid: Option<String> = row.get(4)?;
    let created_at: String = row.get(5).unwrap_or_default();
    let updated_at: String = row.get(6).unwrap_or_default();

    let config: Value = serde_json::from_str(&config_str).unwrap_or(json!({}));
    let window_info = config.get("window_info").cloned().unwrap_or(json!({}));
    let kernel = window_info
        .get("kernel")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    Ok(json!({
        "uuid": uuid,
        "id": uuid,
        "name": name,
        "config": config,
        "group_uuid": group_uuid,
        "proxy_uuid": proxy_uuid,
        "kernel": kernel,
        "status": "stopped",
        "created_at": created_at,
        "updated_at": updated_at,
        "window_info": window_info
    }))
}

/// 解析本地数据库路径：app_data_dir/Simprint/local_data.db
fn resolve_db_path() -> Result<std::path::PathBuf, Box<dyn std::error::Error>> {
    use directories::ProjectDirs;

    // 优先用 Simprint 的 app data 目录
    if let Some(proj_dirs) = ProjectDirs::from("com", "lius", "Simprint") {
        let data_dir = proj_dirs.data_dir();
        return Ok(data_dir.join("local_data.db"));
    }

    // 回退：当前目录
    Ok(std::path::PathBuf::from("local_data.db"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn temp_store() -> LocalStore {
        let path = std::env::temp_dir().join(format!(
            "simprint_test_{}.db",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        LocalStore::open_at(&path).expect("初始化测试存储失败")
    }

    #[test]
    fn test_create_more_than_6_environments() {
        let store = temp_store();

        // 创建 10 个环境（突破 6 个限制）
        for i in 1..=10 {
            let config = json!({ "window_info": { "name": format!("env_{}", i), "kernel": "chromium-136" } });
            let uuid = store
                .create_environment(&format!("环境_{}", i), &config, None, None)
                .expect("创建环境失败");
            assert!(!uuid.is_empty());
        }

        // 验证总数
        let (_, total) = store.list_environments(1, 100, None, None).unwrap();
        assert_eq!(total, 10, "应该能创建 10 个环境（突破 6 限制）");
    }

    #[test]
    fn test_create_and_detail() {
        let store = temp_store();
        let config = json!({ "window_info": { "kernel": "chromium-136" } });
        let uuid = store.create_environment("测试", &config, None, None).unwrap();

        let detail = store.get_environment_detail(&uuid).unwrap().expect("详情不应为空");
        assert_eq!(
            detail["environment"]["uuid"].as_str().unwrap(),
            uuid
        );
        assert_eq!(
            detail["config"]["window_info"]["kernel"].as_str().unwrap(),
            "chromium-136"
        );
    }

    #[test]
    fn test_groups_crud() {
        let store = temp_store();
        let uuid = store.create_group("分组A", "描述").unwrap();
        let groups = store.list_groups().unwrap();
        assert_eq!(groups.len(), 1);
        store.delete_group(&uuid).unwrap();
        assert_eq!(store.list_groups().unwrap().len(), 0);
    }

    #[test]
    fn test_browser_kernels_seeded() {
        let store = temp_store();
        let kernels = store.list_browser_kernels("windows");
        assert!(!kernels.is_empty(), "默认内核应已预置");
        assert_eq!(
            kernels[0]["resource_name"].as_str().unwrap(),
            "chromium-136"
        );
    }
}
