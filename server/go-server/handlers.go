// Package main: Simprint 自托管服务器 Go 骨架。
// 配合 03/05 设计文档；加密协议细节见 crypto.go 注释和 03 文档第二节。
//
// handlers.go —— 全部 HTTP 端点 handler（签名完整 + 请求/响应格式注释；方法体 TODO 占位）。
package main

import (
	"crypto/rsa"
	"encoding/json"
	"net/http"
)

// App 贯穿所有 handler 的服务端上下文，持有配置、密钥及后续的 DB 句柄。
type App struct {
	Config          *Config
	ServerPrivKey   *rsa.PrivateKey // 占位：服务端 RSA 私钥（PEM 加载后）
	ServerPubKeyPEM string          // 占位：服务端 RSA 公钥 PEM（PKCS1），对外暴露

	// TODO: db  *sql.DB           // PostgreSQL 句柄（schema 见 03 文档第四节）
	// TODO: clientKeyCache ...    // access_token -> 客户端公钥 缓存（响应加密用）
}

// 占位：避免未使用导入，正式实现后移除。
var _ = json.Marshal

// ---- 通用响应辅助 ----

// writeJSON 写入明文 JSON 响应（用于非加密端点，如 /health、公钥、latest.json）。
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeEncrypted 将明文 JSON 用客户端公钥加密后写入响应（加密端点统一出口）。
// TODO: 正式实现后调用 EncryptResponse；当前 stub 直接返回 501。
func (a *App) writeEncrypted(w http.ResponseWriter, plainJSON json.RawMessage, clientPublicKeyPEM string) {
	enc, err := EncryptResponse(plainJSON, clientPublicKeyPEM)
	if err != nil {
		http.Error(w, "encrypt response failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, enc)
}

// ---- 3.1 认证端点 ----

// GetPublicKey 处理 GET /api/v1/secret/public/key
//
// 请求：无 body，不加密。
// 响应（明文 JSON）：{ "public_key": "-----BEGIN RSA PUBLIC KEY-----\n...\n-----END RSA PUBLIC KEY-----" }
//
// 说明（03 文档 §2.1 步骤①）：客户端启动时拉取，用于后续请求的 AES 密钥 RSA 加密。
// 公钥必须是 PKCS1 格式（BEGIN RSA PUBLIC KEY，非 PKCS8/X.509）。
func (a *App) GetPublicKey(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"public_key": a.ServerPubKeyPEM, // TODO: 确保为 PKCS1 PEM
	})
}

// Login 处理 POST /api/v1/users/login
//
// 请求（加密 EncryptedBody；解密后 JSON 字段）：
//   {
//     "login_type": "Basic" | "RememberPassword",  // 见 03 文档 §3.1 LoginType
//     "email": "...",
//     "password": "...",          // login_type=Basic 时提供
//     "refresh_token": "...",     // login_type=RememberPassword 时提供
//     "public_secret_key": "...", // 客户端 RSA 公钥（PKCS1 PEM），响应加密用
//     "api_secret": "..."         // 应用层鉴权，须 == config.APISecret
//   }
//
// 响应（加密 EncryptedBody；解密后 JSON 字段）：
//   {
//     "access_token": "...",
//     "refresh_token": "...",
//     "is_first_login": bool,
//     "user_info": {...},    // 对应 users.user_info JSONB
//     "user_extra": {...}    // 对应 users.user_extra JSONB
//   }
//
// 流程：DecryptRequest -> 校验 api_secret -> 查 users 表 -> 校验密码(bcrypt)
//       -> 签发 token 写 sessions 表 -> 缓存 clientPublicKeyPEM 关联 access_token -> 加密响应。
func (a *App) Login(w http.ResponseWriter, r *http.Request) {
	// TODO: 解密 + 校验 api_secret + DB 查询 + bcrypt 校验 + 签发 token + 加密响应
	http.Error(w, "login: not implemented (stub)", http.StatusNotImplemented)
}

