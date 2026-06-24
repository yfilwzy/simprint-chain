use std::collections::HashMap;

use serde_json::{Value, json};
use tauri::AppHandle;

use crate::{
    app::context::AppContext,
    core::error::Result,
    domain::environment::KernelDetail,
    services::environment::{KernelService, KernelStatusEmitter},
};

use super::types::{BrowserKernelVersion, EnvironmentLaunchDetail, SIMPRINT_KERNEL_CHROMIUM};

pub(super) struct ResolvedKernelLaunch {
    pub exe_path: String,
}

pub(super) async fn resolve_kernel_launch(
    app: AppHandle,
    detail: &EnvironmentLaunchDetail,
    profiles_path: &str,
    status_emitter: Option<KernelStatusEmitter>,
) -> Result<ResolvedKernelLaunch> {
    let env = detail
        .environment
        .as_ref()
        .ok_or("Environment detail is missing environment uuid.")?;
    let window_info = get_window_info(detail.config.as_ref());

    let kernel_value = window_info
        .get("kernel")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or("This environment has no browser kernel configured yet.")?
        .to_string();

    let kernels_map = list_browser_kernels(host_platform()).await?;
    let kernel_detail = kernels_map
        .get(SIMPRINT_KERNEL_CHROMIUM)
        .and_then(|list| list.iter().find(|kernel| kernel.resource_name == kernel_value))
        .cloned()
        .ok_or_else(|| format!("No browser kernel matched \"{}\".", kernel_value))?;

    let url = kernel_detail
        .url
        .filter(|value| !value.trim().is_empty())
        .ok_or("The selected browser kernel is missing download metadata.")?;
    let hash = kernel_detail
        .hash
        .filter(|value| !value.trim().is_empty())
        .ok_or("The selected browser kernel is missing download metadata.")?;
    let signature = kernel_detail
        .signature
        .filter(|value| !value.trim().is_empty())
        .ok_or("The selected browser kernel is missing signature metadata.")?;

    let exe_path = KernelService::ensure_kernel_ready(
        app,
        Some(env.uuid.clone()),
        kernel_value,
        profiles_path.to_string(),
        KernelDetail {
            url,
            hash,
            signature: Some(signature),
            requires_extract: kernel_detail.requires_extract,
        },
        status_emitter,
    )
    .await?;

    Ok(ResolvedKernelLaunch { exe_path })
}

pub(super) fn get_window_info(config: Option<&Value>) -> serde_json::Map<String, Value> {
    config
        .and_then(|config| config.get("window_info"))
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default()
}

async fn list_browser_kernels(
    platform: &str,
) -> Result<HashMap<String, Vec<BrowserKernelVersion>>> {
    let ctx = AppContext::get();
    let response = ctx
        .main_server_client
        .post(
            "browser-kernels/list",
            &json!({
                "platform": platform,
                "type_code": SIMPRINT_KERNEL_CHROMIUM,
            }),
        )
        .await?;

    let data = response.data.ok_or("获取浏览器内核失败")?;
    serde_json::from_value(data).map_err(Into::into)
}

fn host_platform() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "windows"
    }

    #[cfg(target_os = "macos")]
    {
        "darwin"
    }

    #[cfg(target_os = "linux")]
    {
        "linux"
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        "windows"
    }
}
