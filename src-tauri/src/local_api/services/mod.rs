pub mod browser_kernels;
pub mod environments;
pub mod groups;
pub mod proxies;
pub mod tags;
pub mod workspaces;

use axum::http::StatusCode;
use serde_json::Value;

use crate::local_api::{
    client::main_server::proxy_request, context::LocalApiRequestContext, types::LocalApiRoute,
};

pub async fn forward_service(
    ctx: &LocalApiRequestContext,
    payload: Value,
    route: LocalApiRoute,
) -> Result<Value, (StatusCode, String)> {
    proxy_request(
        route.server_path,
        route.permission_code,
        &ctx.api_key,
        payload,
    )
    .await
}
