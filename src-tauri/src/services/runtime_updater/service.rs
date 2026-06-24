use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use futures::StreamExt;
use reqwest::Client;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use crate::app::context::AppContext;
use crate::core::error::{Error, Result};
use crate::infrastructure::runtime::PROTOCOL_VERSION;
use crate::infrastructure::updater::planner::calculate_file_hash;
use crate::infrastructure::updater::types::{InstallTask, InstallTasks};
use crate::services::updater::PreparedUpdateInfo;
use crate::services::updater::UpdateService;

use super::types::{PreparedRuntimeUpdate, RuntimeLatestRelease};

const POLL_INTERVAL: Duration = Duration::from_secs(180);
const READY_EVENT_NAME: &str = "app-update-ready";

#[cfg(target_os = "windows")]
const RUNTIME_RESOURCE_NAME: &str = "simprint-runtime.exe";
#[cfg(not(target_os = "windows"))]
const RUNTIME_RESOURCE_NAME: &str = "simprint-runtime";

#[derive(Default)]
struct RuntimeUpdateState {
    prepared: Option<PreparedRuntimeUpdate>,
}

pub struct RuntimeUpdateService {
    started: AtomicBool,
    state: Mutex<RuntimeUpdateState>,
}

impl RuntimeUpdateService {
    pub fn new() -> Self {
        Self {
            started: AtomicBool::new(false),
            state: Mutex::new(RuntimeUpdateState::default()),
        }
    }

    pub fn start_background(self: &Arc<Self>, app_handle: AppHandle) {
        if self.started.swap(true, Ordering::SeqCst) {
            return;
        }

        let service = Arc::clone(self);
        tauri::async_runtime::spawn(async move {
            loop {
                if let Err(error) = service.poll_once(&app_handle).await {
                    log::warn!("runtime update poll failed: {}", error);
                }

                tokio::time::sleep(POLL_INTERVAL).await;
            }
        });
    }

    pub async fn start_prepared_install(_app_handle: AppHandle) -> Result<()> {
        let ctx = AppContext::get();
        let prepared = {
            let state = ctx.runtime_update_service.state.lock().await;
            state.prepared.clone()
        }
        .ok_or_else(|| Error::UpdateInstallFailed)?;

        if !prepared.tasks_file.exists() || !prepared.artifact_path.exists() {
            return Err("待安装更新文件不存在，请等待重新下载".into());
        }

        ctx.simprint_runtime_manager.stop().await;
        UpdateService::start_update_install_with_tasks_file(prepared.tasks_file).await
    }

    pub async fn peek_prepared_update() -> Result<Option<PreparedUpdateInfo>> {
        let ctx = AppContext::get();
        let prepared = {
            let state = ctx.runtime_update_service.state.lock().await;
            state.prepared.clone()
        };

        Ok(prepared.map(|prepared| PreparedUpdateInfo {
            kind: "runtime".to_string(),
            version: prepared.version,
            restart_required: true,
        }))
    }

    async fn poll_once(&self, app_handle: &AppHandle) -> Result<()> {
        let release = self.fetch_latest_release().await?;
        let platform = release.platforms.get(Self::current_target_triple()).ok_or_else(|| {
            Error::UpdateCheckFailed(format!(
                "runtime latest.json 缺少平台 {}",
                Self::current_target_triple()
            ))
        })?;

        if release.protocol_version != u64::from(PROTOCOL_VERSION) {
            log::info!(
                "skip runtime update because protocol_version mismatch: local={}, remote={}",
                PROTOCOL_VERSION,
                release.protocol_version
            );
            return Ok(());
        }

        let runtime_path = crate::app::runtime::runtime_executable_path()?;
        if runtime_path.exists() {
            let local_hash = calculate_file_hash(&runtime_path).map_err(|error| {
                Error::UpdateCheckFailed(format!("runtime 本地文件哈希计算失败: {}", error))
            })?;
            if local_hash.eq_ignore_ascii_case(&platform.sha256) {
                let mut state = self.state.lock().await;
                state.prepared = None;
                return Ok(());
            }
        }

        {
            let state = self.state.lock().await;
            if let Some(prepared) = state.prepared.as_ref() {
                if prepared.version == release.version
                    && prepared.tasks_file.exists()
                    && prepared.artifact_path.exists()
                {
                    return Ok(());
                }
            }
        }

        let prepared = self.download_and_prepare(&release, platform).await?;

        {
            let mut state = self.state.lock().await;
            state.prepared = Some(prepared.clone());
        }

        let _ = app_handle.emit(
            READY_EVENT_NAME,
            PreparedUpdateInfo {
                kind: "runtime".to_string(),
                version: prepared.version,
                restart_required: true,
            },
        );

        Ok(())
    }

