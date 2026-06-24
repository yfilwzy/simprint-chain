// ============ 基础模块 ============
mod client;
mod types;

// 重导出基础类型和客户端
pub use client::{AfterCallFunction, BeforeCallFunction, Client};
pub use types::JsonRespnse;
