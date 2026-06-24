/// 更新器数据模型定义
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// 反序列化 id 字段，支持整数或字符串（字符串转换为整数）
fn deserialize_id<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;

    let value: serde_json::Value = Deserialize::deserialize(deserializer)?;

    match value {
        serde_json::Value::Null => Ok(None),
        serde_json::Value::Number(n) => {
            n.as_i64().ok_or_else(|| D::Error::custom("无法将数字转换为 i64")).map(Some)
        }
        serde_json::Value::String(s) => s
            .parse::<i64>()
            .map_err(|_| D::Error::custom("无法将字符串解析为整数"))
            .map(Some),
        _ => Err(D::Error::custom("id 必须是数字或字符串")),
    }
}

/// 反序列化 file_size 字段，支持 Option<i32> 到 u64 的转换
fn deserialize_file_size<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;

    let value: Option<i32> = Option::deserialize(deserializer)?;
    match value {
        None => Ok(0),
        Some(size) => {
            if size < 0 {
                Err(D::Error::custom("file_size 不能为负数"))
            } else {
                Ok(size as u64)
            }
        }
    }
}

/// 服务器返回的 Artifact 结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    #[serde(deserialize_with = "deserialize_id")]
    pub id: Option<i64>,
    #[serde(default)]
    pub name: String,
    pub version: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub hash: String, // SHA256
    #[serde(deserialize_with = "deserialize_file_size")]
    pub file_size: u64,
    #[serde(default = "default_platform")]
    pub platform: String,
    pub resource_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_latest: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_path: Option<String>,
}

/// 默认平台值
fn default_platform() -> String {
    "windows".to_string()
}

/// 服务器返回的版本集合
///
/// 使用 HashMap 以支持灵活的字段名（T9_CLIENT, DLL, OTHER_PROGRAM, T9_CLIENT_INSTALLER 等）
pub type Versions = HashMap<String, Vec<Artifact>>;

/// 服务器返回的检查响应数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResponseData {
    pub versions: Versions,
}

/// 服务器返回的完整检查响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResponse {
    pub code: i32,
    pub message: String,
    pub data: CheckResponseData,
}

/// 检查请求
#[derive(Debug, Clone, Serialize)]
pub struct CheckRequest {}

/// 资源类型
/// 更新任务
#[derive(Debug, Clone)]
pub struct UpdateTask {
    pub artifact: Artifact,
    pub target_path: PathBuf,
    pub backup_path: Option<PathBuf>,
    pub temp_path: PathBuf, // 下载后的临时路径
}

/// 序列化的安装任务（用于客户端和更新器之间传递）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallTask {
    pub resource_name: String,
    pub version: String,
    pub target_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backup_path: Option<String>,
    pub temp_path: String,     // 已下载并校验通过的文件路径
    pub expected_hash: String, // SHA256，用于再次确认
}

/// 安装任务列表（用于传递多个任务）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstallTasks {
    pub tasks: Vec<InstallTask>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InstallStrategy {
    DirectReplace,
    InstallerPackage,
}

/// 更新计划（用于检查后保存，供下载使用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePlan {
    pub tasks: Vec<UpdatePlanTask>,
}

/// 更新计划任务（序列化版本，用于保存到文件）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePlanTask {
    pub artifact: Artifact,
    pub target_path: String,
    pub backup_path: Option<String>,
    pub temp_path: String,
}

/// 更新状态
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum UpdaterState {
    /// 空闲，未检查或已检查但无更新
    Idle,
    /// 有可用更新
    Available,
    /// 检查中
    Checking,
    /// 下载中
    Downloading,
    /// 校验中
    Verifying,
    /// 安装中
    Installing,
    /// 完成
    Success,
    /// 部分失败（部分资源更新成功）
    PartialFailed,
    /// 失败
    Failed,
}

/// 更新状态详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdaterStateInfo {
    pub state: UpdaterState,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tasks: Option<Vec<TaskInfo>>,
}

