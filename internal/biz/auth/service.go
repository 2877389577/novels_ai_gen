package auth

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

var (
	// ErrInvalidPassword 表示登录密码不正确。
	ErrInvalidPassword = errors.New("invalid password")
	// ErrInvalidToken 表示访问令牌不存在或格式不正确。
	ErrInvalidToken = errors.New("invalid token")
	// ErrExpiredToken 表示访问令牌已经过期。
	ErrExpiredToken = errors.New("expired token")
)

const defaultTokenTTL = 24 * time.Hour

// LoginRequest 表示登录请求参数。
type LoginRequest struct {
	// Password 表示系统登录密码。
	Password string `json:"password" binding:"required" example:"admin123"`
}

// LoginResponse 表示登录成功后的响应数据。
type LoginResponse struct {
	// Token 表示后续访问系统资源使用的 Bearer 令牌。
	Token string `json:"token" example:"MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA"`
	// TokenType 表示令牌类型，固定为 Bearer。
	TokenType string `json:"token_type" example:"Bearer"`
	// ExpiresAt 表示令牌过期时间。
	ExpiresAt time.Time `json:"expires_at" example:"2026-06-14T22:00:00+08:00"`
}

// Service 表示登录鉴权业务服务。
type Service struct {
	// password 表示配置文件中的系统登录密码。
	password string
	// ttl 表示访问令牌有效期。
	ttl time.Duration
	// tokens 表示内存中的令牌过期时间映射。
	tokens map[string]time.Time
	// now 表示获取当前时间的方法。
	now func() time.Time
	// mu 表示保护令牌映射的读写锁。
	mu sync.RWMutex
}

// NewService 创建登录鉴权业务服务。
// 参数 cfg 表示应用完整配置。
func NewService(cfg *appconfig.AppConfig) *Service {
	return &Service{
		password: cfg.Auth.Password,
		ttl:      defaultTokenTTL,
		tokens:   make(map[string]time.Time),
		now:      time.Now,
	}
}

// Login 校验登录密码并生成访问令牌。
// 参数 req 表示登录请求参数。
func (s *Service) Login(req LoginRequest) (LoginResponse, error) {
	if req.Password != s.password {
		return LoginResponse{}, ErrInvalidPassword
	}

	token, err := generateToken()
	if err != nil {
		return LoginResponse{}, fmt.Errorf("生成访问令牌失败: %w", err)
	}

	expiresAt := s.now().Add(s.ttl)
	s.mu.Lock()
	s.tokens[token] = expiresAt
	s.mu.Unlock()

	return LoginResponse{
		Token:     token,
		TokenType: "Bearer",
		ExpiresAt: expiresAt,
	}, nil
}

// Verify 校验访问令牌是否存在且未过期。
// 参数 token 表示请求头中的 Bearer 访问令牌。
func (s *Service) Verify(token string) error {
	token = strings.TrimSpace(token)
	if token == "" {
		return ErrInvalidToken
	}

	s.mu.RLock()
	expiresAt, ok := s.tokens[token]
	s.mu.RUnlock()
	if !ok {
		return ErrInvalidToken
	}

	if !s.now().Before(expiresAt) {
		s.mu.Lock()
		delete(s.tokens, token)
		s.mu.Unlock()
		return ErrExpiredToken
	}

	return nil
}

// generateToken 生成随机访问令牌。
func generateToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("读取随机数失败: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
