package upload

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"path"
	"strings"
	"time"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

const (
	defaultPreviewExpire   = 24 * time.Hour
	minPreviewExpire       = time.Second
	maxPreviewExpire       = 7 * 24 * time.Hour
	defaultMaxUploadSizeMB = int64(20)
	bytesPerMB             = int64(1024 * 1024)
	defaultCoverPrefix     = "covers"
	defaultCharacterPrefix = "characters"
	randomObjectNameBytes  = 16
)

// Service 表示图片上传业务服务。
type Service struct {
	// storage 表示图片保存和预览签名依赖的对象存储。
	storage ObjectStorage
	// previewExpire 表示预签名预览链接有效期。
	previewExpire time.Duration
	// maxUploadSizeBytes 表示单个上传文件允许的最大字节数。
	maxUploadSizeBytes int64
	// coverPrefix 表示小说封面对象 key 的安全前缀。
	coverPrefix string
	// characterPrefix 表示人物图片对象 key 的安全前缀。
	characterPrefix string
	// now 表示获取当前时间的方法。
	now func() time.Time
}

// NewService 创建图片上传业务服务。
// 参数 cfg 表示应用完整配置；参数 storage 表示对象存储实现。
func NewService(cfg *appconfig.AppConfig, storage ObjectStorage) *Service {
	s3 := appconfig.S3Config{}
	if cfg != nil {
		s3 = cfg.Storage.S3
	}

	previewExpire, adjustedPreviewExpire := normalizePreviewExpire(s3.PreviewExpire)
	if adjustedPreviewExpire {
		slog.Warn(
			"图片预览链接有效期已按 S3 预签名限制调整",
			"configured_preview_expire", s3.PreviewExpire.String(),
			"effective_preview_expire", previewExpire.String(),
		)
	}

	maxUploadSizeMB := s3.MaxUploadSizeMB
	if maxUploadSizeMB <= 0 {
		maxUploadSizeMB = defaultMaxUploadSizeMB
	}

	return &Service{
		storage:            storage,
		previewExpire:      previewExpire,
		maxUploadSizeBytes: maxUploadSizeMB * bytesPerMB,
		coverPrefix:        normalizePrefix(s3.CoverPrefix, defaultCoverPrefix),
		characterPrefix:    normalizePrefix(s3.CharacterPrefix, defaultCharacterPrefix),
		now:                time.Now,
	}
}

// UploadImage 校验并上传图片，返回对象 key 和私有预览链接。
// 参数 ctx 表示请求上下文；参数 req 表示图片上传请求参数。
func (s *Service) UploadImage(ctx context.Context, req UploadImageRequest) (UploadImageResponse, error) {
	if s.storage == nil {
		return UploadImageResponse{}, ErrStorageUnavailable
	}

	usage := normalizeUsage(req.Usage)
	if !isSupportedUsage(usage) {
		return UploadImageResponse{}, ErrInvalidUsage
	}
	if req.Content == nil {
		return UploadImageResponse{}, ErrFileRequired
	}
	if req.Size <= 0 {
		return UploadImageResponse{}, ErrEmptyFile
	}
	if req.Size > s.maxUploadSizeBytes {
		return UploadImageResponse{}, ErrFileTooLarge
	}

	header, err := readContentHeader(req.Content)
	if err != nil {
		return UploadImageResponse{}, err
	}

	contentType, ext, ok := detectImageType(header)
	if !ok {
		return UploadImageResponse{}, ErrUnsupportedContentType
	}

	objectKey, err := s.newObjectKey(usage, ext)
	if err != nil {
		return UploadImageResponse{}, err
	}

	previewURL, expiresAt, err := s.createPreview(ctx, objectKey)
	if err != nil {
		return UploadImageResponse{}, err
	}

	reader := io.MultiReader(bytes.NewReader(header), req.Content)
	if err := s.storage.PutObject(ctx, objectKey, reader, req.Size, contentType); err != nil {
		return UploadImageResponse{}, fmt.Errorf("上传图片到对象存储失败: %w", err)
	}

	slog.InfoContext(
		ctx,
		"图片上传到对象存储成功",
		"usage", usage,
		"object_key", objectKey,
		"content_type", contentType,
		"size", req.Size,
	)

	return UploadImageResponse{
		ObjectKey:        objectKey,
		PreviewURL:       previewURL,
		PreviewExpiresAt: expiresAt,
		ContentType:      contentType,
		Size:             req.Size,
		OriginalFilename: sanitizeOriginalFilename(req.OriginalFilename),
	}, nil
}

