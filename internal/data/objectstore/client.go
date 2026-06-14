package objectstore

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/url"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// Client 表示基于 S3 兼容协议的对象存储客户端。
type Client struct {
	// minioClient 表示 MinIO Go SDK 客户端。
	minioClient *minio.Client
	// bucket 表示图片对象保存的 bucket 名称。
	bucket string
}

// NewClient 创建 S3 兼容对象存储客户端。
// 参数 cfg 表示应用完整配置。
func NewClient(cfg *appconfig.AppConfig) (*Client, error) {
	if cfg == nil {
		return nil, errors.New("应用配置不能为空")
	}

	s3 := cfg.Storage.S3
	endpoint, useSSL, err := normalizeEndpoint(s3.Endpoint, s3.UseSSL)
	if err != nil {
		return nil, err
	}

	accessKey := strings.TrimSpace(s3.AccessKey)
	secretKey := strings.TrimSpace(s3.SecretKey)
	bucket := strings.TrimSpace(s3.Bucket)
	if endpoint == "" {
		return nil, errors.New("对象存储 endpoint 不能为空")
	}
	if accessKey == "" {
		return nil, errors.New("对象存储 access key 不能为空")
	}
	if secretKey == "" {
		return nil, errors.New("对象存储 secret key 不能为空")
	}
	if bucket == "" {
		return nil, errors.New("对象存储 bucket 不能为空")
	}

	bucketLookup, err := parseBucketLookup(s3.BucketLookup)
	if err != nil {
		return nil, err
	}

	minioClient, err := minio.New(endpoint, &minio.Options{
		Creds:        credentials.NewStaticV4(accessKey, secretKey, ""),
		Secure:       useSSL,
		Region:       strings.TrimSpace(s3.Region),
		BucketLookup: bucketLookup,
	})
	if err != nil {
		return nil, fmt.Errorf("初始化对象存储客户端失败: %w", err)
	}

	slog.Info(
		"对象存储客户端初始化完成",
		"endpoint", endpoint,
		"bucket", bucket,
		"use_ssl", useSSL,
		"bucket_lookup", bucketLookupName(bucketLookup),
	)

	return &Client{
		minioClient: minioClient,
		bucket:      bucket,
	}, nil
}

// PutObject 上传对象到配置的 bucket。
// 参数 ctx 表示请求上下文；参数 objectKey 表示对象 key；参数 reader 表示对象内容读取器；参数 size 表示对象大小；参数 contentType 表示对象 MIME 类型。
func (c *Client) PutObject(ctx context.Context, objectKey string, reader io.Reader, size int64, contentType string) error {
	if c == nil || c.minioClient == nil {
		return errors.New("对象存储客户端未初始化")
	}

	if _, err := c.minioClient.PutObject(ctx, c.bucket, objectKey, reader, size, minio.PutObjectOptions{
		ContentType: contentType,
	}); err != nil {
		return fmt.Errorf("上传对象失败: %w", err)
	}
	return nil
}

// PresignedGetObject 生成对象的预签名读取链接。
// 参数 ctx 表示请求上下文；参数 objectKey 表示对象 key；参数 expires 表示预签名链接有效期。
func (c *Client) PresignedGetObject(ctx context.Context, objectKey string, expires time.Duration) (string, error) {
	if c == nil || c.minioClient == nil {
		return "", errors.New("对象存储客户端未初始化")
	}

	previewURL, err := c.minioClient.PresignedGetObject(ctx, c.bucket, objectKey, expires, nil)
	if err != nil {
		return "", fmt.Errorf("生成对象预签名链接失败: %w", err)
	}
	return previewURL.String(), nil
}

// normalizeEndpoint 标准化对象存储 endpoint，并根据 URL scheme 修正 SSL 设置。
// 参数 endpoint 表示配置中的对象存储地址；参数 useSSL 表示配置中的 HTTPS 开关。
func normalizeEndpoint(endpoint string, useSSL bool) (string, bool, error) {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return "", useSSL, nil
	}

	if !strings.Contains(endpoint, "://") {
		return endpoint, useSSL, nil
	}

	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", useSSL, fmt.Errorf("解析对象存储 endpoint 失败: %w", err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", useSSL, errors.New("对象存储 endpoint 仅支持 http 或 https")
	}
	if parsed.Host == "" {
		return "", useSSL, errors.New("对象存储 endpoint 主机不能为空")
	}
	if parsed.Path != "" && parsed.Path != "/" {
		return "", useSSL, errors.New("对象存储 endpoint 不能包含路径")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", useSSL, errors.New("对象存储 endpoint 不能包含查询参数或片段")
	}

	return parsed.Host, parsed.Scheme == "https", nil
}

// parseBucketLookup 解析配置中的 bucket 寻址方式。
// 参数 value 表示配置中的 bucket_lookup 字符串。
func parseBucketLookup(value string) (minio.BucketLookupType, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "auto":
		return minio.BucketLookupAuto, nil
	case "dns", "virtual", "virtual_host", "virtual-host":
		return minio.BucketLookupDNS, nil
	case "path", "path_style", "path-style":
		return minio.BucketLookupPath, nil
	default:
		return minio.BucketLookupAuto, fmt.Errorf("不支持的 bucket_lookup: %s", value)
	}
}

// bucketLookupName 返回 bucket 寻址方式对应的日志展示名称。
// 参数 value 表示 MinIO SDK 使用的 bucket 寻址方式。
func bucketLookupName(value minio.BucketLookupType) string {
	switch value {
	case minio.BucketLookupDNS:
		return "dns"
	case minio.BucketLookupPath:
		return "path"
	default:
		return "auto"
	}
}
