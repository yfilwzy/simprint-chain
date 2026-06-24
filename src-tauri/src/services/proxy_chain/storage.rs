use std::collections::HashSet;
use std::path::PathBuf;

use chrono::Utc;
use once_cell::sync::Lazy;
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::core::error::{Error, Result};
use crate::core::paths::PathManager;

use super::redact::restore_masked_secrets;
use super::types::{DEFAULT_PLACEHOLDER_SECRET, MihomoSettings, ProxyChainConfig};

static CONFIG_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

const CONFIG_DIR_NAME: &str = "proxy_chain";
const CONFIG_FILE_NAME: &str = "config.json";
const MIHOMO_CONFIG_FILE_NAME: &str = "mihomo.yaml";
const MIHOMO_WORK_DIR_NAME: &str = "mihomo";

pub async fn load_config() -> Result<ProxyChainConfig> {
    let _guard = CONFIG_LOCK.lock().await;
    load_config_unlocked().await
}

pub async fn save_config(mut config: ProxyChainConfig) -> Result<ProxyChainConfig> {
    let _guard = CONFIG_LOCK.lock().await;
    let existing = load_config_unlocked().await.unwrap_or_default();
    restore_masked_secrets(&mut config, &existing);
    normalize_config(&mut config);
    validate_config(&config)?;
    write_config_unlocked(&config).await?;
    Ok(config)
}

pub async fn reset_config() -> Result<ProxyChainConfig> {
    let _guard = CONFIG_LOCK.lock().await;
    let mut config = ProxyChainConfig::default();
    normalize_config(&mut config);
    write_config_unlocked(&config).await?;
    Ok(config)
}

pub fn default_config_path() -> Result<PathBuf> {
    Ok(PathManager::get_config_dir()
        .map_err(|error| error.to_string())?
        .join(CONFIG_DIR_NAME)
        .join(CONFIG_FILE_NAME))
}

pub fn mihomo_config_path(settings: &MihomoSettings) -> Result<PathBuf> {
    if let Some(path) = non_empty_path(settings.config_path.as_deref()) {
        return Ok(path);
    }

    Ok(PathManager::get_config_dir()
        .map_err(|error| error.to_string())?
        .join(CONFIG_DIR_NAME)
        .join(MIHOMO_CONFIG_FILE_NAME))
}

pub fn mihomo_work_dir(settings: &MihomoSettings) -> Result<PathBuf> {
    if let Some(path) = non_empty_path(settings.work_dir.as_deref()) {
        return Ok(path);
    }

    Ok(PathManager::get_data_dir()
        .map_err(|error| error.to_string())?
        .join(CONFIG_DIR_NAME)
        .join(MIHOMO_WORK_DIR_NAME))
}

pub async fn write_generated_mihomo_config(path: &PathBuf, yaml: &str) -> Result<()> {
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(path, yaml).await?;
    Ok(())
}

async fn load_config_unlocked() -> Result<ProxyChainConfig> {
    let path = default_config_path()?;
    if !path.exists() {
        let mut config = ProxyChainConfig::default();
        normalize_config(&mut config);
        return Ok(config);
    }

    let content = tokio::fs::read_to_string(&path).await?;
    if content.trim().is_empty() {
        let mut config = ProxyChainConfig::default();
        normalize_config(&mut config);
        return Ok(config);
    }

    let mut config: ProxyChainConfig = serde_json::from_str(&content)?;
    normalize_config(&mut config);
    Ok(config)
}

async fn write_config_unlocked(config: &ProxyChainConfig) -> Result<()> {
    let path = default_config_path()?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let content = serde_json::to_string_pretty(config)?;
    tokio::fs::write(path, content).await?;
    Ok(())
}

