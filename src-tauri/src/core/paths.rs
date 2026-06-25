//! 统一的路径解析层
//!
//! 目标：
//! - 不再直接依赖 Tauri 提供的 app_data_dir/app_log_dir/app_cache_dir
//! - 所有运行期目录都从同一个根目录体系派生
//! - 启动前可通过固定位置的 bootstrap.json 覆盖默认路径

use anyhow::{Context, Result, anyhow};
use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(target_os = "windows")]
use winreg::RegKey;
#[cfg(target_os = "windows")]
use winreg::enums::HKEY_CURRENT_USER;

const APP_DIR_NAME: &str = "Simprint";
const BOOTSTRAP_FILENAME: &str = "bootstrap.json";
#[cfg(target_os = "windows")]
const RUNTIME_PATHS_REGISTRY_SUBKEY: &str = "Software\\Simprint\\RuntimePaths";

/// 默认数据根目录的环境变量覆盖键。
///
/// 破限本地版将默认根目录迁移到 D 盘；如需自定义（例如 D 盘不存在或多系统迁移），
/// 设置该环境变量即可覆盖，取值需为绝对路径。
const DATA_ROOT_ENV: &str = "SIMPRINT_DATA_DIR";

/// D 盘默认根目录常量（破限本地版）。
#[cfg(target_os = "windows")]
const DEFAULT_D_DRIVE_ROOT: &str = "D:\\Simprint";

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
struct BootstrapConfig {
    root_dir: Option<String>,
    config_dir: Option<String>,
    logs_dir: Option<String>,
    cache_dir: Option<String>,
    data_dir: Option<String>,
    kernels_dir: Option<String>,
    referral_dir: Option<String>,
    updater_dir: Option<String>,
    update_tasks_file: Option<String>,
}

/// 路径管理器
pub struct PathManager;

impl PathManager {
    /// 默认根目录（不受 bootstrap 影响）
    ///
    /// 破限本地版优先级：
    /// 1. 环境变量 `SIMPRINT_DATA_DIR`（绝对路径，最高优先级）
    /// 2. Windows：`D:\Simprint`（若 D 盘可写）；D 盘不可用时回退到原 `%LOCALAPPDATA%\Simprint`
    /// 3. macOS / Linux：`~/.config/Simprint`
    pub fn get_default_root_dir() -> Result<PathBuf> {
        // 1. 环境变量覆盖
        if let Ok(custom) = std::env::var(DATA_ROOT_ENV) {
            let trimmed = custom.trim();
            if !trimmed.is_empty() {
                let path = PathBuf::from(trimmed);
                if path.is_absolute() {
                    return Ok(path);
                }
            }
        }

        #[cfg(target_os = "windows")]
        {
            // 2. 优先使用 D 盘根目录
            let d_root = PathBuf::from(DEFAULT_D_DRIVE_ROOT);
            if Self::is_drive_writable("D:\\") {
                return Ok(d_root);
            }
            // D 盘不可用（例如无 D 分区），回退到系统 LocalAppData，保证可用性
            let base_dirs = BaseDirs::new().ok_or_else(|| anyhow!("无法获取系统基础目录"))?;
            Ok(base_dirs.data_local_dir().join(APP_DIR_NAME))
        }

        #[cfg(target_os = "macos")]
        {
            let base_dirs = BaseDirs::new().ok_or_else(|| anyhow!("无法获取系统基础目录"))?;
            Ok(base_dirs.config_dir().join(APP_DIR_NAME))
        }

        #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
        {
            let base_dirs = BaseDirs::new().ok_or_else(|| anyhow!("无法获取系统基础目录"))?;
            Ok(base_dirs.config_dir().join(APP_DIR_NAME))
        }
    }

    /// 检测指定盘符根目录是否可写（用于判断 D 盘是否存在且可创建目录）。
    #[cfg(target_os = "windows")]
    fn is_drive_writable(drive_root: &str) -> bool {
        let root = Path::new(drive_root);
        if !root.exists() {
            return false;
        }
        // 尝试在根目录创建临时子目录来验证可写性（失败说明只读或无权限）
        match std::fs::create_dir_all(root.join(".simprint_probe")) {
            Ok(_) => {
                let _ = std::fs::remove_dir(root.join(".simprint_probe"));
                true
            }
            Err(_) => false,
        }
    }

    /// bootstrap.json 固定位置
    pub fn get_bootstrap_file() -> Result<PathBuf> {
        Ok(Self::get_default_root_dir()?.join(BOOTSTRAP_FILENAME))
    }

    /// 最终根目录
    pub fn get_root_dir() -> Result<PathBuf> {
        let default_root = Self::get_default_root_dir()?;
        let bootstrap = Self::load_bootstrap();
        let root = bootstrap
            .root_dir
            .as_deref()
            .map(|value| Self::resolve_override_path(value, &default_root))
            .transpose()?
            .unwrap_or(default_root);
        Self::ensure_dir(&root)?;
        Ok(root)
    }

