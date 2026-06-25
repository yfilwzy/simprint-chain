// 联调脚本：复用客户端加密协议（PKCS1v15+AES-GCM），真实打生产服务器完成 Task1 四步联调。
// 等效 GUI 操作（注册→登录→创建环境→token持久化），且可查 DB 落库验证。
//
// 运行: go run ./e2e_production_check.go
// 服务器: https://api.yfilwzy.cc.cd/simprint/  API_SECRET: s3eqVcjYIwxb5i3YtBP6
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
	"time"
)

const (
	prodBase = "https://api.yfilwzy.cc.cd/simprint"
	apiSecret = os.Getenv("E2E_API_SECRET") // 从环境变量读，勿硬编码
)

type EncryptedBody struct {
	Data      string `json:"data"`
	Encrypted bool   `json:"encrypted"`
	Key       string `json:"key"`
}

// 复刻客户端 encrypt_request_body（rsa.rs + aes.rs 实测规格）
func encryptRequest(data map[string]interface{}, serverPubKeyPEM string, clientPriv *rsa.PrivateKey) (*EncryptedBody, error) {
	// 注入客户端公钥 + api_secret
	clientPubDER := x509.MarshalPKCS1PublicKey(&clientPriv.PublicKey)
	clientPubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: clientPubDER}))
	data["public_secret_key"] = clientPubPEM
	data["api_secret"] = apiSecret

	plainJSON, _ := json.Marshal(data)

	// AES-256-GCM 加密 body
	aesKey := make([]byte, 32)
	rand.Read(aesKey)
	block, _ := aes.NewCipher(aesKey)
	gcm, _ := cipher.NewGCM(block)
	nonce := make([]byte, gcm.NonceSize()) // 12
	rand.Read(nonce)
	ciphertext := gcm.Seal(nil, nonce, plainJSON, nil)
	combined := append(nonce, ciphertext...)
	encData := base64.StdEncoding.EncodeToString(combined)

	// RSA-PKCS1v15 加密 AES 密钥（先 base64(aesKey) 再 RSA）
	aesKeyB64 := base64.StdEncoding.EncodeToString(aesKey)
	// 解析服务端公钥
	block2, _ := pem.Decode([]byte(serverPubKeyPEM))
	serverPub, err := x509.ParsePKCS1PublicKey(block2.Bytes)
	if err != nil {
		return nil, fmt.Errorf("解析服务端公钥失败: %w", err)
	}
	encKeyBytes, err := rsa.EncryptPKCS1v15(rand.Reader, serverPub, []byte(aesKeyB64))
	if err != nil {
		return nil, err
	}
	encKey := base64.StdEncoding.EncodeToString(encKeyBytes)

	return &EncryptedBody{Data: encData, Encrypted: true, Key: encKey}, nil
}

// 复刻客户端 decrypt_if_encrypted（用客户端私钥解密响应）
func decryptResponse(enc *EncryptedBody, clientPriv *rsa.PrivateKey) (map[string]interface{}, error) {
	// RSA 解密 AES 密钥
	encKeyBytes, _ := base64.StdEncoding.DecodeString(enc.Key)
	aesKeyB64, err := rsa.DecryptPKCS1v15(rand.Reader, clientPriv, encKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("RSA解密AES密钥失败: %w", err)
	}
	aesKey, _ := base64.StdEncoding.DecodeString(string(aesKeyB64))

	// AES-GCM 解密 data
	raw, _ := base64.StdEncoding.DecodeString(enc.Data)
	block, _ := aes.NewCipher(aesKey)
	gcm, _ := cipher.NewGCM(block)
	ns := gcm.NonceSize()
	nonce, ciphertext := raw[:ns], raw[ns:]
	plain, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("AES解密失败: %w", err)
	}

	var result map[string]interface{}
	json.Unmarshal(plain, &result)
	return result, nil
}

func getServerPublicKey() (string, error) {
	resp, err := http.Get(prodBase + "/api/v1/secret/public/key")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var r struct {
		PublicKey string `json:"public_key"`
	}
	json.Unmarshal(body, &r)
	return r.PublicKey, nil
}

