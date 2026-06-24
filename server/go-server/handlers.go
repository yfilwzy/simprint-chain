// Package main: Simprint 自托管服务器 Go 骨架。
// 配合 03/05 设计文档；加密协议细节见 crypto.go 注释和 03 文档第二节。
//
// handlers.go —— 全部 HTTP 端点 handler 实现。
package main

import (
	"crypto/rand"
	"crypto/rsa"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
)

// App 贯穿所有 handler 的服务端上下文，持有配置、密钥及 DB 句柄。
type App struct {
	Config          *Config
	ServerPrivKey   *rsa.PrivateKey // 服务端 RSA 私钥
	ServerPubKeyPEM string          // 服务端 RSA 公钥 PEM（PKCS1），对外暴露

	DB *sql.DB // PostgreSQL 句柄

	// clientKeyCache: access_token -> 客户端公钥 PEM（非登录请求的响应加密用）
	// 生产环境若横向扩展应改 Redis；当前单实例用内存 map + 读写锁足够。
	clientKeyCache *tokenKeyCache
}

// tokenKeyCache access_token -> 客户端公钥 PEM 的内存缓存（并发安全）。
type tokenKeyCache struct {
	mu    sync.RWMutex
	store map[string]string // token -> clientPublicKeyPEM
}

func newTokenKeyCache() *tokenKeyCache {
	return &tokenKeyCache{store: make(map[string]string)}
}

func (c *tokenKeyCache) Set(token, pubKeyPEM string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.store[token] = pubKeyPEM
}

func (c *tokenKeyCache) Get(token string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	k, ok := c.store[token]
	return k, ok
}

func (c *tokenKeyCache) Delete(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.store, token)
}

// ---- 通用响应辅助 ----

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// writeEncrypted 将明文业务数据用客户端公钥加密后写入响应（加密端点统一出口）。
//
// ⚠️ 关键：客户端 parse_and_decrypt_response 把解密后的明文反序列化为
//   JsonRespnse { code, message, data }
// 再由业务层从 data 字段取真实数据。因此服务端响应必须包外层 code/message/data，
// 否则客户端 result.data 为 None，业务数据丢失（登录"成功"但 token 存不进去）。
//
// 参数 payload 为业务数据（会被放进 data 字段）。
func (a *App) writeEncrypted(w http.ResponseWriter, payload interface{}, clientPublicKeyPEM string) {
	envelope := map[string]interface{}{
		"code":    0,
		"message": "ok",
		"data":    payload,
	}
	plain, err := json.Marshal(envelope)
	if err != nil {
		http.Error(w, "marshal response failed", http.StatusInternalServerError)
		return
	}
	enc, err := EncryptResponse(plain, clientPublicKeyPEM)
	if err != nil {
		log.Printf("encrypt response failed: %v", err)
		http.Error(w, "encrypt response failed", http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, enc)
}

// maxEncryptedBodySize 限制加密请求体大小（防 OOM；正常加密载荷 < 1MB）。
const maxEncryptedBodySize = 2 * 1024 * 1024 // 2MB

// readEncryptedBody 读取请求体并解析为 EncryptedBody（带大小限制）。
func readEncryptedBody(r *http.Request) (*EncryptedBody, error) {
	raw, err := io.ReadAll(io.LimitReader(r.Body, maxEncryptedBodySize+1))
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 {
		return nil, errors.New("empty body")
	}
	if len(raw) > maxEncryptedBodySize {
		return nil, errors.New("body too large")
	}
	var body EncryptedBody
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, err
	}
	return &body, nil
}

// checkAPISecret 校验解密后 map 里的 api_secret == 配置值。
func (a *App) checkAPISecret(m map[string]interface{}) bool {
	v, ok := m["api_secret"]
	if !ok {
		return false
	}
	s, ok := v.(string)
	if !ok {
		return false
	}
	return s == a.Config.APISecret
}

// asString 安全取 map 中的字符串字段。
func asString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// newToken 生成随机 token（32 字节 hex）。
func newToken() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// ---- 3.1 认证端点 ----

// GetPublicKey 处理 GET /api/v1/secret/public/key
// 响应（明文 JSON）：{ "public_key": "-----BEGIN RSA PUBLIC KEY-----..." }
func (a *App) GetPublicKey(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"public_key": a.ServerPubKeyPEM,
	})
}

