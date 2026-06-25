pub mod remembered;

use log::error;
use once_cell::sync::Lazy;
use std::sync::{Arc, RwLock};
use tokio::sync::Mutex;

/// 凭证信息
#[derive(Debug, Clone, Default)]
pub struct Credential {
    access_token: Option<String>,
    refresh_token: Option<String>,
}

impl Credential {
    pub fn get_access_token(&self) -> Option<String> {
        self.access_token.clone()
    }

    pub fn get_refresh_token(&self) -> Option<String> {
        self.refresh_token.clone()
    }

    // 重置token
    pub fn reset_token(&mut self) {
        self.access_token = None;
        self.refresh_token = None;
    }

    // 是否处于登录状态
    pub fn is_login(&self) -> bool {
        self.access_token.is_some()
    }
}

/// 全局凭证存储
pub(crate) static CREDENTIAL: Lazy<RwLock<Credential>> =
    Lazy::new(|| RwLock::new(Credential::default()));

/// 服务器公钥存储
pub(crate) static SERVER_PUBLIC_KEY: Lazy<RwLock<Option<String>>> = Lazy::new(|| RwLock::new(None));

/// 刷新锁：确保同一时间只有一个请求在刷新凭证
static REFRESH_LOCK: Lazy<Arc<Mutex<()>>> = Lazy::new(|| Arc::new(Mutex::new(())));

// ============ 凭证管理函数 ============

/// 安全读取 CREDENTIAL 锁（poisoned 时降级返回默认凭证，避免 panic 致全应用崩溃）。
fn read_credential() -> Credential {
    CREDENTIAL
        .read()
        .unwrap_or_else(|poisoned| {
            log::error!("[Credential] 读锁 poisoned，降级返回默认凭证: {}", poisoned);
            poisoned.into_inner()
        })
        .clone()
}

/// 安全写入 CREDENTIAL 锁（poisoned 时仍获取内部引用，避免 panic）。
fn write_credential() -> std::sync::RwLockWriteGuard<'static, Credential> {
    CREDENTIAL.write().unwrap_or_else(|poisoned| {
        log::error!("[Credential] 写锁 poisoned，强制恢复: {}", poisoned);
        poisoned.into_inner()
    })
}

/// 获取凭证
pub fn get_credential() -> Credential {
    read_credential()
}

/// 设置访问令牌
pub fn set_access_token(token: String) {
    write_credential().access_token = Some(token);
}

/// 设置刷新令牌
pub fn set_refresh_token(token: String) {
    write_credential().refresh_token = Some(token);
}

/// 设置完整凭证
pub fn set_credential(access_token: String, refresh_token: String) {
    let mut cred = write_credential();
    cred.access_token = Some(access_token);
    cred.refresh_token = Some(refresh_token);
}

/// 清除凭证（登出）
pub fn clear_credential() {
    write_credential().reset_token();
}

/// 是否已登录
pub fn is_login() -> bool {
    read_credential().is_login()
}

// ============ 服务器公钥管理函数 ============

/// 获取/刷新服务器公钥（应用启动时或公钥过期时调用）
/// 支持自动重试，最多重试 3 次
/// 从服务器响应体提取纯 PEM 公钥字符串。
///
/// 兼容两种形态：
///   1. 纯 PEM 文本（官方服务器，-----BEGIN RSA PUBLIC KEY-----...）
///   2. JSON 包装（自托管服务器，{"public_key":"-----BEGIN RSA PUBLIC KEY-----..."}）。
///      JSON 内 `\n` 会被 serde_json 自动还原为真实换行符。
fn extract_public_key_from_body(body: &str) -> Option<String> {
    let trimmed = body.trim();
    // 形态 1：直接是 PEM
    if trimmed.starts_with("-----BEGIN") {
        return Some(trimmed.to_string());
    }
    // 形态 2：JSON 包装，解析后取 public_key 字段
    if trimmed.starts_with('{') {
        #[derive(serde::Deserialize)]
        struct PublicKeyResponse {
            public_key: String,
        }
        if let Ok(resp) = serde_json::from_str::<PublicKeyResponse>(trimmed) {
            return Some(resp.public_key);
        }
    }
    None
}

