package novelagent

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"time"

	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"
	appconfig "novels_ai_gen/internal/bootstrap/config"
	"novels_ai_gen/internal/requestid"
)

const defaultMemoryRecentRounds = 10

// Repository 表示小说写作 Agent 读取 AI 提供商配置的数据依赖。
type Repository interface {
	// GetByID 根据 ID 查询 AI 提供商。
	// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
	GetByID(ctx context.Context, id uint64) (*bizaiprovider.Provider, error)
}

// MemoryRepository 表示小说写作 Agent 记忆读写数据依赖。
type MemoryRepository interface {
	// FindConversationByNovelID 根据小说 ID 查询 Agent 会话。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	FindConversationByNovelID(ctx context.Context, novelID uint64) (*Conversation, bool, error)
	// GetOrCreateConversation 获取或创建指定小说的 Agent 会话。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	GetOrCreateConversation(ctx context.Context, novelID uint64) (*Conversation, error)
	// ListRecentMessages 查询指定会话最近的 Agent 记忆消息，并按时间正序返回。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 limit 表示最多返回的消息数量。
	ListRecentMessages(ctx context.Context, conversationID uint64, limit int) ([]MessageRecord, error)
	// CountMessagesAfterID 统计指定消息 ID 之后的 Agent 记忆消息数量。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 afterID 表示已经纳入摘要的最新消息 ID。
	CountMessagesAfterID(ctx context.Context, conversationID uint64, afterID uint64) (int64, error)
	// ListMessagesAfterID 查询指定消息 ID 之后的 Agent 记忆消息，并按时间正序返回。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 afterID 表示已经纳入摘要的最新消息 ID；参数 limit 表示最多返回的消息数量。
	ListMessagesAfterID(ctx context.Context, conversationID uint64, afterID uint64, limit int) ([]MessageRecord, error)
	// AppendMessagesAndUpdateSummary 以事务追加 Agent 记忆消息并可选更新会话摘要。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 messages 表示需要写入的消息列表；参数 summary 表示需要写回的摘要更新，nil 表示不更新摘要。
	AppendMessagesAndUpdateSummary(ctx context.Context, conversationID uint64, messages []MessageRecord, summary *ConversationSummaryUpdate) error
	// ClearMessagesByNovelID 清空指定小说的 Agent 记忆消息。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	ClearMessagesByNovelID(ctx context.Context, novelID uint64) (int64, error)
}

// Cipher 表示小说写作 Agent 解密 AI 提供商 API Key 的依赖。
type Cipher interface {
	// Decrypt 解密 AI 提供商 API Key 密文。
	// 参数 value 表示保存于数据库中的 API Key 密文。
	Decrypt(value string) (string, error)
}

// PromptProvider 表示可读取当前运行配置快照的依赖。
type PromptProvider interface {
	// Current 返回当前有效应用配置快照。
	Current() *appconfig.AppConfig
}

// Service 表示小说写作 Agent 业务服务。
type Service struct {
	// repo 表示 AI 提供商仓储。
	repo Repository
	// cipher 表示 AI 提供商 API Key 解密器。
	cipher Cipher
	// prompts 表示运行时提示词配置来源。
	prompts PromptProvider
	// runtimeFactory 表示 Eino 多层 Agent 运行时工厂。
	runtimeFactory AgentRuntimeFactory
	// memoryRepo 表示小说级 Agent 记忆仓储。
	memoryRepo MemoryRepository
}

// NewService 创建小说写作 Agent 业务服务。
// 参数 repo 表示 AI 提供商仓储；参数 cipher 表示 API Key 解密器；参数 prompts 表示提示词配置来源；参数 runtimeFactory 表示 Eino 多层 Agent 运行时工厂；参数 memoryRepo 表示小说级 Agent 记忆仓储。
func NewService(repo Repository, cipher Cipher, prompts PromptProvider, runtimeFactory AgentRuntimeFactory, memoryRepo MemoryRepository) *Service {
	if runtimeFactory == nil {
		runtimeFactory = NewEinoAgentRuntimeFactory(nil)
	}
	return &Service{
		repo:           repo,
		cipher:         cipher,
		prompts:        prompts,
		runtimeFactory: runtimeFactory,
		memoryRepo:     memoryRepo,
	}
}