/// 任务信息（用于状态返回）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    pub resource_name: String,
    pub version: String,
    pub status: String, // "pending", "downloading", "verifying", "installing", "success", "failed"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Manifest 文件中存储的版本信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub client: ClientInfo,
    pub artifacts: Vec<ArtifactInfo>,
    pub last_updated: String, // ISO 8601 时间戳
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestRelease {
    pub version: String,
    #[serde(default)]
    pub notes: String,
    pub pub_date: String,
    pub platforms: HashMap<String, LatestReleasePlatform>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatestReleasePlatform {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub r2_url: String,
}

/// 客户端信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientInfo {
    pub version: String,
}

/// Manifest 中的资源信息（仅展示用）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactInfo {
    pub resource_name: String,
    pub version: String,
}

/// 更新事件类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum UpdateEvent {
    /// 检查中
    Checking { payload: CheckingPayload },
    /// 检查失败
    CheckFailed { code: i32, payload: ErrorPayload },
    /// 计划失败
    PlanFailed { code: i32, payload: ErrorPayload },
    /// 无需更新
    NoUpdates { payload: NoUpdatesPayload },
    /// 发现更新
    FoundUpdates { payload: FoundUpdatesPayload },
    /// 下载中
    Downloading { payload: DownloadingPayload },
    /// 下载完成
    DownloadComplete { payload: DownloadCompletePayload },
    /// 部分下载完成
    DownloadPartial { payload: DownloadPartialPayload },
    /// 下载失败
    DownloadFailed { code: i32, payload: ErrorPayload },
    /// 下载进度
    DownloadProgress { payload: DownloadProgressPayload },
}

impl UpdateEvent {
    /// 获取事件类型字符串
    ///
    /// 返回格式：`update_<stage>_<status>`
    /// 例如：`update_checking`, `update_check_failed`, `update_download_complete`
    pub fn event_type(&self) -> &'static str {
        match self {
            UpdateEvent::Checking { .. } => "update_checking",
            UpdateEvent::CheckFailed { .. } => "update_check_failed",
            UpdateEvent::PlanFailed { .. } => "update_plan_failed",
            UpdateEvent::NoUpdates { .. } => "update_no_updates",
            UpdateEvent::FoundUpdates { .. } => "update_found_updates",
            UpdateEvent::Downloading { .. } => "update_downloading",
            UpdateEvent::DownloadComplete { .. } => "update_download_complete",
            UpdateEvent::DownloadPartial { .. } => "update_download_partial",
            UpdateEvent::DownloadFailed { .. } => "update_download_failed",
            UpdateEvent::DownloadProgress { .. } => "update_download_progress",
        }
    }
}

/// 检查中事件负载
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CheckingPayload {
    // 检查阶段无额外数据
}

/// 错误事件负载
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ErrorPayload {
    /// 错误消息
    pub error_message: String,
}

/// 无需更新事件负载
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NoUpdatesPayload {
    // 无需更新无额外数据
}

/// 发现更新事件负载
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FoundUpdatesPayload {
    /// 更新数量
    pub update_count: usize,
}

/// 下载中事件负载
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DownloadingPayload {
    /// 更新数量
    pub update_count: usize,
}

/// 下载完成事件负载
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DownloadCompletePayload {
    /// 更新任务文件路径
    pub tasks_file: String,
    /// 成功下载的文件数量
    pub success_count: usize,
}

/// 部分下载完成事件负载
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DownloadPartialPayload {
    /// 更新任务文件路径
    pub tasks_file: String,
    /// 成功下载的文件数量
    pub success_count: usize,
    /// 失败的文件数量
    pub failed_count: usize,
    /// 错误消息
    pub error_message: String,
}

/// 下载进度事件负载
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DownloadProgressPayload {
    /// 当前已下载总大小（字节）
    pub downloaded: u64,
    /// 总大小（字节）
    pub total: u64,
    /// 进度百分比（0-100）
    pub percentage: f64,
}
