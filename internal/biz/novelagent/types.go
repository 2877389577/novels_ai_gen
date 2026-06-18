package novelagent

import (
	"context"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// ChatRequest 表示小说写作 Agent 流式对话请求。
type ChatRequest struct {
	// ProviderID 表示本次对话使用的 AI 提供商 ID。
	ProviderID uint64 `json:"provider_id" binding:"required" example:"1"`
	// Model 表示本次对话使用的模型标识。
	Model string `json:"model" binding:"required" example:"gpt-5"`
	// Message 表示用户输入的写作需求或问题。
	Message string `json:"message" binding:"required" example:"帮我润色这一段，让语气更紧张"`
	// PromptParams 表示前端传入的提示词占位符参数，键对应模板中的变量名。
	PromptParams map[string]string `json:"prompt_params" example:"text:雨夜里，门外响起了脚步声。"`
}

// StreamEvent 表示小说写作 Agent NDJSON 流事件。
type StreamEvent struct {
	// Type 表示事件类型，支持 meta、delta、done、error。
	Type string `json:"type" example:"delta"`
	// RequestID 表示本次流式请求的追踪标识，用于和后端日志关联。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Stage 表示 meta 事件所处阶段。
	Stage string `json:"stage,omitempty" example:"routed"`
	// Task 表示顶层 Agent 选择的任务类型。
	Task string `json:"task,omitempty" example:"polish"`
	// Content 表示增量文本或完整文本内容。
	Content string `json:"content,omitempty" example:"雨夜里，门外的脚步声一点点逼近。"`
	// Message 表示错误或状态说明。
	Message string `json:"message,omitempty" example:"ok"`
}

// EventWriter 表示 Agent 流事件写出器。
type EventWriter interface {
	// WriteEvent 写出一个流事件。
	// 参数 event 表示需要写出的 NDJSON 事件。
	WriteEvent(event StreamEvent) error
}

// ModelConfig 表示创建 Eino 文本模型所需的运行时配置。
type ModelConfig struct {
	// ProviderType 表示 AI 提供商类型。
	ProviderType string
	// APIType 表示 AI 接口类型。
	APIType string
	// APIKey 表示解密后的 AI 提供商 API Key。
	APIKey string
	// BaseURL 表示 AI 提供商接口基础地址。
	BaseURL string
	// Model 表示本次对话使用的模型标识。
	Model string
}

// AgentDelta 表示 Agent 流式生成的文本增量。
type AgentDelta struct {
	// Task 表示产生该增量的任务来源，direct 表示顶层 Agent 直接回答。
	Task string
	// Content 表示模型生成的增量文本。
	Content string
}

// AgentResult 表示 Agent 流式对话完成后的结果。
type AgentResult struct {
	// Task 表示最终产生回复的任务来源。
	Task string
	// Content 表示完整的模型回复文本。
	Content string
}

// AgentRuntime 表示可执行小说写作多层 Agent 的运行时。
type AgentRuntime interface {
	// Stream 流式执行小说写作 Agent。
	// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 emit 表示文本增量回调。
	Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, emit func(delta AgentDelta) error) (AgentResult, error)
}

// AgentRuntimeFactory 表示 Eino 多层 Agent 运行时工厂。
type AgentRuntimeFactory interface {
	// NewRuntime 按提供商协议创建小说写作 Agent 运行时。
	// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
	NewRuntime(ctx context.Context, cfg ModelConfig) (AgentRuntime, error)
}
