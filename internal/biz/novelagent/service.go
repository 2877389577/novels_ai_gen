package novelagent

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"
	appconfig "novels_ai_gen/internal/bootstrap/config"
	"novels_ai_gen/internal/requestid"
)

// Repository 表示小说写作 Agent 读取 AI 提供商配置的数据依赖。
type Repository interface {
	// GetByID 根据 ID 查询 AI 提供商。
	// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
	GetByID(ctx context.Context, id uint64) (*bizaiprovider.Provider, error)
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
}

// NewService 创建小说写作 Agent 业务服务。
// 参数 repo 表示 AI 提供商仓储；参数 cipher 表示 API Key 解密器；参数 prompts 表示提示词配置来源；参数 runtimeFactory 表示 Eino 多层 Agent 运行时工厂。
func NewService(repo Repository, cipher Cipher, prompts PromptProvider, runtimeFactory AgentRuntimeFactory) *Service {
	if runtimeFactory == nil {
		runtimeFactory = NewEinoAgentRuntimeFactory()
	}
	return &Service{
		repo:           repo,
		cipher:         cipher,
		prompts:        prompts,
		runtimeFactory: runtimeFactory,
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

	cfg := s.currentConfig()
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

	result, err := runtime.Stream(ctx, cfg, req, func(delta AgentDelta) error {
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

	return writer.WriteEvent(StreamEvent{Type: "done", Task: result.Task, Content: result.Content, Message: "ok"})
}

// ValidateChatRequest 校验小说写作 Agent 流式对话请求。
// 参数 req 表示流式对话请求。
func ValidateChatRequest(req ChatRequest) error {
	if req.ProviderID == 0 {
		return ErrProviderIDRequired
	}
	if strings.TrimSpace(req.Model) == "" {
		return ErrModelRequired
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

// currentConfig 返回当前运行配置快照。
func (s *Service) currentConfig() *appconfig.AppConfig {
	if s.prompts == nil {
		return appconfig.Get()
	}
	return s.prompts.Current()
}

// normalizeChatRequest 标准化小说写作 Agent 请求。
// 参数 req 表示原始流式对话请求。
func normalizeChatRequest(req ChatRequest) ChatRequest {
	req.Model = strings.TrimSpace(req.Model)
	req.Message = strings.TrimSpace(req.Message)
	if req.PromptParams == nil {
		req.PromptParams = map[string]string{}
		return req
	}

	params := make(map[string]string, len(req.PromptParams))
	for key, value := range req.PromptParams {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		params[key] = strings.TrimSpace(value)
	}
	req.PromptParams = params
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
