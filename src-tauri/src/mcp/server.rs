use std::{net::SocketAddr, sync::Arc};

use anyhow::{Context, Result};
use axum::{Router, extract::State, response::IntoResponse, routing::get};
use rmcp::{
    ServerHandler,
    handler::server::router::Router as McpRouter,
    model::{ServerCapabilities, ServerInfo},
    transport::streamable_http_server::{
        StreamableHttpServerConfig, StreamableHttpService, session::local::LocalSessionManager,
    },
};
use tokio::{net::TcpListener, sync::oneshot, task::JoinHandle};
use tokio_util::sync::CancellationToken;

use crate::mcp::{bridge::LocalApiBridge, config::McpServerRuntimeConfig, tools};

/// MCP server 运行时上下文，持有 LocalApiBridge 和 AppHandle。
///
/// AppHandle 用于让工具模块调用 Tauri command（proxy_chain_*/backup/extensions 等），
/// 这些功能不走 Local API bridge，需通过 app_handle.invoke 直接调用注册的 command。
#[derive(Clone)]
pub struct McpServer {
    bridge: Arc<LocalApiBridge>,
    app_handle: tauri::AppHandle,
}

impl McpServer {
    pub fn new(config: &McpServerRuntimeConfig, app_handle: tauri::AppHandle) -> Self {
        Self {
            bridge: Arc::new(LocalApiBridge::new(config.local_api_api_key.clone())),
            app_handle,
        }
    }

    pub fn bridge(&self) -> &LocalApiBridge {
        self.bridge.as_ref()
    }

    /// 返回 AppHandle，供工具模块调用 Tauri command。
    pub fn app_handle(&self) -> &tauri::AppHandle {
        &self.app_handle
    }
}

impl ServerHandler for McpServer {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_instructions("Simprint MCP server")
    }
}

pub struct McpServerHandle {
    shutdown_tx: Option<oneshot::Sender<()>>,
    join_handle: JoinHandle<()>,
}

impl McpServerHandle {
    pub fn is_finished(&self) -> bool {
        self.join_handle.is_finished()
    }

    pub async fn shutdown(mut self) {
        if let Some(tx) = self.shutdown_tx.take() {
            let _ = tx.send(());
        }
        let _ = self.join_handle.await;
    }
}

pub fn spawn_mcp_server(config: McpServerRuntimeConfig, app_handle: tauri::AppHandle) -> Result<McpServerHandle> {
    let addr = SocketAddr::from(([127, 0, 0, 1], config.port));
    let endpoint = config.endpoint();
    let state = Arc::new(config);
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let cancellation = CancellationToken::new();
    let app = build_app(state.clone(), cancellation.child_token(), app_handle);

    let join_handle = tokio::spawn(async move {
        let listener = match TcpListener::bind(addr)
            .await
            .with_context(|| format!("failed to bind mcp server on {}", addr))
        {
            Ok(listener) => listener,
            Err(error) => {
                log::error!("{}", error);
                return;
            }
        };

        log::info!("mcp server listening on {}", endpoint);

        let server = axum::serve(listener, app).with_graceful_shutdown(async move {
            let _ = shutdown_rx.await;
            cancellation.cancel();
        });

        if let Err(error) = server.await {
            log::error!("mcp server stopped with error: {}", error);
        }
    });

    Ok(McpServerHandle {
        shutdown_tx: Some(shutdown_tx),
        join_handle,
    })
}

fn build_app(state: Arc<McpServerRuntimeConfig>, cancellation: CancellationToken, app_handle: tauri::AppHandle) -> Router {
    let service: StreamableHttpService<McpRouter<McpServer>, LocalSessionManager> =
        StreamableHttpService::new(
            {
                let state = state.clone();
                let app_handle = app_handle.clone();
                move || Ok(build_service(&state, app_handle.clone()))
            },
            Default::default(),
            StreamableHttpServerConfig {
                stateful_mode: false,
                json_response: true,
                sse_keep_alive: None,
                cancellation_token: cancellation.child_token(),
                ..Default::default()
            },
        );

    Router::new()
        .route("/health", get(health_handler))
        .nest_service("/mcp", service)
        .with_state(state)
}

fn build_service(config: &McpServerRuntimeConfig, app_handle: tauri::AppHandle) -> McpRouter<McpServer> {
    McpRouter::new(McpServer::new(config, app_handle)).with_tools(tools::all_routes())
}

async fn health_handler(State(state): State<Arc<McpServerRuntimeConfig>>) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "running",
        "endpoint": state.endpoint(),
    }))
}
