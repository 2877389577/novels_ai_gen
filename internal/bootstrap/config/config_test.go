package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// TestInitRequiresConfigFile 验证初始化配置时必须传入实际配置文件路径。
// 参数 t 表示测试上下文。
func TestInitRequiresConfigFile(t *testing.T) {
	_, err := Init("")
	if err == nil {
		t.Fatal("空配置文件路径应该返回错误")
	}

	if err.Error() != "config file required" {
		t.Fatalf("错误信息不符合预期: %v", err)
	}
}

// TestInitLoadsS3Defaults 验证 S3 对象存储配置默认值会被正确解析。
// 参数 t 表示测试上下文。
func TestInitLoadsS3Defaults(t *testing.T) {
	configFile := writeConfigFile(t, `
server:
  port: 8080
  host: 127.0.0.1
storage:
  s3:
    endpoint: s3.example.com
    access_key: test-access
    secret_key: test-secret
    bucket: images
`)

	cfg, err := Init(configFile)
	if err != nil {
		t.Fatalf("初始化配置失败: %v", err)
	}

	if cfg.Storage.S3.Endpoint != "s3.example.com" {
		t.Fatalf("endpoint 不符合预期: %s", cfg.Storage.S3.Endpoint)
	}
	if cfg.Storage.S3.BucketLookup != "auto" {
		t.Fatalf("bucket_lookup 默认值不符合预期: %s", cfg.Storage.S3.BucketLookup)
	}
	if cfg.Storage.S3.PreviewExpire != 24*time.Hour {
		t.Fatalf("preview_expire 默认值不符合预期: %s", cfg.Storage.S3.PreviewExpire)
	}
	if cfg.Storage.S3.MaxUploadSizeMB != 20 {
		t.Fatalf("max_upload_size_mb 默认值不符合预期: %d", cfg.Storage.S3.MaxUploadSizeMB)
	}
	if cfg.Storage.S3.CoverPrefix != "covers" {
		t.Fatalf("cover_prefix 默认值不符合预期: %s", cfg.Storage.S3.CoverPrefix)
	}
	if cfg.Storage.S3.CharacterPrefix != "characters" {
		t.Fatalf("character_prefix 默认值不符合预期: %s", cfg.Storage.S3.CharacterPrefix)
	}
}

// TestInitLoadsS3ExplicitValues 验证 S3 对象存储配置显式值会覆盖默认值。
// 参数 t 表示测试上下文。
func TestInitLoadsS3ExplicitValues(t *testing.T) {
	configFile := writeConfigFile(t, `
server:
  port: 8080
  host: 127.0.0.1
storage:
  s3:
    endpoint: https://s3.example.com
    access_key: test-access
    secret_key: test-secret
    bucket: images
    region: cn-east-1
    use_ssl: true
    bucket_lookup: path
    preview_expire: 12h
    max_upload_size_mb: 8
    cover_prefix: book-covers
    character_prefix: roles
`)

	cfg, err := Init(configFile)
	if err != nil {
		t.Fatalf("初始化配置失败: %v", err)
	}

	if cfg.Storage.S3.Region != "cn-east-1" {
		t.Fatalf("region 不符合预期: %s", cfg.Storage.S3.Region)
	}
	if !cfg.Storage.S3.UseSSL {
		t.Fatal("use_ssl 应该为 true")
	}
	if cfg.Storage.S3.BucketLookup != "path" {
		t.Fatalf("bucket_lookup 不符合预期: %s", cfg.Storage.S3.BucketLookup)
	}
	if cfg.Storage.S3.PreviewExpire != 12*time.Hour {
		t.Fatalf("preview_expire 不符合预期: %s", cfg.Storage.S3.PreviewExpire)
	}
	if cfg.Storage.S3.MaxUploadSizeMB != 8 {
		t.Fatalf("max_upload_size_mb 不符合预期: %d", cfg.Storage.S3.MaxUploadSizeMB)
	}
	if cfg.Storage.S3.CoverPrefix != "book-covers" {
		t.Fatalf("cover_prefix 不符合预期: %s", cfg.Storage.S3.CoverPrefix)
	}
	if cfg.Storage.S3.CharacterPrefix != "roles" {
		t.Fatalf("character_prefix 不符合预期: %s", cfg.Storage.S3.CharacterPrefix)
	}
}

// writeConfigFile 写入测试配置文件并返回文件路径。
// 参数 t 表示测试上下文；参数 content 表示配置文件内容。
func writeConfigFile(t *testing.T, content string) string {
	t.Helper()

	configFile := filepath.Join(t.TempDir(), "config.yaml")
	if err := os.WriteFile(configFile, []byte(content), 0o600); err != nil {
		t.Fatalf("写入测试配置失败: %v", err)
	}
	return configFile
}
