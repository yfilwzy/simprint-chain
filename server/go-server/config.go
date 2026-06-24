// Package main: Simprint 自托管服务器 Go 骨架。
// 配合 03/05 设计文档；加密协议细节见 crypto.go 注释和 03 文档第二节。
//
// config.go —— 运行时配置结构与环境变量加载。
package main

import (
	"fmt"
	"os"
	"strconv"
)

// Config 承载服务运行所需的全部配置项。
// 全部从环境变量加载，便于容器化部署（install-server.sh / docker）。
type Config struct {
	// 数据库（PostgreSQL，schema 见 03 文档第四节）
	DBHost string
	DBPort string
	DBUser string
	DBPass string
	DBName string

	// 应用层鉴权密钥（03 文档第五节 api_secret）。
	// 加密请求体解密后校验 api_secret 字段 == 该值；非加解密密钥。
	APISecret string

	// HTTP 服务端口
	ServerPort string

	// RSA 密钥对文件路径（PEM, PKCS1）
	// 公钥对外暴露于 GET /api/v1/secret/public/key
	RSAPrivateKeyPath string
	RSAPublicKeyPath  string
}

// Load 从环境变量读取配置，缺失项使用安全默认值。
func Load() (*Config, error) {
	cfg := &Config{
		DBHost:            getEnv("DB_HOST", "127.0.0.1"),
		DBPort:            getEnv("DB_PORT", "5432"),
		DBUser:            getEnv("DB_USER", "simprint"),
		DBPass:            getEnv("DB_PASSWORD", ""),
		DBName:            getEnv("DB_NAME", "simprint"),
		APISecret:         getEnv("API_SECRET", ""),
		ServerPort:        getEnv("SERVER_PORT", "8080"),
		RSAPrivateKeyPath: getEnv("RSA_PRIVATE_KEY_PATH", "./keys/private.pem"),
		RSAPublicKeyPath:  getEnv("RSA_PUBLIC_KEY_PATH", "./keys/public.pem"),
	}

	if cfg.APISecret == "" {
		return nil, fmt.Errorf("API_SECRET is required (see 03 doc §5 api_secret mechanism)")
	}

	if _, err := strconv.Atoi(cfg.DBPort); err != nil {
		return nil, fmt.Errorf("invalid DB_PORT %q: %w", cfg.DBPort, err)
	}
	return cfg, nil
}

// DSN 返回 PostgreSQL 连接串。
func (c *Config) DSN() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DBHost, c.DBPort, c.DBUser, c.DBPass, c.DBName)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
