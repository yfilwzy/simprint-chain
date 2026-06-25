//! 本地拦截器（破限本地化）
//!
//! 在 http_post 命令入口拦截特定端点，用本地 SQLite 存储处理环境数据，
//! 绕过 main server 的配额限制。仅匹配的端点本地处理，其余透传。
//!
//! 设计目标：环境数量无上限、纯本地持久化、配额返回无限。

pub mod store;

use serde_json::{json, Value};
use std::sync::OnceLock;

use crate::infrastructure::http::client::JsonRespnse;

use store::LocalStore;

/// 全局本地存储单例
static STORE: OnceLock<LocalStore> = OnceLock::new();

fn store() -> &'static LocalStore {
    STORE.get_or_init(|| {
        LocalStore::new().unwrap_or_else(|e| {
            log::error!("[LocalInterceptor] 初始化本地存储失败: {}", e);
            panic!("[LocalInterceptor] 本地存储初始化失败: {}", e);
        })
    })
}

/// 返回当前本地数据库文件路径（供备份/导入功能使用）。
pub fn local_db_path() -> std::path::PathBuf {
    store().db_path().to_path_buf()
}

/// 强制 WAL 检查点，确保数据落盘（导出备份前调用）。
pub fn checkpoint_local_db() -> std::result::Result<(), String> {
    store().checkpoint()
}

/// 尝试用本地拦截器处理请求。
///
/// 返回 `Some(Ok(response))` 表示已被本地处理；
/// 返回 `None` 表示该端点不匹配，交给上层透传 main server。
pub fn try_intercept(url: &str, data: Option<&Value>) -> Option<std::result::Result<JsonRespnse, String>> {
    let payload = data.cloned().unwrap_or(json!({}));
    log::debug!("[LocalInterceptor] 拦截检查: {}", url);

    let result = match url.trim_start_matches('/') {
        // ===== 环境 CRUD（核心破限）=====
        "environments/batch-create" => handle_batch_create(&payload),
        "environments/create" => handle_create(&payload),
        "environments/list" => handle_list(&payload),
        "environments/detail" => handle_detail(&payload),
        "environments/update" => handle_update(&payload),
        "environments/delete" => handle_delete(&payload),
        "environments/batch-delete" => handle_batch_delete(&payload),
        "environments/set-proxy" => handle_set_proxy(&payload),

        // 回收站（本地版不做回收，统一返回空）
        "environments/recycle-bin/list" => empty_paginated_list(),
        "environments/recycle-bin/restore" => success_empty(),
        "environments/recycle-bin/batch-restore" => success_empty(),
        "environments/recycle-bin/permanent-delete" => success_empty(),
        "environments/recycle-bin/batch-permanent-delete" => success_empty(),

        // ===== 分组 =====
        "groups/list" => handle_groups_list(&payload),
        "groups/create" => handle_groups_create(&payload),
        "groups/update" => handle_groups_update(&payload),
        "groups/delete" => handle_groups_delete(&payload),

        // ===== 标签 =====
        "tags/list" => handle_tags_list(&payload),
        "tags/create" => handle_tags_create(&payload),
        "tags/update" => handle_tags_update(&payload),
        "tags/delete" => handle_tags_delete(&payload),

        // ===== 代理/账号（本地版返回空列表）=====
        "proxies/list" => empty_paginated_list(),
        "proxies/create" => success_empty(),
        "proxies/delete" => success_empty(),
        "accounts/list" => empty_paginated_list(),
        "accounts/create" => success_empty(),

        // ===== 内核元数据（第二阶段处理）=====
        "browser-kernels/list" => handle_browser_kernels_list(&payload),

        // ===== 配额（返回无限，解除限制核心）=====
        "workspace-quotas/get" => infinite_quota(),
        "workspace-quotas/update" => success_empty(),
        "billing/quota" => infinite_quota(),
        "billing/subscription" => premium_subscription(),

        // ===== Local API 运行时配置（MCP / 本地 HTTP API 共用）=====
        // 破限版无远程服务，伪造一份有效配置，使 MCP server / Local API server 能正常拉起。
        "local-api/get" => mock_local_api_runtime_config(),

        // ===== 审计日志（本地版无服务端日志，返回空数据避免页面报错）=====
        "audit/logs" => empty_audit_logs(),
        "audit/logs/detail" => success_empty(),
        "audit/logs/export" => empty_audit_export(),
        "audit/stats" => empty_audit_stats(),

        // ===== 其他不匹配，透传 =====
        _ => return None,
    };

    Some(result)
}

// ============================================================================
// 辅助：构造响应
// ============================================================================

fn ok(data: Value) -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(1),
        message: Some("success".into()),
        data: Some(data),
    })
}

fn success_empty() -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(1),
        message: Some("success".into()),
        data: Some(json!({})),
    })
}

fn err(msg: &str) -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(0),
        message: Some(msg.into()),
        data: None,
    })
}