// Preview 刷新私有图片对象的预签名预览链接。
// 参数 ctx 表示请求上下文；参数 req 表示刷新预览链接请求参数。
func (s *Service) Preview(ctx context.Context, req PreviewRequest) (PreviewResponse, error) {
	if s.storage == nil {
		return PreviewResponse{}, ErrStorageUnavailable
	}

	objectKey := strings.TrimSpace(req.ObjectKey)
	if !s.isAllowedObjectKey(objectKey) {
		return PreviewResponse{}, ErrInvalidObjectKey
	}

	previewURL, expiresAt, err := s.createPreview(ctx, objectKey)
	if err != nil {
		return PreviewResponse{}, err
	}

	return PreviewResponse{
		ObjectKey:        objectKey,
		PreviewURL:       previewURL,
		PreviewExpiresAt: expiresAt,
	}, nil
}

// MaxUploadSizeBytes 返回配置允许的单个图片最大上传字节数。
func (s *Service) MaxUploadSizeBytes() int64 {
	return s.maxUploadSizeBytes
}

// normalizePreviewExpire 标准化预签名预览链接有效期，避免超过 S3 协议限制。
// 参数 value 表示配置中的预览链接有效期。
func normalizePreviewExpire(value time.Duration) (time.Duration, bool) {
	if value <= 0 {
		return defaultPreviewExpire, false
	}
	if value < minPreviewExpire {
		return minPreviewExpire, true
	}
	if value > maxPreviewExpire {
		return maxPreviewExpire, true
	}
	return value, false
}

// createPreview 生成对象的私有预签名预览链接和过期时间。
// 参数 ctx 表示请求上下文；参数 objectKey 表示需要生成预览链接的对象 key。
func (s *Service) createPreview(ctx context.Context, objectKey string) (string, time.Time, error) {
	previewURL, err := s.storage.PresignedGetObject(ctx, objectKey, s.previewExpire)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("生成图片预览链接失败: %w", err)
	}

	return previewURL, s.now().Add(s.previewExpire), nil
}

// newObjectKey 根据图片用途和扩展名生成安全对象 key。
// 参数 usage 表示图片用途；参数 ext 表示由文件内容确定的图片扩展名。
func (s *Service) newObjectKey(usage string, ext string) (string, error) {
	token, err := randomHex(randomObjectNameBytes)
	if err != nil {
		return "", fmt.Errorf("生成图片对象 key 失败: %w", err)
	}

	prefix := s.prefixForUsage(usage)
	now := s.now()
	objectKey := path.Join(prefix, now.Format("2006"), now.Format("01"), token+ext)
	if !s.isAllowedObjectKey(objectKey) {
		return "", ErrInvalidObjectKey
	}

	return objectKey, nil
}

// prefixForUsage 返回指定图片用途对应的对象 key 前缀。
// 参数 usage 表示图片用途。
func (s *Service) prefixForUsage(usage string) string {
	if usage == UsageCharacter {
		return s.characterPrefix
	}
	return s.coverPrefix
}

// isAllowedObjectKey 判断对象 key 是否落在允许的图片前缀下且不包含危险路径片段。
// 参数 objectKey 表示需要校验的对象 key。
func (s *Service) isAllowedObjectKey(objectKey string) bool {
	if !isSafeObjectKey(objectKey) {
		return false
	}
	return hasObjectPrefix(objectKey, s.coverPrefix) || hasObjectPrefix(objectKey, s.characterPrefix)
}

