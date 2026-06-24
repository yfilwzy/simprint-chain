use sha2::Sha256;

use crate::infrastructure::http::client::JsonRespnse;
use crate::infrastructure::http::client::{AfterCallFunction, BeforeCallFunction, Client};

use crate::infrastructure::main_server::error::{
    is_public_key_expired_error, is_unauthorized_error,
};
use crate::infrastructure::main_server::interceptors;
use crate::infrastructure::main_server::response::{build_url, parse_and_decrypt_response};

const TIMEOUT_DURATION_SECS: u64 = 35;

/// 缓存配置
const CACHE_TTL_SECS: u64 = 300; // 5 分钟

/// 自动重试宏：处理 401 和 422 错误
macro_rules! with_auto_retry {
    // 统一处理：支持 0 个或多个额外参数
    ($self:expr, $method_without_retry:ident, $url:expr $(, $args:expr)*) => {{
        match $self.$method_without_retry($url $(, $args)*).await {
            Ok(resp) => Ok(resp),

            // 处理 401：刷新凭证
            Err(e) if is_unauthorized_error(&e) => {
                if let Ok(_) = crate::infrastructure::persistence::credential::refresh_credentials().await {
                    $self.$method_without_retry($url $(, $args)*).await
                } else {
                    Err(e)
                }
            }

            // 处理 422 + LASDE：刷新公钥
            Err(e) if is_public_key_expired_error(&e) => {
                if let Ok(_) = crate::infrastructure::persistence::credential::fetch_server_public_key().await {
                    // 公钥已刷新，用新公钥重新加密原始数据并重试
                    $self.$method_without_retry($url $(, $args)*).await
                } else {
                    Err(e)
                }
            }

            Err(e) => Err(e),
        }
    }};
}

/// 主服务器的请求客户端
pub struct MainServerRequestClient {
    client: Client,
}

impl MainServerRequestClient {
    pub fn new() -> MainServerRequestClient {
        MainServerRequestClient {
            client: Client::new(TIMEOUT_DURATION_SECS),
        }
    }

    /// 发起 GET 请求（带自动凭证刷新）
    pub async fn get(&self, url: &str) -> core::result::Result<JsonRespnse, anyhow::Error> {
        with_auto_retry!(self, get_no_retry, url)
    }

    // 内部方法：不带刷新的 GET（仅供宏使用）
    async fn get_no_retry(&self, url: &str) -> core::result::Result<JsonRespnse, anyhow::Error> {
        // 发起实际请求
        let response = self.client.get(build_url(url)?).await?;
        parse_and_decrypt_response(response).await
    }

    /// 发起 POST 请求（带自动凭证刷新）
    pub async fn post<T>(
        &self,
        url: &str,
        json: &T,
    ) -> core::result::Result<JsonRespnse, anyhow::Error>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        with_auto_retry!(self, post_no_retry, url, json)
    }

    pub async fn post_no_retry<T>(
        &self,
        url: &str,
        json: &T,
    ) -> core::result::Result<JsonRespnse, anyhow::Error>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        // 发起实际请求
        let response = self.client.post(build_url(url)?, json).await?;
        parse_and_decrypt_response(response).await
    }

    pub async fn post_with_headers<T>(
        &self,
        url: &str,
        json: &T,
        headers: reqwest::header::HeaderMap,
    ) -> core::result::Result<JsonRespnse, anyhow::Error>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        match self.post_with_headers_no_retry(url, json, headers.clone()).await {
            Ok(resp) => Ok(resp),
            Err(e) if is_unauthorized_error(&e) => {
                if let Ok(_) =
                    crate::infrastructure::persistence::credential::refresh_credentials().await
                {
                    self.post_with_headers_no_retry(url, json, headers).await
                } else {
                    Err(e)
                }
            }
            Err(e) if is_public_key_expired_error(&e) => {
                if let Ok(_) =
                    crate::infrastructure::persistence::credential::fetch_server_public_key().await
                {
                    self.post_with_headers_no_retry(url, json, headers).await
                } else {
                    Err(e)
                }
            }
            Err(e) => Err(e),
        }
    }

    async fn post_with_headers_no_retry<T>(
        &self,
        url: &str,
        json: &T,
        headers: reqwest::header::HeaderMap,
    ) -> core::result::Result<JsonRespnse, anyhow::Error>
    where
        T: serde::Serialize + std::fmt::Debug,
    {
        let response = self.client.post_with_headers(build_url(url)?, json, headers).await?;
        parse_and_decrypt_response(response).await
    }

    /// 发起 POST 表单请求（用于文件上传）
    ///
    /// 注意：由于 Form 无法克隆，此方法不支持自动重试
    pub async fn post_form(
        &self,
        url: &str,
        form: reqwest::multipart::Form,
    ) -> core::result::Result<JsonRespnse, anyhow::Error> {
        let response = self.client.post_form(build_url(url)?, form).await?;
        parse_and_decrypt_response(response).await
    }

    /// 发起 PUT 请求（带自动凭证刷新）
    pub async fn put<T>(
        &self,
        url: &str,
        json: &T,
    ) -> core::result::Result<JsonRespnse, anyhow::Error>
    where
        T: serde::Serialize,
    {
        with_auto_retry!(self, put_no_retry, url, json)
    }

    // 内部方法：不带刷新的 PUT（仅供宏使用）
    async fn put_no_retry<T>(
        &self,
        url: &str,
        json: &T,
    ) -> core::result::Result<JsonRespnse, anyhow::Error>
    where
        T: serde::Serialize,
    {
        let response = self.client.put(build_url(url)?, json).await?;
        parse_and_decrypt_response(response).await
    }

    /// 发起 DELETE 请求（带自动凭证刷新）
    pub async fn delete<T>(
        &self,
        url: &str,
        json: &T,
    ) -> core::result::Result<JsonRespnse, anyhow::Error>
    where
        T: serde::Serialize,
    {
        with_auto_retry!(self, delete_no_retry, url, json)
    }

    // 内部方法：不带刷新的 DELETE（仅供宏使用）
    async fn delete_no_retry<T>(
        &self,
        url: &str,
        json: &T,
    ) -> core::result::Result<JsonRespnse, anyhow::Error>
    where
        T: serde::Serialize,
    {
        let response = self.client.delete(build_url(url)?, json).await?;
        parse_and_decrypt_response(response).await
    }

    // 请求拦截器
    pub fn before(&mut self, call: BeforeCallFunction) {
        self.client.before(call);
    }

    // 响应拦截器
    pub fn after(&mut self, call: AfterCallFunction) {
        self.client.after(call);
    }
}
