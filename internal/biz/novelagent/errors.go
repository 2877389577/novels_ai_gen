package novelagent

import "errors"

var (
	// ErrProviderIDRequired 表示 AI 提供商 ID 不能为空。
	ErrProviderIDRequired = errors.New("novel agent provider id required")
	// ErrModelRequired 表示 AI 模型不能为空。
	ErrModelRequired = errors.New("novel agent model required")
	// ErrMessageRequired 表示用户消息不能为空。
	ErrMessageRequired = errors.New("novel agent message required")
	// ErrProviderDisabled 表示 AI 提供商未启用。
	ErrProviderDisabled = errors.New("novel agent provider disabled")
	// ErrPromptNotConfigured 表示指定任务提示词未配置。
	ErrPromptNotConfigured = errors.New("novel agent prompt not configured")
	// ErrUnsupportedTask 表示当前任务暂不支持。
	ErrUnsupportedTask = errors.New("novel agent task unsupported")
	// ErrPromptVariableMissing 表示提示词模板中存在未提供的变量。
	ErrPromptVariableMissing = errors.New("novel agent prompt variable missing")
	// ErrModelFactoryUnavailable 表示模型工厂不可用。
	ErrModelFactoryUnavailable = errors.New("novel agent model factory unavailable")
	// ErrModelStreamFailed 表示模型流式生成失败。
	ErrModelStreamFailed = errors.New("novel agent model stream failed")
)