// Register 处理 POST /api/v1/users/register
//
// 请求（加密 EncryptedBody；解密后 JSON 字段）：
//   {
//     "email": "...",
//     "password": "...",
//     "referral_code": "...",     // 可选，校验 referral_codes 表
//     "public_secret_key": "...", // 客户端 RSA 公钥
//     "api_secret": "..."
//   }
//
// 响应：结构与 Login 相同（access_token/refresh_token/is_first_login/user_info/user_extra）。
func (a *App) Register(w http.ResponseWriter, r *http.Request) {
	// TODO: 解密 + 校验 api_secret + 邮箱唯一性 + bcrypt 落库 users + 邀请码核销 + 签发 token
	http.Error(w, "register: not implemented (stub)", http.StatusNotImplemented)
}

// RefreshCredentials 处理 POST /api/v1/users/refresh-credentials
//
// 请求（加密 EncryptedBody；解密后 JSON 字段）：
//   { "refresh_token": "...", "api_secret": "..." }
//
// 响应（加密 EncryptedBody；解密后 JSON 字段）：
//   { "access_token": "...", "refresh_token": "..." }
//
// 流程：校验 refresh_token 有效性（sessions 表）-> 轮换 access/refresh token -> 加密响应。
func (a *App) RefreshCredentials(w http.ResponseWriter, r *http.Request) {
	// TODO: 解密 + 校验 api_secret + refresh_token 校验 + token 轮换 + 加密响应
	http.Error(w, "refresh-credentials: not implemented (stub)", http.StatusNotImplemented)
}

// ---- 3.2 业务端点 ----

// LocalApiProxy 处理 POST /api/v1/local-api/{path...}
//
// 说明（03 文档 §3.2）：工作区资源 CRUD 透传。
//   资源：environments / proxies / groups / tags / workspaces / browser_kernels
//   全部走加密通道；经 local_api/client/main_server.rs::proxy_request 调用。
//
// 请求（加密 EncryptedBody）：解密后为对应资源的 CRUD payload + api_secret + access_token。
// 响应（加密 EncryptedBody）：对应资源的 CRUD 结果。
//
// 路由参数 path 由 Go 1.22 ServeMux 的 {path...} 通配捕获（r.PathValue("path")）。
func (a *App) LocalApiProxy(w http.ResponseWriter, r *http.Request) {
	_ = r.PathValue("path")
	// TODO: 解密 + 鉴权(access_token) + 操作对应资源表(03 §4 environments 等) + 加密响应
	http.Error(w, "local-api proxy: not implemented (stub)", http.StatusNotImplemented)
}

// ---- 3.3 更新端点 ----

// CheckVersion 处理 POST /update/api/v1/versions/check
//
// 请求（通常明文 JSON）：客户端当前版本/平台信息。
// 响应（明文 JSON）：是否有更新、最新版本号、下载信息等。
//
// 对齐客户端 [updater].check_url（03 文档 §1.1）。
func (a *App) CheckVersion(w http.ResponseWriter, r *http.Request) {
	// TODO: 解析客户端版本/平台 -> 比对 latest.json -> 返回更新指引
	writeJSON(w, http.StatusNotImplemented, map[string]string{
		"error": "check-version: not implemented (stub)",
	})
}

// GetLatestJson 处理 GET /update/latest.json
//
// 请求：无 body。
// 响应（明文 JSON）：主程序更新清单，schema（03 文档 §3.3）：
//   {
//     "version": "0.2.26-chain.1",
//     "platforms": {
//       "x86_64-pc-windows-msvc": {
//         "r2_url": "https://<YOUR_DOMAIN>/update/Simprint_<ver>_x64-setup.exe",
//         "signature": "..."
//       }
//     }
//   }
//
// 对齐客户端 [updater].latest_json_url（03 文档 §1.1）。
func (a *App) GetLatestJson(w http.ResponseWriter, r *http.Request) {
	// TODO: 读取并返回主程序 latest.json
	writeJSON(w, http.StatusNotImplemented, map[string]string{
		"error": "latest.json: not implemented (stub)",
	})
}

// GetRuntimeLatestJson 处理 GET /update/simprint-runtime/latest.json
//
// 请求：无 body。
// 响应（明文 JSON）：runtime 更新清单，schema 同 GetLatestJson。
//
// 对齐客户端 [updater].runtime_latest_json_url（03 文档 §1.1）。
func (a *App) GetRuntimeLatestJson(w http.ResponseWriter, r *http.Request) {
	// TODO: 读取并返回 runtime latest.json
	writeJSON(w, http.StatusNotImplemented, map[string]string{
		"error": "runtime latest.json: not implemented (stub)",
	})
}
