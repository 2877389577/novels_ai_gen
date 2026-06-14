package upload

import (
	"context"
	"io"
	"time"
)

const (
	// UsageCover 表示上传图片用于小说封面。
	UsageCover = "cover"
	// UsageCharacter 表示上传图片用于人物图片。
	UsageCharacter = "character"
)

// ObjectStorage 表示上传业务依赖的对象存储能力。
type ObjectStorage interface {
	// PutObject 保存对象到对象存储。
	// 参数 ctx 表示请求上下文；参数 objectKey 表示对象 key；参数 reader 表示对象内容读取器；参数 size 表示对象大小；参数 contentType 表示对象 MIME 类型。
	PutObject(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) error
	// PresignedGetObject 生成私有对象的预签名读取链接。
	// 参数 ctx 表示请求上下文；参数 objectKey 表示对象 key；参数 expires 表示预签名链接有效期。
	PresignedGetObject(ctx context.Context, objectKey string, expires time.Duration) (string, error)
}

// UploadImageRequest 表示图片上传请求参数。
type UploadImageRequest struct {
	// Usage 表示图片用途，只允许 cover 或 character。
	Usage string
	// OriginalFilename 表示用户上传文件的原始文件名。
	OriginalFilename string
	// Size 表示上传文件大小，单位为字节。
	Size int64
	// Content 表示上传文件内容读取器。
	Content io.Reader
}

// UploadImageResponse 表示图片上传成功后的响应数据。
type UploadImageResponse struct {
	// ObjectKey 表示图片保存在对象存储中的对象 key。
	ObjectKey string `json:"object_key" example:"covers/2026/06/9f1c1c0a1b2c3d4e.png"`
	// PreviewURL 表示可直接预览私有图片的预签名链接。
	PreviewURL string `json:"preview_url" example:"https://s3.example.com/bucket/covers/2026/06/example.png?X-Amz-Signature=..."`
	// PreviewExpiresAt 表示预签名预览链接过期时间。
	PreviewExpiresAt time.Time `json:"preview_expires_at" example:"2026-06-15T22:00:00+08:00"`
	// ContentType 表示根据文件内容探测出的 MIME 类型。
	ContentType string `json:"content_type" example:"image/png"`
	// Size 表示上传文件大小，单位为字节。
	Size int64 `json:"size" example:"1024"`
	// OriginalFilename 表示用户上传文件的原始文件名。
	OriginalFilename string `json:"original_filename" example:"cover.png"`
}

// PreviewRequest 表示刷新图片预览链接的请求参数。
type PreviewRequest struct {
	// ObjectKey 表示需要刷新预览链接的对象 key。
	ObjectKey string `form:"object_key" example:"covers/2026/06/9f1c1c0a1b2c3d4e.png"`
}

// PreviewResponse 表示刷新图片预览链接后的响应数据。
type PreviewResponse struct {
	// ObjectKey 表示图片保存在对象存储中的对象 key。
	ObjectKey string `json:"object_key" example:"covers/2026/06/9f1c1c0a1b2c3d4e.png"`
	// PreviewURL 表示可直接预览私有图片的预签名链接。
	PreviewURL string `json:"preview_url" example:"https://s3.example.com/bucket/covers/2026/06/example.png?X-Amz-Signature=..."`
	// PreviewExpiresAt 表示预签名预览链接过期时间。
	PreviewExpiresAt time.Time `json:"preview_expires_at" example:"2026-06-15T22:00:00+08:00"`
}
