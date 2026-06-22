package novelagent

import "errors"

var (
	// ErrMessageRequired 表示用户消息不能为空。
	ErrMessageRequired = errors.New("novel agent message required")
	// ErrNovelIDRequired 表示小说 ID 不能为空。
	ErrNovelIDRequired = errors.New("novel agent novel id required")
	// ErrChapterNumberInvalid 表示章节号不能为负数。
	ErrChapterNumberInvalid = errors.New("novel agent chapter number invalid")
	// ErrChapterContextInvalid 表示章节上下文缺少小说 ID。
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
	// ErrAgentMemoryFailed 表示 Agent 记忆读取或写入失败。
	ErrAgentMemoryFailed = errors.New("novel agent memory failed")
	// ErrConversationNotFound 表示 Agent 会话不存在或不属于当前小说。
	ErrConversationNotFound = errors.New("novel agent conversation not found")
)
