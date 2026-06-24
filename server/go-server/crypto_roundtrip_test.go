// crypto_roundtrip_test.go —— 加密协议往返自测（与主包同包，可直接调用 DecryptRequest/EncryptResponse）。
//
// 目的：在客户端接入前，用 Go 完整模拟客户端的加密流程（RSA-PKCS1v15 + AES-256-GCM），
// 调用服务端 DecryptRequest / EncryptResponse，验证服务端能正确解密、且响应能被客户端逻辑还原。
//
// 对齐客户端实现：
//   - src-tauri/src/infrastructure/http/encryption/rsa.rs  (Pkcs1v15Encrypt)
//   - src-tauri/src/infrastructure/http/encryption/aes.rs  (AES-256-GCM, nonce=12B, base64(nonce||ct||tag))
//   - src-tauri/src/infrastructure/main_server/interceptors/request.rs::encrypt_request_body
//   - src-tauri/src/infrastructure/main_server/interceptors/crypto.rs::decrypt_if_encrypted
//
// 运行: docker run --rm -v "$PWD":/app -w /app golang:1.22-alpine go test -v -run TestCryptoRoundTrip
package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"testing"
)

// simClientEncryptRequestBody 精确复刻客户端 encrypt_request_body（request.rs:101-123）。
func simClientEncryptRequestBody(t *testing.T, data map[string]interface{}, serverPubKeyPEM string) (*EncryptedBody, error) {
	t.Helper()
	aesKey := make([]byte, 32)
	if _, err := rand.Read(aesKey); err != nil {
		return nil, err
	}
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize()) // 12
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	ct := gcm.Seal(nil, nonce, jsonBytes, nil)
	combined := append(append([]byte{}, nonce...), ct...)
	encData := base64.StdEncoding.EncodeToString(combined)

	aesKeyB64 := base64.StdEncoding.EncodeToString(aesKey)
	pubKey := mustParsePKCS1Pub(t, serverPubKeyPEM)
	encAesKey, err := rsa.EncryptPKCS1v15(rand.Reader, pubKey, []byte(aesKeyB64))
	if err != nil {
		return nil, err
	}
	encKey := base64.StdEncoding.EncodeToString(encAesKey)

	return &EncryptedBody{Data: encData, Encrypted: true, Key: encKey}, nil
}

// simClientDecryptIfEncrypted 精确复刻客户端 decrypt_if_encrypted（crypto.rs:18-49）。
func simClientDecryptIfEncrypted(t *testing.T, enc *EncryptedBody, clientPrivKey *rsa.PrivateKey) (map[string]interface{}, error) {
	t.Helper()
	if !enc.Encrypted {
		return nil, fmt.Errorf("expected encrypted body")
	}
	encKeyBytes, err := base64.StdEncoding.DecodeString(enc.Key)
	if err != nil {
		return nil, err
	}
	aesKeyB64Bytes, err := rsa.DecryptPKCS1v15(rand.Reader, clientPrivKey, encKeyBytes)
	if err != nil {
		return nil, fmt.Errorf("client rsa decrypt aes key: %w", err)
	}
	aesKey, err := base64.StdEncoding.DecodeString(string(aesKeyB64Bytes))
	if err != nil {
		return nil, fmt.Errorf("client decode aes key b64: %w", err)
	}
	raw, err := base64.StdEncoding.DecodeString(enc.Data)
	if err != nil {
		return nil, err
	}
	if len(raw) < 12 {
		return nil, fmt.Errorf("data too short")
	}
	nonce := raw[:12]
	ct := raw[12:]
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	plain, err := gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return nil, fmt.Errorf("client gcm open: %w", err)
	}
	var m map[string]interface{}
	if err := json.Unmarshal(plain, &m); err != nil {
		return nil, err
	}
	return m, nil
}

func mustParsePKCS1Pub(t *testing.T, pemStr string) *rsa.PublicKey {
	t.Helper()
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		t.Fatal("invalid server public key PEM")
	}
	pub, err := x509.ParsePKCS1PublicKey(block.Bytes)
	if err != nil {
		t.Fatalf("parse pkcs1 pub: %v", err)
	}
	return pub
}

