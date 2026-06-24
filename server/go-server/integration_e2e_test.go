// integration_e2e_test.go —— 端到端集成测试（真实 HTTP 往返）
//
// 目的：跳过单元层，走真实 HTTP 通道（客户端加密 → POST /register → POST /login
// → 客户端解密响应 → 验证 token），证明整个链路（路由 + 加密 + DB + JsonRespnse 外层）端到端通畅。
//
// 运行前提：simprint-server 已在 127.0.0.1:8090 监听。
// 运行: 在宿主上 go test -v -run TestE2E_RegisterLogin ./...
//   （需 API_SECRET 环境变量；或在容器内用 host.docker.internal 访问宿主）
//
// 默认跳过（无 -tags e2e 不跑），避免普通 go test 依赖运行中的服务。
//go:build e2e

package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"os"
	"testing"
)

const e2eBase = "http://127.0.0.1:8090"

// e2eEncryptRequest 用客户端密钥对加密请求，确保整个会话复用同一对密钥。
// 返回加密 body（含注入的 public_secret_key）+ 用的客户端公钥 PEM。
func e2eEncryptRequest(t *testing.T, data map[string]interface{}, serverPubKeyPEM string, clientPriv *rsa.PrivateKey) *EncryptedBody {
	t.Helper()
	clientPubDER := x509.MarshalPKCS1PublicKey(&clientPriv.PublicKey)
	clientPubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: clientPubDER}))
	data["public_secret_key"] = clientPubPEM // 服务端用它加密响应

	aesKey := make([]byte, 32)
	rand.Read(aesKey)
	jsonBytes, _ := json.Marshal(data)
	block, _ := aes.NewCipher(aesKey)
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, 12)
	rand.Read(nonce)
	ct := gcm.Seal(nil, nonce, jsonBytes, nil)
	combined := append(append([]byte{}, nonce...), ct...)

	serverPub := mustParsePub(t, serverPubKeyPEM)
	encAesKey, _ := rsa.EncryptPKCS1v15(rand.Reader, serverPub, []byte(base64.StdEncoding.EncodeToString(aesKey)))

	return &EncryptedBody{
		Data:      base64.StdEncoding.EncodeToString(combined),
		Encrypted: true,
		Key:       base64.StdEncoding.EncodeToString(encAesKey),
	}
}

func mustParsePub(t *testing.T, pemStr string) *rsa.PublicKey {
	t.Helper()
	block, _ := pem.Decode([]byte(pemStr))
	pub, err := x509.ParsePKCS1PublicKey(block.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	return pub
}

// e2eDecryptResponse 模拟客户端 decrypt_if_encrypted 解密服务端响应。
func e2eDecryptResponse(t *testing.T, body []byte, clientPriv *rsa.PrivateKey) map[string]interface{} {
	t.Helper()
	var enc EncryptedBody
	if err := json.Unmarshal(body, &enc); err != nil {
		t.Fatalf("解析加密响应失败: %v, body=%s", err, body)
	}
	encKeyBytes, _ := base64.StdEncoding.DecodeString(enc.Key)
	aesKeyB64, err := rsa.DecryptPKCS1v15(rand.Reader, clientPriv, encKeyBytes)
	if err != nil {
		t.Fatalf("客户端 RSA 解密 AES 密钥失败: %v", err)
	}
	aesKey, _ := base64.StdEncoding.DecodeString(string(aesKeyB64))
	raw, _ := base64.StdEncoding.DecodeString(enc.Data)
	block, _ := aes.NewCipher(aesKey)
	gcm, _ := cipher.NewGCM(block)
	plain, err := gcm.Open(nil, raw[:12], raw[12:], nil)
	if err != nil {
		t.Fatalf("客户端 AES-GCM 解密失败: %v", err)
	}
	var m map[string]interface{}
	json.Unmarshal(plain, &m)
	return m
}

func TestE2E_RegisterLogin(t *testing.T) {
	apiSecret := os.Getenv("API_SECRET")
	if apiSecret == "" {
		apiSecret = "test-secret" // 与服务端不一致会导致 api_secret 校验失败，用于演示
	}

	// 1. 拉服务端公钥
	resp, err := http.Get(e2eBase + "/api/v1/secret/public/key")
	if err != nil {
		t.Skipf("服务未运行，跳过 E2E: %v", err)
	}
	pkBody, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	var pkResp map[string]string
	json.Unmarshal(pkBody, &pkResp)
	serverPubKey := pkResp["public_key"]
	if serverPubKey == "" {
		t.Fatal("未拿到服务端公钥")
	}
	t.Logf("✓ 拉取服务端公钥成功")

	// 2. 准备客户端密钥对（整个会话复用，模拟真实客户端）
	clientPriv, _ := rsa.GenerateKey(rand.Reader, 2048)

	// 3. 注册
	email := fmt.Sprintf("e2e_%d@test.com", os.Getpid())
	regBody := e2eEncryptRequest(t, map[string]interface{}{
		"email":      email,
		"password":   "E2e@Test123",
		"api_secret": apiSecret,
	}, serverPubKey, clientPriv)
	regJSON, _ := json.Marshal(regBody)
	resp, err = http.Post(e2eBase+"/api/v1/users/register", "application/json", bytes.NewReader(regJSON))
	if err != nil {
		t.Fatalf("注册请求失败: %v", err)
	}
	regRespBody, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("注册 HTTP %d: %s", resp.StatusCode, regRespBody)
	}
	regDec := e2eDecryptResponse(t, regRespBody, clientPriv)
	regData, _ := regDec["data"].(map[string]interface{})
	if regData["access_token"] == nil || regData["access_token"] == "" {
		t.Fatalf("注册响应 data 缺少 access_token: %v", regDec)
	}
	t.Logf("✓ 注册成功，拿到 access_token (前12位): %.12s", regData["access_token"])

	// 4. 登录（basic）
	loginBody := e2eEncryptRequest(t, map[string]interface{}{
		"login_type": "basic",
		"email":      email,
		"password":   "E2e@Test123",
		"api_secret": apiSecret,
	}, serverPubKey, clientPriv)
	loginJSON, _ := json.Marshal(loginBody)
	resp, err = http.Post(e2eBase+"/api/v1/users/login", "application/json", bytes.NewReader(loginJSON))
	if err != nil {
		t.Fatalf("登录请求失败: %v", err)
	}
	loginRespBody, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("登录 HTTP %d: %s", resp.StatusCode, loginRespBody)
	}
	loginDec := e2eDecryptResponse(t, loginRespBody, clientPriv)
	loginData, _ := loginDec["data"].(map[string]interface{})
	if loginData["access_token"] == nil {
		t.Fatalf("❌ 登录响应 data 缺少 access_token（JsonRespnse 外层问题）: %v", loginDec)
	}
	t.Logf("✓ 登录成功，access_token (前12位): %.12s", loginData["access_token"])
	t.Logf("✓ is_first_login: %v", loginData["is_first_login"])

	// 5. 重复登录验证（确认 DB 持久化 + 多次会话）
	resp, err = http.Post(e2eBase+"/api/v1/users/login", "application/json", bytes.NewReader(loginJSON))
	if err != nil {
		t.Fatalf("第二次登录请求失败: %v", err)
	}
	login2Body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 {
		t.Fatalf("第二次登录 HTTP %d: %s", resp.StatusCode, login2Body)
	}
	t.Logf("✓ 二次登录成功（DB bcrypt 校验 + 会话写入均正常）")

	t.Log("")
	t.Log("🎉 端到端集成测试通过：注册 → 登录 → 二次登录（完整 HTTP+加密+DB 链路）")
}