// readContentHeader 读取用于 MIME 探测的文件头内容。
// 参数 reader 表示上传文件内容读取器。
func readContentHeader(reader io.Reader) ([]byte, error) {
	header := make([]byte, 512)
	n, err := io.ReadFull(reader, header)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return nil, fmt.Errorf("读取上传图片内容失败: %w", err)
	}
	if n == 0 {
		return nil, ErrEmptyFile
	}
	return header[:n], nil
}

// detectImageType 根据文件内容探测受支持的图片 MIME 类型和扩展名。
// 参数 sample 表示上传文件开头的内容样本。
func detectImageType(sample []byte) (string, string, bool) {
	if isWebP(sample) {
		return "image/webp", ".webp", true
	}

	switch http.DetectContentType(sample) {
	case "image/jpeg":
		return "image/jpeg", ".jpg", true
	case "image/png":
		return "image/png", ".png", true
	case "image/gif":
		return "image/gif", ".gif", true
	case "image/webp":
		return "image/webp", ".webp", true
	default:
		return "", "", false
	}
}

// isWebP 判断内容样本是否符合 WebP 文件签名。
// 参数 sample 表示上传文件开头的内容样本。
func isWebP(sample []byte) bool {
	return len(sample) >= 12 &&
		bytes.Equal(sample[0:4], []byte("RIFF")) &&
		bytes.Equal(sample[8:12], []byte("WEBP"))
}

// randomHex 生成指定字节数的安全随机十六进制字符串。
// 参数 byteCount 表示需要读取的随机字节数。
func randomHex(byteCount int) (string, error) {
	buf := make([]byte, byteCount)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("读取安全随机数失败: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// normalizeUsage 标准化图片用途字符串。
// 参数 usage 表示用户提交的图片用途。
func normalizeUsage(usage string) string {
	return strings.ToLower(strings.TrimSpace(usage))
}

// isSupportedUsage 判断图片用途是否受支持。
// 参数 usage 表示标准化后的图片用途。
func isSupportedUsage(usage string) bool {
	return usage == UsageCover || usage == UsageCharacter
}

// normalizePrefix 标准化对象 key 前缀，配置无效时使用默认前缀。
// 参数 prefix 表示配置中的对象 key 前缀；参数 fallback 表示默认前缀。
func normalizePrefix(prefix string, fallback string) string {
	prefix = strings.Trim(strings.TrimSpace(prefix), "/")
	if !isSafePrefix(prefix) {
		return fallback
	}
	return prefix
}

// isSafePrefix 判断配置的对象 key 前缀是否安全。
// 参数 prefix 表示需要校验的对象 key 前缀。
func isSafePrefix(prefix string) bool {
	return prefix != "" &&
		!strings.Contains(prefix, "\\") &&
		!strings.Contains(prefix, "..") &&
		!path.IsAbs(prefix) &&
		path.Clean(prefix) == prefix
}

// isSafeObjectKey 判断对象 key 是否满足基础路径安全规则。
// 参数 objectKey 表示需要校验的对象 key。
func isSafeObjectKey(objectKey string) bool {
	return objectKey != "" &&
		!strings.Contains(objectKey, "\\") &&
		!strings.Contains(objectKey, "..") &&
		!path.IsAbs(objectKey) &&
		path.Clean(objectKey) == objectKey
}

// hasObjectPrefix 判断对象 key 是否落在指定前缀下。
// 参数 objectKey 表示需要校验的对象 key；参数 prefix 表示允许的对象 key 前缀。
func hasObjectPrefix(objectKey string, prefix string) bool {
	return strings.HasPrefix(objectKey, prefix+"/")
}

// sanitizeOriginalFilename 清理用户上传文件名，避免把本地路径回显给客户端。
// 参数 filename 表示用户上传文件的原始文件名。
func sanitizeOriginalFilename(filename string) string {
	filename = strings.TrimSpace(strings.ReplaceAll(filename, "\\", "/"))
	if filename == "" {
		return ""
	}

	base := path.Base(filename)
	if base == "." || base == "/" {
		return ""
	}
	return base
}
