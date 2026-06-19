package novelagent

import "errors"

var (
	// ErrProviderIDRequired 表示 AI 提供商 ID 不能为空。
	ErrProviderIDRequired = errors.New("novel agent provider id required")
	// ErrModelRequired 表示 AI 模型不能为空。
	ErrModelRequired = errors.New("novel agent model required")
	// ErrMessageRequired 表示用户消息不能为空。
	ErrMessageRequired = errors.New("novel agent message required")
	// ErrChapterContextInvalid 表示章节上下文参数必须同时提供或同时为空。
	ErrChapterContextInvalid = errors.New("novel agent chapter context invalid")
	// ErrProviderDisabled 表示 AI 提供商未启用。
	ErrProviderDisabled = errors.New("novel agent provider disabled")
	// ErrAgentNotConfigured 表示小说写作 Agent 配置未提供。
	ErrAgentNotConfigured = errors.New("novel agent not configured")
	// ErrAgentConfigInvalid 表示小说写作 Agent 配置内容不合法。
	ErrAgentConfigInvalid = errors.New("novel agent config invalid")
	// ErrModelFactoryUnavailable 表示模型工厂不可用。
	ErrModelFactoryUnavailable = errors.New("novel agent model factory unavailable")
	// ErrModelStreamFailed 表示模型流式生成失败。
	ErrModelStreamFailed = errors.New("novel agent model stream failed")
)
