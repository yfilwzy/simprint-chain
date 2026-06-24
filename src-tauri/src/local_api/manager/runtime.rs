use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use anyhow::Result;
use serde_json::json;
use tokio::sync::Mutex;

use crate::{app::context::AppContext, local_api::types::LocalApiRuntimeConfig};

use super::super::server::bootstrap::{LocalApiServerHandle, spawn_local_api_server};

pub struct LocalApiManager {
    server: Mutex<Option<LocalApiServerHandle>>,
    running: Arc<AtomicBool>,
}

impl LocalApiManager {
    pub fn new() -> Self {
        Self {
            server: Mutex::new(None),
            running: Arc::new(AtomicBool::new(false)),
        }
    }

    pub async fn refresh_from_server(self: &Arc<Self>) -> Result<()> {
        let ctx = AppContext::get();
        let response = match ctx.main_server_client.post("local-api/get", &json!({})).await {
            Ok(response) => response,
            Err(error) => {
                log::warn!("failed to fetch local api config: {}", error);
                return Ok(());
            }
        };

        let config = response
            .data
            .ok_or_else(|| anyhow::anyhow!("missing local api config data"))
            .and_then(|data| {
                serde_json::from_value::<LocalApiRuntimeConfig>(data).map_err(Into::into)
            })?;

        if !config.enabled {
            self.stop().await;
            return Ok(());
        }

        self.restart(config).await
    }

    pub async fn stop(&self) {
        let mut guard = self.server.lock().await;
        if let Some(handle) = guard.take() {
            handle.shutdown().await;
        }
        self.running.store(false, Ordering::SeqCst);
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    async fn restart(&self, config: LocalApiRuntimeConfig) -> Result<()> {
        self.stop().await;
        self.running.store(true, Ordering::SeqCst);
        let handle = match spawn_local_api_server(config, Arc::clone(&self.running)) {
            Ok(handle) => handle,
            Err(error) => {
                self.running.store(false, Ordering::SeqCst);
                return Err(error);
            }
        };
        let mut guard = self.server.lock().await;
        *guard = Some(handle);
        Ok(())
    }
}
