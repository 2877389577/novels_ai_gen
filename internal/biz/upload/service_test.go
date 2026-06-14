package upload

import (
	"bytes"
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

var validPNG = []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n', 0, 0, 0, 0}

// fakeStorage 表示用于测试的对象存储实现。
type fakeStorage struct {
	// putObjectKey 表示最近一次上传收到的对象 key。
	putObjectKey string
	// putContentType 表示最近一次上传收到的 MIME 类型。
	putContentType string
	// putSize 表示最近一次上传收到的对象大小。
	putSize int64
	// putBytes 表示最近一次上传收到的对象内容。
	putBytes []byte
	// putErr 表示上传对象时需要返回的错误。
	putErr error
	// previewURL 表示生成预览链接时返回的 URL。
	previewURL string
	// previewKey 表示最近一次预览签名收到的对象 key。
	previewKey string
	// previewExpire 表示最近一次预览签名收到的有效期。
	previewExpire time.Duration
	// previewErr 表示生成预览链接时需要返回的错误。
	previewErr error
}

// PutObject 记录测试上传参数。
// 参数 ctx 表示请求上下文；参数 objectKey 表示对象 key；参数 reader 表示对象内容读取器；参数 size 表示对象大小；参数 contentType 表示对象 MIME 类型。
func (s *fakeStorage) PutObject(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) error {
	s.putObjectKey = objectKey
	s.putContentType = contentType
	s.putSize = size
	data, err := io.ReadAll(reader)
	if err != nil {
		return err
	}
	s.putBytes = data
	return s.putErr
}

// PresignedGetObject 记录测试预览签名参数。
// 参数 ctx 表示请求上下文；参数 objectKey 表示对象 key；参数 expires 表示预签名链接有效期。
func (s *fakeStorage) PresignedGetObject(ctx context.Context, objectKey string, expires time.Duration) (string, error) {
	s.previewKey = objectKey
	s.previewExpire = expires
	if s.previewURL == "" {
		s.previewURL = "https://example.test/preview"
	}
	return s.previewURL, s.previewErr
}

// TestUploadImageValidation 验证图片上传业务的用途、文件大小和 MIME 校验。
// 参数 t 表示测试上下文。
func TestUploadImageValidation(t *testing.T) {
	service := newTestService(&fakeStorage{})

	tests := []struct {
		// name 表示测试名称。
		name string
		// req 表示图片上传请求参数。
		req UploadImageRequest
		// wantErr 表示期望返回的业务错误。
		wantErr error
	}{
		{
			name: "用途非法",
			req: UploadImageRequest{
				Usage:   "avatar",
				Size:    int64(len(validPNG)),
				Content: bytes.NewReader(validPNG),
			},
			wantErr: ErrInvalidUsage,
		},
		{
			name: "缺少文件",
			req: UploadImageRequest{
				Usage: UsageCover,
				Size:  int64(len(validPNG)),
			},
			wantErr: ErrFileRequired,
		},
		{
			name: "空文件",
			req: UploadImageRequest{
				Usage:   UsageCover,
				Size:    0,
				Content: bytes.NewReader(nil),
			},
			wantErr: ErrEmptyFile,
		},
		{
			name: "文件超限",
			req: UploadImageRequest{
				Usage:   UsageCover,
				Size:    service.MaxUploadSizeBytes() + 1,
				Content: bytes.NewReader(validPNG),
			},
			wantErr: ErrFileTooLarge,
		},
		{
			name: "非法 MIME",
			req: UploadImageRequest{
				Usage:   UsageCover,
				Size:    int64(len("not image")),
				Content: strings.NewReader("not image"),
			},
			wantErr: ErrUnsupportedContentType,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.UploadImage(context.Background(), tt.req)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("错误不符合预期: got %v, want %v", err, tt.wantErr)
			}
		})
	}
}

// TestUploadImageSuccess 验证合法图片会上传到对象存储并返回预览链接。
// 参数 t 表示测试上下文。
func TestUploadImageSuccess(t *testing.T) {
	storage := &fakeStorage{previewURL: "https://example.test/signed"}
	service := newTestService(storage)
	service.now = func() time.Time {
		return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	}

	resp, err := service.UploadImage(context.Background(), UploadImageRequest{
		Usage:            " cover ",
		OriginalFilename: `C:\tmp\cover.png`,
		Size:             int64(len(validPNG)),
		Content:          bytes.NewReader(validPNG),
	})
	if err != nil {
		t.Fatalf("上传图片失败: %v", err)
	}

	if !strings.HasPrefix(resp.ObjectKey, "covers/2026/01/") || !strings.HasSuffix(resp.ObjectKey, ".png") {
		t.Fatalf("对象 key 不符合预期: %s", resp.ObjectKey)
	}
	if resp.PreviewURL != "https://example.test/signed" {
		t.Fatalf("预览链接不符合预期: %s", resp.PreviewURL)
	}
	if !resp.PreviewExpiresAt.Equal(time.Date(2026, 1, 3, 3, 4, 5, 0, time.UTC)) {
		t.Fatalf("预览过期时间不符合预期: %s", resp.PreviewExpiresAt)
	}
	if resp.ContentType != "image/png" {
		t.Fatalf("MIME 类型不符合预期: %s", resp.ContentType)
	}
	if resp.OriginalFilename != "cover.png" {
		t.Fatalf("原始文件名不符合预期: %s", resp.OriginalFilename)
	}
	if storage.putObjectKey != resp.ObjectKey {
		t.Fatalf("上传对象 key 不符合预期: %s", storage.putObjectKey)
	}
	if storage.putContentType != "image/png" {
		t.Fatalf("上传 MIME 类型不符合预期: %s", storage.putContentType)
	}
	if storage.putSize != int64(len(validPNG)) {
		t.Fatalf("上传大小不符合预期: %d", storage.putSize)
	}
	if !bytes.Equal(storage.putBytes, validPNG) {
		t.Fatalf("上传内容不符合预期: %v", storage.putBytes)
	}
}