// Login 处理 POST /api/v1/users/login
func (a *App) Login(w http.ResponseWriter, r *http.Request) {
	body, err := readEncryptedBody(r)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	m, err := DecryptRequest(body, a.ServerPrivKey)
	if err != nil {
		log.Printf("login decrypt failed: %v", err)
		http.Error(w, "decrypt failed", http.StatusBadRequest)
		return
	}
	if !a.checkAPISecret(m) {
		http.Error(w, "invalid api_secret", http.StatusUnauthorized)
		return
	}

	clientPubKey := asString(m, "public_secret_key")
	loginType := asString(m, "login_type")
	email := asString(m, "email")

	var (
		userID       string
		passwordHash string
		isFirstLogin bool
		userInfoRaw  interface{}
		userExtraRaw interface{}
	)

	switch loginType {
	case "basic":
		// 客户端 login.rs LoginType::Basic → "login_type":"basic"
		password := asString(m, "password")
		if email == "" || password == "" {
			http.Error(w, "missing email/password", http.StatusBadRequest)
			return
		}
		row := a.DB.QueryRowContext(r.Context(),
			`SELECT id, password_hash, is_first_login, user_info, user_extra FROM users WHERE email=$1`, email)
		if err := row.Scan(&userID, &passwordHash, &isFirstLogin, &userInfoRaw, &userExtraRaw); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "user not found", http.StatusUnauthorized)
				return
			}
			log.Printf("login query: %v", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
			http.Error(w, "invalid credentials", http.StatusUnauthorized)
			return
		}

	case "remember":
		// 客户端 LoginType::RememberPassword → "login_type":"remember"
		refreshToken := asString(m, "refresh_token")
		if email == "" || refreshToken == "" {
			http.Error(w, "missing email/refresh_token", http.StatusBadRequest)
			return
		}
		row := a.DB.QueryRowContext(r.Context(),
			`SELECT u.id, u.password_hash, u.is_first_login, u.user_info, u.user_extra
			 FROM users u JOIN sessions s ON s.user_id = u.id
			 WHERE u.email=$1 AND s.refresh_token=$2 AND s.expires_at > NOW()`, email, refreshToken)
		if err := row.Scan(&userID, &passwordHash, &isFirstLogin, &userInfoRaw, &userExtraRaw); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.Error(w, "invalid refresh_token", http.StatusUnauthorized)
				return
			}
			log.Printf("login(refresh) query: %v", err)
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}
	default:
		http.Error(w, "invalid login_type", http.StatusBadRequest)
		return
	}

	// 签发新 token 并写 sessions
	accessToken := newToken()
	refreshToken := newToken()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	if _, err := a.DB.ExecContext(r.Context(),
		`INSERT INTO sessions (user_id, access_token, refresh_token, expires_at) VALUES ($1,$2,$3,$4)`,
		userID, accessToken, refreshToken, expiresAt); err != nil {
		log.Printf("login insert session: %v", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	// 缓存客户端公钥，供后续非登录请求响应加密
	a.clientKeyCache.Set(accessToken, clientPubKey)

	// 业务数据（会进 JsonRespnse.data），字段名对齐客户端 LoginResponse
	payload := map[string]interface{}{
		"access_token":   accessToken,
		"refresh_token":  refreshToken,
		"is_first_login": isFirstLogin,
		"user_info":      userInfoRaw,
		"user_extra":     userExtraRaw,
	}
	a.writeEncrypted(w, payload, clientPubKey)
}

// Register 处理 POST /api/v1/users/register
func (a *App) Register(w http.ResponseWriter, r *http.Request) {
	body, err := readEncryptedBody(r)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	m, err := DecryptRequest(body, a.ServerPrivKey)
	if err != nil {
		http.Error(w, "decrypt failed", http.StatusBadRequest)
		return
	}
	if !a.checkAPISecret(m) {
		http.Error(w, "invalid api_secret", http.StatusUnauthorized)
		return
	}

	email := asString(m, "email")
	password := asString(m, "password")
	clientPubKey := asString(m, "public_secret_key")
	referralCode := asString(m, "referral_code")
	if email == "" || password == "" {
		http.Error(w, "missing email/password", http.StatusBadRequest)
		return
	}

	// 邮箱唯一性
	var exists bool
	if err := a.DB.QueryRowContext(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM users WHERE email=$1)`, email).Scan(&exists); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "email already registered", http.StatusConflict)
		return
	}

	// bcrypt 落库（cost=12，对齐 schema 注释建议）
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		http.Error(w, "hash error", http.StatusInternalServerError)
		return
	}

	var userID string
	if err := a.DB.QueryRowContext(r.Context(),
		`INSERT INTO users (email, password_hash, is_first_login, user_info, user_extra)
		 VALUES ($1,$2,TRUE,$3,$4) RETURNING id`,
		email, string(hash), json.RawMessage(`{}`), json.RawMessage(`{}`)).Scan(&userID); err != nil {
		log.Printf("register insert user: %v", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	// 邀请码核销（可选）
	if referralCode != "" {
		if _, err := a.DB.ExecContext(r.Context(),
			`UPDATE referral_codes SET used_count = used_count + 1 WHERE code=$1 AND used_count < max_uses`,
			referralCode); err != nil {
			log.Printf("referral consume (non-fatal): %v", err)
		}
	}

	// 签发 token
	accessToken := newToken()
	refreshToken := newToken()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	if _, err := a.DB.ExecContext(r.Context(),
		`INSERT INTO sessions (user_id, access_token, refresh_token, expires_at) VALUES ($1,$2,$3,$4)`,
		userID, accessToken, refreshToken, expiresAt); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	a.clientKeyCache.Set(accessToken, clientPubKey)

	payload := map[string]interface{}{
		"access_token":   accessToken,
		"refresh_token":  refreshToken,
		"is_first_login": true,
		"user_info":      map[string]interface{}{"email": email},
		"user_extra":     map[string]interface{}{},
	}
	a.writeEncrypted(w, payload, clientPubKey)
}

// RefreshCredentials 处理 POST /api/v1/users/refresh-credentials
func (a *App) RefreshCredentials(w http.ResponseWriter, r *http.Request) {
	body, err := readEncryptedBody(r)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	m, err := DecryptRequest(body, a.ServerPrivKey)
	if err != nil {
		http.Error(w, "decrypt failed", http.StatusBadRequest)
		return
	}
	if !a.checkAPISecret(m) {
		http.Error(w, "invalid api_secret", http.StatusUnauthorized)
		return
	}

	oldRefresh := asString(m, "refresh_token")
	if oldRefresh == "" {
		http.Error(w, "missing refresh_token", http.StatusBadRequest)
		return
	}

	// 校验 refresh_token 有效性，并取出 user_id + 旧 access_token（用于更新缓存）
	var userID, oldAccess string
	err = a.DB.QueryRowContext(r.Context(),
		`SELECT user_id, access_token FROM sessions
		 WHERE refresh_token=$1 AND expires_at > NOW()`, oldRefresh).Scan(&userID, &oldAccess)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "invalid refresh_token", http.StatusUnauthorized)
			return
		}
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	// 轮换 token（旧 refresh 失效）
	newAccess := newToken()
	newRefresh := newToken()
	expiresAt := time.Now().Add(7 * 24 * time.Hour)
	if _, err := a.DB.ExecContext(r.Context(),
		`UPDATE sessions SET access_token=$1, refresh_token=$2, expires_at=$3
		 WHERE refresh_token=$4`, newAccess, newRefresh, expiresAt, oldRefresh); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	// 迁移客户端公钥缓存
	if pub, ok := a.clientKeyCache.Get(oldAccess); ok {
		a.clientKeyCache.Set(newAccess, pub)
	}

	// 响应：仅返回新 token（refresh-credentials 请求未带公钥时用旧缓存）
	pub := ""
	if p, ok := a.clientKeyCache.Get(newAccess); ok {
		pub = p
	}
	payload := map[string]interface{}{
		"access_token":  newAccess,
		"refresh_token": newRefresh,
	}
	if pub == "" {
		// 无公钥无法加密响应，回退明文（包 JsonRespnse 外层）
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"code": 0, "message": "ok", "data": payload,
		})
		return
	}
	a.writeEncrypted(w, payload, pub)
}

// ---- 3.2 业务端点 ----

// 业务资源表与 /local-api 路径前缀的映射。
var resourceTables = map[string]string{
	"environments":    "environments",
	"proxies":         "proxies",
	"groups":          "groups",
	"tags":            "tags",
	"workspaces":      "workspaces",
	"browser_kernels": "browser_kernels",
}

// LocalApiProxy 处理 POST /api/v1/local-api/{path...}
// 简化 CRUD 透传：list / get / create / update / delete，按 user_id 隔离。
func (a *App) LocalApiProxy(w http.ResponseWriter, r *http.Request) {
	path := r.PathValue("path")
	body, err := readEncryptedBody(r)
	if err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	m, err := DecryptRequest(body, a.ServerPrivKey)
	if err != nil {
		http.Error(w, "decrypt failed", http.StatusBadRequest)
		return
	}
	if !a.checkAPISecret(m) {
		http.Error(w, "invalid api_secret", http.StatusUnauthorized)
		return
	}

	accessToken := asString(m, "access_token")
	pub := ""
	if p, ok := a.clientKeyCache.Get(accessToken); ok {
		pub = p
	}
	if pub == "" {
		http.Error(w, "session not found (re-login required)", http.StatusUnauthorized)
		return
	}

	// 通过 access_token 解析 user_id
	var userID string
	err = a.DB.QueryRowContext(r.Context(),
		`SELECT user_id FROM sessions WHERE access_token=$1 AND expires_at > NOW()`, accessToken).Scan(&userID)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// 解析 path: <resource> 或 <resource>/<id> 或 <resource>/<id>/...
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		http.Error(w, "invalid resource path", http.StatusBadRequest)
		return
	}
	resource := parts[0]
	table, ok := resourceTables[resource]
	if !ok {
		http.Error(w, "unknown resource: "+resource, http.StatusBadRequest)
		return
	}
	_ = table // 实际 CRUD 见下方分支

	var (
		result interface{}
		rerr   error
	)
	method := r.Method
	resourceID := ""
	if len(parts) >= 2 {
		resourceID = parts[1]
	}

	// NOTE: table 来自 resourceTables 白名单 map，绝无用户输入直接拼接，无 SQL 注入风险。
	switch {
	case method == "GET" && resourceID == "":
		// list：列出该用户的所有资源
		rows, qerr := a.DB.QueryContext(r.Context(),
			`SELECT id, name, config, created_at, updated_at FROM `+table+` WHERE user_id=$1 ORDER BY created_at DESC`, userID)
		if qerr != nil {
			rerr = qerr
			break
		}
		items := []map[string]interface{}{}
		for rows.Next() {
			var id, name string
			var cfg interface{}
			var created, updated time.Time
			if err := rows.Scan(&id, &name, &cfg, &created, &updated); err != nil {
				rows.Close()
				rerr = err
				break
			}
			items = append(items, map[string]interface{}{
				"id": id, "name": name, "config": cfg, "created_at": created, "updated_at": updated,
			})
		}
		rows.Close()
		result = map[string]interface{}{"items": items, "total": len(items)}

	case method == "GET" && resourceID != "":
		// get：取单个资源
		var name string
		var cfg interface{}
		var created, updated time.Time
		err = a.DB.QueryRowContext(r.Context(),
			`SELECT name, config, created_at, updated_at FROM `+table+` WHERE id=$1 AND user_id=$2`, resourceID, userID).
			Scan(&name, &cfg, &created, &updated)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
				return
			}
			rerr = err
			break
		}
		result = map[string]interface{}{
			"id": resourceID, "name": name, "config": cfg, "created_at": created, "updated_at": updated,
		}

	case method == "POST":
		// create：新建资源
		name := asString(m, "name")
		cfgJSON, _ := json.Marshal(m["config"])
		var newID string
		err = a.DB.QueryRowContext(r.Context(),
			`INSERT INTO `+table+` (user_id, name, config) VALUES ($1,$2,$3) RETURNING id`,
			userID, name, cfgJSON).Scan(&newID)
		if err != nil {
			rerr = err
			break
		}
		result = map[string]interface{}{"id": newID, "success": true}

	case method == "PUT" && resourceID != "":
		// update：更新已有资源（UPSERT 语义）
		name := asString(m, "name")
		cfgJSON, _ := json.Marshal(m["config"])
		var updatedID string
		err = a.DB.QueryRowContext(r.Context(),
			`UPDATE `+table+` SET name=$1, config=$2 WHERE id=$3 AND user_id=$4 RETURNING id`,
			name, cfgJSON, resourceID, userID).Scan(&updatedID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
				return
			}
			rerr = err
			break
		}
		result = map[string]interface{}{"id": updatedID, "success": true}

	case method == "DELETE" && resourceID != "":
		// delete：删除资源（带 user_id 二次校验防越权）
		_, err = a.DB.ExecContext(r.Context(),
			`DELETE FROM `+table+` WHERE id=$1 AND user_id=$2`, resourceID, userID)
		if err != nil {
			rerr = err
			break
		}
		result = map[string]interface{}{"success": true}

	default:
		http.Error(w, "unsupported operation", http.StatusBadRequest)
		return
	}

	if rerr != nil {
		log.Printf("local-api %s %s: %v", method, path, rerr)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	a.writeEncrypted(w, result, pub)
}

// ---- 3.3 更新端点 ----
//
// 结构严格对齐客户端 src-tauri/src/infrastructure/updater/types.rs：
//   - CheckResponse  { code:i32, message:String, data:{ versions: HashMap<String, Vec<Artifact>> } }
//   - LatestRelease  { version, notes, pub_date, platforms: HashMap<String, {url, r2_url}> }
// ⚠️ 之前误用了 03 文档里的 {r2_url, signature}，实际客户端解 LatestRelease 只认 url/r2_url，
//    且顶层 notes/pub_date 是必需字段。以源码为准（深度复核修正）。

const appVersion = "0.2.26-chain.1"

// CheckVersion 处理 POST /update/api/v1/versions/check
// 客户端 CheckRequest 为空体；返回 CheckResponse。
func (a *App) CheckVersion(w http.ResponseWriter, r *http.Request) {
	// 首期：返回"无更新"——versions 为空 map，客户端解析后走 NoUpdates 分支。
	// 发版时在此填入真实 artifact 列表（resource_name + version + url + hash 等）。
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"code":    0,
		"message": "ok",
		"data": map[string]interface{}{
			"versions": map[string]interface{}{},
		},
	})
}

// GetLatestJson 处理 GET /update/latest.json
// 返回 LatestRelease 结构（对齐客户端 types.rs::LatestRelease）。
func (a *App) GetLatestJson(w http.ResponseWriter, r *http.Request) {
	if data, err := readUpdateFile("/opt/simprint/updates/latest.json"); err == nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(data)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"version":  appVersion,
		"notes":    "Simprint-Chain self-hosted release",
		"pub_date": time.Now().UTC().Format(time.RFC3339),
		"platforms": map[string]map[string]string{
			"x86_64-pc-windows-msvc": {
				"url":    "https://api.yfilwzy.cc.cd/simprint/update/Simprint_" + appVersion + "_x64-setup.exe",
				"r2_url": "https://api.yfilwzy.cc.cd/simprint/update/Simprint_" + appVersion + "_x64-setup.exe",
			},
		},
	})
}

// GetRuntimeLatestJson 处理 GET /update/simprint-runtime/latest.json
func (a *App) GetRuntimeLatestJson(w http.ResponseWriter, r *http.Request) {
	if data, err := readUpdateFile("/opt/simprint/updates/runtime-latest.json"); err == nil {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		_, _ = w.Write(data)
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{
		"version":  appVersion,
		"notes":    "Simprint-Chain runtime self-hosted release",
		"pub_date": time.Now().UTC().Format(time.RFC3339),
		"platforms": map[string]map[string]string{
			"x86_64-pc-windows-msvc": {
				"url":    "https://api.yfilwzy.cc.cd/simprint/update/simprint-runtime_" + appVersion + "_x64.zip",
				"r2_url": "https://api.yfilwzy.cc.cd/simprint/update/simprint-runtime_" + appVersion + "_x64.zip",
			},
		},
	})
}

// ServeWebviewZip 处理 GET /update/webview-fixed.zip（静态文件，供客户端按 downlaod_url 拉取）
func (a *App) ServeWebviewZip(w http.ResponseWriter, r *http.Request) {
	data, err := readUpdateFile("/opt/simprint/updates/webview-fixed.zip")
	if err != nil {
		http.Error(w, "webview-fixed.zip not provisioned yet", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/zip")
	_, _ = w.Write(data)
}

// readUpdateFile 读取磁盘上的更新相关文件（latest.json / zip）。
func readUpdateFile(path string) ([]byte, error) {
	return os.ReadFile(path)
}