// StreamChat 执行小说写作 Agent 流式对话。
// 参数 ctx 表示请求上下文；参数 req 表示流式对话请求；参数 writer 表示 NDJSON 事件写出器。
func (s *Service) StreamChat(ctx context.Context, req ChatRequest, writer EventWriter) error {
	req = normalizeChatRequest(req)
	if err := ValidateChatRequest(req); err != nil {
		return err
	}
	if writer == nil {
		return fmt.Errorf("Agent 流事件写出器不能为空")
	}

	provider, apiKey, err := s.providerCredential(ctx, req.ProviderID)
	if err != nil {
		return err
	}
	req.Model = modelForChatRequest(req.Model, provider.DefaultModel)
	if strings.TrimSpace(req.Model) == "" {
		return ErrModelRequired
	}

	cfg := s.currentConfig()
	memory, err := s.memoryForRun(ctx, cfg, req.NovelID)
	if err != nil {
		return err
	}

	runtime, err := s.runtimeFactory.NewRuntime(ctx, ModelConfig{
		ProviderType: provider.ProviderType,
		APIType:      provider.APIType,
		APIKey:       apiKey,
		BaseURL:      provider.BaseURL,
		Model:        req.Model,
	})
	if err != nil {
		slog.ErrorContext(ctx, "小说写作 Agent 创建运行时失败",
			"error", err,
			"provider_id", req.ProviderID,
			"provider_type", provider.ProviderType,
			"api_type", provider.APIType,
			"model", req.Model,
			"base_url_configured", strings.TrimSpace(provider.BaseURL) != "",
		)
		return fmt.Errorf("%w: %v", ErrModelStreamFailed, err)
	}

	if err := writer.WriteEvent(StreamEvent{Type: "meta", Stage: "started", Message: "Agent 已开始处理"}); err != nil {
		return err
	}

	if err := writer.WriteEvent(StreamEvent{Type: "meta", Stage: "routed", Message: "顶层 Agent 将自行决定是否调用子 Agent"}); err != nil {
		return err
	}

	result, err := runtime.Stream(ctx, cfg, req, memory, func(delta AgentDelta) error {
		if delta.Content == "" {
			return nil
		}
		return writer.WriteEvent(StreamEvent{Type: "delta", Task: delta.Task, Content: delta.Content})
	})
	if err != nil {
		slog.ErrorContext(ctx, "小说写作 Agent 执行失败",
			"error", err,
			"provider_id", req.ProviderID,
			"provider_type", provider.ProviderType,
			"api_type", provider.APIType,
			"model", req.Model,
			"base_url_configured", strings.TrimSpace(provider.BaseURL) != "",
		)
		_ = writer.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(ctx), Task: result.Task, Message: friendlyError(err)})
		return fmt.Errorf("%w: %v", ErrModelStreamFailed, err)
	}
	if err := s.saveSuccessfulTurn(ctx, cfg, runtime, req, result, provider.ID); err != nil {
		slog.ErrorContext(ctx, "小说写作 Agent 记忆保存失败",
			"error", err,
			"provider_id", req.ProviderID,
			"model", req.Model,
			"novel_id", req.NovelID,
			"chapter_id", req.ChapterID,
		)
		_ = writer.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(ctx), Task: result.Task, Message: "AI 记忆保存失败，本次回复未完成入库"})
		return fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}

	return writer.WriteEvent(StreamEvent{Type: "done", Task: result.Task, Content: result.Content, Message: "ok"})
}

// ListMessages 查询指定小说最近的 Agent 历史消息。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) ListMessages(ctx context.Context, novelID uint64) (MessageListResponse, error) {
	if novelID == 0 {
		return MessageListResponse{}, ErrChapterContextInvalid
	}
	if s.memoryRepo == nil {
		return MessageListResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversation, ok, err := s.memoryRepo.FindConversationByNovelID(ctx, novelID)
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	if !ok {
		return MessageListResponse{Items: []MessageResponse{}}, nil
	}

	messages, err := s.memoryRepo.ListRecentMessages(ctx, conversation.ID, memoryMessageLimit(s.currentConfig()))
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return MessageListResponse{Items: messageResponses(messages)}, nil
}