/// 空分页列表（兼容前端的 items/total 结构）
fn empty_paginated_list() -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(1),
        message: Some("success".into()),
        data: Some(json!({ "items": [], "total": 0 })),
    })
}

/// 无限配额响应
fn infinite_quota() -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(1),
        message: Some("success".into()),
        data: Some(json!({
            "workspace_uuid": "local-workspace",
            "max_environments": 999999,
            "used_environments": 0,
            "max_team_members": 999999,
            "used_team_members": 0,
            "max_proxies": 999999,
            "used_proxies": 0,
            "max_rpa_tasks": 999999,
            "used_rpa_tasks": 0,
            "created_at": "",
            "updated_at": ""
        })),
    })
}

/// 付费套餐响应（解锁会员展示）
fn premium_subscription() -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(1),
        message: Some("success".into()),
        data: Some(json!({
            "plan_uuid": "premium-local",
            "plan_name": "本地高级版",
            "expires_at": null,
            "status": "active",
            "is_premium": true,
            "max_environments": 999999
        })),
    })
}

/// 本地 Local API 运行时配置（伪造，供 MCP server / 本地 HTTP API server 启动使用）。
///
/// 破限版无远程 main server，`mcp/manager.rs` 与 `local_api/manager` 都依赖
/// `local-api/get` 返回的 `api_key` 才能拉起本地服务。这里返回一份固定有效配置，
/// `api_key` 与本地 server 鉴权保持一致（均使用同一本地常量）。
fn mock_local_api_runtime_config() -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(1),
        message: Some("success".into()),
        data: Some(json!({
            "enabled": true,
            "apiKey": "simprint-local-mock-key-v1",
            "port": 37111,
            "remoteAccess": false,
            "corsOrigins": [],
            "requestsToday": 0,
            "dailyLimit": 999999
        })),
    })
}

/// 空审计日志列表（本地版无服务端日志采集）。
///
/// 响应结构匹配前端 `AuditLogsListResponse`：items / total / page / page_size。
fn empty_audit_logs() -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(1),
        message: Some("success".into()),
        data: Some(json!({
            "items": [],
            "total": 0,
            "page": 1,
            "page_size": 20
        })),
    })
}

/// 空审计日志导出（匹配前端 `ExportResponse`：content / filename / mime_type）。
fn empty_audit_export() -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(1),
        message: Some("success".into()),
        data: Some(json!({
            "content": "[]",
            "filename": "audit-logs-empty.json",
            "mimeType": "application/json"
        })),
    })
}

/// 空审计统计（匹配前端 `AuditStatsResponse`：全部计数为 0，top 列表为空）。
fn empty_audit_stats() -> std::result::Result<JsonRespnse, String> {
    Ok(JsonRespnse {
        code: Some(1),
        message: Some("success".into()),
        data: Some(json!({
            "totalLogs": 0,
            "logsToday": 0,
            "logsThisWeek": 0,
            "logsThisMonth": 0,
            "topActions": [],
            "topTargetTypes": []
        })),
    })
}

// ============================================================================
// 环境 CRUD 处理函数
// ============================================================================

fn handle_batch_create(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    // 前端 BatchCreateEnvironmentRequest: { environments: [...] }
    let environments = payload
        .get("environments")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    if environments.is_empty() {
        return err("批量创建环境列表为空");
    }

    let mut results = Vec::with_capacity(environments.len());
    for env_config in &environments {
        let name = env_config
            .get("name")
            .and_then(|v| v.as_str())
            .unwrap_or("未命名环境")
            .to_string();
        let group_uuid = env_config
            .get("group_uuid")
            .and_then(|v| v.as_str())
            .map(String::from);
        let proxy_uuid = env_config
            .get("proxy_uuid")
            .and_then(|v| v.as_str())
            .map(String::from);

        let uuid = store().create_environment(&name, env_config, group_uuid, proxy_uuid)?;

        results.push(json!({
            "uuid": uuid,
            "name": name,
            "success": true
        }));
    }

    log::info!(
        "[LocalInterceptor] 批量创建 {} 个环境成功",
        results.len()
    );
    ok(json!({ "data": results }))
}

fn handle_create(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let name = payload
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("未命名环境")
        .to_string();
    let group_uuid = payload
        .get("group_uuid")
        .and_then(|v| v.as_str())
        .map(String::from);
    let proxy_uuid = payload
        .get("proxy_uuid")
        .and_then(|v| v.as_str())
        .map(String::from);

    let uuid = store().create_environment(&name, payload, group_uuid, proxy_uuid)?;
    log::info!("[LocalInterceptor] 创建环境成功: {} ({})", name, uuid);
    ok(json!({ "uuid": uuid, "name": name }))
}