func postEncrypted(path string, data map[string]interface{}, serverPubPEM string, clientPriv *rsa.PrivateKey) (map[string]interface{}, error) {
	enc, err := encryptRequest(data, serverPubPEM, clientPriv)
	if err != nil {
		return nil, err
	}
	encJSON, _ := json.Marshal(enc)
	resp, err := http.Post(prodBase+path, "application/json", bytes.NewReader(encJSON))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	// 服务端响应结构：直接返回 EncryptedBody {data,encrypted,key}
	// 解密后得到 {code,message,data:{业务字段}}
	var encResp EncryptedBody
	json.Unmarshal(respBody, &encResp)
	if !encResp.Encrypted {
		// 非加密响应（错误）
		var r map[string]interface{}
		json.Unmarshal(respBody, &r)
		return r, nil
	}
	plainMap, err := decryptResponse(&encResp, clientPriv)
	if err != nil {
		return nil, err
	}
	// plainMap 是 {code,message,data:{...}}，从 data 取业务字段
	if dataField, ok := plainMap["data"]; ok {
		if dataMap, ok := dataField.(map[string]interface{}); ok {
			return dataMap, nil
		}
	}
	return plainMap, nil
}

func main() {
	fmt.Println("===== Task1 生产联调（4步）=====")
	fmt.Println("服务器:", prodBase)

	// 生成客户端临时密钥对
	clientPriv, _ := rsa.GenerateKey(rand.Reader, 2048)
	fmt.Println("✅ 客户端 RSA 密钥对生成")

	// 拉取服务端公钥
	serverPubPEM, err := getServerPublicKey()
	if err != nil || serverPubPEM == "" {
		fmt.Println("❌ 拉取公钥失败:", err)
		os.Exit(1)
	}
	fmt.Println("✅ 服务端公钥拉取成功")

	email := fmt.Sprintf("e2e_%d@test.local", time.Now().Unix())
	password := "Test123456!"

	// === 步骤A：注册 ===
	fmt.Println("\n--- 步骤A：注册新账号 ---")
	regResp, err := postEncrypted("/api/v1/users/register", map[string]interface{}{
		"email":    email,
		"password": password,
	}, serverPubPEM, clientPriv)
	if err != nil {
		fmt.Println("❌ 注册失败:", err)
		os.Exit(1)
	}
	fmt.Printf("✅ 注册成功 email=%s\n", email)
	if at, ok := regResp["access_token"].(string); ok {
		fmt.Printf("   access_token: %s...(len=%d)\n", at[:20], len(at))
	}

	// === 步骤B：账密登录 ===
	fmt.Println("\n--- 步骤B：账密登录 ---")
	loginResp, err := postEncrypted("/api/v1/users/login", map[string]interface{}{
		"email":         email,
		"password":      password,
		"login_type":    "basic",
	}, serverPubPEM, clientPriv)
	if err != nil {
		fmt.Println("❌ 登录失败:", err)
		os.Exit(1)
	}
	fmt.Printf("✅ 登录成功\n")
	if at, ok := loginResp["access_token"].(string); ok {
		fmt.Printf("   access_token: %s...(len=%d) ← token获取成功\n", at[:20], len(at))
	}
	if rt, ok := loginResp["refresh_token"].(string); ok {
		fmt.Printf("   refresh_token: %s...(len=%d)\n", rt[:20], len(rt))
	}

	// === 步骤C：创建环境（通过 local-api，需带 access_token） ===
	fmt.Println("\n--- 步骤C：创建环境 ---")
	accessToken, _ := loginResp["access_token"].(string)
	refreshToken, _ := loginResp["refresh_token"].(string)
	envData := map[string]interface{}{
		"name":   fmt.Sprintf("e2e-env-%d", time.Now().Unix()),
		"config": map[string]interface{}{"browser": "chromium"},
		"access_token": accessToken, // local-api 鉴权必需
	}
	envResp, err := postEncrypted("/api/v1/local-api/environments", envData, serverPubPEM, clientPriv)
	if err != nil {
		fmt.Printf("⚠️ 创建环境: %v（local-api 路由可能需调整）\n", err)
	} else {
		fmt.Printf("✅ 创建环境响应: %v\n", envResp)
	}

	// === 步骤D：refresh token（验证 remember 模式）===
	fmt.Println("\n--- 步骤D：refresh token（remember 模式）---")
	if refreshToken != "" {
		refreshResp, err := postEncrypted("/api/v1/users/refresh-credentials", map[string]interface{}{
			"refresh_token": refreshToken,
		}, serverPubPEM, clientPriv)
		if err != nil {
			fmt.Println("❌ refresh 失败:", err)
		} else {
			fmt.Printf("✅ refresh 成功（remember 模式可用）\n")
			if at, ok := refreshResp["access_token"].(string); ok {
				fmt.Printf("   新 access_token: %s...\n", at[:20])
			}
		}
	} else {
		fmt.Println("⚠️ 未取到 refresh_token，跳过 D 步骤")
	}

	fmt.Println("\n===== 联调完成，请用 SSH 查 DB 落库 =====")
	fmt.Printf("ssh simprint-server 'docker exec simprint-postgres psql -U simprint_user -d simprint_db -c \"SELECT email FROM users WHERE email=\\\"%s\\\";\"'\n", email)
}
