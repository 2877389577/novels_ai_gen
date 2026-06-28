package aiprovider

import "errors"

var (
	// ErrNotFound 表示 AI 提供商不存在。
	ErrNotFound = errors.New("ai provider not found")
	// ErrNameRequired 表示 AI 提供商名称不能为空。
	ErrNameRequired = errors.New("ai provider name required")
	// ErrProviderTypeRequired 表示模型 API 协议不能为空。
	ErrProviderTypeRequired = errors.New("ai provider type required")
	// ErrInvalidProviderType 表示模型 API 协议不在允许范围内。
	ErrInvalidProviderType = errors.New("ai provider type invalid")
	// ErrAPIKeyRequired 表示 AI 提供商 API Key 不能为空。
	ErrAPIKeyRequired = errors.New("ai provider api key required")
	// ErrInvalidPriority 表示 AI 提供商排序优先级不能小于 0。
	ErrInvalidPriority = errors.New("ai provider priority invalid")
	// ErrInvalidBaseURL 表示 AI 提供商服务根地址格式无效。
	ErrInvalidBaseURL = errors.New("ai provider base url invalid")
	// ErrInvalidHTTPProxy 表示 AI 提供商 HTTP 代理地址格式无效。
	ErrInvalidHTTPProxy = errors.New("ai provider http proxy invalid")
	// ErrModelListUnavailable 表示官方模型列表接口暂时不可用。
	ErrModelListUnavailable = errors.New("ai provider model list unavailable")
	// ErrModelListInvalid 表示官方模型列表响应格式无效。
	ErrModelListInvalid = errors.New("ai provider model list invalid")
	// ErrNameConflict 表示 AI 提供商名称已存在。
	ErrNameConflict = errors.New("ai provider name conflict")
	// ErrProviderSecretKeyRequired 表示 AI 提供商 API Key 加密密钥不能为空。
	ErrProviderSecretKeyRequired = errors.New("ai provider secret key required")
	// ErrProviderSecretKeyInvalid 表示 AI 提供商 API Key 加密密钥无法用于初始化。
	ErrProviderSecretKeyInvalid = errors.New("ai provider secret key invalid")
	// ErrCiphertextInvalid 表示 AI 提供商 API Key 密文格式无效。
	ErrCiphertextInvalid = errors.New("ai provider ciphertext invalid")
)
