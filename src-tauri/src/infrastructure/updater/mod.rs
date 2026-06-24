pub mod checker;
pub mod downloader;
pub mod installer;
pub mod manifest;
pub mod planner;
pub mod service;
pub mod state;
/// 更新器模块
///
/// 实现独立的更新器逻辑，包括版本检查、下载、校验、替换等功能
pub mod types;
pub mod verifier;

pub use checker::*;
pub use downloader::*;
pub use installer::*;
pub use manifest::*;
pub use planner::*;
pub use service::*;
pub use types::*;
pub use verifier::*;
