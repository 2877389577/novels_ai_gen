package aiprovider

import "errors"

var (
	// ErrNotFound 表示 AI 提供商不存在。
	ErrNotFound = errors.New("ai provider not found")
	// ErrNameRequired 表示 AI 提供商名称不能为空。
	ErrNameRequired = errors.New("ai provider name required")
	// ErrProviderTypeRequired 表示 AI 提供商类型不能为空。
	ErrProviderTypeRequired = errors.New("ai provider type required")
	// ErrInvalidProviderType 表示 AI 提供商类型不在允许范围内。
	ErrInvalidProviderType = errors.New("ai provider type invalid")
	// ErrAPIKeyRequired 表示 AI 提供商 API Key 不能为空。
	ErrAPIKeyRequired = errors.New("ai provider api key required")
	// ErrModelRequired 表示 AI 提供商模型名称不能为空。
	ErrModelRequired = errors.New("ai provider model required")
	// ErrInvalidAPIType 表示 AI 接口类型不在允许范围内。
	ErrInvalidAPIType = errors.New("ai provider api type invalid")
	// ErrInvalidMaxTokens 表示最大输出 token 数必须大于 0。
	ErrInvalidMaxTokens = errors.New("ai provider max tokens invalid")
	// ErrInvalidTemperature 表示 temperature 不能小于 0。
	ErrInvalidTemperature = errors.New("ai provider temperature invalid")
	// ErrInvalidTopP 表示 top_p 必须在 0 到 1 之间。
	ErrInvalidTopP = errors.New("ai provider top p invalid")
	// ErrInvalidThinkingLevel 表示思考等级不能小于 0。
	ErrInvalidThinkingLevel = errors.New("ai provider thinking level invalid")
	// ErrNameConflict 表示 AI 提供商名称已存在。
	ErrNameConflict = errors.New("ai provider name conflict")
	// ErrProviderSecretKeyRequired 表示 AI 提供商 API Key 加密密钥不能为空。
	ErrProviderSecretKeyRequired = errors.New("ai provider secret key required")
	// ErrProviderSecretKeyInvalid 表示 AI 提供商 API Key 加密密钥无法用于初始化。
	ErrProviderSecretKeyInvalid = errors.New("ai provider secret key invalid")
	// ErrCiphertextInvalid 表示 AI 提供商 API Key 密文格式无效。
	ErrCiphertextInvalid = errors.New("ai provider ciphertext invalid")
)