    pub fn get_config_dir() -> Result<PathBuf> {
        let dir = Self::resolve_named_dir(
            Self::load_bootstrap().config_dir.as_deref(),
            Self::get_root_dir()?,
            "config",
        )?;
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_logs_dir(_app: &tauri::AppHandle) -> Result<PathBuf> {
        let dir = if let Some(value) = Self::read_store_storage_string("logsPath") {
            Self::resolve_override_path(&value, &Self::get_root_dir()?)?
        } else {
            Self::resolve_named_dir(
                Self::load_bootstrap().logs_dir.as_deref(),
                Self::get_root_dir()?,
                "logs",
            )?
        };
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_cache_dir(_app: &tauri::AppHandle) -> Result<PathBuf> {
        let dir = if let Some(value) = Self::read_store_storage_string("cachePath") {
            Self::resolve_override_path(&value, &Self::get_root_dir()?)?
        } else {
            Self::resolve_named_dir(
                Self::load_bootstrap().cache_dir.as_deref(),
                Self::get_root_dir()?,
                "cache",
            )?
        };
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_app_data_dir(_app: &tauri::AppHandle) -> Result<PathBuf> {
        Self::get_data_dir()
    }

    pub fn get_data_dir() -> Result<PathBuf> {
        let dir = Self::resolve_named_dir(
            Self::load_bootstrap().data_dir.as_deref(),
            Self::get_root_dir()?,
            "data",
        )?;
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_local_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
        let dir = Self::get_app_data_dir(app)?.join(".local");
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_profiles_dir(_app: &tauri::AppHandle) -> Result<PathBuf> {
        let dir = if let Some(value) = Self::read_store_storage_string("profilesPath") {
            Self::resolve_override_path(&value, &Self::get_root_dir()?)?
        } else {
            Self::get_data_dir()?.join("profiles")
        };
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_downloads_dir(_app: &tauri::AppHandle) -> Result<PathBuf> {
        let dir = if let Some(value) = Self::read_store_storage_string("downloadsPath") {
            Self::resolve_override_path(&value, &Self::get_root_dir()?)?
        } else {
            Self::get_data_dir()?.join("downloads")
        };
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_kernel_cache_dir(app: &tauri::AppHandle) -> Result<PathBuf> {
        let dir = Self::get_cache_dir(app)?.join("kernel");
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_kernels_dir() -> Result<PathBuf> {
        let dir = Self::resolve_named_dir(
            Self::load_bootstrap().kernels_dir.as_deref(),
            Self::get_root_dir()?,
            "kernels",
        )?;
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_referral_dir() -> Result<PathBuf> {
        let dir = Self::resolve_named_dir(
            Self::load_bootstrap().referral_dir.as_deref(),
            Self::get_root_dir()?,
            "referral",
        )?;
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_updater_dir() -> Result<PathBuf> {
        let dir = Self::resolve_named_dir(
            Self::load_bootstrap().updater_dir.as_deref(),
            Self::get_root_dir()?,
            "updates",
        )?;
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    pub fn get_update_tasks_file() -> Result<PathBuf> {
        let root = Self::get_root_dir()?;
        let path = Self::load_bootstrap()
            .update_tasks_file
            .as_deref()
            .map(|value| Self::resolve_override_path(value, &root))
            .transpose()?
            .unwrap_or_else(|| root.join("update_tasks.json"));
        Self::ensure_parent_dir(&path)?;
        Ok(path)
    }

    pub fn get_store_file() -> Result<PathBuf> {
        let path = Self::get_config_dir()?.join("store.json");
        Self::ensure_parent_dir(&path)?;
        Ok(path)
    }

    pub fn get_manifest_file() -> Result<PathBuf> {
        let path = Self::get_root_dir()?.join("manifest.json");
        Self::ensure_parent_dir(&path)?;
        Ok(path)
    }

    pub fn get_webview_data_dir() -> Result<PathBuf> {
        let dir = Self::get_data_dir()?.join("webview");
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    /// 启动早期日志目录，不依赖 Tauri。
    pub fn get_bootstrap_logs_dir() -> Result<PathBuf> {
        let dir = if let Some(value) = Self::read_store_storage_string("logsPath") {
            Self::resolve_override_path(&value, &Self::get_root_dir()?)?
        } else {
            Self::resolve_named_dir(
                Self::load_bootstrap().logs_dir.as_deref(),
                Self::get_root_dir()?,
                "logs",
            )?
        };
        Self::ensure_dir(&dir)?;
        Ok(dir)
    }

    fn resolve_named_dir(
        override_value: Option<&str>,
        root_dir: PathBuf,
        default_child: &str,
    ) -> Result<PathBuf> {
        Ok(override_value
            .map(|value| Self::resolve_override_path(value, &root_dir))
            .transpose()?
            .unwrap_or_else(|| root_dir.join(default_child)))
    }

    fn resolve_override_path(value: &str, base_dir: &Path) -> Result<PathBuf> {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            return Err(anyhow!("路径配置不能为空"));
        }

        let path = PathBuf::from(trimmed);
        if path.is_absolute() {
            Ok(path)
        } else {
            Ok(base_dir.join(path))
        }
    }

    fn load_bootstrap() -> BootstrapConfig {
        let Ok(path) = Self::get_bootstrap_file() else {
            return BootstrapConfig::default();
        };

        let Ok(content) = fs::read_to_string(path) else {
            return BootstrapConfig::default();
        };

        serde_json::from_str(&content).unwrap_or_default()
    }

    pub fn sync_bootstrap_from_storage(storage: Option<&Map<String, Value>>) -> Result<()> {
        let mut bootstrap = Self::load_bootstrap();

        bootstrap.logs_dir = Self::storage_path_value(storage, "logsPath");
        bootstrap.cache_dir = Self::storage_path_value(storage, "cachePath");

        let bootstrap_path = Self::get_bootstrap_file()?;

        if bootstrap.is_empty() {
            if bootstrap_path.exists() {
                fs::remove_file(&bootstrap_path).with_context(|| {
                    format!("删除 bootstrap.json 失败: {}", bootstrap_path.display())
                })?;
            }
            return Ok(());
        }

        Self::ensure_parent_dir(&bootstrap_path)?;
        let content =
            serde_json::to_string_pretty(&bootstrap).context("序列化 bootstrap.json 失败")?;
        fs::write(&bootstrap_path, content)
            .with_context(|| format!("写入 bootstrap.json 失败: {}", bootstrap_path.display()))
    }

    pub fn sync_runtime_paths_registry(app: &tauri::AppHandle) -> Result<()> {
        #[cfg(target_os = "windows")]
        {
            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            let (key, _) = hkcu
                .create_subkey(RUNTIME_PATHS_REGISTRY_SUBKEY)
                .context("创建运行时路径注册表键失败")?;

            key.set_value(
                "RootDir",
                &Self::get_root_dir()?.to_string_lossy().to_string(),
            )
            .context("写入注册表 RootDir 失败")?;
            key.set_value(
                "ConfigDir",
                &Self::get_config_dir()?.to_string_lossy().to_string(),
            )
            .context("写入注册表 ConfigDir 失败")?;
            key.set_value(
                "LogsDir",
                &Self::get_logs_dir(app)?.to_string_lossy().to_string(),
            )
            .context("写入注册表 LogsDir 失败")?;
            key.set_value(
                "CacheDir",
                &Self::get_cache_dir(app)?.to_string_lossy().to_string(),
            )
            .context("写入注册表 CacheDir 失败")?;
            key.set_value(
                "DataDir",
                &Self::get_data_dir()?.to_string_lossy().to_string(),
            )
            .context("写入注册表 DataDir 失败")?;
            key.set_value(
                "KernelsDir",
                &Self::get_kernels_dir()?.to_string_lossy().to_string(),
            )
            .context("写入注册表 KernelsDir 失败")?;
            key.set_value(
                "ReferralDir",
                &Self::get_referral_dir()?.to_string_lossy().to_string(),
            )
            .context("写入注册表 ReferralDir 失败")?;
            key.set_value(
                "UpdaterDir",
                &Self::get_updater_dir()?.to_string_lossy().to_string(),
            )
            .context("写入注册表 UpdaterDir 失败")?;
            key.set_value(
                "UpdateTasksFile",
                &Self::get_update_tasks_file()?.to_string_lossy().to_string(),
            )
            .context("写入注册表 UpdateTasksFile 失败")?;
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = app;
        }

        Ok(())
    }

    fn ensure_dir(path: &Path) -> Result<()> {
        fs::create_dir_all(path).with_context(|| format!("创建目录失败: {}", path.display()))
    }

    fn ensure_parent_dir(path: &Path) -> Result<()> {
        let parent = path.parent().ok_or_else(|| anyhow!("无法获取父目录: {}", path.display()))?;
        Self::ensure_dir(parent)
    }

    fn read_store_storage_string(sub_key: &str) -> Option<String> {
        let store_path = Self::get_store_file().ok()?;
        let content = fs::read_to_string(store_path).ok()?;
        let root: Value = serde_json::from_str(&content).ok()?;
        let value = root.get("storage")?.get(sub_key)?.as_str()?;
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    }

    fn storage_path_value(storage: Option<&Map<String, Value>>, key: &str) -> Option<String> {
        let value = storage?.get(key)?.as_str()?.trim();
        if value.is_empty() {
            None
        } else {
            Some(value.to_string())
        }
    }
}

impl BootstrapConfig {
    fn is_empty(&self) -> bool {
        self.root_dir.is_none()
            && self.config_dir.is_none()
            && self.logs_dir.is_none()
            && self.cache_dir.is_none()
            && self.data_dir.is_none()
            && self.kernels_dir.is_none()
            && self.referral_dir.is_none()
            && self.updater_dir.is_none()
            && self.update_tasks_file.is_none()
    }
}
