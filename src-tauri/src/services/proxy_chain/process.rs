use std::path::PathBuf;
use std::process::Stdio;

use chrono::Utc;
use once_cell::sync::Lazy;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

use crate::core::error::{Error, Result};

use super::generator;
use super::types::{ProxyChainConfig, RuntimeStatus};

pub static RUNTIME: Lazy<ProxyChainRuntime> = Lazy::new(ProxyChainRuntime::new);

pub struct ProxyChainRuntime {
    process: Mutex<Option<ManagedMihomoProcess>>,
}

struct ManagedMihomoProcess {
    child: Child,
    pid: Option<u32>,
    started_at: chrono::DateTime<Utc>,
    config_path: String,
    work_dir: String,
    controller: Option<String>,
    stdout_task: tokio::task::JoinHandle<()>,
    stderr_task: tokio::task::JoinHandle<()>,
}

impl ProxyChainRuntime {
    pub fn new() -> Self {
        Self {
            process: Mutex::new(None),
        }
    }

    pub async fn start(&self, config: &ProxyChainConfig) -> Result<RuntimeStatus> {
        let generated = generator::generate_and_write(config, true).await?;
        let mut guard = self.process.lock().await;
        if let Some(status) = running_status_from_guard(&mut guard)? {
            return Ok(status);
        }

        let binary = resolve_mihomo_binary(config);
        let work_dir = PathBuf::from(&generated.work_dir);
        tokio::fs::create_dir_all(&work_dir).await?;

        let mut command = Command::new(&binary);
        command
            .arg("-d")
            .arg(&generated.work_dir)
            .arg("-f")
            .arg(&generated.config_path)
            .current_dir(&work_dir)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = command.spawn().map_err(|error| {
            Error::ProcessStartFailed.log_with(format!(
                "启动 Mihomo 失败，binary={}, error={}",
                binary, error
            ))
        })?;

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let stdout_task = tokio::spawn(async move {
            if let Some(stdout) = stdout {
                drain_process_output("stdout", stdout).await;
            }
        });
        let stderr_task = tokio::spawn(async move {
            if let Some(stderr) = stderr {
                drain_process_output("stderr", stderr).await;
            }
        });

        tokio::time::sleep(std::time::Duration::from_millis(300)).await;
        if let Some(status) = child.try_wait()? {
            stdout_task.abort();
            stderr_task.abort();
            return Err(Error::ProcessStartFailed
                .log_with(format!("Mihomo 进程启动后立即退出: {}", status)));
        }

        let managed = ManagedMihomoProcess {
            pid: child.id(),
            child,
            started_at: Utc::now(),
            config_path: generated.config_path,
            work_dir: generated.work_dir,
            controller: Some(config.mihomo.external_controller.clone()),
            stdout_task,
            stderr_task,
        };
        let status = managed.status(true);
        *guard = Some(managed);
        Ok(status)
    }

    pub async fn stop(&self) -> Result<RuntimeStatus> {
        let managed = self.process.lock().await.take();
        let Some(mut managed) = managed else {
            return Ok(RuntimeStatus {
                running: false,
                pid: None,
                started_at: None,
                config_path: None,
                work_dir: None,
                controller: None,
            });
        };

        let kill_result = managed.child.kill().await;
        let _ = managed.child.wait().await;
        managed.stdout_task.abort();
        managed.stderr_task.abort();

        if let Err(error) = kill_result {
            return Err(Error::ProcessStopFailed.log_with(format!("停止 Mihomo 失败: {}", error)));
        }

        Ok(RuntimeStatus {
            running: false,
            pid: None,
            started_at: None,
            config_path: Some(managed.config_path),
            work_dir: Some(managed.work_dir),
            controller: managed.controller,
        })
    }

    pub async fn restart(&self, config: &ProxyChainConfig) -> Result<RuntimeStatus> {
        let _ = self.stop().await;
        self.start(config).await
    }

    pub async fn status(&self) -> Result<RuntimeStatus> {
        let mut guard = self.process.lock().await;
        Ok(
            running_status_from_guard(&mut guard)?.unwrap_or(RuntimeStatus {
                running: false,
                pid: None,
                started_at: None,
                config_path: None,
                work_dir: None,
                controller: None,
            }),
        )
    }
}

impl ManagedMihomoProcess {
    fn status(&self, running: bool) -> RuntimeStatus {
        RuntimeStatus {
            running,
            pid: self.pid,
            started_at: Some(self.started_at),
            config_path: Some(self.config_path.clone()),
            work_dir: Some(self.work_dir.clone()),
            controller: self.controller.clone(),
        }
    }
}

fn running_status_from_guard(
    guard: &mut Option<ManagedMihomoProcess>,
) -> Result<Option<RuntimeStatus>> {
    let Some(managed) = guard.as_mut() else {
        return Ok(None);
    };

    if managed.child.try_wait()?.is_some() {
        let managed = guard.take().expect("checked Some above");
        managed.stdout_task.abort();
        managed.stderr_task.abort();
        return Ok(None);
    }

    Ok(Some(managed.status(true)))
}

fn resolve_mihomo_binary(config: &ProxyChainConfig) -> String {
    if let Some(path) = config
        .mihomo
        .binary_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return path.to_string();
    }

    if let Ok(path) = std::env::var("SIMPRINT_MIHOMO_PATH") {
        let path = path.trim();
        if !path.is_empty() {
            return path.to_string();
        }
    }

    let executable = mihomo_executable_name();
    if let Some(path) = bundled_mihomo_candidates(executable).into_iter().find(|path| path.exists())
    {
        return path.to_string_lossy().to_string();
    }

    executable.to_string()
}

fn mihomo_executable_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "mihomo.exe"
    } else {
        "mihomo"
    }
}

fn bundled_mihomo_candidates(executable: &str) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(dir) = current_exe.parent() {
            candidates.push(dir.join(executable));
            candidates.push(dir.join("resources").join(executable));
            candidates.push(dir.join("bin").join(executable));
        }
    }
    candidates
}

async fn drain_process_output<R>(label: &'static str, stream: R)
where
    R: tokio::io::AsyncRead + Unpin,
{
    let mut lines = BufReader::new(stream).lines();
    loop {
        match lines.next_line().await {
            Ok(Some(line)) => log::debug!("[mihomo:{}] {}", label, line),
            Ok(None) => break,
            Err(error) => {
                log::warn!("读取 Mihomo {} 失败: {}", label, error);
                break;
            }
        }
    }
}
