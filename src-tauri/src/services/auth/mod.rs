/// 认证服务模块
///
/// 提供登录、注册和凭证管理的业务逻辑
pub mod credential;
pub mod login;
pub mod register;

pub use credential::CredentialService;
pub use login::{
    BasicLoginRequest, LoginResponse, LoginService, LoginType, RememberPasswordLoginRequest,
};
pub use register::{RegisterRequest, RegisterService};
