package upload

import "errors"

var (
	// ErrInvalidUsage 表示图片用途不受支持。
	ErrInvalidUsage = errors.New("invalid upload usage")
	// ErrFileRequired 表示上传请求缺少图片文件。
	ErrFileRequired = errors.New("upload file required")
	// ErrEmptyFile 表示上传的图片文件为空。
	ErrEmptyFile = errors.New("upload file empty")
	// ErrFileTooLarge 表示上传的图片超过大小限制。
	ErrFileTooLarge = errors.New("upload file too large")
	// ErrUnsupportedContentType 表示上传文件内容不是受支持的图片类型。
	ErrUnsupportedContentType = errors.New("unsupported image content type")
	// ErrInvalidObjectKey 表示对象 key 不符合安全约束。
	ErrInvalidObjectKey = errors.New("invalid object key")
	// ErrStorageUnavailable 表示对象存储服务未正确初始化。
	ErrStorageUnavailable = errors.New("object storage unavailable")
)
