use axum::{
    extract::{Request, State},
    http::Method,
    middleware::Next,
    response::IntoResponse,
    response::Response,
};

use crate::local_api::{
    context::LocalApiRequestContext, handlers::Response as LocalApiResponse,
    server::state::LocalApiServerState,
};

use super::super::client::headers::extract_api_key;

pub async fn auth_middleware(
    State(state): State<LocalApiServerState>,
    mut request: Request,
    next: Next,
) -> Response {
    if request.method() == Method::OPTIONS || request.uri().path() == "/api/local/health" {
        return next.run(request).await;
    }

    let Some(api_key) = extract_api_key(request.headers()) else {
        return LocalApiResponse::<()>::fail(
            Some("missing api key"),
            axum::http::StatusCode::UNAUTHORIZED,
        )
        .into_response();
    };

    // 校验 api_key 值与配置一致（破限版首次启动随机生成持久化），防止任意字符串绕过鉴权
    if api_key != state.config.api_key {
        return LocalApiResponse::<()>::fail(
            Some("invalid api key"),
            axum::http::StatusCode::UNAUTHORIZED,
        )
        .into_response();
    }

    request.extensions_mut().insert(LocalApiRequestContext { api_key });
    next.run(request).await
}
