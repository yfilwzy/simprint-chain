use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

use bytes::BytesMut;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command};
use tokio::sync::{Mutex, RwLock, oneshot};

use crate::app::context::AppContext;
use crate::domain::environment::EnvironmentStatus;
use crate::infrastructure::runtime::{
    AuthCommandRequest, AuthInfo, AuthResponse, EmptyPayload, EnvConnectionPayload,
    EnvironmentCommandRequest, EnvironmentCommandResponse, EnvironmentResponse, ErrorCode,
    ErrorResponse, HandshakeRequest, HandshakeResponse, InitializeContextRequest, Message,
    MessageType, PROTOCOL_VERSION, RuntimeContextInput, RuntimeEventEnvelope, RuntimeIpcError,
    StateResponse, SyncCommandRequest, SyncCommandResponse, SyncResponse, Topic,
};

const REQUEST_TIMEOUT_SECS: u64 = 30;

struct ManagedRuntime {
    child: Mutex<Child>,
    stdin: Mutex<ChildStdin>,
    pending: Mutex<HashMap<u32, oneshot::Sender<Message>>>,
    context_initialized: AtomicBool,
}

struct ManagedRuntimeHandle {
    runtime: Arc<ManagedRuntime>,
    reader_task: tokio::task::JoinHandle<()>,
    stderr_task: tokio::task::JoinHandle<()>,
}

pub struct SimprintRuntimeManager {
    app_handle: RwLock<Option<AppHandle>>,
    handle: Mutex<Option<ManagedRuntimeHandle>>,
}

impl SimprintRuntimeManager {
    pub fn new() -> Self {
        Self {
            app_handle: RwLock::new(None),
            handle: Mutex::new(None),
        }
    }

    pub async fn set_app_handle(&self, app_handle: AppHandle) {
        let mut guard = self.app_handle.write().await;
        *guard = Some(app_handle);
    }

    pub async fn is_running(&self) -> bool {
        self.runtime().await.is_some()
    }

    pub async fn send_environment_command(
        self: &Arc<Self>,
        command: EnvironmentCommandRequest,
    ) -> crate::core::error::Result<EnvironmentCommandResponse> {
        self.ensure_context_ready().await?;
        let message = Message::request_payload(Topic::EnvironmentCommand, &command)
            .map_err(runtime_err_to_string)?;
        let response = self.request(message).await?;
        let payload: EnvironmentResponse = response.payload().map_err(runtime_err_to_string)?;
        Ok(payload.result)
    }

    pub async fn send_sync_command(
        self: &Arc<Self>,
        command: SyncCommandRequest,
    ) -> crate::core::error::Result<SyncCommandResponse> {
        self.ensure_context_ready().await?;
        let message = Message::request_payload(Topic::SyncCommand, &command)
            .map_err(runtime_err_to_string)?;
        let response = self.request(message).await?;
        let payload: SyncResponse = response.payload().map_err(runtime_err_to_string)?;
        Ok(payload.result)
    }

    pub async fn sync_session_state(self: &Arc<Self>) -> crate::core::error::Result<()> {
        if !is_runtime_authenticated() {
            self.stop().await;
            return Ok(());
        }

        self.start_background().await?;
        self.ensure_context_ready().await?;

        let auth_info = current_auth_info();
        let command = AuthCommandRequest::SetAuthState { auth_info };
        let message = Message::request_payload(Topic::AuthCommand, &command)
            .map_err(runtime_err_to_string)?;
        let response = self.request(message).await?;
        let _: AuthResponse = response.payload().map_err(runtime_err_to_string)?;
        Ok(())
    }

    pub async fn start_background(self: &Arc<Self>) -> crate::core::error::Result<()> {
        self.start_if_needed().await
    }

    pub async fn stop(&self) {
        let handle = self.handle.lock().await.take();
        let Some(handle) = handle else {
            return;
        };

        let shutdown_message = Message::request_payload(Topic::Shutdown, &EmptyPayload::default())
            .map_err(runtime_err_to_string)
            .ok();
        if let Some(message) = shutdown_message {
            let _ = Self::request_with_runtime(handle.runtime.clone(), message).await;
        }

        {
            let mut child = handle.runtime.child.lock().await;
            let _ = tokio::time::timeout(std::time::Duration::from_secs(5), child.wait()).await;

            let exited = child.try_wait().ok().flatten().is_some();
            if !exited {
                let _ = child.kill().await;
                let _ = child.wait().await;
            }
        }

        handle.reader_task.abort();
        handle.stderr_task.abort();
    }