pub fn normalize_config(config: &mut ProxyChainConfig) {
    config.version = super::types::CONFIG_VERSION;
    config.updated_at = Utc::now();

    let mut subscription_ids = HashSet::new();
    for (index, subscription) in config.subscriptions.iter_mut().enumerate() {
        ensure_id(&mut subscription.id, &mut subscription_ids);
        if subscription.name.trim().is_empty() {
            subscription.name = format!("订阅 {}", index + 1);
        }

        let mut node_ids = HashSet::new();
        for (node_index, node) in subscription.nodes.iter_mut().enumerate() {
            ensure_id(&mut node.id, &mut node_ids);
            if node.name.trim().is_empty() {
                node.name = node
                    .raw
                    .get("name")
                    .and_then(|value| value.as_str())
                    .map(ToOwned::to_owned)
                    .unwrap_or_else(|| format!("{} 节点 {}", subscription.name, node_index + 1));
            }
            node.source_subscription_id = Some(subscription.id.clone());
            if let Some(object) = node.raw.as_object_mut() {
                object.insert(
                    "name".to_string(),
                    serde_json::Value::String(node.name.clone()),
                );
            }
        }
    }

    let mut landing_ids = HashSet::new();
    for (index, landing) in config.landing_socks.iter_mut().enumerate() {
        ensure_id(&mut landing.id, &mut landing_ids);
        if landing.name.trim().is_empty() {
            landing.name = format!("落地 SOCKS {}", index + 1);
        }
    }

    let mut policy_ids = HashSet::new();
    for (index, policy) in config.policies.iter_mut().enumerate() {
        ensure_id(&mut policy.id, &mut policy_ids);
        if policy.name.trim().is_empty() {
            policy.name = if index == 0 {
                "PROXY".to_string()
            } else {
                format!("PROXY-{}", index + 1)
            };
        }
    }
    if config.policies.is_empty() {
        let mut policy = super::types::ProxyPolicy::default_select();
        ensure_id(&mut policy.id, &mut policy_ids);
        config.policies.push(policy);
    }

    if config.mihomo.external_controller.trim().is_empty() {
        config.mihomo.external_controller = super::types::DEFAULT_EXTERNAL_CONTROLLER.to_string();
    }
    if config.mihomo.default_test_url.trim().is_empty() {
        config.mihomo.default_test_url = super::types::DEFAULT_TEST_URL.to_string();
    }
    if config.mihomo.bind_address.trim().is_empty() {
        config.mihomo.bind_address = "127.0.0.1".to_string();
    }
    if config.mihomo.mode.trim().is_empty() {
        config.mihomo.mode = "rule".to_string();
    }
    if config.mihomo.log_level.trim().is_empty() {
        config.mihomo.log_level = "info".to_string();
    }
    if config.mihomo.mixed_port.is_none()
        && config.mihomo.socks_port.is_none()
        && config.mihomo.http_port.is_none()
    {
        config.mihomo.mixed_port = Some(7890);
    }
    if config.mihomo.external_controller_secret.is_none() {
        config.mihomo.external_controller_secret = Some(DEFAULT_PLACEHOLDER_SECRET.to_string());
    }
}

fn validate_config(config: &ProxyChainConfig) -> Result<()> {
    for subscription in &config.subscriptions {
        if subscription.enabled && subscription.url.trim().is_empty() {
            return Err(
                Error::InvalidArgument.log_with(format!("订阅 {} URL 不能为空", subscription.name))
            );
        }
    }

    validate_port(config.mihomo.mixed_port, "mixed_port")?;
    validate_port(config.mihomo.socks_port, "socks_port")?;
    validate_port(config.mihomo.http_port, "http_port")?;

    for landing in &config.landing_socks {
        if landing.enabled {
            if landing.host.trim().is_empty() || landing.port == 0 {
                return Err(Error::ProxyConfigInvalid
                    .log_with(format!("落地 SOCKS {} 配置无效", landing.name)));
            }
        }
    }

    Ok(())
}

fn validate_port(port: Option<u16>, field: &str) -> Result<()> {
    if port.is_some_and(|port| port == 0) {
        return Err(Error::InvalidArgument.log_with(format!("{} 端口不能为 0", field)));
    }
    Ok(())
}

fn ensure_id(value: &mut String, seen: &mut HashSet<String>) {
    if value.trim().is_empty() || seen.contains(value) {
        *value = Uuid::new_v4().to_string();
    }
    seen.insert(value.clone());
}

fn non_empty_path(value: Option<&str>) -> Option<PathBuf> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(PathBuf::from(trimmed))
        }
    })
}
