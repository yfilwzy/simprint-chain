/// 记住的凭证持久化存储模块
///
/// 使用系统凭据存储保存 email 和 refresh_token
use anyhow::{Context, Result};
use keyring::{Entry, Error as KeyringError};
use serde::{Deserialize, Serialize};

const REMEMBERED_CREDENTIAL_SERVICE: &str = "simprint";
const REMEMBERED_CREDENTIAL_ACCOUNT: &str = "remembered-session";

/// 记住的凭证数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
struct RememberedCredential {
    email: String,
    refresh_token: String,
    saved_at: i64, // Unix timestamp
}

fn remembered_entry() -> Result<Entry> {
    Entry::new(REMEMBERED_CREDENTIAL_SERVICE, REMEMBERED_CREDENTIAL_ACCOUNT)
        .context("创建系统凭据条目失败")
}

/// 保存记住的凭证
pub fn save_remembered_credential(email: String, refresh_token: String) -> Result<()> {
    let credential = RememberedCredential {
        email,
        refresh_token,
        saved_at: chrono::Utc::now().timestamp(),
    };

    let payload = serde_json::to_string(&credential)
        .map_err(|_| anyhow::anyhow!("Failed to serialize credential data"))?;
    let entry = remembered_entry()?;
    entry.set_password(&payload).context("保存系统凭据失败")?;

    log::debug!("凭证存储操作完成");
    Ok(())
}

/// 读取记住的凭证
pub fn get_remembered_credential() -> Result<Option<(String, String)>> {
    let entry = remembered_entry()?;
    let payload = match entry.get_password() {
        Ok(payload) => payload,
        Err(KeyringError::NoEntry) => return Ok(None),
        Err(error) => return Err(anyhow::Error::new(error).context("读取系统凭据失败")),
    };

    let credential: RememberedCredential = serde_json::from_str(&payload)
        .map_err(|_| anyhow::anyhow!("Failed to deserialize credential data"))?;

    Ok(Some((credential.email, credential.refresh_token)))
}

/// 清除记住的凭证
pub fn clear_remembered_credential() -> Result<()> {
    let entry = remembered_entry()?;
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => {
            log::debug!("凭证清除操作完成");
            Ok(())
        }
        Err(error) => Err(anyhow::Error::new(error).context("删除系统凭据失败")),
    }
}
