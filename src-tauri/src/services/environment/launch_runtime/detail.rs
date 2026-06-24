use serde_json::json;

use crate::{app::context::AppContext, core::error::Result};

use super::types::EnvironmentLaunchDetail;

pub(super) async fn get_environment_launch_detail(
    env_uuid: &str,
) -> Result<EnvironmentLaunchDetail> {
    let ctx = AppContext::get();
    let response = ctx
        .main_server_client
        .post("environments/detail", &json!({ "uuid": env_uuid }))
        .await?;

    let data = response.data.ok_or("获取环境详情失败")?;
    serde_json::from_value(data).map_err(Into::into)
}
