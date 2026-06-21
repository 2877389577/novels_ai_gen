package novelagent

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"
	appconfig "novels_ai_gen/internal/bootstrap/config"
	"novels_ai_gen/internal/requestid"
)

const (
	defaultMemoryRecentRounds  = 10
	defaultConversationTitle   = "新会话"
	maxConversationTitleLength = 50
)

// Repository 表示小说写作 Agent 读取 AI 提供商配置的数据依赖。
type Repository interface {
	// GetByID 根据 ID 查询 AI 提供商。
	// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
	GetByID(ctx context.Context, id uint64) (*bizaiprovider.Provider, error)
}

// MemoryRepository 表示小说写作 Agent 记忆读写数据依赖。
type MemoryRepository interface {
	// ListConversationsByNovelID 查询指定小说下的 Agent 会话列表。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	ListConversationsByNovelID(ctx context.Context, novelID uint64) ([]Conversation, error)
	// FindLatestConversationByNovelID 查询指定小说最近更新的 Agent 会话。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	FindLatestConversationByNovelID(ctx context.Context, novelID uint64) (*Conversation, bool, error)
	// FindConversationByID 根据小说 ID 和会话 ID 查询 Agent 会话。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID。
	FindConversationByID(ctx context.Context, novelID uint64, conversationID uint64) (*Conversation, bool, error)
	// CreateConversation 创建指定小说下的 Agent 会话。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 title 表示会话标题。
	CreateConversation(ctx context.Context, novelID uint64, title string) (*Conversation, error)
	// ListRecentMessages 查询指定会话最近的 Agent 记忆消息，并按时间正序返回。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 limit 表示最多返回的消息数量。
	ListRecentMessages(ctx context.Context, conversationID uint64, limit int) ([]MessageRecord, error)
	// ListRecentMessagesByUserRounds 查询指定会话最近若干个用户轮次的 Agent 记忆消息，并按时间正序返回。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 rounds 表示最多返回的最近用户消息轮次数量。
	ListRecentMessagesByUserRounds(ctx context.Context, conversationID uint64, rounds int) ([]MessageRecord, error)
	// CountMessagesAfterID 统计指定消息 ID 之后的 Agent 记忆消息数量。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 afterID 表示已经纳入摘要的最新消息 ID。
	CountMessagesAfterID(ctx context.Context, conversationID uint64, afterID uint64) (int64, error)
	// ListMessagesAfterID 查询指定消息 ID 之后的 Agent 记忆消息，并按时间正序返回。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 afterID 表示已经纳入摘要的最新消息 ID；参数 limit 表示最多返回的消息数量。
	ListMessagesAfterID(ctx context.Context, conversationID uint64, afterID uint64, limit int) ([]MessageRecord, error)
	// AppendMessagesAndUpdateSummary 以事务追加 Agent 记忆消息并可选更新会话摘要。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 messages 表示需要写入的消息列表；参数 summary 表示需要写回的摘要更新，nil 表示不更新摘要。
	AppendMessagesAndUpdateSummary(ctx context.Context, conversationID uint64, messages []MessageRecord, summary *ConversationSummaryUpdate) error
	// ClearMessagesByConversationID 清空指定 Agent 会话的记忆消息。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID。
	ClearMessagesByConversationID(ctx context.Context, novelID uint64, conversationID uint64) (int64, error)
	// ClearMessagesByNovelID 清空指定小说下所有 Agent 会话的记忆消息。
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
	// memoryRepo 表示会话级 Agent 记忆仓储。
	memoryRepo MemoryRepository
}

// savedTurnInfo 表示本轮成功入库后的会话信息。
type savedTurnInfo struct {
	// ConversationID 表示本轮消息保存到的 Agent 会话 ID。
	ConversationID uint64
	// ConversationTitle 表示本轮消息保存到的 Agent 会话标题。
	ConversationTitle string
}

