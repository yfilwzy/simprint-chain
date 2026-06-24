// Package main: Simprint 自托管服务器 Go 骨架。
// 配合 03/05 设计文档；加密协议细节见本文件注释和 03 文档第二节。
//
// crypto.go —— RSA-2048 + AES-256-GCM 混合加密协议实现。
//
// ===== 加密协议要点（以客户端源码为唯一权威，已核对）=====
//
// 已核对客户端实现：
//   - src-tauri/src/infrastructure/http/encryption/rsa.rs   → RSA padding = PKCS1v15（Pkcs1v15Encrypt）
//   - src-tauri/src/infrastructure/http/encryption/aes.rs   → AES-256-GCM，nonce=12B，base64(nonce||ciphertext||tag)
//
// 注意：03 文档 §2.2/§2.4 伪代码里写的 "RSA_OAEP" 是笔误；
//       03 文档 §2.5 明确"以客户端 rsa.rs 为准"，源码是 PKCS1v15。本实现按 PKCS1v15。
//
// [请求加密 / 客户端 -> 服务端]（对应 aes.rs::encrypt + rsa.rs::encrypt_with_public_key）
//   1. 客户端随机生成 AES-256 密钥（32 字节）
//   2. AES-256-GCM 加密 JSON body：
//      - nonce：12 字节随机
//      - 密文格式：base64( nonce[12B] || ciphertext || tag[16B] )   // aes.rs::encrypt 第58-63行
//   3. 用服务端 RSA 公钥加密 "AES 密钥的 base64 字符串的字节"（关键！）：
//      - 客户端：aes.get_key_as_base64().as_bytes()  → 即 base64(aesKey) 的 UTF-8 字节
//      - 再 base64 编码密文 → key 字段                          // rsa.rs::encrypt_with_public_key 第79/84行
//   4. 发送 { "data": <encryptedData>, "encrypted": true, "key": <encryptedKey> }
//
// [响应加密 / 服务端 -> 客户端]（客户端用 rsa.rs::decrypt + aes.rs::decrypt 还原）
//   1. 服务端随机生成新的 AES-256 密钥（32 字节）
//   2. AES-256-GCM 加密响应 body（格式同上：base64(nonce||ciphertext||tag)）
//   3. 用"请求中携带的客户端公钥"RSA-PKCS1v15 加密 base64(aesKey) 的字节，再 base64 编码
//   4. 返回 { "data": ..., "encrypted": true, "key": ... }
//
// [RSA 细节]
//   - 算法：RSA-2048
//   - padding：PKCS1v15（与客户端 rsa.rs Pkcs1v15Encrypt 对齐）
//   - 公钥格式：PKCS1 PEM（"-----BEGIN RSA PUBLIC KEY-----"）
//   - 私钥格式：PKCS1 PEM（"-----BEGIN RSA PRIVATE KEY-----"）
//
// [AES-GCM 细节]
//   - 算法：AES-256-GCM
//   - nonce：12 字节随机
//   - tag：16 字节，Go crypto/cipher GCM 默认 Seal 时附在 ciphertext 末尾（与 aes-gcm crate 行为一致）
//   - 编码：整体 base64(StdEncoding)
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
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// EncryptedBody 对应客户端/服务端之间的加密载荷结构。
// JSON tag 对齐 03 文档 §2.2：{ data, encrypted, key }
type EncryptedBody struct {
	Data      string `json:"data"`      // base64( nonce[12B] || ciphertext || tag[16B] )
	Encrypted bool   `json:"encrypted"` // 固定 true
	Key       string `json:"key"`       // base64( RSA_PKCS1v15( base64(aes_key) 的字节 ) )
}

