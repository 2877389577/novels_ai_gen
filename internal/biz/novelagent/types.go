package novelagent

import (
	"context"
	"time"

	biznovel "novels_ai_gen/internal/biz/novel"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// ChatRequest 表示小说写作 Agent 流式对话请求。
type ChatRequest struct {
	// Message 表示用户输入的写作需求或问题。
	Message string `json:"message" binding:"required" example:"帮我润色这一段，让语气更紧张"`
	// NovelID 表示当前请求关联的小说 ID，正式 AI 对话必须传入。
	NovelID uint64 `json:"novel_id" example:"1"`
	// ConversationID 表示本轮请求所属 Agent 会话 ID，空值表示开启新会话。
	ConversationID uint64 `json:"conversation_id,omitempty" example:"1"`
	// ChapterID 表示当前请求关联的章节 ID，普通对话可为空。
	ChapterID uint64 `json:"chapter_id,omitempty" example:"1"`
	// ChapterNumber 表示当前请求关联的章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number,omitempty" example:"3"`
}

// ChatApprovalResumeRequest 表示人工审核后恢复 Agent 执行的请求。
type ChatApprovalResumeRequest struct {
	// NovelID 表示待恢复请求关联的小说 ID。
	NovelID uint64 `json:"novel_id" binding:"required" example:"1"`
	// ConversationID 表示待恢复请求所属 Agent 会话 ID，新会话恢复时可为空。
	ConversationID uint64 `json:"conversation_id,omitempty" example:"1"`
	// ChapterID 表示待恢复请求关联的章节 ID，普通对话可为空。
	ChapterID uint64 `json:"chapter_id,omitempty" example:"1"`
	// ChapterNumber 表示待恢复请求关联的章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number,omitempty" example:"3"`
	// CheckPointID 表示 Eino ADK 中断时保存的 checkpoint 标识。
	CheckPointID string `json:"checkpoint_id" binding:"required" example:"agent-approval-abc123"`
	// InterruptID 表示本次人工审核对应的中断点标识。
	InterruptID string `json:"interrupt_id" binding:"required" example:"agent:supervisor;tool:get_content:call_1"`
	// Approved 表示用户是否允许执行该工具。
	Approved bool `json:"approved" example:"true"`
	// Reason 表示用户拒绝或批准时填写的补充原因。
	Reason string `json:"reason,omitempty" example:"这次允许读取章节内容"`
}

// MessageRole 表示 Agent 记忆消息角色。
type MessageRole string

const (
	// MessageRoleUser 表示用户发送给 Agent 的消息。
	MessageRoleUser MessageRole = "user"
	// MessageRoleAssistant 表示 Agent 最终返回给用户的助手消息。
	MessageRoleAssistant MessageRole = "assistant"
	// MessageRoleFunctionCall 表示 Agent 发起的函数工具调用，仅用于内部记忆。
	MessageRoleFunctionCall MessageRole = "function_call"
	// MessageRoleFunctionResult 表示函数工具调用返回结果，仅用于内部记忆。
	MessageRoleFunctionResult MessageRole = "function_result"
)

// Conversation 表示小说下的 Agent 会话数据库模型。
type Conversation struct {
	// ID 表示 Agent 会话主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:Agent会话主键ID" example:"1"`
	// NovelID 表示会话所属小说 ID，同一小说可以拥有多个 Agent 会话。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;index:idx_agent_conversations_novel_id;index:idx_agent_conversations_novel_updated,priority:1;comment:会话所属小说ID，同一小说可以拥有多个Agent会话" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// Title 表示 Agent 会话标题，由新会话首轮用户消息自动生成。
	Title string `json:"title" gorm:"column:title;type:varchar(255);not null;default:新会话;comment:Agent会话标题，由新会话首轮用户消息自动生成" example:"讨论第三章节奏"`
	// Summary 表示已经滚动压缩后的 Agent 长期记忆摘要。
	Summary string `json:"summary,omitempty" gorm:"column:summary;type:text;comment:已经滚动压缩后的Agent长期记忆摘要"`
	// SummaryMessageID 表示已经纳入摘要的最新 Agent 消息 ID。
	SummaryMessageID *uint64 `json:"summary_message_id,omitempty" gorm:"column:summary_message_id;comment:已经纳入摘要的最新Agent消息ID" example:"20"`
	// SummaryUpdatedAt 表示 Agent 长期记忆摘要最近更新时间。
	SummaryUpdatedAt *time.Time `json:"summary_updated_at,omitempty" gorm:"column:summary_updated_at;comment:Agent长期记忆摘要最近更新时间" example:"2026-06-19T22:00:00+08:00"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-19T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;index:idx_agent_conversations_novel_updated,priority:2;comment:更新时间" example:"2026-06-19T22:00:00+08:00"`
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
	// Role 表示消息角色，包含可展示消息和内部工具记忆消息。
	Role MessageRole `json:"role" gorm:"column:role;type:varchar(32);not null;comment:消息角色，包含可展示消息和内部工具记忆消息" example:"user"`
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
	// ConversationID 表示消息所属 Agent 会话 ID。
	ConversationID uint64 `json:"conversation_id" example:"1"`
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

// ConversationResponse 表示前端展示用的 Agent 会话摘要。
type ConversationResponse struct {
	// ID 表示 Agent 会话主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示会话所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Title 表示 Agent 会话标题。
	Title string `json:"title" example:"讨论第三章节奏"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-19T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-19T22:00:00+08:00"`
}

// ConversationListResponse 表示 Agent 会话列表响应。
type ConversationListResponse struct {
	// Items 表示当前小说下的 Agent 会话列表，按更新时间倒序排列。
	Items []ConversationResponse `json:"items"`
}

// DeleteConversationResponse 表示删除 Agent 会话后的响应。
type DeleteConversationResponse struct {
	// Deleted 表示 Agent 会话是否已经删除。
	Deleted bool `json:"deleted" example:"true"`
}

// StreamEvent 表示小说写作 Agent NDJSON 流事件。
type StreamEvent struct {
	// Type 表示事件类型，支持 meta、delta、approval_required、done、error。
	Type string `json:"type" example:"delta"`
	// RunID 表示本次 AI 对话后台运行任务 ID。
	RunID string `json:"run_id,omitempty" example:"agent-run-abc123"`
	// RequestID 表示本次流式请求的追踪标识，用于和后端日志关联。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Stage 表示 meta 事件所处阶段。
	Stage string `json:"stage,omitempty" example:"routed"`
	// Task 表示顶层 Agent 选择的任务类型。
	Task string `json:"task,omitempty" example:"polish"`
	// ReplyIndex 表示同一次请求中的可见助手回复段序号，从 1 开始。
	ReplyIndex int `json:"reply_index,omitempty" example:"1"`
	// Content 表示增量文本或完整文本内容。
	Content string `json:"content,omitempty" example:"雨夜里，门外的脚步声一点点逼近。"`
	// Replies 表示 done 事件中返回的分段助手回复列表。
	Replies []StreamReply `json:"replies,omitempty"`
	// ConversationID 表示本轮回复保存到的 Agent 会话 ID，仅 done 事件返回。
	ConversationID uint64 `json:"conversation_id,omitempty" example:"1"`
	// ConversationTitle 表示本轮回复保存到的 Agent 会话标题，仅 done 事件返回。
	ConversationTitle string `json:"conversation_title,omitempty" example:"讨论第三章节奏"`
	// Message 表示错误或状态说明。
	Message string `json:"message,omitempty" example:"ok"`
	// CheckPointID 表示等待人工审核时用于恢复 Agent 执行的 checkpoint 标识。
	CheckPointID string `json:"checkpoint_id,omitempty" example:"agent-approval-abc123"`
	// InterruptID 表示等待人工审核时需要恢复的中断点标识。
	InterruptID string `json:"interrupt_id,omitempty" example:"agent:supervisor;tool:get_content:call_1"`
	// ToolName 表示等待人工审核的工具名称。
	ToolName string `json:"tool_name,omitempty" example:"get_content"`
	// ToolArguments 表示等待人工审核的工具调用参数 JSON 字符串。
	ToolArguments string `json:"tool_arguments,omitempty" example:"{\"chapter_number\":3}"`
}

// StreamReply 表示一次 Agent 请求中的单段可见助手回复。
type StreamReply struct {
	// ReplyIndex 表示同一次请求中的可见助手回复段序号，从 1 开始。
	ReplyIndex int `json:"reply_index" example:"1"`
	// Task 表示产生该回复段的任务来源。
	Task string `json:"task,omitempty" example:"polish"`
	// Content 表示该回复段的完整文本内容。
	Content string `json:"content" example:"我先读取当前章节内容。"`
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
	// ReasoningEffort 表示 GPT 类模型使用的推理强度。
	ReasoningEffort string
	// UserAgent 表示该模型请求使用的 User-Agent 头，空值表示使用 SDK 默认值。
	UserAgent string
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
	// Default 表示本轮 Agent 运行入口模型配置。
	Default ModelConfig
	// Supervisor 表示顶层 Agent 模型配置，nil 表示使用 Default。
	Supervisor *ModelConfig
	// Children 表示启用子 Agent 的模型配置，键为子 Agent 名称。
	Children map[string]ModelConfig
	// Retry 表示本次 Agent 运行中模型调用失败时的重试配置。
	Retry RuntimeRetryConfig
}

// AgentDelta 表示 Agent 流式生成的文本增量。
type AgentDelta struct {
	// Task 表示产生该增量的任务来源，direct 表示顶层 Agent 直接回答。
	Task string
	// ReplyIndex 表示同一次请求中的可见助手回复段序号，从 1 开始。
	ReplyIndex int
	// Content 表示模型生成的增量文本。
	Content string
}

// AgentReply 表示 Agent 运行过程中产生的一段可见助手回复。
type AgentReply struct {
	// ReplyIndex 表示同一次请求中的可见助手回复段序号，从 1 开始。
	ReplyIndex int
	// Task 表示产生该回复段的任务来源。
	Task string
	// Content 表示该回复段的完整文本。
	Content string
	// AgentName 表示产生该回复段的 Eino Agent 名称。
	AgentName string
	// ProviderID 表示产生该回复段的实际 AI 提供商 ID。
	ProviderID uint64
	// Model 表示产生该回复段的实际模型标识。
	Model string
}

// AgentMemoryEvent 表示 Agent 运行过程中需要按顺序写入记忆的内部事件。
type AgentMemoryEvent struct {
	// Role 表示记忆事件角色，可为 assistant、function_call 或 function_result。
	Role MessageRole
	// Task 表示产生该事件的任务来源。
	Task string
	// Content 表示该事件写入记忆表的正文。
	Content string
	// AgentName 表示产生该事件的 Eino Agent 名称。
	AgentName string
	// ProviderID 表示产生该事件的实际 AI 提供商 ID。
	ProviderID uint64
	// Model 表示产生该事件的实际模型标识。
	Model string
}

// AgentResult 表示 Agent 流式对话完成后的结果。
type AgentResult struct {
	// Task 表示最终产生回复的任务来源。
	Task string
	// Content 表示完整的模型回复文本。
	Content string
	// Replies 表示本轮请求中按可见输出边界拆分后的助手回复。
	Replies []AgentReply
	// MemoryEvents 表示本轮请求中需要按顺序写入记忆的内部事件。
	MemoryEvents []AgentMemoryEvent
	// AgentName 表示最终产生回复的 Eino Agent 名称。
	AgentName string
	// ProviderID 表示最终产生回复的 AI 提供商 ID。
	ProviderID uint64
	// Model 表示最终产生回复的模型标识。
	Model string
}

// AgentMemoryInput 表示运行 Agent 时需要注入模型上下文的会话级记忆。
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

// AgentConversationTitleInput 表示生成新会话标题所需的用户首轮输入。
type AgentConversationTitleInput struct {
	// Message 表示新会话第一轮用户消息。
	Message string
}

// AgentCheckPointStore 表示 Agent 中断恢复所需的 checkpoint 存储。
type AgentCheckPointStore interface {
	// Get 读取指定 checkpoint 的序列化数据。
	// 参数 ctx 表示请求上下文；参数 checkPointID 表示 checkpoint 标识。
	Get(ctx context.Context, checkPointID string) ([]byte, bool, error)
	// Set 写入指定 checkpoint 的序列化数据。
	// 参数 ctx 表示请求上下文；参数 checkPointID 表示 checkpoint 标识；参数 checkPoint 表示 Eino 序列化后的 checkpoint 数据。
	Set(ctx context.Context, checkPointID string, checkPoint []byte) error
}

// AgentRunControl 表示一次 Agent 运行中的中断恢复控制参数。
type AgentRunControl struct {
	// CheckPointID 表示本轮运行使用的 checkpoint 标识。
	CheckPointID string
	// InterruptID 表示恢复人工审核时需要定向恢复的中断点标识。
	InterruptID string
	// CheckPointStore 表示本轮运行使用的 checkpoint 存储。
	CheckPointStore AgentCheckPointStore
}

// ToolApprovalResumeData 表示恢复工具人工审核中断时传入的用户决策。
type ToolApprovalResumeData struct {
	// Approved 表示用户是否允许执行工具。
	Approved bool `json:"approved"`
	// Reason 表示用户填写的补充原因。
	Reason string `json:"reason,omitempty"`
}

// ModelTextInput 表示直接调用单个模型生成文本所需的提示词。
type ModelTextInput struct {
	// SystemPrompt 表示发送给模型的系统提示词。
	SystemPrompt string
	// UserPrompt 表示发送给模型的用户提示词。
	UserPrompt string
}

// ModelTextGenerator 表示可根据模型配置直接生成文本的组件。
type ModelTextGenerator interface {
	// GenerateText 根据模型配置直接生成一段文本。
	// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置；参数 retry 表示模型失败重试配置；参数 input 表示本次生成的提示词。
	GenerateText(ctx context.Context, cfg ModelConfig, retry RuntimeRetryConfig, input ModelTextInput) (string, error)
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
	// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 memory 表示需要注入模型上下文的会话级记忆；参数 control 表示 checkpoint 控制参数；参数 emit 表示文本增量回调。
	Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, memory AgentMemoryInput, control AgentRunControl, emit func(delta AgentDelta) error) (AgentResult, error)
	// Resume 从人工审核中断点恢复小说写作 Agent。
	// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示原始流式聊天请求；参数 memory 表示需要注入模型上下文的会话级记忆；参数 control 表示 checkpoint 控制参数；参数 approval 表示用户审核决策；参数 emit 表示文本增量回调。
	Resume(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, memory AgentMemoryInput, control AgentRunControl, approval ToolApprovalResumeData, emit func(delta AgentDelta) error) (AgentResult, error)
	// Summarize 生成会话级 Agent 滚动摘要。
	// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示需要压缩进摘要的历史上下文。
	Summarize(ctx context.Context, cfg *appconfig.AppConfig, input AgentSummaryInput) (string, error)
	// GenerateConversationTitle 根据新会话第一轮用户输入生成会话标题。
	// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示标题生成输入。
	GenerateConversationTitle(ctx context.Context, cfg *appconfig.AppConfig, input AgentConversationTitleInput) (string, error)
}

// AgentRuntimeFactory 表示 Eino 多层 Agent 运行时工厂。
type AgentRuntimeFactory interface {
	// NewRuntime 按提供商协议创建小说写作 Agent 运行时。
	// 参数 ctx 表示请求上下文；参数 cfg 表示一次运行中的入口模型和 Agent 模型配置。
	NewRuntime(ctx context.Context, cfg RuntimeModelConfig) (AgentRuntime, error)
}
