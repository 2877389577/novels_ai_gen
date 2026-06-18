package aiprovider

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

const (
	providerSecretKeySize             = 32
	providerSecretKeyPBKDF2Iterations = 210000
)

var providerSecretKeySalt = []byte("novels_ai_gen:ai_provider_api_key:v1")

// Cipher 表示 AI 提供商 API Key 的加解密器。
type Cipher struct {
	// key 表示 AES-256-GCM 使用的 32 字节密钥。
	key []byte
}

// NewCipher 根据应用配置创建 AI 提供商 API Key 加解密器。
// 参数 cfg 表示应用完整配置。
func NewCipher(cfg *appconfig.AppConfig) (*Cipher, error) {
	if cfg == nil {
		return nil, ErrProviderSecretKeyRequired
	}

	secretKey := strings.TrimSpace(cfg.AI.ProviderSecretKey)
	if secretKey == "" {
		return nil, ErrProviderSecretKeyRequired
	}

	key, err := deriveProviderSecretKey(secretKey)
	if err != nil {
		return nil, err
	}

	return &Cipher{key: key}, nil
}

// Encrypt 加密 AI 提供商 API Key 并返回 base64(nonce || ciphertext || tag)。
// 参数 plaintext 表示需要加密的 API Key 明文。
func (c *Cipher) Encrypt(plaintext string) (string, error) {
	if c == nil || len(c.key) != providerSecretKeySize {
		return "", ErrProviderSecretKeyInvalid
	}

	gcm, err := c.gcm()
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("生成 API Key 加密 nonce 失败: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, []byte(plaintext), nil)
	payload := make([]byte, 0, len(nonce)+len(ciphertext))
	payload = append(payload, nonce...)
	payload = append(payload, ciphertext...)
	return base64.StdEncoding.EncodeToString(payload), nil
}

// Decrypt 解密 AI 提供商 API Key 密文。
// 参数 value 表示 base64(nonce || ciphertext || tag) 格式的密文。
func (c *Cipher) Decrypt(value string) (string, error) {
	if c == nil || len(c.key) != providerSecretKeySize {
		return "", ErrProviderSecretKeyInvalid
	}

	gcm, err := c.gcm()
	if err != nil {
		return "", err
	}

	payload, err := base64.StdEncoding.DecodeString(strings.TrimSpace(value))
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrCiphertextInvalid, err)
	}
	if len(payload) <= gcm.NonceSize() {
		return "", ErrCiphertextInvalid
	}

	nonce := payload[:gcm.NonceSize()]
	ciphertext := payload[gcm.NonceSize():]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("%w: %v", ErrCiphertextInvalid, err)
	}
	return string(plaintext), nil
}

// gcm 创建 AES-256-GCM 加密实例。
func (c *Cipher) gcm() (cipher.AEAD, error) {
	block, err := aes.NewCipher(c.key)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderSecretKeyInvalid, err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderSecretKeyInvalid, err)
	}
	return gcm, nil
}

// deriveProviderSecretKey 将用户配置的任意非空密钥文本派生为 AES-256-GCM 使用的 32 字节密钥。
// 参数 secretKey 表示已经去除首尾空白的用户配置密钥文本。
func deriveProviderSecretKey(secretKey string) ([]byte, error) {
	if legacyKey, ok := decodeLegacyProviderSecretKey(secretKey); ok {
		return legacyKey, nil
	}

	key, err := pbkdf2.Key(sha256.New, secretKey, providerSecretKeySalt, providerSecretKeyPBKDF2Iterations, providerSecretKeySize)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderSecretKeyInvalid, err)
	}
	return key, nil
}

// decodeLegacyProviderSecretKey 兼容旧版 base64 编码 32 字节密钥配置。
// 参数 secretKey 表示已经去除首尾空白的用户配置密钥文本。
func decodeLegacyProviderSecretKey(secretKey string) ([]byte, bool) {
	key, err := base64.StdEncoding.DecodeString(secretKey)
	if err != nil || len(key) != providerSecretKeySize {
		return nil, false
	}
	return key, true
}

// isSecretKeyError 判断错误是否来自加密密钥配置。
// 参数 err 表示需要判断的错误。
func isSecretKeyError(err error) bool {
	return errors.Is(err, ErrProviderSecretKeyRequired) || errors.Is(err, ErrProviderSecretKeyInvalid)
}