// DecryptRequest 解密来自客户端的加密请求体，返回明文 JSON（map 形式）。
//
// 流程（对齐客户端 aes.rs::decrypt + rsa.rs::decrypt）：
//   1. base64 解码 body.Key -> RSA 密文
//   2. RSA-PKCS1v15 解密 -> 得到 base64(aesKey) 字符串的字节
//   3. base64 解码该字符串 -> 32 字节 AES-256 密钥
//   4. base64 解码 body.Data -> 前 12 字节 nonce，其余 ciphertext||tag
//   5. AES-256-GCM Open 解密 -> 明文 JSON
//   6. json.Unmarshal -> map[string]interface{}
func DecryptRequest(body *EncryptedBody, serverPrivKey *rsa.PrivateKey) (map[string]interface{}, error) {
	// 1. base64 解码 key 字段 -> RSA 密文
	encAesKey, err := base64.StdEncoding.DecodeString(body.Key)
	if err != nil {
		return nil, fmt.Errorf("decode key base64: %w", err)
	}

	// 2. RSA-PKCS1v15 私钥解密 -> base64(aesKey) 的字节
	aesKeyBase64Bytes, err := rsa.DecryptPKCS1v15(rand.Reader, serverPrivKey, encAesKey)
	if err != nil {
		return nil, fmt.Errorf("rsa decrypt aes key: %w", err)
	}

	// 3. base64 解码 -> 32 字节 AES 密钥（客户端加密的是 base64(aesKey) 字符串）
	aesKey, err := base64.StdEncoding.DecodeString(string(aesKeyBase64Bytes))
	if err != nil {
		return nil, fmt.Errorf("decode aes key base64: %w", err)
	}
	if len(aesKey) != 32 {
		return nil, fmt.Errorf("invalid aes key length: got %d, want 32", len(aesKey))
	}

	// 4. base64 解码 data -> nonce(12B) || ciphertext||tag
	raw, err := base64.StdEncoding.DecodeString(body.Data)
	if err != nil {
		return nil, fmt.Errorf("decode data base64: %w", err)
	}
	if len(raw) < 13 { // nonce 12 + 至少 1 字节
		return nil, errors.New("data too short")
	}
	nonce := raw[:12]
	ciphertext := raw[12:]

	// 5. AES-256-GCM Open
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return nil, fmt.Errorf("aes new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm new: %w", err)
	}
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("gcm open: %w", err)
	}

	// 6. 解析 JSON
	var m map[string]interface{}
	if err := json.Unmarshal(plaintext, &m); err != nil {
		return nil, fmt.Errorf("json unmarshal: %w", err)
	}
	return m, nil
}

// EncryptResponse 用客户端公钥加密响应 JSON，返回可下发客户端的 EncryptedBody。
//
// 流程（对齐客户端 aes.rs::encrypt + rsa.rs::encrypt_with_public_key 的逆操作）：
//   1. 解析客户端公钥 PEM（PKCS1）
//   2. 随机生成 32 字节 AES-256 密钥
//   3. 随机生成 12 字节 nonce
//   4. AES-256-GCM Seal -> nonce || ciphertext || tag，base64 编码 -> Data
//   5. base64(aesKey) -> RSA-PKCS1v15 公钥加密 -> base64 编码 -> Key
func EncryptResponse(plainJSON json.RawMessage, clientPublicKeyPEM string) (*EncryptedBody, error) {
	// 1. 解析客户端公钥（PKCS1 PEM）
	clientPubKey, err := parsePKCS1PublicKey(clientPublicKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("parse client public key: %w", err)
	}

	// 2. 随机 AES-256 密钥
	aesKey := make([]byte, 32)
	if _, err := rand.Read(aesKey); err != nil {
		return nil, fmt.Errorf("rand aes key: %w", err)
	}
	block, err := aes.NewCipher(aesKey)
	if err != nil {
		return nil, fmt.Errorf("aes new cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("gcm new: %w", err)
	}

	// 3. 随机 nonce（12B）
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, fmt.Errorf("rand nonce: %w", err)
	}

	// 4. Seal -> nonce || ciphertext || tag，整体 base64
	ciphertext := gcm.Seal(nil, nonce, plainJSON, nil)
	combined := make([]byte, 0, len(nonce)+len(ciphertext))
	combined = append(combined, nonce...)
	combined = append(combined, ciphertext...)
	dataB64 := base64.StdEncoding.EncodeToString(combined)

	// 5. base64(aesKey) -> RSA-PKCS1v15 公钥加密 -> base64
	aesKeyB64 := base64.StdEncoding.EncodeToString(aesKey)
	encAesKey, err := rsa.EncryptPKCS1v15(rand.Reader, clientPubKey, []byte(aesKeyB64))
	if err != nil {
		return nil, fmt.Errorf("rsa encrypt aes key: %w", err)
	}
	keyB64 := base64.StdEncoding.EncodeToString(encAesKey)

	return &EncryptedBody{
		Data:      dataB64,
		Encrypted: true,
		Key:       keyB64,
	}, nil
}

