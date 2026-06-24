// Package main: Simprint 自托管服务器 Go 骨架。
// 配合 03/05 设计文档；加密协议细节见本文件注释和 03 文档第二节。
//
// crypto.go —— RSA-2048 + AES-256-GCM 混合加密协议实现（签名 + TODO 占位）。
//
// ===== 加密协议要点（03 文档第二节，服务端必须对齐）=====
//
// 总体：客户端与服务端之间使用 RSA-2048 + AES-256-GCM 混合加密。
//
// [请求加密 / 客户端 -> 服务端]
//   1. 客户端随机生成 AES-256 密钥
//   2. AES-256-GCM 加密 JSON body：
//      - nonce：12 字节随机
//      - 密文格式：base64( nonce[12B] || ciphertext || tag[16B] )  // GCM tag 附在末尾
//   3. 用服务端 RSA 公钥加密 AES 密钥：
//      - 密钥传输格式：base64( RSA( base64(aes_key) ) )
//   4. 发送 { "data": <encryptedData>, "encrypted": true, "key": <encryptedKey> }
//
// [响应加密 / 服务端 -> 客户端]
//   1. 服务端随机生成新的 AES-256 密钥
//   2. AES-256-GCM 加密响应 body（同上格式）
//   3. 用"请求中携带的客户端公钥"RSA 加密 AES 密钥
//      - 登录请求：客户端公钥在 payload.public_secret_key 字段
//      - 非登录请求：服务端按 access_token 缓存的客户端公钥
//   4. 返回 { "data": ..., "encrypted": true, "key": ... }
//
// [RSA 细节]
//   - 算法：RSA-2048
//   - 公钥格式：PKCS1 PEM（"-----BEGIN RSA PUBLIC KEY-----"，非 PKCS8）
//   - padding：PKCS1v15（本任务要求）
//     ⚠️ 注意：03 文档 §2.4 写密钥传输为 RSA_OAEP_sha1，§2.5 写 PKCS1v15 并强调
//        "实现前必须读 infrastructure/http/encryption/rsa.rs 确认 padding 类型"。
//        当前按任务要求实现为 PKCS1v15；正式落地前务必核对客户端 rsa.rs 以避免解密失败。
//
// [AES-GCM 细节]
//   - 算法：AES-256-GCM
//   - nonce：12 字节随机
//   - tag：16 字节，附在 ciphertext 末尾（Go crypto/cipher GCM 默认行为）
//   - 编码：整体 base64(StdEncoding)
package main

import (
	"crypto/rsa"
	"encoding/json"
	"errors"
)

// ErrNotImplemented 表示该函数为 stub，尚未实现具体逻辑。
var ErrNotImplemented = errors.New("crypto: not implemented (stub)")

// EncryptedBody 对应客户端/服务端之间的加密载荷结构。
// JSON tag 对齐 03 文档 §2.2：{ data, encrypted, key }
type EncryptedBody struct {
	Data      string `json:"data"`      // base64( nonce[12B] || ciphertext || tag[16B] )
	Encrypted bool   `json:"encrypted"` // 固定 true
	Key       string `json:"key"`       // base64( RSA( base64(aes_key) ) )
}

// DecryptRequest 解密来自客户端的加密请求体，返回明文 JSON（map 形式）。
//
// 流程（03 文档 §2.2 服务端伪代码）：
//   1. base64 解码 body.Key，用服务端 RSA 私钥解密 -> 得到 aes_key_base64
//   2. base64 解码 aes_key_base64 -> 得到 32 字节 AES-256 密钥
//   3. base64 解码 body.Data -> 取前 12 字节为 nonce，其余为 ciphertext||tag
//   4. AES-256-GCM Open 解密 -> 明文 JSON
//   5. json.Unmarshal -> map[string]interface{}
//
// 注意：本函数仅负责解密与解析；api_secret 校验由上层 handler/middleware 完成
//       （03 文档 §5：解密后校验 map["api_secret"] == config.APISecret）。
func DecryptRequest(body *EncryptedBody, serverPrivKey *rsa.PrivateKey) (map[string]interface{}, error) {
	// TODO: 实现 RSA 私钥解密 AES 密钥（padding 需与客户端对齐，见文件头注释）
	// TODO: 实现 AES-256-GCM 解密 data（nonce=前12字节）
	// TODO: json.Unmarshal 明文为 map
	_ = body
	_ = serverPrivKey
	return nil, ErrNotImplemented
}

// EncryptResponse 用客户端公钥加密响应 JSON，返回可下发客户端的 EncryptedBody。
//
// 流程（03 文档 §2.3 服务端伪代码）：
//   1. 随机生成 32 字节 AES-256 密钥
//   2. 随机生成 12 字节 nonce
//   3. AES-256-GCM Seal 加密 plainJSON -> nonce || ciphertext || tag
//   4. base64(nonce||ciphertext||tag) -> Data 字段
//   5. base64(aesKey) -> 用客户端 RSA 公钥加密 -> base64 编码 -> Key 字段
//   6. 返回 {Data, Encrypted:true, Key}
//
// 参数 clientPublicKeyPEM 为 PKCS1 PEM 格式客户端公钥（来自 login payload 或 token 缓存）。
func EncryptResponse(plainJSON json.RawMessage, clientPublicKeyPEM string) (*EncryptedBody, error) {
	// TODO: 随机 AES-256 密钥 + 12B nonce，AES-GCM Seal
	// TODO: base64(nonce||ciphertext||tag) 赋值 Data
	// TODO: base64(RSA_PKCS1v15_Encrypt(base64(aesKey), clientPublicKeyPEM)) 赋值 Key
	_ = plainJSON
	_ = clientPublicKeyPEM
	return nil, ErrNotImplemented
}

// GenerateRSAKeyPair 生成 RSA-2048 密钥对，并按 PKCS1 PEM 写入磁盘。
// 服务端首次启动时若无密钥文件则调用本函数生成并持久化。
//
// 参数 bits 通常为 2048（03 文档 §2.5）。
// 返回私钥指针，同时将私钥/公钥以 PKCS1 PEM 格式落盘到 config 指定路径。
func GenerateRSAKeyPair(bits int) (*rsa.PrivateKey, error) {
	// TODO: rsa.GenerateKey(rand.Reader, bits)
	// TODO: x509.MarshalPKCS1PrivateKey / MarshalPKCS1PublicKey -> PEM 编码 -> 写文件
	_ = bits
	return nil, ErrNotImplemented
}
