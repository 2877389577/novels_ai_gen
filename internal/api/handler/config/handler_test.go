package config

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/middleware"
	bizauth "novels_ai_gen/internal/biz/auth"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// TestHandler_GetFileRequiresAuth 验证配置文件读取接口需要 Bearer 登录态。
func TestHandler_GetFileRequiresAuth(t *testing.T) {
	engine, _ := newTestEngine(t, "admin123")

	response := performConfigRequest(engine, http.MethodGet, "/api/v1/config/file", "", "")
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
}

// TestHandler_GetFileSuccess 验证登录后可以读取当前启动配置文件内容。
func TestHandler_GetFileSuccess(t *testing.T) {
	engine, token := newTestEngine(t, "admin123")

	response := performConfigRequest(engine, http.MethodGet, "/api/v1/config/file", "", token)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", response.Code, http.StatusOK, response.Body.String())
	}

	var body struct {
		// Data 表示配置文件接口返回的数据。
		Data FileData `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if !strings.Contains(body.Data.Content, "admin123") {
		t.Fatalf("content does not contain password")
	}
	if body.Data.ConfigFile == "" {
		t.Fatalf("config_file is empty")
	}
}

// TestHandler_UpdateFileRejectsInvalidContent 验证保存非法 YAML 会返回 400。
func TestHandler_UpdateFileRejectsInvalidContent(t *testing.T) {
	engine, token := newTestEngine(t, "admin123")
	body := mustJSON(t, UpdateFileRequest{Content: "auth: ["})

	response := performConfigRequest(engine, http.MethodPut, "/api/v1/config/file", body, token)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d, body = %s", response.Code, http.StatusBadRequest, response.Body.String())
	}
}

// TestHandler_UpdateFileSuccess 验证保存合法配置会写入文件并返回最新内容。
func TestHandler_UpdateFileSuccess(t *testing.T) {
	engine, token := newTestEngine(t, "admin123")
	newContent := testHandlerConfigContent("new-password")
	body := mustJSON(t, UpdateFileRequest{Content: newContent})

	response := performConfigRequest(engine, http.MethodPut, "/api/v1/config/file", body, token)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d, body = %s", response.Code, http.StatusOK, response.Body.String())
	}

	var payload struct {
		// Data 表示配置文件接口返回的数据。
		Data FileData `json:"data"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatalf("Unmarshal() error = %v", err)
	}
	if !strings.Contains(payload.Data.Content, "new-password") {
		t.Fatalf("content does not contain new password")
	}
}

// newTestEngine 创建包含配置接口和鉴权中间件的测试 Gin 引擎。
// 参数 t 表示当前测试对象；参数 password 表示测试登录密码。
func newTestEngine(t *testing.T, password string) (*gin.Engine, string) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	manager := newTestConfigManager(t, password)
	authService := bizauth.NewService(manager)
	loginData, err := authService.Login(bizauth.LoginRequest{Password: password})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}

	handler := NewHandler(manager)
	engine := gin.New()
	api := engine.Group("/api/v1")
	protected := api.Group("")
	protected.Use(middleware.Auth(authService))
	protected.GET("/config/file", handler.GetFile)
	protected.PUT("/config/file", handler.UpdateFile)
	return engine, loginData.Token
}

// newTestConfigManager 创建测试用配置文件管理器。
// 参数 t 表示当前测试对象；参数 password 表示测试登录密码。
func newTestConfigManager(t *testing.T, password string) *appconfig.ConfigManager {
	t.Helper()

	configFile := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(configFile, []byte(testHandlerConfigContent(password)), 0644); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	manager, cleanup, err := appconfig.NewManager(configFile)
	if err != nil {
		t.Fatalf("NewManager() error = %v", err)
	}
	t.Cleanup(cleanup)
	return manager
}

// performConfigRequest 执行配置接口测试请求。
// 参数 engine 表示 Gin 测试引擎；参数 method 表示 HTTP 方法；参数 path 表示请求路径；参数 body 表示请求体；参数 token 表示 Bearer token。
func performConfigRequest(engine *gin.Engine, method string, path string, body string, token string) *httptest.ResponseRecorder {
	request := httptest.NewRequest(method, path, bytes.NewBufferString(body))
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}

	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	return response
}

// mustJSON 将测试请求结构序列化为 JSON 文本。
// 参数 t 表示当前测试对象；参数 value 表示需要序列化的值。
func mustJSON(t *testing.T, value any) string {
	t.Helper()

	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("Marshal() error = %v", err)
	}
	return string(data)
}

// testHandlerConfigContent 返回 handler 测试使用的 YAML 配置文本。
// 参数 password 表示写入 auth.password 的密码。
func testHandlerConfigContent(password string) string {
	return `server:
  port: 8080
  host: 127.0.0.1
auth:
  password: ` + password + `
`
}
