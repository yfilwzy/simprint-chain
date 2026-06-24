use reqwest::{Url, header};
use std::{fmt::Debug, future::Future, pin::Pin, time::Duration};

use crate::app::context::AppContext;

pub type BeforeCallFunction = fn(
    rb: reqwest::RequestBuilder,
) -> Pin<
    Box<dyn Future<Output = std::result::Result<reqwest::RequestBuilder, reqwest::Error>> + Send>,
>;

pub type AfterCallFunction = fn(
    response: reqwest::Response,
) -> Pin<
    Box<dyn Future<Output = std::result::Result<reqwest::Response, reqwest::Error>> + Send>,
>;

pub struct Client {
    client: reqwest::Client,
    before: Vec<BeforeCallFunction>,
    after: Vec<AfterCallFunction>,
}

impl Client {
    pub fn new(timeout: u64) -> Client {
        Client {
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(timeout))
                .default_headers({
                    let headers = header::HeaderMap::new();
                    headers
                })
                .build()
                .unwrap(),
            before: vec![],
            after: vec![],
        }
    }

    pub fn build_url(resource: &str) -> Result<Url, anyhow::Error> {
        let ctx = AppContext::get();
        let config = ctx.config();
        let server_url = config.server.base_url.as_str();
        let version = config.server.version.as_str();

        let t = Url::parse(server_url)?.join(&format!("{}/", version))?.join(resource)?;

        Ok(t)
    }

    async fn run_before(
        &self,
        mut request_builder: reqwest::RequestBuilder,
    ) -> core::result::Result<reqwest::RequestBuilder, anyhow::Error> {
        for call in &self.before {
            request_builder = call(request_builder).await?;
        }
        Ok(request_builder)
    }

    async fn run_after(
        &self,
        mut response: reqwest::Response,
    ) -> core::result::Result<reqwest::Response, anyhow::Error> {
        for call in &self.after {
            response = call(response).await?;
        }
        Ok(response)
    }

    pub async fn post<T>(
        &self,
        url: reqwest::Url,
        json: &T,
    ) -> core::result::Result<reqwest::Response, anyhow::Error>
    where
        T: serde::Serialize + Debug,
    {
        let request_builder = self.client.post(url).json(json);
        let request_builder = self.run_before(request_builder).await?;
        let response = request_builder.send().await?;
        self.run_after(response).await
    }

    pub async fn post_with_headers<T>(
        &self,
        url: reqwest::Url,
        json: &T,
        headers: reqwest::header::HeaderMap,
    ) -> core::result::Result<reqwest::Response, anyhow::Error>
    where
        T: serde::Serialize + Debug,
    {
        let request_builder = self.client.post(url).headers(headers).json(json);
        let request_builder = self.run_before(request_builder).await?;
        let response = request_builder.send().await?;
        self.run_after(response).await
    }

    pub async fn post_form(
        &self,
        url: reqwest::Url,
        form: reqwest::multipart::Form,
    ) -> core::result::Result<reqwest::Response, anyhow::Error> {
        let request_builder = self.client.post(url).multipart(form);
        let request_builder = self.run_before(request_builder).await?;
        let response = request_builder.send().await?;
        self.run_after(response).await
    }

    pub async fn get(
        &self,
        url: reqwest::Url,
    ) -> core::result::Result<reqwest::Response, anyhow::Error> {
        let request_builder = self.client.get(url);
        let request_builder = self.run_before(request_builder).await?;
        let response = request_builder.send().await?;
        self.run_after(response).await
    }

    pub async fn put<T>(
        &self,
        url: reqwest::Url,
        json: &T,
    ) -> core::result::Result<reqwest::Response, anyhow::Error>
    where
        T: serde::Serialize,
    {
        let request_builder = self.client.put(url).json(json);
        let request_builder = self.run_before(request_builder).await?;
        let response = request_builder.send().await?;
        self.run_after(response).await
    }

    pub async fn delete<T>(
        &self,
        url: reqwest::Url,
        json: &T,
    ) -> core::result::Result<reqwest::Response, anyhow::Error>
    where
        T: serde::Serialize,
    {
        let request_builder = self.client.delete(url).json(json);
        let request_builder = self.run_before(request_builder).await?;
        let response = request_builder.send().await?;
        self.run_after(response).await
    }

    pub fn before(&mut self, call: BeforeCallFunction) {
        self.before.push(call);
    }

    pub fn after(&mut self, call: AfterCallFunction) {
        self.after.push(call);
    }
}