    async fn start_if_needed(self: &Arc<Self>) -> crate::core::error::Result<()> {
        if self.runtime().await.is_some() {
            return Ok(());
        }

        let executable = resolve_runtime_executable_path()?;
        let mut child = Command::new(&executable)
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()
            .map_err(|error| format!("启动 simprint-runtime 失败: {}", error))?;

        let stdin = child.stdin.take().ok_or("simprint-runtime stdin 未就绪")?;
        let stdout = child.stdout.take().ok_or("simprint-runtime stdout 未就绪")?;
        let stderr = child.stderr.take().ok_or("simprint-runtime stderr 未就绪")?;

        let runtime = Arc::new(ManagedRuntime {
            child: Mutex::new(child),
            stdin: Mutex::new(stdin),
            pending: Mutex::new(HashMap::new()),
            context_initialized: AtomicBool::new(false),
        });

        let reader_manager = Arc::clone(self);
        let reader_runtime = runtime.clone();
        let reader_task = tokio::spawn(async move {
            reader_manager.run_reader_loop(reader_runtime, stdout).await;
        });

        let stderr_task = tokio::spawn(async move {
            drain_stderr(stderr).await;
        });

        {
            let mut guard = self.handle.lock().await;
            *guard = Some(ManagedRuntimeHandle {
                runtime: runtime.clone(),
                reader_task,
                stderr_task,
            });
        }

        let handshake = Message::request_payload(
            Topic::Handshake,
            &HandshakeRequest {
                protocol_version: PROTOCOL_VERSION,
                client_name: "simprint".into(),
                client_version: env!("CARGO_PKG_VERSION").into(),
            },
        )
        .map_err(runtime_err_to_string)?;

        let response = self.request(handshake).await?;
        let _: HandshakeResponse = response.payload().map_err(runtime_err_to_string)?;
        Ok(())
    }

    async fn ensure_context_ready(self: &Arc<Self>) -> crate::core::error::Result<()> {
        if !is_runtime_authenticated() {
            return Err("当前未登录，无法初始化 simprint-runtime".into());
        }

        self.start_if_needed().await?;

        let runtime = self.runtime().await.ok_or("simprint-runtime 未启动")?;
        if runtime.context_initialized.load(Ordering::SeqCst) {
            return Ok(());
        }

        let message = Message::request_payload(
            Topic::InitializeContext,
            &InitializeContextRequest {
                context: RuntimeContextInput {
                    user_id: None,
                    workspace_id: None,
                    auth_info: Some(current_auth_info()),
                    attributes: BTreeMap::new(),
                },
            },
        )
        .map_err(runtime_err_to_string)?;
        let response = self.request(message).await?;
        let _: StateResponse = response.payload().map_err(runtime_err_to_string)?;
        runtime.context_initialized.store(true, Ordering::SeqCst);
        Ok(())
    }

    async fn request(self: &Arc<Self>, message: Message) -> crate::core::error::Result<Message> {
        let runtime = self.runtime().await.ok_or("simprint-runtime 未启动")?;
        Self::request_with_runtime(runtime, message).await
    }