// GenerateRSAKeyPair 生成 RSA-2048 密钥对，并按 PKCS1 PEM 写入磁盘。
// 服务端首次启动时若无密钥文件则调用本函数生成并持久化。
func GenerateRSAKeyPair(bits int, privPath, pubPath string) (*rsa.PrivateKey, string, error) {
	// 生成密钥
	privKey, err := rsa.GenerateKey(rand.Reader, bits)
	if err != nil {
		return nil, "", fmt.Errorf("generate rsa key: %w", err)
	}

	// 确保目录存在
	if err := os.MkdirAll(filepath.Dir(privPath), 0o700); err != nil {
		return nil, "", fmt.Errorf("mkdir priv key dir: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(pubPath), 0o700); err != nil {
		return nil, "", fmt.Errorf("mkdir pub key dir: %w", err)
	}

	// 私钥 PKCS1 PEM
	privDER := x509.MarshalPKCS1PrivateKey(privKey)
	privPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: privDER})
	if err := os.WriteFile(privPath, privPEM, 0o600); err != nil {
		return nil, "", fmt.Errorf("write priv key: %w", err)
	}

	// 公钥 PKCS1 PEM
	pubDER := x509.MarshalPKCS1PublicKey(&privKey.PublicKey)
	pubPEM := pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: pubDER})
	if err := os.WriteFile(pubPath, pubPEM, 0o600); err != nil {
		return nil, "", fmt.Errorf("write pub key: %w", err)
	}

	return privKey, string(pubPEM), nil
}

// LoadServerKeys 加载服务端 RSA 密钥：文件存在则读，否则生成并落盘。
// 返回私钥指针 + 公钥 PEM 字符串（对外暴露于 GET /api/v1/secret/public/key）。
func LoadServerKeys(privPath, pubPath string) (*rsa.PrivateKey, string, error) {
	// 文件存在则加载
	if _, err := os.Stat(privPath); err == nil {
		privKey, pubPEM, err := loadKeysFromDisk(privPath, pubPath)
		if err == nil {
			return privKey, pubPEM, nil
		}
		// 加载失败则继续走生成流程
	}
	return GenerateRSAKeyPair(2048, privPath, pubPath)
}

// loadKeysFromDisk 从 PEM 文件加载私钥与公钥。
func loadKeysFromDisk(privPath, pubPath string) (*rsa.PrivateKey, string, error) {
	privBytes, err := os.ReadFile(privPath)
	if err != nil {
		return nil, "", err
	}
	privBlock, _ := pem.Decode(privBytes)
	if privBlock == nil {
		return nil, "", errors.New("invalid private key PEM")
	}
	privKey, err := x509.ParsePKCS1PrivateKey(privBlock.Bytes)
	if err != nil {
		return nil, "", err
	}

	// 公钥：优先从 pubPath 读；若缺失则从私钥推导
	var pubPEM string
	if pubBytes, err := os.ReadFile(pubPath); err == nil {
		pubPEM = string(pubBytes)
	} else {
		pubDER := x509.MarshalPKCS1PublicKey(&privKey.PublicKey)
		pubPEM = string(pem.EncodeToMemory(&pem.Block{Type: "RSA PUBLIC KEY", Bytes: pubDER}))
	}
	return privKey, pubPEM, nil
}

// parsePKCS1PublicKey 解析客户端 PKCS1 公钥 PEM（兼容有无尾部换行）。
func parsePKCS1PublicKey(pemStr string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, errors.New("invalid client public key PEM")
	}
	// 客户端是 PKCS1（BEGIN RSA PUBLIC KEY）
	if pub, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return pub, nil
	}
	// 兜底：兼容 PKIX（BEGIN PUBLIC KEY）格式
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, errors.New("not an RSA public key")
	}
	return rsaPub, nil
}
