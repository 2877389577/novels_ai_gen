package upload

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	bizupload "novels_ai_gen/internal/biz/upload"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

var handlerValidPNG = []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0}

// handlerFakeStorage 表示 handler 测试使用的对象存储实现。
type handlerFakeStorage struct {
	// previewURL 表示生成预览链接时返回的 URL。
	previewURL string
	// putObjectKey 表示最近一次上传收到的对象 key。
	putObjectKey string
}

// PutObject 记录 handler 测试中的上传对象 key。
// 参数 ctx 表示请求上下文；参数 objectKey 表示对象 key；参数 reader 表示对象内容读取器；参数 size 表示对象大小；参数 contentType 表示对象 MIME 类型。
func (s *handlerFakeStorage) PutObject(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) error {
	s.putObjectKey = objectKey
	_, err := io.Copy(io.Discard, reader)
	return err
}

// PresignedGetObject 返回 handler 测试中的固定预览链接。
// 参数 ctx 表示请求上下文；参数 objectKey 表示对象 key；参数 expires 表示预签名链接有效期。
func (s *handlerFakeStorage) PresignedGetObject(ctx context.Context, objectKey string, expires time.Duration) (string, error) {
	if s.previewURL == "" {
		return "https://example.test/preview", nil
	}
	return s.previewURL, nil
}

// TestUploadImageHandlerValidation 验证上传接口会处理缺文件、缺用途和非法用途。
// 参数 t 表示测试上下文。
func TestUploadImageHandlerValidation(t *testing.T) {
	router, _ := newUploadTestRouter()

	tests := []struct {
		// name 表示测试名称。
		name string
		// usage 表示 multipart 中的 usage 字段，nil 表示不提交该字段。
		usage *string
		// filename 表示 multipart 中的文件名。
		filename string
		// content 表示 multipart 中的文件内容。
		content []byte
		// wantStatus 表示期望的 HTTP 状态码。
		wantStatus int
	}{
		{name: "缺少文件", usage: stringPtr(bizupload.UsageCover), wantStatus: http.StatusBadRequest},
		{name: "缺少用途", filename: "cover.png", content: handlerValidPNG, wantStatus: http.StatusBadRequest},
		{name: "非法用途", usage: stringPtr("avatar"), filename: "cover.png", content: handlerValidPNG, wantStatus: http.StatusBadRequest},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp := performUploadRequest(t, router, tt.usage, tt.filename, tt.content)
			if resp.Code != tt.wantStatus {
				t.Fatalf("HTTP 状态码不符合预期: got %d, want %d", resp.Code, tt.wantStatus)
			}
		})
	}
}

// TestUploadImageHandlerSuccess 验证上传接口成功响应结构。
// 参数 t 表示测试上下文。
func TestUploadImageHandlerSuccess(t *testing.T) {
	router, storage := newUploadTestRouter()

	resp := performUploadRequest(t, router, stringPtr(bizupload.UsageCover), "cover.png", handlerValidPNG)
	if resp.Code != http.StatusOK {
		t.Fatalf("HTTP 状态码不符合预期: %d", resp.Code)
	}

	var body struct {
		// Code 表示业务响应码。
		Code int `json:"code"`
		// Message 表示响应提示信息。
		Message string `json:"message"`
		// Data 表示上传图片响应数据。
		Data bizupload.UploadImageResponse `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("解析响应 JSON 失败: %v", err)
	}

	if body.Code != 0 {
		t.Fatalf("业务响应码不符合预期: %d", body.Code)
	}
	if body.Data.ObjectKey == "" {
		t.Fatal("object_key 不应该为空")
	}
	if body.Data.PreviewURL != "https://example.test/preview" {
		t.Fatalf("preview_url 不符合预期: %s", body.Data.PreviewURL)
	}
	if storage.putObjectKey != body.Data.ObjectKey {
		t.Fatalf("上传对象 key 不符合预期: %s", storage.putObjectKey)
	}
}

// TestPreviewHandler 验证刷新预览接口的非法 key 和成功响应。
// 参数 t 表示测试上下文。
func TestPreviewHandler(t *testing.T) {
	router, _ := newUploadTestRouter()

	badResp := httptest.NewRecorder()
	badReq := httptest.NewRequest(http.MethodGet, "/uploads/preview?object_key=other/a.png", nil)
	router.ServeHTTP(badResp, badReq)
	if badResp.Code != http.StatusBadRequest {
		t.Fatalf("非法 key 状态码不符合预期: %d", badResp.Code)
	}

	okResp := httptest.NewRecorder()
	okReq := httptest.NewRequest(http.MethodGet, "/uploads/preview?object_key=covers/2026/06/a.png", nil)
	router.ServeHTTP(okResp, okReq)
	if okResp.Code != http.StatusOK {
		t.Fatalf("合法 key 状态码不符合预期: %d", okResp.Code)
	}
}

// newUploadTestRouter 创建上传 handler 测试路由和假对象存储。
func newUploadTestRouter() (*gin.Engine, *handlerFakeStorage) {
	gin.SetMode(gin.TestMode)

	storage := &handlerFakeStorage{}
	service := bizupload.NewService(&appconfig.AppConfig{
		Storage: appconfig.StorageConfig{
			S3: appconfig.S3Config{
				PreviewExpire:   24 * time.Hour,
				MaxUploadSizeMB: 1,
				CoverPrefix:     "covers",
				CharacterPrefix: "characters",
			},
		},
	}, storage)
	handler := NewHandler(service)

	router := gin.New()
	router.POST("/uploads/images", handler.UploadImage)
	router.GET("/uploads/preview", handler.Preview)
	return router, storage
}

// performUploadRequest 构造并执行 multipart 图片上传请求。
// 参数 t 表示测试上下文；参数 router 表示测试路由；参数 usage 表示图片用途字段；参数 filename 表示上传文件名；参数 content 表示上传文件内容。
func performUploadRequest(t *testing.T, router *gin.Engine, usage *string, filename string, content []byte) *httptest.ResponseRecorder {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	if usage != nil {
		if err := writer.WriteField("usage", *usage); err != nil {
			t.Fatalf("写入 usage 字段失败: %v", err)
		}
	}
	if filename != "" {
		part, err := writer.CreateFormFile("file", filename)
		if err != nil {
			t.Fatalf("创建文件字段失败: %v", err)
		}
		if _, err := part.Write(content); err != nil {
			t.Fatalf("写入文件内容失败: %v", err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("关闭 multipart writer 失败: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/uploads/images", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	return resp
}

// stringPtr 返回字符串指针，便于测试中表达可省略字段。
// 参数 value 表示需要取地址的字符串。
func stringPtr(value string) *string {
	return &value
}