// NewService 创建小说写作 Agent 业务服务。
// 参数 repo 表示 AI 提供商仓储；参数 cipher 表示 API Key 解密器；参数 prompts 表示提示词配置来源；参数 runtimeFactory 表示 Eino 多层 Agent 运行时工厂；参数 memoryRepo 表示会话级 Agent 记忆仓储。
func NewService(repo Repository, cipher Cipher, prompts PromptProvider, runtimeFactory AgentRuntimeFactory, memoryRepo MemoryRepository) *Service {
	if runtimeFactory == nil {
		runtimeFactory = NewEinoAgentRuntimeFactory(nil, nil, nil, nil)
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
	modelConfig, err := s.runtimeModelConfig(ctx, cfg, ModelConfig{
		ProviderID:   provider.ID,
		ProviderType: provider.ProviderType,
		APIType:      provider.APIType,
		APIKey:       apiKey,
		BaseURL:      provider.BaseURL,
		Model:        req.Model,
	})
	if err != nil {
		return err
	}
	memory, err := s.memoryForRun(ctx, cfg, req.NovelID, req.ConversationID)
	if err != nil {
		return err
	}

	runtime, err := s.runtimeFactory.NewRuntime(ctx, modelConfig)
	if err != nil {
		slog.ErrorContext(ctx, "小说写作 Agent 创建运行时失败",
			"error", err,
			"provider_id", req.ProviderID,
			"provider_type", provider.ProviderType,
			"api_type", provider.APIType,
			"model", req.Model,
			"base_url_configured", strings.TrimSpace(provider.BaseURL) != "",
		)
		return fmt.Errorf("%w: %w", ErrModelStreamFailed, err)
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
		return writer.WriteEvent(StreamEvent{Type: "delta", Task: delta.Task, ReplyIndex: delta.ReplyIndex, Content: delta.Content})
	})
	if err != nil {
		if IsCanceledError(ctx, err) {
			return nil
		}
		slog.ErrorContext(ctx, "小说写作 Agent 执行失败",
			"error", err,
			"provider_id", req.ProviderID,
			"provider_type", provider.ProviderType,
			"api_type", provider.APIType,
			"model", req.Model,
			"base_url_configured", strings.TrimSpace(provider.BaseURL) != "",
		)
		_ = writer.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(ctx), Task: result.Task, Message: friendlyError(err)})
		return fmt.Errorf("%w: %w", ErrModelStreamFailed, err)
	}
	if IsCanceledError(ctx, nil) {
		return nil
	}
	savedTurn, err := s.saveSuccessfulTurn(ctx, cfg, runtime, req, result, provider.ID)
	if err != nil {
		if IsCanceledError(ctx, err) {
			return nil
		}
		slog.ErrorContext(ctx, "小说写作 Agent 记忆保存失败",
			"error", err,
			"provider_id", req.ProviderID,
			"model", req.Model,
			"novel_id", req.NovelID,
			"chapter_id", req.ChapterID,
			"chapter_number", req.ChapterNumber,
		)
		_ = writer.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(ctx), Task: result.Task, Message: "AI 记忆保存失败，本次回复未完成入库"})
		return fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}

	return writer.WriteEvent(StreamEvent{
		Type:              "done",
		Task:              result.Task,
		Content:           result.Content,
		Replies:           streamRepliesForResult(result),
		ConversationID:    savedTurn.ConversationID,
		ConversationTitle: savedTurn.ConversationTitle,
		Message:           "ok",
	})
}