// TestUploadImageSkipsPutObjectWhenPreviewFails 验证预览链接生成失败时不会写入对象存储。
// 参数 t 表示测试上下文。
func TestUploadImageSkipsPutObjectWhenPreviewFails(t *testing.T) {
	storage := &fakeStorage{previewErr: errors.New("preview failed")}
	service := newTestService(storage)

	_, err := service.UploadImage(context.Background(), UploadImageRequest{
		Usage:            UsageCover,
		OriginalFilename: "cover.png",
		Size:             int64(len(validPNG)),
		Content:          bytes.NewReader(validPNG),
	})
	if err == nil {
		t.Fatal("预览链接生成失败时应该返回错误")
	}
	if storage.putObjectKey != "" {
		t.Fatalf("不应该写入对象存储: %s", storage.putObjectKey)
	}
}

// TestPreviewValidation 验证刷新预览链接会拒绝非法对象 key。
// 参数 t 表示测试上下文。
func TestPreviewValidation(t *testing.T) {
	tests := []struct {
		// name 表示测试名称。
		name string
		// objectKey 表示待刷新预览的对象 key。
		objectKey string
		// wantErr 表示期望返回的业务错误。
		wantErr error
	}{
		{name: "空 key", objectKey: "", wantErr: ErrInvalidObjectKey},
		{name: "绝对路径", objectKey: "/covers/a.png", wantErr: ErrInvalidObjectKey},
		{name: "包含上级目录", objectKey: "covers/../a.png", wantErr: ErrInvalidObjectKey},
		{name: "不在允许前缀", objectKey: "other/a.png", wantErr: ErrInvalidObjectKey},
		{name: "包含反斜杠", objectKey: `covers\2026\a.png`, wantErr: ErrInvalidObjectKey},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := newTestService(&fakeStorage{})
			_, err := service.Preview(context.Background(), PreviewRequest{ObjectKey: tt.objectKey})
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("错误不符合预期: got %v, want %v", err, tt.wantErr)
			}
		})
	}
}

// TestPreviewSuccess 验证合法对象 key 可以刷新预签名预览链接。
// 参数 t 表示测试上下文。
func TestPreviewSuccess(t *testing.T) {
	storage := &fakeStorage{previewURL: "https://example.test/character"}
	service := newTestService(storage)
	service.now = func() time.Time {
		return time.Date(2026, 6, 14, 12, 0, 0, 0, time.UTC)
	}

	resp, err := service.Preview(context.Background(), PreviewRequest{
		ObjectKey: "characters/2026/06/a.jpg",
	})
	if err != nil {
		t.Fatalf("刷新预览链接失败: %v", err)
	}

	if resp.ObjectKey != "characters/2026/06/a.jpg" {
		t.Fatalf("对象 key 不符合预期: %s", resp.ObjectKey)
	}
	if resp.PreviewURL != "https://example.test/character" {
		t.Fatalf("预览链接不符合预期: %s", resp.PreviewURL)
	}
	if !resp.PreviewExpiresAt.Equal(time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)) {
		t.Fatalf("预览过期时间不符合预期: %s", resp.PreviewExpiresAt)
	}
	if storage.previewKey != "characters/2026/06/a.jpg" {
		t.Fatalf("签名对象 key 不符合预期: %s", storage.previewKey)
	}
	if storage.previewExpire != 24*time.Hour {
		t.Fatalf("签名有效期不符合预期: %s", storage.previewExpire)
	}
}

// TestPreviewExpireIsClampedToS3Limit 验证预览有效期会被限制在 S3 预签名允许范围内。
// 参数 t 表示测试上下文。
func TestPreviewExpireIsClampedToS3Limit(t *testing.T) {
	storage := &fakeStorage{previewURL: "https://example.test/cover"}
	service := NewService(&appconfig.AppConfig{
		Storage: appconfig.StorageConfig{
			S3: appconfig.S3Config{
				PreviewExpire:   8760 * time.Hour,
				MaxUploadSizeMB: 1,
				CoverPrefix:     "covers",
				CharacterPrefix: "characters",
			},
		},
	}, storage)
	service.now = func() time.Time {
		return time.Date(2026, 6, 14, 13, 0, 0, 0, time.UTC)
	}

	resp, err := service.Preview(context.Background(), PreviewRequest{
		ObjectKey: "covers/2026/06/a.png",
	})
	if err != nil {
		t.Fatalf("刷新预览链接失败: %v", err)
	}

	if storage.previewExpire != 7*24*time.Hour {
		t.Fatalf("预览有效期不符合 S3 上限: %s", storage.previewExpire)
	}
	if !resp.PreviewExpiresAt.Equal(time.Date(2026, 6, 21, 13, 0, 0, 0, time.UTC)) {
		t.Fatalf("预览过期时间不符合预期: %s", resp.PreviewExpiresAt)
	}
}

// newTestService 创建用于业务测试的上传服务。
// 参数 storage 表示测试使用的对象存储实现。
func newTestService(storage ObjectStorage) *Service {
	return NewService(&appconfig.AppConfig{
		Storage: appconfig.StorageConfig{
			S3: appconfig.S3Config{
				PreviewExpire:   24 * time.Hour,
				MaxUploadSizeMB: 1,
				CoverPrefix:     "covers",
				CharacterPrefix: "characters",
			},
		},
	}, storage)
}
