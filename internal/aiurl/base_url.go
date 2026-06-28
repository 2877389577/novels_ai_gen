package aiurl

import (
	"errors"
	"net/url"
	"strings"
)

const (
	// DefaultOpenAIBaseURL 表示 OpenAI 兼容协议的默认基础地址。
	DefaultOpenAIBaseURL = "https://api.openai.com/v1"
	// DefaultClaudeBaseURL 表示 Claude 协议的默认服务根地址。
	DefaultClaudeBaseURL = "https://api.anthropic.com"
	openAIAPIVersionPath = "v1"
)

var (
	// ErrInvalidBaseURL 表示 AI 提供商服务根地址格式无效。
	ErrInvalidBaseURL = errors.New("invalid ai base url")
)

// NormalizeOpenAIBaseURL 将用户填写的服务地址转换为 OpenAI SDK 期望的基础地址。
// 参数 baseURL 表示用户填写的服务根地址或 OpenAI 兼容 /v1 地址，空值表示使用 SDK 默认地址。
func NormalizeOpenAIBaseURL(baseURL string) (string, error) {
	normalized, err := normalizeBaseURL(baseURL)
	if err != nil || normalized == "" {
		return normalized, err
	}

	parsed, err := url.Parse(normalized)
	if err != nil {
		return "", ErrInvalidBaseURL
	}
	if pathEndsWithSegment(parsed.Path, openAIAPIVersionPath) {
		return normalized, nil
	}

	joined, err := url.JoinPath(normalized, openAIAPIVersionPath)
	if err != nil {
		return "", ErrInvalidBaseURL
	}
	return joined, nil
}

// NormalizeClaudeBaseURL 将用户填写的服务地址转换为 Claude SDK 期望的服务根地址。
// 参数 baseURL 表示用户填写的 Claude 服务根地址，空值表示使用 SDK 默认地址。
func NormalizeClaudeBaseURL(baseURL string) (string, error) {
	return normalizeBaseURL(baseURL)
}

// OpenAIModelListURL 返回 OpenAI 兼容协议的模型列表接口地址。
// 参数 baseURL 表示用户填写的服务根地址或 OpenAI 兼容 /v1 地址，空值表示使用默认地址。
func OpenAIModelListURL(baseURL string) (string, error) {
	normalized, err := NormalizeOpenAIBaseURL(baseURL)
	if err != nil {
		return "", err
	}
	if normalized == "" {
		normalized = DefaultOpenAIBaseURL
	}
	return joinBasePath(normalized, "models")
}

// ClaudeModelListURL 返回 Claude 协议的模型列表接口地址。
// 参数 baseURL 表示用户填写的 Claude 服务根地址，空值表示使用默认地址。
func ClaudeModelListURL(baseURL string) (string, error) {
	normalized, err := NormalizeClaudeBaseURL(baseURL)
	if err != nil {
		return "", err
	}
	if normalized == "" {
		normalized = DefaultClaudeBaseURL
	}
	return joinBasePath(normalized, "v1", "models")
}

// normalizeBaseURL 清理并校验用户填写的 AI 服务基础地址。
// 参数 baseURL 表示用户填写的 AI 服务基础地址，空值会被保留为空字符串。
func normalizeBaseURL(baseURL string) (string, error) {
	base := strings.TrimSpace(baseURL)
	if base == "" {
		return "", nil
	}

	parsed, err := url.Parse(base)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", ErrInvalidBaseURL
	}
	return strings.TrimRight(parsed.String(), "/"), nil
}

// joinBasePath 将路径片段追加到已校验的基础地址后。
// 参数 baseURL 表示已经标准化的基础地址；参数 pathElems 表示需要追加的路径片段。
func joinBasePath(baseURL string, pathElems ...string) (string, error) {
	joined, err := url.JoinPath(strings.TrimRight(baseURL, "/"), pathElems...)
	if err != nil {
		return "", ErrInvalidBaseURL
	}
	return joined, nil
}

// pathEndsWithSegment 判断 URL 路径是否以指定片段结尾。
// 参数 pathValue 表示 URL path；参数 segment 表示需要匹配的最后一个路径片段。
func pathEndsWithSegment(pathValue string, segment string) bool {
	parts := strings.Split(strings.Trim(pathValue, "/"), "/")
	if len(parts) == 0 {
		return false
	}
	return parts[len(parts)-1] == segment
}
