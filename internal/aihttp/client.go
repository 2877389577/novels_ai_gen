package aihttp

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ClientConfig 表示 AI 外部请求专用 HTTP 客户端配置。
type ClientConfig struct {
	// HTTPProxy 表示模型请求使用的 HTTP 代理地址，空值表示严格不使用代理。
	HTTPProxy string
	// UserAgent 表示模型请求需要写入的 User-Agent 头，空值表示不改写。
	UserAgent string
	// Timeout 表示 HTTP 请求超时时间。
	Timeout time.Duration
}

// NewClient 创建 AI 外部请求专用 HTTP 客户端。
// 参数 cfg 表示 HTTP 客户端配置。
func NewClient(cfg ClientConfig) (*http.Client, error) {
	transport, err := NewTransport(cfg.HTTPProxy, cfg.UserAgent)
	if err != nil {
		return nil, err
	}
	return &http.Client{
		Timeout:   cfg.Timeout,
		Transport: transport,
	}, nil
}

// NewTransport 创建 AI 外部请求专用 HTTP 传输层。
// 参数 httpProxy 表示 HTTP 代理地址，空值会禁用环境变量代理；参数 userAgent 表示需要写入的 User-Agent 头。
func NewTransport(httpProxy string, userAgent string) (http.RoundTripper, error) {
	base, ok := http.DefaultTransport.(*http.Transport)
	if !ok {
		return nil, fmt.Errorf("默认 HTTP 传输层类型无效")
	}

	transport := base.Clone()
	transport.Proxy = nil

	proxyURL, err := ParseHTTPProxy(httpProxy)
	if err != nil {
		return nil, err
	}
	if proxyURL != nil {
		transport.Proxy = http.ProxyURL(proxyURL)
	}

	userAgent = strings.TrimSpace(userAgent)
	if userAgent == "" {
		return transport, nil
	}
	return userAgentRoundTripper{
		userAgent: userAgent,
		base:      transport,
	}, nil
}

// ParseHTTPProxy 解析并校验 HTTP 代理地址。
// 参数 value 表示用户填写的 HTTP 代理地址。
func ParseHTTPProxy(value string) (*url.URL, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}

	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("HTTP 代理地址格式无效")
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		return parsed, nil
	default:
		return nil, fmt.Errorf("HTTP 代理地址仅支持 http 或 https 协议")
	}
}

// IsValidHTTPProxy 判断 HTTP 代理地址是否为空或有效。
// 参数 value 表示需要校验的 HTTP 代理地址。
func IsValidHTTPProxy(value string) bool {
	_, err := ParseHTTPProxy(value)
	return err == nil
}

// userAgentRoundTripper 表示为模型请求写入固定 User-Agent 的 HTTP 传输层。
type userAgentRoundTripper struct {
	// userAgent 表示写入请求的 User-Agent 头。
	userAgent string
	// base 表示实际发送请求的底层 RoundTripper。
	base http.RoundTripper
}

// RoundTrip 克隆请求并写入 User-Agent 后交给底层传输层发送。
// 参数 req 表示本次模型请求。
func (t userAgentRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if req == nil {
		return nil, fmt.Errorf("HTTP 请求未初始化")
	}

	base := t.base
	if base == nil {
		base = http.DefaultTransport
	}

	cloned := req.Clone(req.Context())
	cloned.Header = req.Header.Clone()
	if cloned.Header == nil {
		cloned.Header = make(http.Header)
	}
	cloned.Header.Set("User-Agent", t.userAgent)
	return base.RoundTrip(cloned)
}