pub async fn fetch_server_public_key() -> Result<(), String> {
    use crate::infrastructure::http::client::Client;
    use tokio::time::{Duration, sleep};

    let url = Client::build_url("secret/public/key").map_err(|_| {
        error!("服务器请求路径错误");
        "初始化失败".to_string()
    })?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|_| "初始化失败".to_string())?;

    let mut last_err = None;
    for attempt in 0..3 {
        if attempt > 0 {
            sleep(Duration::from_millis(1000 * attempt as u64)).await;
        }

        match client.get(url.as_str()).send().await {
            Ok(response) => {
                if !response.status().is_success() {
                    last_err = Some("初始化失败".to_string());
                    continue;
                }

                match response.text().await {
                    Ok(body) => {
                        // 服务器可能返回纯 PEM 文本（官方）或 JSON 包装 {"public_key":"..."}（自托管）。
                        // 统一提取出纯 PEM 字符串后再校验。
                        let public_key = extract_public_key_from_body(&body);
                        if let Some(pk) = public_key.as_deref().filter(|pk| pk.contains("-----BEGIN RSA PUBLIC KEY-----")) {
                            *write_public_key_guard() = Some(pk.to_string());
                            return Ok(());
                        } else {
                            error!("服务器响应错误：公钥格式无效");
                            return Err("初始化失败".to_string());
                        }
                    }
                    Err(_) => {
                        last_err = Some("初始化失败".to_string());
                        continue;
                    }
                }
            }
            Err(_) => {
                last_err = Some("初始化失败".to_string());
                continue;
            }
        }
    }

    error!("获取服务器公钥失败，已达到最大重试次数");
    Err(last_err.unwrap_or_else(|| "初始化失败".to_string()))
}

/// 初始化服务器公钥（应用启动时调用，是 fetch_server_public_key 的别名）
#[inline]
pub async fn init_server_public_key() -> Result<(), String> {
    fetch_server_public_key().await
}

/// 安全读取 SERVER_PUBLIC_KEY 锁（poisoned 降级）。
fn read_public_key_guard() -> std::sync::RwLockReadGuard<'static, Option<String>> {
    SERVER_PUBLIC_KEY.read().unwrap_or_else(|poisoned| {
        log::error!("[Credential] 公钥读锁 poisoned，降级: {}", poisoned);
        poisoned.into_inner()
    })
}

/// 安全写入 SERVER_PUBLIC_KEY 锁（poisoned 仍恢复）。
fn write_public_key_guard() -> std::sync::RwLockWriteGuard<'static, Option<String>> {
    SERVER_PUBLIC_KEY.write().unwrap_or_else(|poisoned| {
        log::error!("[Credential] 公钥写锁 poisoned，强制恢复: {}", poisoned);
        poisoned.into_inner()
    })
}

/// 获取服务器公钥（必须在初始化后调用）
pub fn get_server_public_key() -> String {
    read_public_key_guard()
        .clone()
        .expect("服务器配置未初始化")
}

/// 设置服务器公钥
pub fn set_server_public_key(public_key: String) {
    *write_public_key_guard() = Some(public_key);
}

/// 清除服务器公钥
pub fn clear_server_public_key() {
    *write_public_key_guard() = None;
}

// ============ 凭证刷新函数 ============

/// 刷新用户凭证（带并发控制）
pub async fn refresh_credentials() -> Result<(), String> {
    // 使用 Box::pin 避免递归检测
    Box::pin(async {
        // 获取锁，确保同一时间只有一个请求在刷新
        let _lock = REFRESH_LOCK.lock().await;

        // 获取当前的 refresh_token
        let refresh_token = get_credential().get_refresh_token().ok_or("无刷新令牌")?;

        // 使用 AppContext 中的 HTTP 客户端发送刷新请求（避免递归）
        let ctx = crate::app::context::AppContext::get();
        let response = ctx
            .main_server_client
            .post_no_retry(
                "users/refresh-credentials",
                &serde_json::json!({
                    "refresh_token": refresh_token
                }),
            )
            .await
            .map_err(|_| "刷新凭证失败")?;

        // 检查响应状态
        if response.code != Some(1) {
            return Err("凭证刷新失败".to_string());
        }

        // 提取新凭证
        let data = response.data.ok_or("响应无数据")?;
        let access_token = data.get("access_token").and_then(|t| t.as_str()).ok_or("无访问令牌")?;
        let new_refresh_token =
            data.get("refresh_token").and_then(|t| t.as_str()).ok_or("无刷新令牌")?;

        // 更新全局凭证
        set_credential(access_token.to_string(), new_refresh_token.to_string());

        Ok(())
    })
    .await
}
