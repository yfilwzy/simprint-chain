pub mod accounts;
pub mod backup;
pub mod browser_kernels;
pub mod environments;
pub mod environments_extras;
pub mod groups;
pub mod proxy_chain;
pub mod proxies;
pub mod rpa;
pub mod tags;
pub mod workspaces;

use rmcp::handler::server::router::tool::ToolRoute;

use crate::mcp::server::McpServer;

pub fn all_routes() -> Vec<ToolRoute<McpServer>> {
    let mut routes = Vec::new();
    routes.extend(accounts::routes());
    routes.extend(backup::routes());
    routes.extend(browser_kernels::routes());
    routes.extend(environments::routes());
    routes.extend(environments_extras::routes());
    routes.extend(groups::routes());
    routes.extend(proxy_chain::routes());
    routes.extend(proxies::routes());
    routes.extend(rpa::routes());
    routes.extend(tags::routes());
    routes.extend(workspaces::routes());
    // 元工具（catalog 自描述发现）
    routes.extend(crate::mcp::catalog::routes());
    routes
}
