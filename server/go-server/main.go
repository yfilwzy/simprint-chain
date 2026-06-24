// Package main: Simprint 自托管服务器 Go 骨架。
// 配合 03/05 设计文档；加密协议细节见 crypto.go 注释和 03 文档第二节。
//
// main.go —— 应用入口：加载配置 -> 准备密钥 -> 连接 DB -> 注册路由 -> 启动 HTTP 服务（支持优雅退出）。
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
//   GET  /update/webview-fixed.zip                 ServeWebviewZip
//   GET  /health                                   健康检查
package main

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	cfg, err := Load()
	if err != nil {
		log.Fatalf("load config failed: %v", err)
	}

	// 1. 加载/生成服务端 RSA 密钥对（PKCS1 PEM）
	privKey, pubPEM, err := LoadServerKeys(cfg.RSAPrivateKeyPath, cfg.RSAPublicKeyPath)
	if err != nil {
		log.Fatalf("load server rsa keys failed: %v", err)
	}
	log.Printf("server RSA key ready (PKCS1), public key head: %q", headPEM(pubPEM))

	// 2. 连接 PostgreSQL
	db, err := sql.Open("postgres", cfg.DSN())
	if err != nil {
		log.Fatalf("open db failed: %v", err)
	}
	db.SetMaxOpenConns(15)
	db.SetMaxIdleConns(3)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		log.Fatalf("db ping failed: %v", err)
	}
	log.Printf("connected to PostgreSQL %s:%s db=%s", cfg.DBHost, cfg.DBPort, cfg.DBName)

	app := &App{
		Config:          cfg,
		ServerPrivKey:   privKey,
		ServerPubKeyPEM: pubPEM,
		DB:              db,
		clientKeyCache:  newTokenKeyCache(),
	}

	mux := http.NewServeMux()

	// 健康检查（运维必需，不走加密）
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		if err := db.PingContext(r.Context()); err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "db-down", "error": err.Error()})
			return
		}
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
	mux.HandleFunc("GET /update/webview-fixed.zip", app.ServeWebviewZip)

	// 全局中间件：安全响应头 + 请求超时
	handler := withSecurityHeaders(mux)

	srv := &http.Server{
		Addr:              ":" + cfg.ServerPort,
		Handler:           handler,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1MB
	}

	// 优雅关闭：捕获 SIGINT/SIGTERM，等待在途请求完成
	ctxStop, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Printf("simprint-server listening on %s", srv.Addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server stopped: %v", err)
		}
	}()

	<-ctxStop.Done()
	log.Printf("shutdown signal received, draining connections (30s grace)...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("graceful shutdown error: %v", err)
	}
	if err := db.Close(); err != nil {
		log.Printf("db close error: %v", err)
	}
	log.Printf("simprint-server stopped cleanly")
}

// withSecurityHeaders 注入基础安全响应头（仅对浏览器端有意义，但无害且符合最佳实践）。
func withSecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

// headPEM 返回 PEM 的首行（用于启动日志，不含密钥本体）。
func headPEM(pem string) string {
	for i, line := 0, ""; i < len(pem); i++ {
		if pem[i] == '\n' {
			return line
		}
		line += string(pem[i])
	}
	return pem
}