fn handle_list(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let page = payload
        .get("page")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as i64;
    let page_size = payload
        .get("page_size")
        .and_then(|v| v.as_u64())
        .unwrap_or(20) as i64;

    let keyword = payload
        .pointer("/filters/keyword")
        .and_then(|v| v.as_str())
        .map(String::from);
    let group_uuid = payload
        .pointer("/filters/group_uuid")
        .and_then(|v| v.as_str())
        .map(String::from);

    let (items, total) = store().list_environments(page, page_size, keyword, group_uuid)?;
    log::debug!(
        "[LocalInterceptor] 列出环境: page={}, size={}, total={}",
        page,
        page_size,
        total
    );
    ok(json!({ "items": items, "total": total }))
}

fn handle_detail(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let uuid = payload
        .get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("detail 缺少 uuid")?;

    let detail = store().get_environment_detail(uuid)?;
    match detail {
        Some(d) => ok(d),
        None => err(&format!("环境 {} 不存在", uuid)),
    }
}

fn handle_update(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let uuid = payload
        .get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("update 缺少 uuid")?;

    store().update_environment(uuid, payload)?;
    ok(json!({ "uuid": uuid }))
}

fn handle_delete(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let uuid = payload
        .get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("delete 缺少 uuid")?;
    store().delete_environment(uuid)?;
    ok(json!({ "uuid": uuid }))
}

fn handle_batch_delete(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let uuids = payload
        .get("uuids")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut deleted = Vec::new();
    for uuid_val in &uuids {
        if let Some(uuid) = uuid_val.as_str() {
            store().delete_environment(uuid)?;
            deleted.push(json!({ "uuid": uuid, "success": true }));
        }
    }
    ok(json!({ "data": deleted }))
}

fn handle_set_proxy(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let uuid = payload
        .get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("set-proxy 缺少 uuid")?;
    let proxy_uuid = payload
        .get("proxy_uuid")
        .and_then(|v| v.as_str())
        .map(String::from);
    store().set_environment_proxy(uuid, proxy_uuid)?;
    ok(json!({ "uuid": uuid }))
}

// ============================================================================
// 分组 / 标签处理
// ============================================================================

fn handle_groups_list(_payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let groups = store().list_groups()?;
    ok(json!(groups))
}

fn handle_groups_create(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let name = payload
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("未命名分组")
        .to_string();
    let description = payload
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let uuid = store().create_group(&name, &description)?;
    ok(json!({ "uuid": uuid, "id": uuid, "name": name, "description": description }))
}

fn handle_groups_update(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let uuid = payload
        .get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("groups/update 缺少 uuid")?;
    let name = payload
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let description = payload
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    store().update_group(uuid, name, description)?;
    ok(json!({ "uuid": uuid }))
}

fn handle_groups_delete(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let uuid = payload
        .get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("groups/delete 缺少 uuid")?;
    store().delete_group(uuid)?;
    ok(json!({ "uuid": uuid }))
}

fn handle_tags_list(_payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let tags = store().list_tags()?;
    ok(json!(tags))
}

fn handle_tags_create(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let name = payload
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("未命名标签")
        .to_string();
    let color = payload
        .get("color")
        .and_then(|v| v.as_str())
        .unwrap_or("#808080")
        .to_string();
    let uuid = store().create_tag(&name, &color)?;
    ok(json!({ "uuid": uuid, "id": uuid, "name": name, "color": color }))
}

fn handle_tags_update(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let uuid = payload
        .get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("tags/update 缺少 uuid")?;
    let name = payload
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let color = payload
        .get("color")
        .and_then(|v| v.as_str())
        .unwrap_or("#808080");
    store().update_tag(uuid, name, color)?;
    ok(json!({ "uuid": uuid }))
}

fn handle_tags_delete(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let uuid = payload
        .get("uuid")
        .and_then(|v| v.as_str())
        .ok_or("tags/delete 缺少 uuid")?;
    store().delete_tag(uuid)?;
    ok(json!({ "uuid": uuid }))
}

// ============================================================================
// 浏览器内核（第二阶段：返回本地预置元数据）
// ============================================================================

fn handle_browser_kernels_list(payload: &Value) -> std::result::Result<JsonRespnse, String> {
    let platform = payload
        .get("platform")
        .and_then(|v| v.as_str())
        .unwrap_or("windows");
    let type_code = payload
        .get("type_code")
        .and_then(|v| v.as_str())
        .unwrap_or("SIMPRINT_KERNEL_CHROMIUM");

    log::debug!(
        "[LocalInterceptor] browser-kernels/list: platform={}, type={}",
        platform,
        type_code
    );

    // 返回一个本地默认内核版本。
    // kernel_value 必须与创建环境时 config.window_info.kernel 一致。
    // url/hash/signature 由 store 的内核配置提供（第二阶段可配置）。
    let kernels = store().list_browser_kernels(platform);

    let mut map = serde_json::Map::new();
    map.insert(type_code.to_string(), Value::Array(kernels));

    ok(Value::Object(map))
}
