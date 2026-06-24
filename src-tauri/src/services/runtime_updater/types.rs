use std::collections::HashMap;
use std::path::PathBuf;

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct RuntimeLatestRelease {
    pub version: String,
    pub protocol_version: u64,
    #[serde(default)]
    pub notes: String,
    pub pub_date: String,
    pub platforms: HashMap<String, RuntimeLatestReleasePlatform>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RuntimeLatestReleasePlatform {
    pub url: String,
    pub size: u64,
    pub sha256: String,
}

#[derive(Debug, Clone)]
pub struct PreparedRuntimeUpdate {
    pub version: String,
    pub artifact_path: PathBuf,
    pub tasks_file: PathBuf,
}
