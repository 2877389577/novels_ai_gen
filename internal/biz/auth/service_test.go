package auth

import (
	"errors"
	"testing"
	"time"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// newTestService 创建测试用登录鉴权服务。
// 参数 now 表示测试中的当前时间。
func newTestService(now time.Time) *Service {
	service := NewService(&appconfig.AppConfig{
		Auth: appconfig.AuthConfig{Password: "admin123"},
	})
	service.now = func() time.Time {
		return now
	}
	return service
}

// TestLoginReturnsToken 验证密码正确时会返回可校验的访问令牌。
// 参数 t 表示测试上下文。
func TestLoginReturnsToken(t *testing.T) {
	now := time.Date(2026, 6, 13, 10, 0, 0, 0, time.Local)
	service := newTestService(now)

	resp, err := service.Login(LoginRequest{Password: "admin123"})
	if err != nil {
		t.Fatalf("登录失败: %v", err)
	}
	if resp.Token == "" {
		t.Fatal("登录成功后应该返回访问令牌")
	}
	if err := service.Verify(resp.Token); err != nil {
		t.Fatalf("校验访问令牌失败: %v", err)
	}
}

// TestLoginRejectsInvalidPassword 验证密码错误时返回 ErrInvalidPassword。
// 参数 t 表示测试上下文。
func TestLoginRejectsInvalidPassword(t *testing.T) {
	service := newTestService(time.Now())

	_, err := service.Login(LoginRequest{Password: "bad"})
	if !errors.Is(err, ErrInvalidPassword) {
		t.Fatalf("错误类型不符合预期: %v", err)
	}
}

// TestVerifyRejectsUnknownToken 验证不存在的访问令牌会被拒绝。
// 参数 t 表示测试上下文。
func TestVerifyRejectsUnknownToken(t *testing.T) {
	service := newTestService(time.Now())

	err := service.Verify("missing")
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("错误类型不符合预期: %v", err)
	}
}

// TestVerifyRejectsExpiredToken 验证过期的访问令牌会被拒绝。
// 参数 t 表示测试上下文。
func TestVerifyRejectsExpiredToken(t *testing.T) {
	now := time.Date(2026, 6, 13, 10, 0, 0, 0, time.Local)
	service := newTestService(now)

	resp, err := service.Login(LoginRequest{Password: "admin123"})
	if err != nil {
		t.Fatalf("登录失败: %v", err)
	}

	service.now = func() time.Time {
		return now.Add(defaultTokenTTL + time.Second)
	}
	err = service.Verify(resp.Token)
	if !errors.Is(err, ErrExpiredToken) {
		t.Fatalf("错误类型不符合预期: %v", err)
	}
}
