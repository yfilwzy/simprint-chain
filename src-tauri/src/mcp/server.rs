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

#[derive(Debug, Clone)]
pub struct McpServer {
    bridge: Arc<LocalApiBridge>,
}

impl McpServer {
    pub fn new(config: &McpServerRuntimeConfig) -> Self {
        Self {
            bridge: Arc::new(LocalApiBridge::new(config.local_api_api_key.clone())),
        }
    }

    pub fn bridge(&self) -> &LocalApiBridge {
        self.bridge.as_ref()
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

pub fn spawn_mcp_server(config: McpServerRuntimeConfig) -> Result<McpServerHandle> {
    let addr = SocketAddr::from(([127, 0, 0, 1], config.port));
    let endpoint = config.endpoint();
    let state = Arc::new(config);
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let cancellation = CancellationToken::new();
    let app = build_app(state.clone(), cancellation.child_token());

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

fn build_app(state: Arc<McpServerRuntimeConfig>, cancellation: CancellationToken) -> Router {
    let service: StreamableHttpService<McpRouter<McpServer>, LocalSessionManager> =
        StreamableHttpService::new(
            {
                let state = state.clone();
                move || Ok(build_service(&state))
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

fn build_service(config: &McpServerRuntimeConfig) -> McpRouter<McpServer> {
    McpRouter::new(McpServer::new(config)).with_tools(tools::all_routes())
}

async fn health_handler(State(state): State<Arc<McpServerRuntimeConfig>>) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "running",
        "endpoint": state.endpoint(),
    }))
}
