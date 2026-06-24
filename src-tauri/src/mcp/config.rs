use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::infrastructure::persistence::tauri_store::{get_store_key, keys, set_store_key};

pub const DEFAULT_MCP_PORT: i32 = 37110;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpConfig {
    pub enabled: bool,
}

impl Default for McpConfig {
    fn default() -> Self {
        Self { enabled: false }
    }
}

impl McpConfig {
    pub fn validate(&self) -> Result<(), String> {
        Ok(())
    }

    pub fn endpoint(&self) -> String {
        format!("http://127.0.0.1:{}/mcp", DEFAULT_MCP_PORT)
    }

    pub fn health_url(&self) -> String {
        format!("http://127.0.0.1:{}/health", DEFAULT_MCP_PORT)
    }

    pub fn runtime(&self) -> Result<McpRuntimeConfig, String> {
        self.validate()?;

        Ok(McpRuntimeConfig {
            port: DEFAULT_MCP_PORT as u16,
        })
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMcpConfigRequest {
    pub enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpRuntimeSnapshot {
    pub enabled: bool,
    pub running: bool,
    pub endpoint: String,
    pub health_url: String,
}

#[derive(Debug, Clone)]
pub struct McpRuntimeConfig {
    pub port: u16,
}

#[derive(Debug, Clone)]
pub struct McpManagerStatus {
    pub running: bool,
}

#[derive(Debug, Clone)]
pub struct McpServerRuntimeConfig {
    pub port: u16,
    pub local_api_api_key: String,
}

impl McpServerRuntimeConfig {
    pub fn endpoint(&self) -> String {
        format!("http://127.0.0.1:{}/mcp", self.port)
    }
}

pub fn load_config(app: &AppHandle) -> Result<McpConfig, String> {
    match get_store_key(app, keys::MCP) {
        Some(value) => {
            let config = serde_json::from_value::<McpConfig>(value)
                .map_err(|error| format!("MCP 配置格式无效: {error}"))?;
            config.validate()?;
            Ok(config)
        }
        None => {
            let config = McpConfig::default();
            save_config(app, &config)?;
            Ok(config)
        }
    }
}

pub fn save_config(app: &AppHandle, config: &McpConfig) -> Result<(), String> {
    config.validate()?;
    let value = serde_json::to_value(config).map_err(|error| error.to_string())?;
    set_store_key(app, keys::MCP, value)
}

pub fn update_config(
    app: &AppHandle,
    request: UpdateMcpConfigRequest,
) -> Result<McpConfig, String> {
    let mut config = load_config(app)?;

    if let Some(enabled) = request.enabled {
        config.enabled = enabled;
    }

    save_config(app, &config)?;
    Ok(config)
}

pub fn snapshot_from_config(config: McpConfig, status: McpManagerStatus) -> McpRuntimeSnapshot {
    let endpoint = config.endpoint();
    let health_url = config.health_url();

    McpRuntimeSnapshot {
        enabled: config.enabled,
        running: status.running,
        endpoint,
        health_url,
    }
}
