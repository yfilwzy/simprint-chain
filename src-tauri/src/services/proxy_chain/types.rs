use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const CONFIG_VERSION: u32 = 1;
pub const DEFAULT_TEST_URL: &str = "https://www.gstatic.com/generate_204";
pub const DEFAULT_EXTERNAL_CONTROLLER: &str = "127.0.0.1:9090";
pub const DEFAULT_PLACEHOLDER_SECRET: &str = "CHANGE_ME_PROXY_CHAIN_SECRET";

/// 代理链模式。
///
/// - `Direct`：机场订阅直连。浏览器 → 本地 Mihomo → 机场节点（直接出口）。
///   PROXY 组直接由机场节点组成，无 dialer-proxy。适合目标网站不查落地 IP 的场景。
/// - `LandingChain`（默认）：机场订阅加落地代理。浏览器 → 本地 Mihomo → 机场节点（第一跳）
///   → 落地 SOCKS5（最终出口）。目标网站看到落地 IP，落地服务器经机场节点到达。
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProxyChainMode {
    Direct,
    #[default]
    LandingChain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProxyChainConfig {
    pub version: u32,
    pub mode: ProxyChainMode,
    pub subscriptions: Vec<ProxySubscription>,
    pub landing_socks: Vec<LandingSocksConfig>,
    pub policies: Vec<ProxyPolicy>,
    pub mihomo: MihomoSettings,
    pub updated_at: DateTime<Utc>,
}

impl Default for ProxyChainConfig {
    fn default() -> Self {
        Self {
            version: CONFIG_VERSION,
            mode: ProxyChainMode::default(),
            subscriptions: Vec::new(),
            landing_socks: Vec::new(),
            policies: vec![ProxyPolicy::default_select()],
            mihomo: MihomoSettings::default(),
            updated_at: Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProxySubscription {
    pub id: String,
    pub name: String,
    pub url: String,
    pub enabled: bool,
    pub user_agent: Option<String>,
    pub update_interval_minutes: Option<u64>,
    pub include_keywords: Vec<String>,
    pub exclude_keywords: Vec<String>,
    pub nodes: Vec<ProxyNode>,
    pub last_updated_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

impl Default for ProxySubscription {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: "订阅".to_string(),
            url: String::new(),
            enabled: true,
            user_agent: None,
            update_interval_minutes: Some(360),
            include_keywords: Vec::new(),
            exclude_keywords: Vec::new(),
            nodes: Vec::new(),
            last_updated_at: None,
            last_error: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProxyNode {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub source_subscription_id: Option<String>,
    /// Mihomo/Clash proxy object. Secrets inside this value must be redacted before returning to UI.
    pub raw: Value,
}

impl Default for ProxyNode {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: String::new(),
            enabled: true,
            source_subscription_id: None,
            raw: Value::Object(Default::default()),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct LandingSocksConfig {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub username: Option<String>,
    pub password: Option<String>,
    pub udp: bool,
    pub enabled: bool,
}

impl Default for LandingSocksConfig {
    fn default() -> Self {
        Self {
            id: String::new(),
            name: "落地 SOCKS".to_string(),
            host: "127.0.0.1".to_string(),
            port: 1080,
            username: None,
            password: None,
            udp: true,
            enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct ProxyPolicy {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub strategy: ProxyPolicyStrategy,
    /// Explicit subscription node ids to include.
    pub node_ids: Vec<String>,
    /// If set, include all enabled nodes from these subscriptions.
    pub subscription_ids: Vec<String>,
    /// Landing SOCKS ids to append into the policy.
    pub landing_socks_ids: Vec<String>,
    pub test_url: Option<String>,
    pub interval_seconds: Option<u64>,
    pub use_direct_fallback: bool,
}

impl Default for ProxyPolicy {
    fn default() -> Self {
        Self::default_select()
    }
}

impl ProxyPolicy {
    pub fn default_select() -> Self {
        Self {
            id: String::new(),
            name: "PROXY".to_string(),
            enabled: true,
            strategy: ProxyPolicyStrategy::UrlTest,
            node_ids: Vec::new(),
            subscription_ids: Vec::new(),
            landing_socks_ids: Vec::new(),
            test_url: Some(DEFAULT_TEST_URL.to_string()),
            interval_seconds: Some(300),
            use_direct_fallback: false,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, Eq, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProxyPolicyStrategy {
    #[default]
    Select,
    UrlTest,
    Fallback,
    /// Mihomo relay group: chains multiple proxies in order.
    Relay,
}

impl ProxyPolicyStrategy {
    pub fn mihomo_group_type(self, proxy_count: usize) -> &'static str {
        match self {
            Self::Select => "select",
            Self::UrlTest => "url-test",
            Self::Fallback => "fallback",
            // A relay group with fewer than 2 nodes is not useful and may be rejected by Mihomo.
            Self::Relay if proxy_count >= 2 => "relay",
            Self::Relay => "select",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct MihomoSettings {
    /// Optional executable path. Empty means use `mihomo` from PATH (or `mihomo.exe` on Windows).
    pub binary_path: Option<String>,
    /// Optional work directory; default is data/proxy_chain/mihomo.
    pub work_dir: Option<String>,
    /// Optional generated config file path; default is config/proxy_chain/mihomo.yaml.
    pub config_path: Option<String>,
    pub external_controller: String,
    pub external_controller_secret: Option<String>,
    pub external_ui: Option<String>,
    pub mixed_port: Option<u16>,
    pub socks_port: Option<u16>,
    pub http_port: Option<u16>,
    pub allow_lan: bool,
    pub bind_address: String,
    pub mode: String,
    pub log_level: String,
    pub default_test_url: String,
}

impl Default for MihomoSettings {
    fn default() -> Self {
        Self {
            binary_path: None,
            work_dir: None,
            config_path: None,
            external_controller: DEFAULT_EXTERNAL_CONTROLLER.to_string(),
            external_controller_secret: Some(DEFAULT_PLACEHOLDER_SECRET.to_string()),
            external_ui: None,
            mixed_port: Some(7890),
            socks_port: None,
            http_port: None,
            allow_lan: false,
            bind_address: "127.0.0.1".to_string(),
            mode: "rule".to_string(),
            log_level: "info".to_string(),
            default_test_url: DEFAULT_TEST_URL.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedMihomoConfig {
    pub config_path: String,
    pub work_dir: String,
    /// YAML text returned to UI. It is redacted by default in commands.
    pub yaml: String,
    pub redacted_yaml: String,
    pub proxy_count: usize,
    pub proxy_group_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub started_at: Option<DateTime<Utc>>,
    pub config_path: Option<String>,
    pub work_dir: Option<String>,
    pub controller: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionUpdateResult {
    pub subscription_id: String,
    pub fetched: bool,
    pub parsed: usize,
    pub skipped: usize,
    pub updated_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MihomoProxyDelayResult {
    pub name: String,
    pub success: bool,
    pub delay_ms: Option<u64>,
    pub error: Option<String>,
}
