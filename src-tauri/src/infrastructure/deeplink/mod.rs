use reqwest::Url;

pub mod referral;
pub mod storage;

/// Deeplink 统一入口：传入 argv 中的某个参数，若是 URL 则分发给各 handler。
pub fn process_arg(arg: &str) {
    if !arg.contains("://") {
        return;
    }

    let Ok(url) = Url::parse(arg) else {
        return;
    };

    // 目前只处理推广码，后续可继续追加更多 handler
    referral::handle_referral_code(&url);
}

/// 冷启动/单实例启动场景：从 argv 中找到第一个 URL 参数并处理。
pub fn process_first_url_arg<I>(args: I)
where
    I: IntoIterator<Item = String>,
{
    for arg in args {
        if arg.contains("://") {
            process_arg(&arg);
            break;
        }
    }
}