// ListConversations 查询指定小说下的 Agent 会话列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) ListConversations(ctx context.Context, novelID uint64) (ConversationListResponse, error) {
	if novelID == 0 {
		return ConversationListResponse{}, ErrChapterContextInvalid
	}
	if s.memoryRepo == nil {
		return ConversationListResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversations, err := s.memoryRepo.ListConversationsByNovelID(ctx, novelID)
	if err != nil {
		return ConversationListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return ConversationListResponse{Items: conversationResponses(conversations)}, nil
}

// ListConversationMessages 查询指定 Agent 会话最近的历史消息。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID。
func (s *Service) ListConversationMessages(ctx context.Context, novelID uint64, conversationID uint64) (MessageListResponse, error) {
	if novelID == 0 {
		return MessageListResponse{}, ErrChapterContextInvalid
	}
	if conversationID == 0 {
		return MessageListResponse{}, ErrConversationNotFound
	}
	if s.memoryRepo == nil {
		return MessageListResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversation, ok, err := s.memoryRepo.FindConversationByID(ctx, novelID, conversationID)
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	if !ok {
		return MessageListResponse{}, ErrConversationNotFound
	}

	messages, err := s.memoryRepo.ListRecentMessagesByUserRounds(ctx, conversation.ID, memoryRecentRounds(s.currentConfig()))
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return MessageListResponse{Items: messageResponses(messages)}, nil
}

// ListMessages 查询指定小说最近更新会话的 Agent 历史消息。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) ListMessages(ctx context.Context, novelID uint64) (MessageListResponse, error) {
	if novelID == 0 {
		return MessageListResponse{}, ErrChapterContextInvalid
	}
	if s.memoryRepo == nil {
		return MessageListResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversation, ok, err := s.memoryRepo.FindLatestConversationByNovelID(ctx, novelID)
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	if !ok {
		return MessageListResponse{Items: []MessageResponse{}}, nil
	}

	messages, err := s.memoryRepo.ListRecentMessagesByUserRounds(ctx, conversation.ID, memoryRecentRounds(s.currentConfig()))
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return MessageListResponse{Items: messageResponses(messages)}, nil
}

// ClearConversationMessages 清空指定 Agent 会话的历史消息和概要。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID。
func (s *Service) ClearConversationMessages(ctx context.Context, novelID uint64, conversationID uint64) (ClearMessagesResponse, error) {
	if novelID == 0 {
		return ClearMessagesResponse{}, ErrChapterContextInvalid
	}
	if conversationID == 0 {
		return ClearMessagesResponse{}, ErrConversationNotFound
	}
	if s.memoryRepo == nil {
		return ClearMessagesResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	cleared, err := s.memoryRepo.ClearMessagesByConversationID(ctx, novelID, conversationID)
	if err != nil {
		if errors.Is(err, ErrConversationNotFound) {
			return ClearMessagesResponse{}, err
		}
		return ClearMessagesResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return ClearMessagesResponse{Cleared: cleared}, nil
}

// ClearMessages 清空指定小说下所有 Agent 会话的历史消息。
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

	runtime, err := s.runtimeFactory.NewRuntime(ctx, RuntimeModelConfig{
		Default: ModelConfig{
			ProviderID:   provider.ID,
			ProviderType: provider.ProviderType,
			APIType:      provider.APIType,
			APIKey:       apiKey,
			BaseURL:      provider.BaseURL,
			Model:        req.Model,
		},
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
		return PromptRecommendationResponse{}, fmt.Errorf("%w: %w", ErrModelStreamFailed, err)
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
		return PromptRecommendationResponse{}, fmt.Errorf("%w: %w", ErrModelStreamFailed, err)
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
	if req.NovelID == 0 {
		return ErrNovelIDRequired
	}
	if req.ChapterNumber < 0 {
		return ErrChapterNumberInvalid
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

// runtimeModelConfig 解析本轮 Agent 运行需要使用的入口模型和父子 Agent 自定义模型。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 defaultConfig 表示前端请求继承来源模型配置。
func (s *Service) runtimeModelConfig(ctx context.Context, cfg *appconfig.AppConfig, defaultConfig ModelConfig) (RuntimeModelConfig, error) {
	agentCfg, err := newAgentRuntimeConfig(cfg)
	if err != nil {
		return RuntimeModelConfig{}, err
	}

	runtimeConfig := RuntimeModelConfig{
		Default: defaultConfig,
		Retry:   agentCfg.retry,
	}
	if agentCfg.supervisor.providerID != 0 {
		supervisorConfig, err := s.agentModelOverrideConfig(ctx, "顶层 Agent", agentCfg.supervisor.providerID, agentCfg.supervisor.model)
		if err != nil {
			return RuntimeModelConfig{}, err
		}
		runtimeConfig.Supervisor = &supervisorConfig
	}

	for _, child := range agentCfg.children {
		if child.providerID == 0 {
			continue
		}
		childConfig, err := s.agentModelOverrideConfig(ctx, "子 Agent "+child.name, child.providerID, child.model)
		if err != nil {
			return RuntimeModelConfig{}, err
		}
		if runtimeConfig.Children == nil {
			runtimeConfig.Children = make(map[string]ModelConfig)
		}
		runtimeConfig.Children[child.name] = childConfig
	}
	return runtimeConfig, nil
}

// agentModelOverrideConfig 读取单个 Agent 自定义模型对应的提供商凭据并补齐默认模型。
// 参数 ctx 表示请求上下文；参数 label 表示错误提示中的 Agent 名称；参数 providerID 表示自定义模型提供商 ID；参数 model 表示配置文件中的模型标识。
func (s *Service) agentModelOverrideConfig(ctx context.Context, label string, providerID uint64, model string) (ModelConfig, error) {
	provider, apiKey, err := s.providerCredential(ctx, providerID)
	if err != nil {
		return ModelConfig{}, fmt.Errorf("%w: %s 自定义模型提供商 %d 不可用: %v", ErrAgentConfigInvalid, label, providerID, err)
	}
	model = modelForChatRequest(model, provider.DefaultModel)
	if strings.TrimSpace(model) == "" {
		return ModelConfig{}, fmt.Errorf("%w: %s 自定义模型为空且提供商未配置默认模型", ErrAgentConfigInvalid, label)
	}
	return ModelConfig{
		ProviderID:   provider.ID,
		ProviderType: provider.ProviderType,
		APIType:      provider.APIType,
		APIKey:       apiKey,
		BaseURL:      provider.BaseURL,
		Model:        model,
	}, nil
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

// memoryForRun 读取本次 Agent 请求需要注入模型上下文的会话级记忆。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID，0 表示新会话且不注入旧记忆。
func (s *Service) memoryForRun(ctx context.Context, cfg *appconfig.AppConfig, novelID uint64, conversationID uint64) (AgentMemoryInput, error) {
	if novelID == 0 || conversationID == 0 {
		return AgentMemoryInput{}, nil
	}
	if s.memoryRepo == nil {
		return AgentMemoryInput{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversation, ok, err := s.memoryRepo.FindConversationByID(ctx, novelID, conversationID)
	if err != nil {
		return AgentMemoryInput{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	if !ok {
		return AgentMemoryInput{}, ErrConversationNotFound
	}

	messages, err := s.memoryRepo.ListRecentMessagesByUserRounds(ctx, conversation.ID, memoryRecentRounds(cfg))
	if err != nil {
		return AgentMemoryInput{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return AgentMemoryInput{
		Summary:  conversation.Summary,
		Messages: messages,
	}, nil
}

// saveSuccessfulTurn 将成功完成的一轮用户消息和助手回复写入会话级 Agent 记忆。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 req 表示本轮聊天请求；参数 result 表示 Agent 最终生成结果；参数 entryProviderID 表示用户入口请求使用的 AI 提供商 ID。
func (s *Service) saveSuccessfulTurn(ctx context.Context, cfg *appconfig.AppConfig, runtime AgentRuntime, req ChatRequest, result AgentResult, entryProviderID uint64) (savedTurnInfo, error) {
	if req.NovelID == 0 {
		return savedTurnInfo{}, nil
	}
	if err := ctx.Err(); err != nil {
		return savedTurnInfo{}, err
	}
	if s.memoryRepo == nil {
		return savedTurnInfo{}, fmt.Errorf("Agent 记忆仓储未初始化")
	}

	conversation, err := s.conversationForSuccessfulTurn(ctx, cfg, runtime, req)
	if err != nil {
		return savedTurnInfo{}, err
	}

	var chapterID *uint64
	if req.ChapterID != 0 {
		value := req.ChapterID
		chapterID = &value
	}
	assistantProviderID := result.ProviderID
	if assistantProviderID == 0 {
		assistantProviderID = entryProviderID
	}
	assistantModel := strings.TrimSpace(result.Model)
	if assistantModel == "" {
		assistantModel = req.Model
	}
	requestID := requestid.FromContext(ctx)
	messages := []MessageRecord{
		{
			ConversationID: conversation.ID,
			NovelID:        req.NovelID,
			ChapterID:      chapterID,
			Role:           MessageRoleUser,
			Content:        req.Message,
			ProviderID:     entryProviderID,
			Model:          req.Model,
			RequestID:      requestID,
		},
	}
	for _, reply := range agentRepliesForSave(result) {
		replyProviderID := reply.ProviderID
		if replyProviderID == 0 {
			replyProviderID = assistantProviderID
		}
		replyModel := strings.TrimSpace(reply.Model)
		if replyModel == "" {
			replyModel = assistantModel
		}
		messages = append(messages, MessageRecord{
			ConversationID: conversation.ID,
			NovelID:        req.NovelID,
			ChapterID:      chapterID,
			Role:           MessageRoleAssistant,
			Task:           reply.Task,
			Content:        reply.Content,
			ProviderID:     replyProviderID,
			Model:          replyModel,
			RequestID:      requestID,
		})
	}
	summary, err := s.summaryUpdateForTurn(ctx, cfg, runtime, conversation, messages)
	if err != nil {
		return savedTurnInfo{}, err
	}
	if err := ctx.Err(); err != nil {
		return savedTurnInfo{}, err
	}
	if err := s.memoryRepo.AppendMessagesAndUpdateSummary(ctx, conversation.ID, messages, summary); err != nil {
		return savedTurnInfo{}, err
	}
	return savedTurnInfo{
		ConversationID:    conversation.ID,
		ConversationTitle: conversation.Title,
	}, nil
}

// conversationForSuccessfulTurn 返回本轮成功消息应写入的 Agent 会话。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 req 表示本轮聊天请求。
func (s *Service) conversationForSuccessfulTurn(ctx context.Context, cfg *appconfig.AppConfig, runtime AgentRuntime, req ChatRequest) (*Conversation, error) {
	if req.ConversationID != 0 {
		conversation, ok, err := s.memoryRepo.FindConversationByID(ctx, req.NovelID, req.ConversationID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrConversationNotFound
		}
		return conversation, nil
	}

	title, err := s.conversationTitleForMessage(ctx, cfg, runtime, req.Message)
	if err != nil {
		return nil, err
	}
	return s.memoryRepo.CreateConversation(ctx, req.NovelID, title)
}

// conversationTitleForMessage 根据新会话首轮消息生成标题，模型失败时使用用户输入兜底。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 message 表示用户首轮消息。
func (s *Service) conversationTitleForMessage(ctx context.Context, cfg *appconfig.AppConfig, runtime AgentRuntime, message string) (string, error) {
	if runtime == nil {
		return fallbackConversationTitle(message), nil
	}
	title, err := runtime.GenerateConversationTitle(ctx, cfg, AgentConversationTitleInput{Message: message})
	if err != nil {
		if IsCanceledError(ctx, err) {
			return "", err
		}
		slog.WarnContext(ctx, "Agent 会话标题生成失败，使用用户输入兜底", "error", err)
		return fallbackConversationTitle(message), nil
	}
	return normalizeConversationTitle(title, message), nil
}

// IsCanceledError 判断当前错误是否由请求上下文取消或超时引起。
// 参数 ctx 表示请求上下文；参数 err 表示需要判断的错误。
func IsCanceledError(ctx context.Context, err error) bool {
	if ctx != nil && ctx.Err() != nil {
		return true
	}
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}

// summaryUpdateForTurn 计算本轮保存前是否需要生成新的滚动摘要。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 conversation 表示当前 Agent 会话；参数 pendingMessages 表示本轮即将写入的用户和助手消息。
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

// normalizedAgentReplies 返回可展示和可保存的分段助手回复列表。
// 参数 result 表示 Agent 本轮运行的最终结果。
func normalizedAgentReplies(result AgentResult) []AgentReply {
	replies := make([]AgentReply, 0, len(result.Replies))
	for _, reply := range result.Replies {
		if reply.Content == "" {
			continue
		}
		if reply.ReplyIndex <= 0 {
			reply.ReplyIndex = len(replies) + 1
		}
		if strings.TrimSpace(reply.Task) == "" {
			reply.Task = result.Task
		}
		if strings.TrimSpace(reply.AgentName) == "" {
			reply.AgentName = result.AgentName
		}
		if reply.ProviderID == 0 {
			reply.ProviderID = result.ProviderID
		}
		if strings.TrimSpace(reply.Model) == "" {
			reply.Model = result.Model
		}
		replies = append(replies, reply)
	}
	if len(replies) == 0 && result.Content != "" {
		replies = append(replies, AgentReply{
			ReplyIndex: 1,
			Task:       result.Task,
			Content:    result.Content,
			AgentName:  result.AgentName,
			ProviderID: result.ProviderID,
			Model:      result.Model,
		})
	}
	return replies
}

// streamRepliesForResult 将 Agent 运行结果转换为 done 事件中的分段回复列表。
// 参数 result 表示 Agent 本轮运行的最终结果。
func streamRepliesForResult(result AgentResult) []StreamReply {
	replies := normalizedAgentReplies(result)
	if len(replies) == 0 {
		return nil
	}
	items := make([]StreamReply, 0, len(replies))
	for _, reply := range replies {
		items = append(items, StreamReply{
			ReplyIndex: reply.ReplyIndex,
			Task:       reply.Task,
			Content:    reply.Content,
		})
	}
	return items
}

// agentRepliesForSave 返回需要写入记忆表的分段助手回复列表。
// 参数 result 表示 Agent 本轮运行的最终结果。
func agentRepliesForSave(result AgentResult) []AgentReply {
	return normalizedAgentReplies(result)
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

// fallbackConversationTitle 使用用户首轮输入生成会话标题兜底值。
// 参数 message 表示用户首轮消息。
func fallbackConversationTitle(message string) string {
	return normalizeConversationTitle(message, defaultConversationTitle)
}

// normalizeConversationTitle 清理并截断 Agent 会话标题。
// 参数 title 表示模型生成或候选标题；参数 fallback 表示标题为空时的兜底文本。
func normalizeConversationTitle(title string, fallback string) string {
	title = strings.TrimSpace(title)
	title = strings.TrimPrefix(title, "标题：")
	title = strings.TrimPrefix(title, "标题:")
	title = strings.Trim(title, "\"'`“”‘’")
	title = strings.Join(strings.Fields(title), " ")
	if title == "" {
		title = strings.TrimSpace(fallback)
	}
	if title == "" {
		title = defaultConversationTitle
	}
	return truncateRunes(title, maxConversationTitleLength)
}

// truncateRunes 按 rune 数量截断字符串。
// 参数 value 表示原始字符串；参数 limit 表示最多保留的 rune 数量。
func truncateRunes(value string, limit int) string {
	if limit <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

// conversationSummaryMessageID 返回会话已经纳入摘要的最新消息 ID。
// 参数 conversation 表示当前 Agent 会话。
func conversationSummaryMessageID(conversation *Conversation) uint64 {
	if conversation == nil || conversation.SummaryMessageID == nil {
		return 0
	}
	return *conversation.SummaryMessageID
}

// conversationResponses 将数据库会话模型转换为前端响应结构。
// 参数 conversations 表示数据库中的 Agent 会话列表。
func conversationResponses(conversations []Conversation) []ConversationResponse {
	if len(conversations) == 0 {
		return []ConversationResponse{}
	}

	items := make([]ConversationResponse, 0, len(conversations))
	for _, conversation := range conversations {
		items = append(items, ConversationResponse{
			ID:        conversation.ID,
			NovelID:   conversation.NovelID,
			Title:     normalizeConversationTitle(conversation.Title, defaultConversationTitle),
			CreatedAt: conversation.CreatedAt,
			UpdatedAt: conversation.UpdatedAt,
		})
	}
	return items
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
			ID:             message.ID,
			ConversationID: message.ConversationID,
			NovelID:        message.NovelID,
			ChapterID:      message.ChapterID,
			Role:           message.Role,
			Task:           message.Task,
			Content:        message.Content,
			CreatedAt:      message.CreatedAt,
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
	if errors.Is(err, ErrAgentNotConfigured) || errors.Is(err, ErrAgentConfigInvalid) {
		return "AI 写作智能体配置错误，请检查自定义模型配置"
	}
	if strings.TrimSpace(err.Error()) == "" {
		return "AI 生成失败，请稍后再试"
	}
	return "AI 生成失败，请检查模型、密钥或网络后重试"
}
