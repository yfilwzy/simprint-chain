use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreparedUpdateInfo {
    pub kind: String,
    pub version: String,
    pub restart_required: bool,
}