// ClearMessages 清空指定小说的 Agent 历史消息。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) ClearMessages(ctx context.Context, novelID uint64) (ClearMessagesResponse, error) {
	if novelID == 0 {
		return ClearMessagesResponse{}, ErrChapterContextInvalid
	}
	if s.memoryRepo == nil {
		return ClearMessagesResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	cleared, err := s.memoryRepo.ClearMessagesByNovelID(ctx, novelID)
	if err != nil {
		return ClearMessagesResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return ClearMessagesResponse{Cleared: cleared}, nil
}

// RecommendPromptType 判断当前用户输入是否需要查询提示词库推荐。
// 参数 ctx 表示请求上下文；参数 req 表示提示词库推荐判定请求。
func (s *Service) RecommendPromptType(ctx context.Context, req PromptRecommendationRequest) (PromptRecommendationResponse, error) {
	req = normalizePromptRecommendationRequest(req)
	if err := ValidatePromptRecommendationRequest(req); err != nil {
		return PromptRecommendationResponse{}, err
	}

	provider, apiKey, err := s.providerCredential(ctx, req.ProviderID)
	if err != nil {
		return PromptRecommendationResponse{}, err
	}
	req.Model = modelForChatRequest(req.Model, provider.DefaultModel)
	if strings.TrimSpace(req.Model) == "" {
		return PromptRecommendationResponse{}, ErrModelRequired
	}

	cfg := s.currentConfig()
	promptTypes := normalizedPromptTypes(cfg)
	if len(promptTypes) == 0 {
		return noPromptRecommendation(), nil
	}

	runtime, err := s.runtimeFactory.NewRuntime(ctx, ModelConfig{
		ProviderType: provider.ProviderType,
		APIType:      provider.APIType,
		APIKey:       apiKey,
		BaseURL:      provider.BaseURL,
		Model:        req.Model,
	})
	if err != nil {
		slog.ErrorContext(ctx, "提示词库推荐判定运行时创建失败",
			"error", err,
			"provider_id", req.ProviderID,
			"provider_type", provider.ProviderType,
			"api_type", provider.APIType,
			"model", req.Model,
			"base_url_configured", strings.TrimSpace(provider.BaseURL) != "",
		)
		return PromptRecommendationResponse{}, fmt.Errorf("%w: %v", ErrModelStreamFailed, err)
	}

	result, err := runtime.RecommendPromptType(ctx, cfg, PromptRecommendationInput{
		Message:     req.Message,
		PromptTypes: promptTypes,
	})
	if err != nil {
		slog.ErrorContext(ctx, "提示词库推荐判定失败",
			"error", err,
			"provider_id", req.ProviderID,
			"provider_type", provider.ProviderType,
			"api_type", provider.APIType,
			"model", req.Model,
			"base_url_configured", strings.TrimSpace(provider.BaseURL) != "",
		)
		return PromptRecommendationResponse{}, fmt.Errorf("%w: %v", ErrModelStreamFailed, err)
	}
	if result.Action != PromptRecommendationActionSearch || !result.Matched || !promptRecommendationTypeAllowed(promptTypes, result.PromptType) {
		return noPromptRecommendation(), nil
	}
	return result, nil
}

// ValidateChatRequest 校验小说写作 Agent 流式对话请求。
// 参数 req 表示流式对话请求。
func ValidateChatRequest(req ChatRequest) error {
	if req.ProviderID == 0 {
		return ErrProviderIDRequired
	}
	if strings.TrimSpace(req.Message) == "" {
		return ErrMessageRequired
	}
	if req.ChapterID != 0 && req.NovelID == 0 {
		return ErrChapterContextInvalid
	}
	return nil
}

// ValidatePromptRecommendationRequest 校验提示词库推荐判定请求。
// 参数 req 表示提示词库推荐判定请求。
func ValidatePromptRecommendationRequest(req PromptRecommendationRequest) error {
	if req.ProviderID == 0 {
		return ErrProviderIDRequired
	}
	if strings.TrimSpace(req.Message) == "" {
		return ErrMessageRequired
	}
	return nil
}

// providerCredential 查询 AI 提供商并解密 API Key。
// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
func (s *Service) providerCredential(ctx context.Context, id uint64) (*bizaiprovider.Provider, string, error) {
	if s.repo == nil {
		return nil, "", fmt.Errorf("AI 提供商仓储未初始化")
	}
	if s.cipher == nil {
		return nil, "", fmt.Errorf("AI 提供商密钥解密器未初始化")
	}

	provider, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, "", err
	}
	if !provider.Enabled {
		return nil, "", ErrProviderDisabled
	}

	apiKey, err := s.cipher.Decrypt(provider.APIKeyCiphertext)
	if err != nil {
		return nil, "", fmt.Errorf("解密 AI 提供商 API Key 失败: %w", err)
	}
	return provider, apiKey, nil
}