    async fn fetch_latest_release(&self) -> Result<RuntimeLatestRelease> {
        let ctx = AppContext::get();
        let response = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()?
            .get(&ctx.config.updater.runtime_latest_json_url)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            return Err(Error::UpdateCheckFailed(format!(
                "runtime latest.json 请求失败: {}",
                status
            )));
        }

        response.json::<RuntimeLatestRelease>().await.map_err(|error| {
            Error::UpdateCheckFailed(format!("runtime latest.json 解析失败: {}", error))
        })
    }

    async fn download_and_prepare(
        &self,
        release: &RuntimeLatestRelease,
        platform: &super::types::RuntimeLatestReleasePlatform,
    ) -> Result<PreparedRuntimeUpdate> {
        if platform.url.trim().is_empty() {
            return Err("runtime latest.json 未提供下载地址".into());
        }

        let runtime_dir = runtime_update_dir()?;
        fs::create_dir_all(&runtime_dir)?;

        let artifact_path =
            runtime_dir.join(format!("simprint-runtime-{}.download", release.version));
        let tasks_file = runtime_dir.join("runtime-update-tasks.json");
        let backup_path = runtime_dir.join(format!("simprint-runtime-{}.bak", release.version));

        download_to_file(&platform.url, &artifact_path).await?;

        let actual_hash = calculate_file_hash(&artifact_path).map_err(|error| {
            Error::UpdateCheckFailed(format!("runtime 更新包校验失败: {}", error))
        })?;
        if !actual_hash.eq_ignore_ascii_case(&platform.sha256) {
            return Err(Error::UpdateCheckFailed(format!(
                "runtime 更新包哈希不匹配: expected={}, actual={}",
                platform.sha256, actual_hash
            )));
        }

        let install_tasks = InstallTasks {
            tasks: vec![InstallTask {
                resource_name: RUNTIME_RESOURCE_NAME.to_string(),
                version: release.version.clone(),
                target_path: crate::app::runtime::runtime_executable_path()?
                    .to_string_lossy()
                    .to_string(),
                backup_path: Some(backup_path.to_string_lossy().to_string()),
                temp_path: artifact_path.to_string_lossy().to_string(),
                expected_hash: platform.sha256.clone(),
            }],
        };

        let payload = serde_json::to_vec_pretty(&install_tasks).map_err(|error| {
            Error::UpdateCheckFailed(format!("runtime 安装任务序列化失败: {}", error))
        })?;
        fs::write(&tasks_file, payload).map_err(|error| {
            Error::UpdateCheckFailed(format!("runtime 安装任务写入失败: {}", error))
        })?;

        Ok(PreparedRuntimeUpdate {
            version: release.version.clone(),
            artifact_path,
            tasks_file,
        })
    }

    fn current_target_triple() -> &'static str {
        #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
        {
            "x86_64-pc-windows-msvc"
        }

        #[cfg(all(target_os = "windows", target_arch = "aarch64"))]
        {
            "aarch64-pc-windows-msvc"
        }

        #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
        {
            "x86_64-unknown-linux-gnu"
        }

        #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
        {
            "x86_64-apple-darwin"
        }

        #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
        {
            "aarch64-apple-darwin"
        }
    }
}

fn runtime_update_dir() -> Result<PathBuf> {
    Ok(crate::core::paths::PathManager::get_updater_dir()?.join("runtime"))
}

async fn download_to_file(url: &str, target_path: &Path) -> Result<()> {
    let client = Client::builder().timeout(Duration::from_secs(300)).build()?;
    let response = client.get(url).send().await?;

    if !response.status().is_success() {
        return Err(Error::UpdateCheckFailed(format!(
            "runtime 更新包下载失败: {}",
            response.status()
        )));
    }

    let parent = target_path.parent().ok_or("无法确定 runtime 更新目录")?;
    fs::create_dir_all(parent)?;

    let mut file = fs::File::create(target_path)?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| {
            Error::UpdateCheckFailed(format!("runtime 更新包读取失败: {}", error))
        })?;
        std::io::Write::write_all(&mut file, &chunk)?;
    }

    std::io::Write::flush(&mut file)?;
    file.sync_all()?;
    Ok(())
}
