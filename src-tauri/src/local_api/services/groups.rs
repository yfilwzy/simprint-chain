use axum::http::StatusCode;
use serde_json::Value;

use crate::local_api::{
    client::main_server::proxy_data_value_request, context::LocalApiRequestContext,
    services::forward_service, types::LocalApiRoute,
};

macro_rules! group_service {
    ($fn_name:ident, $path:literal, $permission:literal, $response_ty:ty) => {
        pub async fn $fn_name(
            ctx: &LocalApiRequestContext,
            payload: Value,
        ) -> Result<Value, (StatusCode, String)> {
            proxy_data_value_request::<$response_ty>(
                concat!("groups", $path),
                $permission,
                &ctx.api_key,
                payload,
            )
            .await
        }
    };
    ($fn_name:ident, $path:literal, $permission:literal) => {
        pub async fn $fn_name(
            ctx: &LocalApiRequestContext,
            payload: Value,
        ) -> Result<Value, (StatusCode, String)> {
            forward_service(
                ctx,
                payload,
                LocalApiRoute {
                    method: "POST",
                    local_path: concat!("/api/local/groups", $path),
                    server_path: concat!("groups", $path),
                    permission_code: $permission,
                },
            )
            .await
        }
    };
}

group_service!(
    list_groups_service,
    "/list",
    "groups.list",
    crate::local_api::entitys::LocalApiGroupListResponse
);
group_service!(create_group_service, "/create", "groups.create");
group_service!(update_group_service, "/update", "groups.update");
group_service!(delete_group_service, "/delete", "groups.delete");
