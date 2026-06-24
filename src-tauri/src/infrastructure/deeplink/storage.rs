use std::fs;

/// 推广码存储：在统一根目录的 `referral/<code>` 创建空文件。
pub fn store_referral_code(code: &str) -> Result<(), String> {
    let referral_dir =
        crate::core::paths::PathManager::get_referral_dir().map_err(|e| e.to_string())?;

    // 先删除旧目录，再写入（确保单一来源，避免残留）
    let _ = fs::remove_dir_all(&referral_dir);
    fs::create_dir_all(&referral_dir).map_err(|e| e.to_string())?;

    let file_path = referral_dir.join(code);
    fs::write(&file_path, "").map_err(|e| e.to_string())?;
    Ok(())
}