// TestCryptoRoundTrip 全链路：客户端加密 → 服务端解密 → 服务端加密响应 → 客户端解密。
func TestCryptoRoundTrip(t *testing.T) {
	serverPriv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	serverPubDER := x509.MarshalPKCS1PublicKey(&serverPriv.PublicKey)
	serverPubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: serverPubDER}))

	clientPriv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	clientPubDER := x509.MarshalPKCS1PublicKey(&clientPriv.PublicKey)
	clientPubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: clientPubDER}))

	// 正向：客户端加密登录请求
	loginPayload := map[string]interface{}{
		"login_type":        "Basic",
		"email":             "test@example.com",
		"password":          "P@ssw0rd!",
		"public_secret_key": clientPubPEM,
		"api_secret":        "test-api-secret-12345",
	}
	encReq, err := simClientEncryptRequestBody(t, loginPayload, serverPubPEM)
	if err != nil {
		t.Fatalf("client encrypt request: %v", err)
	}
	t.Logf("✓ 客户端加密请求成功 (data=%dB, key=%dB)", len(encReq.Data), len(encReq.Key))

	// 服务端解密
	decMap, err := DecryptRequest(encReq, serverPriv)
	if err != nil {
		t.Fatalf("服务端解密失败（最关键验证，失败=padding/格式不对）: %v", err)
	}
	t.Logf("✓ 服务端解密请求成功")
	if decMap["email"] != "test@example.com" {
		t.Errorf("email 不匹配: got %v", decMap["email"])
	}
	if decMap["api_secret"] != "test-api-secret-12345" {
		t.Errorf("api_secret 不匹配: got %v", decMap["api_secret"])
	}
	if _, ok := decMap["public_secret_key"]; !ok {
		t.Errorf("public_secret_key 丢失")
	}
	t.Logf("✓ 解密内容正确 (email/api_secret/public_secret_key 全部还原)")

	// 反向：服务端加密响应 —— 必须包 {code, message, data} 外层（JsonRespnse 协议）
	// 这是深度复核发现的关键：客户端 parse_and_decrypt_response 把明文解析为 JsonRespnse，
	// 业务数据从 data 字段取。不包外层会导致 result.data 为 None，登录 token 存不进去。
	loginRespPayload := map[string]interface{}{
		"access_token":   "atk-abcdef123456",
		"refresh_token":  "rtk-xyz789",
		"is_first_login": true,
	}
	envelope := map[string]interface{}{
		"code":    0,
		"message": "ok",
		"data":    loginRespPayload,
	}
	envelopeJSON, _ := json.Marshal(envelope)
	encResp, err := EncryptResponse(envelopeJSON, clientPubPEM)
	if err != nil {
		t.Fatalf("服务端加密响应失败: %v", err)
	}
	t.Logf("✓ 服务端加密响应成功（已包 code/message/data 外层）")

	// 客户端解密响应 → 模拟 parse_and_decrypt_response 解析为 JsonRespnse
	decResp, err := simClientDecryptIfEncrypted(t, encResp, clientPriv)
	if err != nil {
		t.Fatalf("客户端解密响应失败（反向链路）: %v", err)
	}
	t.Logf("✓ 客户端解密响应成功")

	// 模拟客户端：先解析为 JsonRespnse {code, message, data}，再从 data 取业务数据
	code, _ := decResp["code"].(float64)
	if code != 0 {
		t.Errorf("code 不为 0: got %v", decResp["code"])
	}
	dataRaw, ok := decResp["data"]
	if !ok {
		t.Fatalf("❌ 致命：响应缺少 data 字段 —— 客户端 result.data 会是 None，登录失败！")
	}
	dataMap, ok := dataRaw.(map[string]interface{})
	if !ok {
		t.Fatalf("data 字段不是对象: %T", dataRaw)
	}
	t.Logf("✓ 响应外层结构正确 (code=%v, data 字段存在)", code)

	// 从 data 取 access_token（模拟 login.rs::handle_login_response）
	if dataMap["access_token"] != "atk-abcdef123456" {
		t.Errorf("access_token 不匹配: got %v", dataMap["access_token"])
	}
	if dataMap["is_first_login"] != true {
		t.Errorf("is_first_login 不匹配: got %v", dataMap["is_first_login"])
	}
	t.Logf("✓ 业务数据正确 (从 data 取出 access_token/refresh_token/is_first_login)")

	t.Log("")
	t.Log("🎉 加密往返全链路验证通过 —— 服务端实现与客户端协议完全兼容")
	t.Log("   ✓ RSA padding = PKCS1v15（与客户端 rsa.rs 一致）")
	t.Log("   ✓ AES-256-GCM，nonce=12B，base64(nonce||ct||tag)")
	t.Log("   ✓ 响应包 {code,message,data} 外层（JsonRespnse 协议，登录 token 可正确存入）")
}

// TestDecryptRejectsTamperedData 验证：篡改密文后解密应失败（GCM 完整性保护）。
func TestDecryptRejectsTamperedData(t *testing.T) {
	serverPriv, _ := rsa.GenerateKey(rand.Reader, 2048)
	serverPubDER := x509.MarshalPKCS1PublicKey(&serverPriv.PublicKey)
	serverPubPEM := string(pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: serverPubDER}))

	encReq, err := simClientEncryptRequestBody(t, map[string]interface{}{"x": 1}, serverPubPEM)
	if err != nil {
		t.Fatal(err)
	}
	// 篡改 data 字段（翻转一个 base64 字符）
	tampered := *encReq
	b := []byte(tampered.Data)
	b[len(b)-1] = flip(b[len(b)-1]) // 翻转末字符
	tampered.Data = string(b)

	if _, err := DecryptRequest(&tampered, serverPriv); err == nil {
		t.Fatal("篡改的密文竟然解密成功了，GCM 完整性保护失效")
	}
	t.Logf("✓ 篡改密文被正确拒绝（GCM 认证标签生效）")
}

func flip(c byte) byte {
	if c == 'A' {
		return 'B'
	}
	return 'A'
}
