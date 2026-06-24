// Package main: Simprint 自托管服务器 Go 骨架。
// 配合 03/05 设计文档；加密协议细节见 crypto.go 注释和 03 文档第二节。
//
// main.go —— 应用入口：加载配置 -> 准备密钥 -> 注册路由 -> 启动 HTTP 服务。
//
// 路由（03 文档 §3，客户端 base_url=.../api/）：
//   GET  /api/v1/secret/public/key                 GetPublicKey
//   POST /api/v1/users/login                       Login
//   POST /api/v1/users/register                    Register
//   POST /api/v1/users/refresh-credentials         RefreshCredentials
//   POST /api/v1/local-api/{path...}               LocalApiProxy
//   POST /update/api/v1/versions/check             CheckVersion
//   GET  /update/latest.json                       GetLatestJson
//   GET  /update/simprint-runtime/latest.json      GetRuntimeLatestJson
//   GET  /health                                   健康检查
package main

import (
	"crypto/rsa"
	"log"
	"net/http"
)

func main() {
	cfg, err := Load()
	if err != nil {
		log.Fatalf("load config failed: %v", err)
	}

	app := &App{
		Config: cfg,
		// TODO: 从 cfg.RSAPrivateKeyPath 加载服务端 RSA 私钥（PEM, PKCS1），
		//       若文件缺失则调用 GenerateRSAKeyPair(2048) 生成并落盘。
		//       ServerPubKeyPEM 填充 PKCS1 PEM 字符串。
		ServerPrivKey:   (*rsa.PrivateKey)(nil),
		ServerPubKeyPEM: "", // TODO: 加载真实公钥 PEM
	}

	mux := http.NewServeMux()

	// 健康检查（运维必需）
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// 3.1 认证端点
	mux.HandleFunc("GET /api/v1/secret/public/key", app.GetPublicKey)
	mux.HandleFunc("POST /api/v1/users/login", app.Login)
	mux.HandleFunc("POST /api/v1/users/register", app.Register)
	mux.HandleFunc("POST /api/v1/users/refresh-credentials", app.RefreshCredentials)

	// 3.2 业务端点（透传，加密通道）
	mux.HandleFunc("POST /api/v1/local-api/{path...}", app.LocalApiProxy)

	// 3.3 更新端点
	mux.HandleFunc("POST /update/api/v1/versions/check", app.CheckVersion)
	mux.HandleFunc("GET /update/latest.json", app.GetLatestJson)
	mux.HandleFunc("GET /update/simprint-runtime/latest.json", app.GetRuntimeLatestJson)

	addr := ":" + cfg.ServerPort
	log.Printf("simprint-server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