// modelForChatRequest 返回本轮 Agent 对话最终使用的模型标识。
// 参数 requestedModel 表示请求体传入的模型标识；参数 defaultModel 表示 AI 提供商配置的默认模型标识。
func modelForChatRequest(requestedModel string, defaultModel string) string {
	requestedModel = strings.TrimSpace(requestedModel)
	if requestedModel != "" {
		return requestedModel
	}
	return strings.TrimSpace(defaultModel)
}

// currentConfig 返回当前运行配置快照。
func (s *Service) currentConfig() *appconfig.AppConfig {
	if s.prompts == nil {
		return appconfig.Get()
	}
	return s.prompts.Current()
}

// memoryForRun 读取本次 Agent 请求需要注入模型上下文的小说级记忆。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 novelID 表示小说主键 ID，普通无记忆对话为 0。
func (s *Service) memoryForRun(ctx context.Context, cfg *appconfig.AppConfig, novelID uint64) (AgentMemoryInput, error) {
	if novelID == 0 {
		return AgentMemoryInput{}, nil
	}
	if s.memoryRepo == nil {
		return AgentMemoryInput{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversation, ok, err := s.memoryRepo.FindConversationByNovelID(ctx, novelID)
	if err != nil {
		return AgentMemoryInput{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	if !ok {
		return AgentMemoryInput{}, nil
	}

	messages, err := s.memoryRepo.ListRecentMessages(ctx, conversation.ID, memoryMessageLimit(cfg))
	if err != nil {
		return AgentMemoryInput{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return AgentMemoryInput{
		Summary:  conversation.Summary,
		Messages: messages,
	}, nil
}

// saveSuccessfulTurn 将成功完成的一轮用户消息和助手回复写入小说级 Agent 记忆。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 req 表示本轮聊天请求；参数 result 表示 Agent 最终生成结果；参数 providerID 表示实际使用的 AI 提供商 ID。
func (s *Service) saveSuccessfulTurn(ctx context.Context, cfg *appconfig.AppConfig, runtime AgentRuntime, req ChatRequest, result AgentResult, providerID uint64) error {
	if req.NovelID == 0 {
		return nil
	}
	if s.memoryRepo == nil {
		return fmt.Errorf("Agent 记忆仓储未初始化")
	}

	conversation, err := s.memoryRepo.GetOrCreateConversation(ctx, req.NovelID)
	if err != nil {
		return err
	}

	var chapterID *uint64
	if req.ChapterID != 0 {
		value := req.ChapterID
		chapterID = &value
	}
	messages := []MessageRecord{
		{
			ConversationID: conversation.ID,
			NovelID:        req.NovelID,
			ChapterID:      chapterID,
			Role:           MessageRoleUser,
			Content:        req.Message,
			ProviderID:     providerID,
			Model:          req.Model,
			RequestID:      requestid.FromContext(ctx),
		},
		{
			ConversationID: conversation.ID,
			NovelID:        req.NovelID,
			ChapterID:      chapterID,
			Role:           MessageRoleAssistant,
			Task:           result.Task,
			Content:        result.Content,
			ProviderID:     providerID,
			Model:          req.Model,
			RequestID:      requestid.FromContext(ctx),
		},
	}
	summary, err := s.summaryUpdateForTurn(ctx, cfg, runtime, conversation, messages)
	if err != nil {
		return err
	}
	return s.memoryRepo.AppendMessagesAndUpdateSummary(ctx, conversation.ID, messages, summary)
}

// summaryUpdateForTurn 计算本轮保存前是否需要生成新的滚动摘要。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 conversation 表示小说级 Agent 会话；参数 pendingMessages 表示本轮即将写入的用户和助手消息。
func (s *Service) summaryUpdateForTurn(ctx context.Context, cfg *appconfig.AppConfig, runtime AgentRuntime, conversation *Conversation, pendingMessages []MessageRecord) (*ConversationSummaryUpdate, error) {
	if runtime == nil || conversation == nil || len(pendingMessages) == 0 {
		return nil, nil
	}
	messageLimit := memoryMessageLimit(cfg)
	if messageLimit <= 0 {
		return nil, nil
	}

	afterID := conversationSummaryMessageID(conversation)
	unsummarizedCount, err := s.memoryRepo.CountMessagesAfterID(ctx, conversation.ID, afterID)
	if err != nil {
		return nil, err
	}
	summarizeCount := int(unsummarizedCount) + len(pendingMessages) - messageLimit
	if summarizeCount <= 0 {
		return nil, nil
	}

	messages, err := s.memoryRepo.ListMessagesAfterID(ctx, conversation.ID, afterID, summarizeCount)
	if err != nil {
		return nil, err
	}
	if len(messages) == 0 {
		return nil, nil
	}

	summary, err := runtime.Summarize(ctx, cfg, AgentSummaryInput{
		PreviousSummary: conversation.Summary,
		Messages:        messages,
	})
	if err != nil {
		return nil, err
	}
	return &ConversationSummaryUpdate{
		Summary:          summary,
		SummaryMessageID: messages[len(messages)-1].ID,
		SummaryUpdatedAt: time.Now(),
	}, nil
}

// memoryRecentRounds 返回配置生效后的最近对话轮数。
// 参数 cfg 表示当前配置快照。
func memoryRecentRounds(cfg *appconfig.AppConfig) int {
	if cfg == nil || cfg.AI.Agent.Memory.RecentRounds <= 0 {
		return defaultMemoryRecentRounds
	}
	return cfg.AI.Agent.Memory.RecentRounds
}

// memoryMessageLimit 返回最近对话轮数对应的消息条数上限。
// 参数 cfg 表示当前配置快照。
func memoryMessageLimit(cfg *appconfig.AppConfig) int {
	return memoryRecentRounds(cfg) * 2
}

// normalizedPromptTypes 返回配置文件中可用于推荐判定的提示词类型列表。
// 参数 cfg 表示当前配置快照。
func normalizedPromptTypes(cfg *appconfig.AppConfig) []string {
	if cfg == nil || len(cfg.AI.PromptTypes) == 0 {
		return []string{}
	}
	items := make([]string, 0, len(cfg.AI.PromptTypes))
	seen := make(map[string]struct{}, len(cfg.AI.PromptTypes))
	for _, item := range cfg.AI.PromptTypes {
		name := strings.TrimSpace(item)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		items = append(items, name)
	}
	return items
}

// conversationSummaryMessageID 返回会话已经纳入摘要的最新消息 ID。
// 参数 conversation 表示小说级 Agent 会话。
func conversationSummaryMessageID(conversation *Conversation) uint64 {
	if conversation == nil || conversation.SummaryMessageID == nil {
		return 0
	}
	return *conversation.SummaryMessageID
}

// messageResponses 将数据库消息模型转换为前端响应结构。
// 参数 messages 表示数据库中的 Agent 记忆消息列表。
func messageResponses(messages []MessageRecord) []MessageResponse {
	if len(messages) == 0 {
		return []MessageResponse{}
	}

	items := make([]MessageResponse, 0, len(messages))
	for _, message := range messages {
		items = append(items, MessageResponse{
			ID:        message.ID,
			NovelID:   message.NovelID,
			ChapterID: message.ChapterID,
			Role:      message.Role,
			Task:      message.Task,
			Content:   message.Content,
			CreatedAt: message.CreatedAt,
		})
	}
	return items
}

// normalizeChatRequest 标准化小说写作 Agent 请求。
// 参数 req 表示原始流式对话请求。
func normalizeChatRequest(req ChatRequest) ChatRequest {
	req.Model = strings.TrimSpace(req.Model)
	req.Message = strings.TrimSpace(req.Message)
	return req
}

// normalizePromptRecommendationRequest 标准化提示词库推荐判定请求。
// 参数 req 表示原始提示词库推荐判定请求。
func normalizePromptRecommendationRequest(req PromptRecommendationRequest) PromptRecommendationRequest {
	req.Model = strings.TrimSpace(req.Model)
	req.Message = strings.TrimSpace(req.Message)
	return req
}

// friendlyError 将内部错误转换为用户可理解的错误消息。
// 参数 err 表示内部错误。
func friendlyError(err error) string {
	if err == nil {
		return ""
	}
	if strings.TrimSpace(err.Error()) == "" {
		return "AI 生成失败，请稍后再试"
	}
	return "AI 生成失败，请检查模型、密钥或网络后重试"
}
