//! 链式代理服务
//!
//! 负责本地持久化 proxy-chain 配置、订阅解析、生成 Mihomo 配置、
//! 管理 Mihomo 进程以及通过 Mihomo external-controller API 测速/选择节点。

mod api;
mod generator;
mod process;
mod redact;
mod service;
mod storage;
mod subscription;
mod types;

pub use service::ProxyChainService;
pub use types::{
    GeneratedMihomoConfig, LandingSocksConfig, MihomoProxyDelayResult, MihomoSettings,
    ProxyChainConfig, ProxyNode, ProxyPolicy, ProxyPolicyStrategy, ProxySubscription,
    RuntimeStatus, SubscriptionUpdateResult,
};
