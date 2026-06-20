package novelagent

import (
	"context"
	"time"

	biznovel "novels_ai_gen/internal/biz/novel"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// ChatRequest 表示小说写作 Agent 流式对话请求。
type ChatRequest struct {
	// ProviderID 表示本次对话使用的 AI 提供商 ID。
	ProviderID uint64 `json:"provider_id" binding:"required" example:"1"`
	// Model 表示本次对话使用的模型标识。
	Model string `json:"model" example:"gpt-5"`
	// Message 表示用户输入的写作需求或问题。
	Message string `json:"message" binding:"required" example:"帮我润色这一段，让语气更紧张"`
	// NovelID 表示当前请求关联的小说 ID，普通对话可为空。
	NovelID uint64 `json:"novel_id,omitempty" example:"1"`
	// ChapterID 表示当前请求关联的章节 ID，普通对话可为空。
	ChapterID uint64 `json:"chapter_id,omitempty" example:"1"`
}

const (
	// PromptRecommendationActionSearch 表示前端需要按提示词类型查询数据库提示词。
	PromptRecommendationActionSearch = "prompt_search"
	// PromptRecommendationActionNone 表示当前用户输入不需要推荐提示词。
	PromptRecommendationActionNone = "none"
)

// PromptRecommendationRequest 表示提示词库推荐判定请求。
type PromptRecommendationRequest struct {
	// ProviderID 表示本次推荐判定使用的 AI 提供商 ID。
	ProviderID uint64 `json:"provider_id" binding:"required" example:"1"`
	// Model 表示本次推荐判定使用的模型标识，空值时使用提供商默认模型。
	Model string `json:"model" example:"gpt-5"`
	// Message 表示用户当前尚未发送的 AI 输入框原文。
	Message string `json:"message" binding:"required" example:"帮我把这一段润色得更有压迫感"`
}

// PromptRecommendationResponse 表示提示词库推荐判定结果。
type PromptRecommendationResponse struct {
	// Action 表示前端下一步动作，prompt_search 表示查询数据库提示词，none 表示无需推荐。
	Action string `json:"action" example:"prompt_search"`
	// Matched 表示是否匹配到小说修改或润色相关意图。
	Matched bool `json:"matched" example:"true"`
	// PromptType 表示匹配到的提示词类型，不匹配时为空。
	PromptType string `json:"prompt_type" example:"润色"`
}

// MessageRole 表示 Agent 记忆消息角色。
type MessageRole string

const (
	// MessageRoleUser 表示用户发送给 Agent 的消息。
	MessageRoleUser MessageRole = "user"
	// MessageRoleAssistant 表示 Agent 最终返回给用户的助手消息。
	MessageRoleAssistant MessageRole = "assistant"
)

// Conversation 表示小说级 Agent 会话数据库模型。
type Conversation struct {
	// ID 表示 Agent 会话主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:Agent会话主键ID" example:"1"`
	// NovelID 表示会话所属小说 ID，一部小说只保留一条 Agent 会话。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;uniqueIndex:idx_agent_conversations_novel_id;comment:会话所属小说ID，一部小说只保留一条Agent会话" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// Summary 表示已经滚动压缩后的 Agent 长期记忆摘要。
	Summary string `json:"summary,omitempty" gorm:"column:summary;type:text;comment:已经滚动压缩后的Agent长期记忆摘要"`
	// SummaryMessageID 表示已经纳入摘要的最新 Agent 消息 ID。
	SummaryMessageID *uint64 `json:"summary_message_id,omitempty" gorm:"column:summary_message_id;comment:已经纳入摘要的最新Agent消息ID" example:"20"`
	// SummaryUpdatedAt 表示 Agent 长期记忆摘要最近更新时间。
	SummaryUpdatedAt *time.Time `json:"summary_updated_at,omitempty" gorm:"column:summary_updated_at;comment:Agent长期记忆摘要最近更新时间" example:"2026-06-19T22:00:00+08:00"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-19T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-19T22:00:00+08:00"`
}

// TableName 返回 Agent 会话模型对应的数据表名称。
func (Conversation) TableName() string {
	return "agent_conversations"
}

// MessageRecord 表示 Agent 记忆消息数据库模型。
type MessageRecord struct {
	// ID 表示 Agent 消息主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:Agent消息主键ID" example:"1"`
	// ConversationID 表示消息所属 Agent 会话 ID。
	ConversationID uint64 `json:"conversation_id" gorm:"column:conversation_id;not null;index:idx_agent_messages_conversation_created,priority:1;comment:消息所属Agent会话ID" example:"1"`
	// Conversation 表示所属 Agent 会话关联，用于生成外键和级联删除约束。
	Conversation Conversation `json:"-" gorm:"foreignKey:ConversationID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属Agent会话关联"`
	// NovelID 表示消息所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;index:idx_agent_messages_novel_created,priority:1;comment:消息所属小说ID" example:"1"`
	// ChapterID 表示本轮消息关联的章节 ID，普通小说级对话可为空。
	ChapterID *uint64 `json:"chapter_id,omitempty" gorm:"column:chapter_id;comment:本轮消息关联的章节ID，普通小说级对话可为空" example:"1"`
	// Role 表示消息角色，仅保存 user 或 assistant。
	Role MessageRole `json:"role" gorm:"column:role;type:varchar(32);not null;comment:消息角色，仅保存user或assistant" example:"user"`
	// Task 表示产生助手消息的任务类型，用户消息为空。
	Task string `json:"task,omitempty" gorm:"column:task;type:varchar(64);comment:产生助手消息的任务类型，用户消息为空" example:"polish"`
	// Content 表示消息正文。
	Content string `json:"content" gorm:"column:content;type:text;not null;comment:消息正文" example:"帮我润色这一章"`
	// ProviderID 表示本轮消息使用的 AI 提供商 ID。
	ProviderID uint64 `json:"provider_id,omitempty" gorm:"column:provider_id;comment:本轮消息使用的AI提供商ID" example:"1"`
	// Model 表示本轮消息使用的模型标识。
	Model string `json:"model,omitempty" gorm:"column:model;type:varchar(255);comment:本轮消息使用的模型标识" example:"gpt-5"`
	// RequestID 表示本轮流式请求的追踪标识。
	RequestID string `json:"request_id,omitempty" gorm:"column:request_id;type:varchar(64);comment:本轮流式请求的追踪标识" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;index:idx_agent_messages_conversation_created,priority:2;index:idx_agent_messages_novel_created,priority:2;comment:创建时间" example:"2026-06-19T22:00:00+08:00"`
}

// TableName 返回 Agent 记忆消息模型对应的数据表名称。
func (MessageRecord) TableName() string {
	return "agent_messages"
}

// MessageResponse 表示前端展示用的 Agent 历史消息。
type MessageResponse struct {
	// ID 表示 Agent 消息主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示消息所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// ChapterID 表示本轮消息关联的章节 ID，普通小说级对话可为空。
	ChapterID *uint64 `json:"chapter_id,omitempty" example:"1"`
	// Role 表示消息角色，仅包含 user 或 assistant。
	Role MessageRole `json:"role" example:"user"`
	// Task 表示产生助手消息的任务类型，用户消息为空。
	Task string `json:"task,omitempty" example:"polish"`
	// Content 表示消息正文。
	Content string `json:"content" example:"帮我润色这一章"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-19T22:00:00+08:00"`
}

// MessageListResponse 表示 Agent 历史消息列表响应。
type MessageListResponse struct {
	// Items 表示最近的 Agent 历史消息列表，按时间正序排列。
	Items []MessageResponse `json:"items"`
}

// ClearMessagesResponse 表示清空 Agent 历史消息后的响应。
type ClearMessagesResponse struct {
	// Cleared 表示本次清空的消息数量。
	Cleared int64 `json:"cleared" example:"2"`
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
	// ProviderID 表示 AI 提供商主键 ID。
	ProviderID uint64
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

// RuntimeRetryConfig 表示一次 Agent 运行中的模型失败重试配置。
type RuntimeRetryConfig struct {
	// MaxRetries 表示单次模型调用失败后的最大重试次数，0 表示不重试。
	MaxRetries int
	// Backoff 表示两次模型重试之间等待的时间。
	Backoff time.Duration
}

// RuntimeModelConfig 表示一次 Agent 运行中父子 Agent 使用的模型配置集合。
type RuntimeModelConfig struct {
	// Default 表示前端请求传入并完成默认模型兜底后的入口模型配置。
	Default ModelConfig
	// Supervisor 表示顶层 Agent 自定义模型配置，nil 表示继承 Default。
	Supervisor *ModelConfig
	// Children 表示启用子 Agent 的自定义模型配置，键为子 Agent 名称。
	Children map[string]ModelConfig
	// Retry 表示本次 Agent 运行中模型调用失败时的重试配置。
	Retry RuntimeRetryConfig
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
	// AgentName 表示最终产生回复的 Eino Agent 名称。
	AgentName string
	// ProviderID 表示最终产生回复的 AI 提供商 ID。
	ProviderID uint64
	// Model 表示最终产生回复的模型标识。
	Model string
}

// AgentMemoryInput 表示运行 Agent 时需要注入模型上下文的小说级记忆。
type AgentMemoryInput struct {
	// Summary 表示已经滚动压缩后的长期记忆摘要。
	Summary string
	// Messages 表示仍以原文形式注入的最近 Agent 记忆消息。
	Messages []MessageRecord
}

// AgentSummaryInput 表示生成滚动摘要所需的历史上下文。
type AgentSummaryInput struct {
	// PreviousSummary 表示此前已经保存的长期记忆摘要，可以为空。
	PreviousSummary string
	// Messages 表示本次需要滚入长期摘要的旧 Agent 记忆消息。
	Messages []MessageRecord
}

// PromptRecommendationInput 表示推荐判定模型需要的用户输入和可选提示词类型。
type PromptRecommendationInput struct {
	// Message 表示用户当前输入框中的原始需求。
	Message string
	// PromptTypes 表示配置文件中允许匹配的提示词类型列表。
	PromptTypes []string
}

// ConversationSummaryUpdate 表示需要写回 Agent 会话的滚动摘要更新。
type ConversationSummaryUpdate struct {
	// Summary 表示新的长期记忆摘要正文。
	Summary string
	// SummaryMessageID 表示新摘要已经覆盖到的最新 Agent 消息 ID。
	SummaryMessageID uint64
	// SummaryUpdatedAt 表示新摘要生成完成的时间。
	SummaryUpdatedAt time.Time
}

// AgentRuntime 表示可执行小说写作多层 Agent 的运行时。
type AgentRuntime interface {
	// Stream 流式执行小说写作 Agent。
	// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 memory 表示需要注入模型上下文的小说级记忆；参数 emit 表示文本增量回调。
	Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, memory AgentMemoryInput, emit func(delta AgentDelta) error) (AgentResult, error)
	// Summarize 生成小说级 Agent 滚动摘要。
	// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示需要压缩进摘要的历史上下文。
	Summarize(ctx context.Context, cfg *appconfig.AppConfig, input AgentSummaryInput) (string, error)
	// RecommendPromptType 判断当前用户输入是否需要查询提示词库推荐。
	// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示推荐判定所需的用户输入和提示词类型。
	RecommendPromptType(ctx context.Context, cfg *appconfig.AppConfig, input PromptRecommendationInput) (PromptRecommendationResponse, error)
}

// AgentRuntimeFactory 表示 Eino 多层 Agent 运行时工厂。
type AgentRuntimeFactory interface {
	// NewRuntime 按提供商协议创建小说写作 Agent 运行时。
	// 参数 ctx 表示请求上下文；参数 cfg 表示一次运行中的入口模型和 Agent 自定义模型配置。
	NewRuntime(ctx context.Context, cfg RuntimeModelConfig) (AgentRuntime, error)
}