    async fn request_with_runtime(
        runtime: Arc<ManagedRuntime>,
        message: Message,
    ) -> crate::core::error::Result<Message> {
        let (tx, rx) = oneshot::channel();
        {
            let mut pending = runtime.pending.lock().await;
            pending.insert(message.msg_id, tx);
        }

        let encoded = message.encode().map_err(runtime_err_to_string)?;
        {
            let mut stdin = runtime.stdin.lock().await;
            if let Err(error) = stdin.write_all(&encoded).await {
                let mut pending = runtime.pending.lock().await;
                pending.remove(&message.msg_id);
                return Err(format!("向 simprint-runtime 发送请求失败: {}", error).into());
            }
            if let Err(error) = stdin.flush().await {
                let mut pending = runtime.pending.lock().await;
                pending.remove(&message.msg_id);
                return Err(format!("刷新 simprint-runtime 请求失败: {}", error).into());
            }
        }

        let response =
            tokio::time::timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS), rx)
                .await
                .map_err(|_| "等待 simprint-runtime 响应超时")?
                .map_err(|_| "simprint-runtime 响应通道已关闭")?;

        if response.error_code != ErrorCode::Success.as_i32() {
            let message = response
                .payload::<ErrorResponse>()
                .map(|payload| payload.message)
                .unwrap_or_else(|_| format!("runtime error code {}", response.error_code));
            return Err(format!("simprint-runtime 请求失败: {}", message).into());
        }

        Ok(response)
    }

    async fn runtime(&self) -> Option<Arc<ManagedRuntime>> {
        let mut guard = self.handle.lock().await;
        let Some(handle) = guard.as_ref() else {
            return None;
        };

        let exited = {
            let mut child = handle.runtime.child.lock().await;
            child.try_wait().ok().flatten().is_some()
        };

        if exited {
            let handle = guard.take().unwrap();
            handle.reader_task.abort();
            handle.stderr_task.abort();
            return None;
        }

        Some(handle.runtime.clone())
    }

    async fn run_reader_loop(self: Arc<Self>, runtime: Arc<ManagedRuntime>, stdout: ChildStdout) {
        let mut stdout = stdout;
        let mut buffer = BytesMut::with_capacity(64 * 1024);
        let mut temp = [0u8; 64 * 1024];

        loop {
            match crate::infrastructure::runtime::Message::try_decode(&buffer) {
                Ok(Some((message, consumed))) => {
                    let _ = buffer.split_to(consumed);
                    match message.msg_type {
                        MessageType::Response => {
                            let sender = {
                                let mut pending = runtime.pending.lock().await;
                                pending.remove(&message.msg_id)
                            };
                            if let Some(sender) = sender {
                                let _ = sender.send(message);
                            }
                        }
                        MessageType::Event if matches!(message.topic, Topic::RuntimeEvent) => {
                            match message.payload::<RuntimeEventEnvelope>() {
                                Ok(event) => self.handle_runtime_event(event).await,
                                Err(error) => {
                                    log::warn!("failed to decode runtime event: {}", error);
                                }
                            }
                        }
                        _ => {}
                    }
                }
                Ok(None) => match stdout.read(&mut temp).await {
                    Ok(0) => {
                        log::warn!("simprint-runtime reader loop stopped: connection closed");
                        break;
                    }
                    Ok(bytes_read) => {
                        buffer.extend_from_slice(&temp[..bytes_read]);
                    }
                    Err(error) => {
                        log::warn!("simprint-runtime reader loop stopped: {}", error);
                        break;
                    }
                },
                Err(error) => {
                    log::warn!("simprint-runtime reader loop stopped: {}", error);
                    break;
                }
            }
        }
    }

    async fn handle_runtime_event(&self, event: RuntimeEventEnvelope) {
        if let Some(app_handle) = self.app_handle.read().await.clone() {
            let _ = app_handle.emit(&event.name, event.payload.clone());

            if event.name == "eventbus.connection_status" {
                if let Ok(payload) =
                    serde_json::from_value::<EnvConnectionPayload>(event.payload.clone())
                {
                    let _ = app_handle.emit("env-connection-status", payload.clone());
                    if let Some(ctx) = AppContext::try_get() {
                        match payload.status.as_str() {
                            "connected" => {
                                ctx.env_status_manager
                                    .set_status(&payload.env_id, EnvironmentStatus::Running)
                                    .await;
                            }
                            "disconnected" => {
                                ctx.env_status_manager
                                    .set_status(&payload.env_id, EnvironmentStatus::Stopped)
                                    .await;
                                ctx.env_position_manager.release_position(&payload.env_id).await;
                            }
                            _ => {}
                        }
                    }
                }
                return;
            }
        }

        if let Some(ctx) = AppContext::try_get() {
            match event.name.as_str() {
                "environment.stopped"
                | "environment.disconnected"
                | "environment.browser_disconnected" => {
                    if let Some(env_uuid) =
                        event.payload.get("env_uuid").and_then(|value| value.as_str())
                    {
                        ctx.env_status_manager
                            .set_status(env_uuid, EnvironmentStatus::Stopped)
                            .await;
                        ctx.env_position_manager.release_position(env_uuid).await;
                    }
                }
                "environment.launch_failed" => {
                    if let Some(env_uuid) =
                        event.payload.get("env_uuid").and_then(|value| value.as_str())
                    {
                        ctx.env_status_manager.set_status(env_uuid, EnvironmentStatus::Error).await;
                    }
                }
                _ => {}
            }
        }
    }
}

fn runtime_err_to_string(error: RuntimeIpcError) -> crate::core::error::Error {
    error.to_string().into()
}

pub fn runtime_executable_path() -> crate::core::error::Result<PathBuf> {
    if !cfg!(feature = "production") {
        let resource_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(runtime_file_name());
        return Ok(resource_path);
    }

    let current_exe = std::env::current_exe()?;
    let executable_dir = current_exe.parent().ok_or("无法确定当前可执行文件目录")?;
    Ok(executable_dir.join(runtime_file_name()))
}

fn resolve_runtime_executable_path() -> crate::core::error::Result<PathBuf> {
    let runtime_path = runtime_executable_path()?;
    if !runtime_path.exists() {
        return Err(format!(
            "未找到 simprint-runtime 可执行文件: {}",
            runtime_path.display()
        )
        .into());
    }

    Ok(runtime_path)
}

fn runtime_file_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "simprint-runtime.exe"
    }

    #[cfg(not(target_os = "windows"))]
    {
        "simprint-runtime"
    }
}

fn current_auth_info() -> AuthInfo {
    use crate::infrastructure::persistence::credential::{get_credential, is_login};

    if !is_login() {
        return AuthInfo {
            is_authenticated: false,
            access_token: None,
            user_info: None,
        };
    }

    let credential = get_credential();
    AuthInfo {
        is_authenticated: true,
        access_token: credential.get_access_token(),
        user_info: None,
    }
}

fn is_runtime_authenticated() -> bool {
    crate::infrastructure::persistence::credential::is_login()
}

async fn drain_stderr(stderr: ChildStderr) {
    let mut reader = BufReader::new(stderr).lines();
    loop {
        match reader.next_line().await {
            Ok(Some(line)) => {
                log::debug!("[simprint-runtime] {}", line);
            }
            Ok(None) => break,
            Err(error) => {
                log::warn!("failed to read simprint-runtime stderr: {}", error);
                break;
            }
        }
    }
}
