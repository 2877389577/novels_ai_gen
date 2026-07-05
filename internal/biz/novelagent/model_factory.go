package novelagent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	einoclaude "github.com/cloudwego/eino-ext/components/model/claude"
	einoopenai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/adk"
	"github.com/cloudwego/eino/adk/middlewares/summarization"
	einomodel "github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"github.com/cloudwego/eino/schema/openai"

	"novels_ai_gen/internal/aihttp"
	"novels_ai_gen/internal/aiurl"
	agenttools "novels_ai_gen/internal/biz/novelagent/tools"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

const (
	providerTypeOpenAI = "openai"
	providerTypeClaude = "claude"
	defaultMaxTokens   = 4096
	defaultTimeout     = 300 * time.Second
)

const summarySystemPrompt = "你是小说写作 Agent 的长期记忆摘要器。请把旧摘要和新增对话整理成一份紧凑、准确、可持续更新的中文摘要，保留用户偏好、小说设定、角色关系、写作要求、已经确认的修改方向和重要上下文。不要输出寒暄、标题或 Markdown 代码块，只输出摘要正文。"

const conversationTitleSystemPrompt = "你是小说写作 AI 会话标题生成器。请根据用户开启会话时发送的第一句话，生成一个中文会话标题。标题必须不超过 50 个字，简洁具体，不要输出解释、引号、前缀、Markdown 或多行内容。"

// EinoAgentRuntimeFactory 表示基于 Eino ADK 的多层 Agent 运行时工厂。
type EinoAgentRuntimeFactory struct {
	// chapterReader 表示 get_content 工具读取章节正文所需的数据依赖。
	chapterReader agenttools.ChapterReader
	// novelSummaryStore 表示小说滚动总结工具读写总结所需的数据依赖。
	novelSummaryStore agenttools.NovelSummaryStore
	// novelOutlineStore 表示小说大纲工具读写大纲所需的数据依赖。
	novelOutlineStore agenttools.NovelOutlineStore
	// characterStore 表示角色信息工具读写角色卡数据所需的数据依赖。
	characterStore agenttools.CharacterStore
	// relationshipGraphStore 表示角色关系图工具读取直接关系所需的数据依赖。
	relationshipGraphStore agenttools.RelationshipGraphStore
}

// NewEinoAgentRuntimeFactory 创建基于 Eino ADK 的多层 Agent 运行时工厂。
// 参数 chapterReader 表示 get_content 工具读取章节正文所需的数据依赖；参数 novelSummaryStore 表示小说滚动总结工具读写总结所需的数据依赖；参数 novelOutlineStore 表示小说大纲工具读写大纲所需的数据依赖；参数 characterStore 表示角色信息工具读写角色卡数据所需的数据依赖；参数 relationshipGraphStore 表示角色关系图工具读取直接关系所需的数据依赖。
func NewEinoAgentRuntimeFactory(chapterReader agenttools.ChapterReader, novelSummaryStore agenttools.NovelSummaryStore, novelOutlineStore agenttools.NovelOutlineStore, characterStore agenttools.CharacterStore, relationshipGraphStore agenttools.RelationshipGraphStore) *EinoAgentRuntimeFactory {
	return &EinoAgentRuntimeFactory{chapterReader: chapterReader, novelSummaryStore: novelSummaryStore, novelOutlineStore: novelOutlineStore, characterStore: characterStore, relationshipGraphStore: relationshipGraphStore}
}

// GenerateText 根据模型配置直接生成一段文本，不创建多层 Agent。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置；参数 retry 表示模型失败重试配置；参数 input 表示本次生成的提示词。
func (f *EinoAgentRuntimeFactory) GenerateText(ctx context.Context, cfg ModelConfig, retry RuntimeRetryConfig, input ModelTextInput) (string, error) {
	cfg = normalizeModelConfig(cfg)
	retry = normalizeRuntimeRetryConfig(retry)

	model, err := f.newChatModel(ctx, cfg)
	if err != nil {
		return "", err
	}
	return generateTextWithRetry(ctx, retry, func() (string, error) {
		output, err := model.Generate(ctx, []*schema.Message{
			schema.SystemMessage(input.SystemPrompt),
			schema.UserMessage(input.UserPrompt),
		})
		if err != nil {
			return "", err
		}
		if output == nil {
			return "", fmt.Errorf("模型返回空消息")
		}
		return output.Content, nil
	})
}

// generateTextWithRetry 按运行时重试配置执行直接文本生成。
// 参数 ctx 表示请求上下文；参数 retry 表示模型失败重试配置；参数 generate 表示单次模型生成函数。
func generateTextWithRetry(ctx context.Context, retry RuntimeRetryConfig, generate func() (string, error)) (string, error) {
	if generate == nil {
		return "", fmt.Errorf("模型生成函数未初始化")
	}
	var lastErr error
	for attempt := 0; attempt <= retry.MaxRetries; attempt += 1 {
		content, err := generate()
		if err == nil {
			return content, nil
		}
		lastErr = err
		if attempt >= retry.MaxRetries || !isRetryableModelError(ctx, err) {
			break
		}
		timer := time.NewTimer(retry.Backoff)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
			return "", ctx.Err()
		case <-timer.C:
		}
	}
	return "", lastErr
}

// NewRuntime 按 AI 提供商协议创建 Eino 多层 Agent 运行时。
// 参数 ctx 表示请求上下文；参数 cfg 表示入口模型和启用 Agent 模型配置。
func (f *EinoAgentRuntimeFactory) NewRuntime(ctx context.Context, cfg RuntimeModelConfig) (AgentRuntime, error) {
	cfg = normalizeRuntimeModelConfig(cfg)
	if err := validateRuntimeModelConfig(cfg); err != nil {
		return nil, err
	}

	registry := newAgentModelConfigRegistry(cfg)
	defaultModel, err := f.newChatModel(ctx, cfg.Default)
	if err != nil {
		return nil, err
	}
	supervisorModel := defaultModel
	if cfg.Supervisor != nil {
		supervisorModel, err = f.newChatModel(ctx, *cfg.Supervisor)
		if err != nil {
			return nil, err
		}
	}
	childModels, err := f.newChatChildModels(ctx, cfg.Children)
	if err != nil {
		return nil, err
	}
	return chatAgentRuntime{
		model:                  defaultModel,
		supervisorModel:        supervisorModel,
		childModels:            childModels,
		modelConfigs:           registry,
		chapterReader:          f.chapterReader,
		novelSummaryStore:      f.novelSummaryStore,
		novelOutlineStore:      f.novelOutlineStore,
		characterStore:         f.characterStore,
		relationshipGraphStore: f.relationshipGraphStore,
	}, nil
}

// newChatModel 创建 schema.Message 路径使用的 Eino ChatModel。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
func (f *EinoAgentRuntimeFactory) newChatModel(ctx context.Context, cfg ModelConfig) (einomodel.BaseChatModel, error) {
	_ = f
	if err := validateModelConfig("Agent", cfg); err != nil {
		return nil, err
	}
	switch cfg.ProviderType {
	case providerTypeOpenAI:
		return newOpenAIChatModel(ctx, cfg)
	case providerTypeClaude:
		return newClaudeChatModel(ctx, cfg)
	default:
		return nil, fmt.Errorf("不支持的 AI 提供商类型: %s", cfg.ProviderType)
	}
}

// newOpenAIChatModel 创建 OpenAI 协议的 Eino ChatModel。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
func newOpenAIChatModel(ctx context.Context, cfg ModelConfig) (einomodel.BaseChatModel, error) {
	baseURL, err := aiurl.NormalizeOpenAIBaseURL(cfg.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("%w: OpenAI 服务根地址格式无效", ErrAgentConfigInvalid)
	}
	modelConfig := &einoopenai.ChatModelConfig{
		APIKey:  cfg.APIKey,
		BaseURL: baseURL,
		Model:   cfg.Model,
		Timeout: defaultTimeout,
	}
	httpClient, err := newModelHTTPClient(cfg, defaultTimeout)
	if err != nil {
		return nil, err
	}
	modelConfig.HTTPClient = httpClient

	reasoningEffort, ok, err := chatModelReasoningEffort(cfg)
	if err != nil {
		return nil, err
	}
	if ok {
		modelConfig.ReasoningEffort = reasoningEffort
	}

	model, err := einoopenai.NewChatModel(ctx, modelConfig)
	if err != nil {
		return nil, err
	}
	return model, nil
}

// newClaudeChatModel 创建 Claude 协议的 Eino ChatModel。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
func newClaudeChatModel(ctx context.Context, cfg ModelConfig) (einomodel.BaseChatModel, error) {
	baseURL, err := aiurl.NormalizeClaudeBaseURL(cfg.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("%w: Claude 服务根地址格式无效", ErrAgentConfigInvalid)
	}
	httpClient, err := newModelHTTPClient(cfg, defaultTimeout)
	if err != nil {
		return nil, err
	}
	modelConfig := &einoclaude.Config{
		APIKey:     cfg.APIKey,
		Model:      cfg.Model,
		MaxTokens:  defaultMaxTokens,
		HTTPClient: httpClient,
	}
	if baseURL != "" {
		modelConfig.BaseURL = &baseURL
	}
	model, err := einoclaude.NewChatModel(ctx, modelConfig)
	if err != nil {
		return nil, err
	}
	return model, nil
}

// newChatChildModels 创建启用子 Agent 的 ChatModel 覆盖集合。
// 参数 ctx 表示请求上下文；参数 configs 表示按子 Agent 名称索引的模型覆盖配置。
func (f *EinoAgentRuntimeFactory) newChatChildModels(ctx context.Context, configs map[string]ModelConfig) (map[string]einomodel.BaseChatModel, error) {
	if len(configs) == 0 {
		return nil, nil
	}
	models := make(map[string]einomodel.BaseChatModel, len(configs))
	for name, cfg := range configs {
		model, err := f.newChatModel(ctx, cfg)
		if err != nil {
			return nil, fmt.Errorf("创建子 Agent %s 自定义模型失败: %w", name, err)
		}
		models[name] = model
	}
	return models, nil
}

// normalizeRuntimeModelConfig 标准化一次 Agent 运行中的所有模型配置。
// 参数 cfg 表示入口模型和启用 Agent 模型配置。
func normalizeRuntimeModelConfig(cfg RuntimeModelConfig) RuntimeModelConfig {
	cfg.Default = normalizeModelConfig(cfg.Default)
	cfg.Retry = normalizeRuntimeRetryConfig(cfg.Retry)
	if cfg.Supervisor != nil {
		supervisor := normalizeModelConfig(*cfg.Supervisor)
		cfg.Supervisor = &supervisor
	}
	if len(cfg.Children) > 0 {
		children := make(map[string]ModelConfig, len(cfg.Children))
		for name, childCfg := range cfg.Children {
			name = strings.TrimSpace(name)
			if name == "" {
				continue
			}
			children[name] = normalizeModelConfig(childCfg)
		}
		cfg.Children = children
	}
	return cfg
}

// normalizeRuntimeRetryConfig 标准化一次 Agent 运行中的模型失败重试配置。
// 参数 cfg 表示运行时重试配置。
func normalizeRuntimeRetryConfig(cfg RuntimeRetryConfig) RuntimeRetryConfig {
	if cfg.MaxRetries < 0 {
		cfg.MaxRetries = 0
	}
	if cfg.Backoff <= 0 {
		cfg.Backoff = defaultAgentRetryBackoff
	}
	return cfg
}

// normalizeModelConfig 标准化单个模型创建配置。
// 参数 cfg 表示模型创建配置。
func normalizeModelConfig(cfg ModelConfig) ModelConfig {
	cfg.ProviderType = strings.ToLower(strings.TrimSpace(cfg.ProviderType))
	if cfg.ProviderType == "" {
		cfg.ProviderType = providerTypeOpenAI
	}
	cfg.BaseURL = strings.TrimSpace(cfg.BaseURL)
	cfg.HTTPProxy = strings.TrimSpace(cfg.HTTPProxy)
	cfg.Model = strings.TrimSpace(cfg.Model)
	cfg.ReasoningEffort = strings.ToLower(strings.TrimSpace(cfg.ReasoningEffort))
	cfg.UserAgent = strings.TrimSpace(cfg.UserAgent)
	return cfg
}

// newModelHTTPClient 创建模型请求专用 HTTP client。
// 参数 cfg 表示模型创建配置；参数 timeout 表示请求超时时间。
func newModelHTTPClient(cfg ModelConfig, timeout time.Duration) (*http.Client, error) {
	client, err := aihttp.NewClient(aihttp.ClientConfig{
		HTTPProxy: cfg.HTTPProxy,
		UserAgent: cfg.UserAgent,
		Timeout:   timeout,
	})
	if err != nil {
		return nil, fmt.Errorf("创建模型 HTTP 客户端失败: %w", err)
	}
	return client, nil
}

// chatModelReasoningEffort 返回 ChatModel 应使用的 GPT 推理强度。
// 参数 cfg 表示模型创建配置。
func chatModelReasoningEffort(cfg ModelConfig) (einoopenai.ReasoningEffortLevel, bool, error) {
	if !isGPTModel(cfg.Model) {
		return "", false, nil
	}

	effort := strings.ToLower(strings.TrimSpace(cfg.ReasoningEffort))
	if effort == "" {
		return einoopenai.ReasoningEffortLevel(openai.ReasoningEffortHigh), true, nil
	}

	switch openai.ReasoningEffort(effort) {
	case openai.ReasoningEffortLow, openai.ReasoningEffortMedium, openai.ReasoningEffortHigh:
		return einoopenai.ReasoningEffortLevel(effort), true, nil
	default:
		return "", false, fmt.Errorf("%w: reasoning_effort 仅支持 low、medium、high", ErrAgentConfigInvalid)
	}
}

// isGPTModel 判断模型名称是否属于 GPT 类模型。
// 参数 model 表示模型标识。
func isGPTModel(model string) bool {
	return strings.Contains(strings.ToLower(strings.TrimSpace(model)), "gpt")
}

// validateRuntimeModelConfig 校验一次运行中的模型配置。
// 参数 cfg 表示模型创建配置。
func validateRuntimeModelConfig(cfg RuntimeModelConfig) error {
	if err := validateModelConfig("入口 Agent", cfg.Default); err != nil {
		return err
	}
	if cfg.Supervisor != nil {
		if err := validateModelConfig("顶层 Agent", *cfg.Supervisor); err != nil {
			return err
		}
	}
	for name, childCfg := range cfg.Children {
		if err := validateModelConfig("子 Agent "+name, childCfg); err != nil {
			return err
		}
	}
	return nil
}

// validateModelConfig 校验单个 Agent 模型配置。
// 参数 label 表示错误提示中的 Agent 名称；参数 cfg 表示需要校验的模型配置。
func validateModelConfig(label string, cfg ModelConfig) error {
	switch cfg.ProviderType {
	case providerTypeOpenAI, providerTypeClaude:
	default:
		return fmt.Errorf("%w: %s 模型 API 协议仅支持 openai 或 claude", ErrAgentConfigInvalid, label)
	}
	return nil
}

// agentModelConfigRegistry 表示 Agent 名称到实际模型配置的查询表。
type agentModelConfigRegistry struct {
	// defaultConfig 表示未配置自定义模型的 Agent 继承的入口模型配置。
	defaultConfig ModelConfig
	// supervisorConfigured 表示顶层 Agent 是否配置了自定义模型。
	supervisorConfigured bool
	// supervisorConfig 表示顶层 Agent 实际使用的模型配置。
	supervisorConfig ModelConfig
	// childConfigs 表示启用子 Agent 的模型配置，键为子 Agent 名称。
	childConfigs map[string]ModelConfig
}

// newAgentModelConfigRegistry 创建 Agent 模型配置查询表。
// 参数 cfg 表示一次运行中的模型配置集合。
func newAgentModelConfigRegistry(cfg RuntimeModelConfig) agentModelConfigRegistry {
	registry := agentModelConfigRegistry{
		defaultConfig: cfg.Default,
		childConfigs:  cfg.Children,
	}
	if cfg.Supervisor != nil {
		registry.supervisorConfigured = true
		registry.supervisorConfig = *cfg.Supervisor
	}
	return registry
}

// configForAgent 返回指定 Agent 实际使用的模型配置。
// 参数 agentName 表示 Eino 事件来源 Agent 名称；参数 supervisorName 表示顶层 Agent 名称。
func (r agentModelConfigRegistry) configForAgent(agentName string, supervisorName string) ModelConfig {
	agentName = strings.TrimSpace(agentName)
	if agentName == "" || agentName == supervisorName {
		if r.supervisorConfigured {
			return r.supervisorConfig
		}
		return r.defaultConfig
	}
	if cfg, ok := r.childConfigs[agentName]; ok {
		return cfg
	}
	return r.defaultConfig
}

// applyResultModelInfo 将最终回复来源 Agent 的实际模型信息写入结果。
// 参数 result 表示 Agent 流式运行结果；参数 supervisorName 表示顶层 Agent 名称；参数 registry 表示 Agent 模型配置查询表。
func applyResultModelInfo(result AgentResult, supervisorName string, registry agentModelConfigRegistry) AgentResult {
	if strings.TrimSpace(result.AgentName) == "" {
		result.AgentName = supervisorName
	}
	cfg := registry.configForAgent(result.AgentName, supervisorName)
	result.ProviderID = cfg.ProviderID
	result.Model = cfg.Model
	for index := range result.Replies {
		replyAgentName := result.Replies[index].AgentName
		if strings.TrimSpace(replyAgentName) == "" {
			replyAgentName = result.AgentName
			result.Replies[index].AgentName = replyAgentName
		}
		replyCfg := registry.configForAgent(replyAgentName, supervisorName)
		result.Replies[index].ProviderID = replyCfg.ProviderID
		result.Replies[index].Model = replyCfg.Model
	}
	for index := range result.MemoryEvents {
		eventAgentName := result.MemoryEvents[index].AgentName
		if strings.TrimSpace(eventAgentName) == "" {
			eventAgentName = result.AgentName
			result.MemoryEvents[index].AgentName = eventAgentName
		}
		eventCfg := registry.configForAgent(eventAgentName, supervisorName)
		result.MemoryEvents[index].ProviderID = eventCfg.ProviderID
		result.MemoryEvents[index].Model = eventCfg.Model
	}
	return result
}

// chatAgentRuntime 表示基于 schema.Message 的 Eino ADK 多层 Agent 运行时。
type chatAgentRuntime struct {
	// model 表示支持 OpenAI completions 协议的 Eino ChatModel。
	model einomodel.BaseChatModel
	// supervisorModel 表示顶层 Agent 实际使用的 Eino ChatModel。
	supervisorModel einomodel.BaseChatModel
	// childModels 表示启用子 Agent 的自定义 ChatModel，未配置的子 Agent 使用入口模型。
	childModels map[string]einomodel.BaseChatModel
	// modelConfigs 表示 Agent 名称到实际模型配置的查询表。
	modelConfigs agentModelConfigRegistry
	// chapterReader 表示 get_content 工具读取章节正文所需的数据依赖。
	chapterReader agenttools.ChapterReader
	// novelSummaryStore 表示小说滚动总结工具读写总结所需的数据依赖。
	novelSummaryStore agenttools.NovelSummaryStore
	// novelOutlineStore 表示小说大纲工具读写大纲所需的数据依赖。
	novelOutlineStore agenttools.NovelOutlineStore
	// characterStore 表示角色信息工具读写角色卡数据所需的数据依赖。
	characterStore agenttools.CharacterStore
	// relationshipGraphStore 表示角色关系图工具读取直接关系所需的数据依赖。
	relationshipGraphStore agenttools.RelationshipGraphStore
}

// Stream 流式执行基于 schema.Message 的小说写作 Agent。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 memory 表示需要注入模型上下文的会话级记忆；参数 control 表示 checkpoint 控制参数；参数 emit 表示文本增量回调。
func (r chatAgentRuntime) Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, memory AgentMemoryInput, control AgentRunControl, emit func(delta AgentDelta) error) (AgentResult, error) {
	agentCfg, err := newAgentRuntimeConfig(cfg)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	agent, err := newChatSupervisorAgent(ctx, r.model, r.supervisorModel, r.childModels, agentCfg, req, r.chapterReader, r.novelSummaryStore, r.novelOutlineStore, r.characterStore, r.relationshipGraphStore)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	runner := adk.NewTypedRunner(adk.TypedRunnerConfig[*schema.Message]{
		Agent:           agent,
		EnableStreaming: true,
		CheckPointStore: control.CheckPointStore,
	})
	result, err := streamChatAgentEvents(runner.Run(ctx, chatRunMessages(req, memory), agentRunOptions(control)...), control.CheckPointID, agentCfg.taskByAgent, emit)
	if err != nil {
		return result, err
	}
	return applyResultModelInfo(result, agentCfg.supervisor.name, r.modelConfigs), nil
}

// Resume 从人工审核中断点恢复基于 schema.Message 的小说写作 Agent。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示原始流式聊天请求；参数 memory 表示需要注入模型上下文的会话级记忆；参数 control 表示 checkpoint 控制参数；参数 approval 表示用户审核决策；参数 emit 表示文本增量回调。
func (r chatAgentRuntime) Resume(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, memory AgentMemoryInput, control AgentRunControl, approval ToolApprovalResumeData, emit func(delta AgentDelta) error) (AgentResult, error) {
	agentCfg, err := newAgentRuntimeConfig(cfg)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	agent, err := newChatSupervisorAgent(ctx, r.model, r.supervisorModel, r.childModels, agentCfg, req, r.chapterReader, r.novelSummaryStore, r.novelOutlineStore, r.characterStore, r.relationshipGraphStore)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	runner := adk.NewTypedRunner(adk.TypedRunnerConfig[*schema.Message]{
		Agent:           agent,
		EnableStreaming: true,
		CheckPointStore: control.CheckPointStore,
	})
	iterator, err := runner.ResumeWithParams(ctx, control.CheckPointID, &adk.ResumeParams{
		Targets: map[string]any{control.InterruptID: approval},
	})
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}
	result, err := streamChatAgentEvents(iterator, control.CheckPointID, agentCfg.taskByAgent, emit)
	if err != nil {
		return result, err
	}
	return applyResultModelInfo(result, agentCfg.supervisor.name, r.modelConfigs), nil
}

// Summarize 使用 schema.Message 模型生成会话级 Agent 滚动摘要。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示需要压缩进摘要的历史上下文。
func (r chatAgentRuntime) Summarize(ctx context.Context, cfg *appconfig.AppConfig, input AgentSummaryInput) (string, error) {
	messages := []*schema.Message{
		schema.SystemMessage(summarySystemPrompt),
		schema.UserMessage(summaryUserPrompt(input)),
	}
	output, err := r.model.Generate(ctx, messages)
	if err != nil {
		return "", err
	}
	if output == nil {
		return "", fmt.Errorf("摘要模型返回空消息")
	}
	return normalizeSummaryContent(output.Content)
}

// GenerateConversationTitle 使用 schema.Message 模型生成新 Agent 会话标题。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示标题生成输入。
func (r chatAgentRuntime) GenerateConversationTitle(ctx context.Context, cfg *appconfig.AppConfig, input AgentConversationTitleInput) (string, error) {
	_ = cfg
	messages := []*schema.Message{
		schema.SystemMessage(conversationTitleSystemPrompt),
		schema.UserMessage(conversationTitleUserPrompt(input)),
	}
	output, err := r.model.Generate(ctx, messages)
	if err != nil {
		return "", err
	}
	if output == nil {
		return "", fmt.Errorf("会话标题模型返回空消息")
	}
	return normalizeConversationTitleContent(output.Content)
}

// chatRunMessages 构造 schema.Message 路径的 Agent 输入消息列表。
// 参数 req 表示本轮聊天请求；参数 memory 表示需要注入模型上下文的会话级记忆。
func chatRunMessages(req ChatRequest, memory AgentMemoryInput) []*schema.Message {
	messages := make([]*schema.Message, 0, len(memory.Messages)+3)
	if prompt := memorySummaryPrompt(memory.Summary); prompt != "" {
		messages = append(messages, schema.SystemMessage(prompt))
	}
	for _, item := range memory.Messages {
		content := strings.TrimSpace(item.Content)
		if content == "" {
			continue
		}
		switch item.Role {
		case MessageRoleUser:
			messages = append(messages, schema.UserMessage(item.Content))
		case MessageRoleAssistant, MessageRoleFunctionCall, MessageRoleFunctionResult:
			messages = append(messages, schema.AssistantMessage(item.Content, nil))
		}
	}
	messages = append(messages, schema.UserMessage(req.Message))
	return messages
}

// agentRunOptions 构造 Agent Runner 运行选项。
// 参数 control 表示本轮运行的 checkpoint 控制参数。
func agentRunOptions(control AgentRunControl) []adk.AgentRunOption {
	if strings.TrimSpace(control.CheckPointID) == "" || control.CheckPointStore == nil {
		return nil
	}
	return []adk.AgentRunOption{adk.WithCheckPointID(control.CheckPointID)}
}

// agentFunctionToolCall 表示可写入记忆的函数工具调用摘要。
type agentFunctionToolCall struct {
	// Name 表示被调用的工具名称。
	Name string
}

// agentFunctionToolResult 表示可写入记忆的函数工具结果摘要。
type agentFunctionToolResult struct {
	// ID 表示对应的工具调用 ID。
	ID string
	// Content 表示工具返回给模型的文本结果。
	Content string
}

// encodeFunctionCallMemoryContent 将函数工具调用列表编码为纯文本记忆正文。
// 参数 calls 表示需要写入记忆的函数工具调用列表。
func encodeFunctionCallMemoryContent(calls []agentFunctionToolCall) (string, bool) {
	if len(calls) == 0 {
		return "", false
	}
	lines := make([]string, 0, len(calls))
	for _, call := range calls {
		name := strings.TrimSpace(call.Name)
		if name == "" {
			continue
		}
		lines = append(lines, "Tool Call:"+name)
	}
	if len(lines) == 0 {
		return "", false
	}
	return strings.Join(lines, "\n"), true
}

// encodeFunctionResultMemoryContent 将函数工具结果列表编码为纯文本记忆正文。
// 参数 results 表示需要写入记忆的函数工具结果列表。
func encodeFunctionResultMemoryContent(results []agentFunctionToolResult) (string, bool) {
	if len(results) == 0 {
		return "", false
	}
	lines := make([]string, 0, len(results))
	for _, result := range results {
		id := strings.TrimSpace(result.ID)
		if id == "" && strings.TrimSpace(result.Content) == "" {
			continue
		}
		lines = append(lines, fmt.Sprintf(
			"Tool ID:%s, Original token count:%d, Output:%s",
			id,
			estimateTextTokens(result.Content),
			result.Content,
		))
	}
	if len(lines) == 0 {
		return "", false
	}
	return strings.Join(lines, "\n"), true
}

// requestContextPrompt 生成仅用于本轮模型输入的请求上下文提示，不写入记忆。
// 参数 req 表示本轮聊天请求。
func requestContextPrompt(req ChatRequest) string {
	chapterIDText := fmt.Sprintf("%d", req.ChapterID)
	if req.ChapterID == 0 {
		chapterIDText = "0（未关联具体章节）"
	}
	chapterNumberText := fmt.Sprintf("%d", req.ChapterNumber)
	if req.ChapterNumber == 0 {
		chapterNumberText = "0（未传当前章节号）"
	}
	return fmt.Sprintf(`本轮请求上下文：
- novel_id: %d
  含义：当前小说的数据库主键 ID；调用小说级工具或章节查询工具时可用于定位小说；不是作品排序号。
- chapter_id: %s
  含义：当前章节的数据库主键 ID；用于按章节 ID 定位章节；不是“第几章”，禁止根据它推断章节号。
- chapter_number: %s
  含义：当前章节号，即“第 N 章”中的 N；当需要判断当前是第几章，或按章节号查询/更新章节时使用它。
说明：chapter_id 和 chapter_number 是两个不同字段；当前章节真实顺序以 chapter_number 或工具查询结果为准。`,
		req.NovelID,
		chapterIDText,
		chapterNumberText,
	)
}

// instructionWithRequestContext 将本轮请求上下文追加到 Agent 系统提示词末尾。
// 参数 instruction 表示配置文件中的原始 Agent 系统提示词；参数 req 表示本轮聊天请求。
func instructionWithRequestContext(instruction string, req ChatRequest) string {
	instruction = strings.TrimSpace(instruction)
	contextPrompt := requestContextPrompt(req)
	if instruction == "" {
		return contextPrompt
	}
	return instruction + "\n\n" + contextPrompt
}

// memorySummaryPrompt 生成注入模型上下文的长期记忆摘要提示。
// 参数 summary 表示数据库中保存的滚动摘要。
func memorySummaryPrompt(summary string) string {
	summary = strings.TrimSpace(summary)
	if summary == "" {
		return ""
	}
	return "以下是当前小说此前对话的长期记忆摘要。请在理解用户当前问题时参考它，但不要主动复述摘要：\n" + summary
}

// summaryUserPrompt 生成滚动摘要模型的用户消息。
// 参数 input 表示旧摘要和本次需要滚入摘要的历史消息。
func summaryUserPrompt(input AgentSummaryInput) string {
	var builder strings.Builder
	previousSummary := strings.TrimSpace(input.PreviousSummary)
	if previousSummary == "" {
		builder.WriteString("旧摘要：无\n\n")
	} else {
		builder.WriteString("旧摘要：\n")
		builder.WriteString(previousSummary)
		builder.WriteString("\n\n")
	}
	builder.WriteString("需要滚入摘要的新对话：\n")
	for _, message := range input.Messages {
		if strings.TrimSpace(message.Content) == "" {
			continue
		}
		builder.WriteString(summaryMessageRoleLabel(message.Role))
		builder.WriteString("：")
		builder.WriteString(message.Content)
		builder.WriteString("\n")
	}
	return builder.String()
}

// conversationTitleUserPrompt 生成会话标题模型的用户消息。
// 参数 input 表示新会话标题生成输入。
func conversationTitleUserPrompt(input AgentConversationTitleInput) string {
	return "用户第一句话：\n" + strings.TrimSpace(input.Message)
}

// normalizeConversationTitleContent 标准化标题模型返回的标题正文。
// 参数 content 表示模型生成的原始标题文本。
func normalizeConversationTitleContent(content string) (string, error) {
	title := strings.TrimSpace(content)
	title = strings.TrimPrefix(title, "标题：")
	title = strings.TrimPrefix(title, "标题:")
	title = strings.Trim(title, "\"'`“”‘’")
	title = strings.Join(strings.Fields(title), " ")
	if title == "" {
		return "", fmt.Errorf("会话标题模型返回空内容")
	}
	return truncateRunes(title, maxConversationTitleLength), nil
}

// summaryMessageRoleLabel 返回摘要提示中使用的消息角色名称。
// 参数 role 表示 Agent 记忆消息角色。
func summaryMessageRoleLabel(role MessageRole) string {
	switch role {
	case MessageRoleUser:
		return "用户"
	case MessageRoleAssistant:
		return "助手"
	case MessageRoleFunctionCall:
		return "函数调用"
	case MessageRoleFunctionResult:
		return "工具结果"
	default:
		return "未知"
	}
}

// normalizeSummaryContent 标准化摘要模型返回的正文。
// 参数 content 表示模型生成的原始摘要文本。
func normalizeSummaryContent(content string) (string, error) {
	if strings.TrimSpace(content) == "" {
		return "", fmt.Errorf("摘要模型返回空内容")
	}
	return content, nil
}

// newChatSupervisorAgent 创建基于 schema.Message 的顶层 Agent，并把配置中的子 Agent 包装为 tool。
// 参数 ctx 表示请求上下文；参数 defaultModel 表示入口 ChatModel；参数 supervisorModel 表示顶层 Agent 使用的 ChatModel；参数 childModels 表示子 Agent 自定义 ChatModel；参数 cfg 表示运行时 Agent 配置；参数 req 表示流式聊天请求；参数 chapterReader 表示章节读取依赖；参数 novelSummaryStore 表示小说滚动总结读写依赖；参数 novelOutlineStore 表示小说大纲读写依赖；参数 characterStore 表示角色信息读写依赖；参数 relationshipGraphStore 表示角色关系图读取依赖。
func newChatSupervisorAgent(ctx context.Context, defaultModel einomodel.BaseChatModel, supervisorModel einomodel.BaseChatModel, childModels map[string]einomodel.BaseChatModel, cfg runtimeAgentConfig, req ChatRequest, chapterReader agenttools.ChapterReader, novelSummaryStore agenttools.NovelSummaryStore, novelOutlineStore agenttools.NovelOutlineStore, characterStore agenttools.CharacterStore, relationshipGraphStore agenttools.RelationshipGraphStore) (*adk.TypedChatModelAgent[*schema.Message], error) {
	if err := adk.SetLanguage(adk.LanguageChinese); err != nil {
		return nil, err
	}

	supervisorTools, err := configuredAgentTools(req, cfg.supervisor, cfg.tools, chapterReader, novelSummaryStore, novelOutlineStore, characterStore, relationshipGraphStore)
	if err != nil {
		return nil, err
	}

	tools := make([]tool.BaseTool, 0, len(supervisorTools)+len(cfg.children))
	tools = append(tools, supervisorTools...)
	returnDirectly := make(map[string]bool, len(cfg.children))
	childAgentToolNames := make(map[string]struct{}, len(cfg.children))
	for _, child := range cfg.children {
		childTools, err := configuredAgentTools(req, child, cfg.tools, chapterReader, novelSummaryStore, novelOutlineStore, characterStore, relationshipGraphStore)
		if err != nil {
			return nil, err
		}
		childModel := defaultModel
		if configuredModel, ok := childModels[child.name]; ok {
			childModel = configuredModel
		}
		childHandlers, err := chatAgentHandlers(ctx, childModel, cfg.memory, nil)
		if err != nil {
			return nil, fmt.Errorf("创建子 Agent %s 上下文压缩中间件失败: %w", child.name, err)
		}
		childAgent, err := adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.Message]{
			Name:             child.name,
			Description:      child.description,
			Instruction:      instructionWithRequestContext(child.instruction, req),
			Model:            childModel,
			ToolsConfig:      childToolsConfig(childTools),
			Handlers:         childHandlers,
			MaxIterations:    child.maxIterations,
			ModelRetryConfig: chatModelRetryConfig(cfg.retry),
		})
		if err != nil {
			return nil, fmt.Errorf("创建子 Agent %s 失败: %w", child.name, err)
		}
		tools = append(tools, adk.NewAgentTool(
			ctx,
			childAgent,
			childAgentToolOptions(child)...,
		))
		returnDirectly[child.name] = true
		childAgentToolNames[child.name] = struct{}{}
	}

	supervisorHandlers, err := chatAgentHandlers(ctx, supervisorModel, cfg.memory, childAgentToolNames)
	if err != nil {
		return nil, fmt.Errorf("创建顶层 Agent 上下文压缩中间件失败: %w", err)
	}
	return adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.Message]{
		Name:        cfg.supervisor.name,
		Description: cfg.supervisor.description,
		Instruction: instructionWithRequestContext(cfg.supervisor.instruction, req),
		Model:       supervisorModel,
		ToolsConfig: adk.ToolsConfig{
			ToolsNodeConfig: compose.ToolsNodeConfig{
				Tools:               tools,
				ExecuteSequentially: true,
			},
			EmitInternalEvents: true,
			ReturnDirectly:     returnDirectly,
		},
		Handlers:         supervisorHandlers,
		MaxIterations:    cfg.supervisor.maxIterations,
		ModelRetryConfig: chatModelRetryConfig(cfg.retry),
	})
}

// toolErrorResult 表示返回给模型的工具错误结果。
type toolErrorResult struct {
	// OK 表示工具是否成功执行。
	OK bool `json:"ok"`
	// Tool 表示执行失败的工具名称。
	Tool string `json:"tool,omitempty"`
	// CallID 表示本次工具调用 ID。
	CallID string `json:"call_id,omitempty"`
	// Error 表示工具返回的原始错误文本。
	Error string `json:"error"`
	// Message 表示模型可直接理解的中文错误说明。
	Message string `json:"message"`
}

// safeToolErrorHandler 将普通工具错误转换为模型可读的工具结果。
type safeToolErrorHandler[M adk.MessageType] struct {
	// TypedBaseChatModelAgentMiddleware 表示 Eino ADK 默认空实现。
	*adk.TypedBaseChatModelAgentMiddleware[M]
	// propagatedToolNames 表示执行失败时必须继续向外传播错误的工具名称集合，通常用于子 Agent 工具。
	propagatedToolNames map[string]struct{}
}

// safeToolErrorHandlers 创建 Agent 使用的工具错误处理器列表。
// 参数 propagatedToolNames 表示执行失败时需要直接向外传播错误的工具名称集合。
func safeToolErrorHandlers[M adk.MessageType](propagatedToolNames map[string]struct{}) []adk.TypedChatModelAgentMiddleware[M] {
	return []adk.TypedChatModelAgentMiddleware[M]{newSafeToolErrorHandler[M](propagatedToolNames)}
}

// newSafeToolErrorHandler 创建单个工具错误处理器。
// 参数 propagatedToolNames 表示执行失败时需要直接向外传播错误的工具名称集合。
func newSafeToolErrorHandler[M adk.MessageType](propagatedToolNames map[string]struct{}) adk.TypedChatModelAgentMiddleware[M] {
	copiedToolNames := make(map[string]struct{}, len(propagatedToolNames))
	for name := range propagatedToolNames {
		copiedToolNames[name] = struct{}{}
	}
	return &safeToolErrorHandler[M]{
		TypedBaseChatModelAgentMiddleware: &adk.TypedBaseChatModelAgentMiddleware[M]{},
		propagatedToolNames:               copiedToolNames,
	}
}

// WrapInvokableToolCall 包装普通工具调用，将可恢复错误转换为工具结果。
// 参数 ctx 表示包装发生时的上下文；参数 endpoint 表示原始工具调用入口；参数 toolCtx 表示工具调用元信息。
func (h *safeToolErrorHandler[M]) WrapInvokableToolCall(ctx context.Context, endpoint adk.InvokableToolCallEndpoint, toolCtx *adk.ToolContext) (adk.InvokableToolCallEndpoint, error) {
	return func(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
		result, err := endpoint(ctx, argumentsInJSON, opts...)
		if err == nil {
			return result, nil
		}
		if shouldPropagateToolContextError(toolCtx, err, h.propagatedToolNames) {
			return result, err
		}
		return toolErrorResultJSON(toolCtx, err), nil
	}, nil
}

// WrapStreamableToolCall 包装流式工具启动调用，将可恢复启动错误转换为单帧工具结果流。
// 参数 ctx 表示包装发生时的上下文；参数 endpoint 表示原始流式工具调用入口；参数 toolCtx 表示工具调用元信息。
func (h *safeToolErrorHandler[M]) WrapStreamableToolCall(ctx context.Context, endpoint adk.StreamableToolCallEndpoint, toolCtx *adk.ToolContext) (adk.StreamableToolCallEndpoint, error) {
	return func(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (*schema.StreamReader[string], error) {
		result, err := endpoint(ctx, argumentsInJSON, opts...)
		if err == nil {
			return result, nil
		}
		if shouldPropagateToolContextError(toolCtx, err, h.propagatedToolNames) {
			return nil, err
		}
		return schema.StreamReaderFromArray([]string{toolErrorResultJSON(toolCtx, err)}), nil
	}, nil
}

// shouldPropagateToolError 判断工具错误是否必须继续向外传播。
// 参数 err 表示工具调用返回的错误。
func shouldPropagateToolError(err error) bool {
	if err == nil {
		return false
	}
	if _, ok := compose.IsInterruptRerunError(err); ok {
		return true
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) || errors.Is(err, adk.ErrStreamCanceled) {
		return true
	}
	var cancelErr *adk.CancelError
	return errors.As(err, &cancelErr)
}

// shouldPropagateToolContextError 判断本次工具错误是否必须继续向外传播。
// 参数 toolCtx 表示工具调用元信息；参数 err 表示工具调用返回的错误；参数 propagatedToolNames 表示执行失败时需要直接向外传播错误的工具名称集合。
func shouldPropagateToolContextError(toolCtx *adk.ToolContext, err error, propagatedToolNames map[string]struct{}) bool {
	if shouldPropagateToolError(err) {
		return true
	}
	if err == nil || toolCtx == nil || len(propagatedToolNames) == 0 {
		return false
	}
	_, ok := propagatedToolNames[toolCtx.Name]
	return ok
}

// toolErrorResultJSON 将工具错误序列化为模型可读的 JSON 字符串。
// 参数 toolCtx 表示工具调用元信息；参数 err 表示工具调用返回的错误。
func toolErrorResultJSON(toolCtx *adk.ToolContext, err error) string {
	toolName := ""
	callID := ""
	if toolCtx != nil {
		toolName = toolCtx.Name
		callID = toolCtx.CallID
	}
	message := fmt.Sprintf("工具 %s 执行失败：%s", toolName, err.Error())
	if toolName == "" {
		message = fmt.Sprintf("工具执行失败：%s", err.Error())
	}
	result := toolErrorResult{
		OK:      false,
		Tool:    toolName,
		CallID:  callID,
		Error:   err.Error(),
		Message: message,
	}
	data, marshalErr := json.Marshal(result)
	if marshalErr != nil {
		return fmt.Sprintf(`{"ok":false,"error":%q,"message":%q}`, err.Error(), message)
	}
	return string(data)
}

// childAgentToolOptions 根据子 Agent 配置生成父 Agent 包装子 Agent 时使用的 ADK tool 选项。
// 参数 child 表示运行时子 Agent 配置。
func childAgentToolOptions(child runtimeAgentDefinition) []adk.AgentToolOption {
	if child.shareChatHistory {
		return []adk.AgentToolOption{adk.WithFullChatHistoryAsInput()}
	}
	return []adk.AgentToolOption{
		adk.WithAgentInputSchema(schema.NewParamsOneOfByParams(child.parameters)),
	}
}

// chatAgentHandlers 创建 schema.Message 路径 Agent 使用的中间件列表。
// 参数 ctx 表示创建中间件的上下文；参数 model 表示摘要生成使用的模型；参数 memory 表示上下文压缩配置；参数 propagatedToolNames 表示执行失败时需要直接向外传播错误的工具名称集合。
func chatAgentHandlers(ctx context.Context, model einomodel.BaseChatModel, memory RuntimeMemoryConfig, propagatedToolNames map[string]struct{}) ([]adk.TypedChatModelAgentMiddleware[*schema.Message], error) {
	mw, err := summarization.New(ctx, &summarization.Config{
		Model: model,
		Trigger: &summarization.TriggerCondition{
			ContextTokens: memory.ContextTokens,
		},
		TokenCounter: tokenCounterForMessages,
	})
	if err != nil {
		return nil, err
	}
	handlers := []adk.TypedChatModelAgentMiddleware[*schema.Message]{mw}
	handlers = append(handlers, safeToolErrorHandlers[*schema.Message](propagatedToolNames)...)
	return handlers, nil
}

// chatModelRetryConfig 创建 schema.Message 路径使用的 ADK 模型重试配置。
// 参数 retry 表示当前 Agent 运行使用的模型失败重试配置。
func chatModelRetryConfig(retry RuntimeRetryConfig) *adk.ModelRetryConfig {
	if retry.MaxRetries <= 0 {
		return nil
	}
	return &adk.ModelRetryConfig{
		MaxRetries:  retry.MaxRetries,
		ShouldRetry: shouldRetryModelError[*schema.Message],
		BackoffFunc: fixedRetryBackoff(retry.Backoff),
	}
}

// shouldRetryModelError 根据 ADK 重试上下文判断本次模型调用是否需要重试。
// 参数 ctx 表示当前请求上下文；参数 retryCtx 表示 ADK 传入的模型调用结果与重试上下文。
func shouldRetryModelError[M adk.MessageType](ctx context.Context, retryCtx *adk.TypedRetryContext[M]) *adk.TypedRetryDecision[M] {
	if retryCtx == nil {
		return &adk.TypedRetryDecision[M]{Retry: false}
	}
	return &adk.TypedRetryDecision[M]{
		Retry: isRetryableModelError(ctx, retryCtx.Err),
	}
}

// isRetryableModelError 判断模型错误是否允许重试。
// 参数 ctx 表示当前请求上下文；参数 err 表示模型调用返回的错误。
func isRetryableModelError(ctx context.Context, err error) bool {
	if err == nil {
		return false
	}
	if ctx != nil && ctx.Err() != nil {
		return false
	}
	return !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded)
}

// fixedRetryBackoff 返回固定间隔的 ADK 重试等待函数。
// 参数 backoff 表示每次重试前等待的时间。
func fixedRetryBackoff(backoff time.Duration) func(context.Context, int) time.Duration {
	if backoff <= 0 {
		backoff = defaultAgentRetryBackoff
	}
	return func(context.Context, int) time.Duration {
		return backoff
	}
}

// configuredAgentTools 根据 Agent 配置创建本次请求可用的普通工具。
// 参数 req 表示流式聊天请求；参数 agent 表示 Agent 运行时配置；参数 registry 表示普通工具注册表；参数 chapterReader 表示章节读取依赖；参数 novelSummaryStore 表示小说滚动总结读写依赖；参数 novelOutlineStore 表示小说大纲读写依赖；参数 characterStore 表示角色信息读写依赖；参数 relationshipGraphStore 表示角色关系图读取依赖。
func configuredAgentTools(req ChatRequest, agent runtimeAgentDefinition, registry map[string]runtimeAgentTool, chapterReader agenttools.ChapterReader, novelSummaryStore agenttools.NovelSummaryStore, novelOutlineStore agenttools.NovelOutlineStore, characterStore agenttools.CharacterStore, relationshipGraphStore agenttools.RelationshipGraphStore) ([]tool.BaseTool, error) {
	if len(agent.toolNames) == 0 {
		return nil, nil
	}

	tools := make([]tool.BaseTool, 0, len(agent.toolNames))
	for _, name := range agent.toolNames {
		toolConfig, ok := registry[name]
		if !ok {
			return nil, fmt.Errorf("%w: Agent %s 的工具 %s 未在 ai.agent.tools 中配置", ErrAgentConfigInvalid, agent.name, name)
		}
		switch name {
		case agenttools.ToolNameGetContent:
			getContentTool, err := agenttools.NewGetContentTool(chapterReader, req.NovelID, req.ChapterID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, getContentTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameQueryChapters:
			queryChaptersTool, err := agenttools.NewQueryChaptersTool(chapterReader, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, queryChaptersTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameUpdateChapterSummary:
			updateSummaryTool, err := agenttools.NewUpdateChapterSummaryTool(chapterReader, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, updateSummaryTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameQueryNovelSummary:
			queryNovelSummaryTool, err := agenttools.NewQueryNovelSummaryTool(novelSummaryStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, queryNovelSummaryTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameUpdateNovelSummary:
			updateNovelSummaryTool, err := agenttools.NewUpdateNovelSummaryTool(novelSummaryStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, updateNovelSummaryTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameQueryNovelOutline:
			queryNovelOutlineTool, err := agenttools.NewQueryNovelOutlineTool(novelOutlineStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, queryNovelOutlineTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameUpdateNovelOutline:
			updateNovelOutlineTool, err := agenttools.NewUpdateNovelOutlineTool(novelOutlineStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, updateNovelOutlineTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameListCharacters:
			listCharactersTool, err := agenttools.NewListCharactersTool(characterStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, listCharactersTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameSearchCharactersByName:
			searchCharactersTool, err := agenttools.NewSearchCharactersByNameTool(characterStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, searchCharactersTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameSaveCharacter:
			saveCharacterTool, err := agenttools.NewSaveCharacterTool(characterStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, saveCharacterTool, toolConfig)
			if err != nil {
				return nil, err
			}
		case agenttools.ToolNameQueryCharacterRelationships:
			queryRelationshipsTool, err := agenttools.NewQueryCharacterRelationshipsTool(relationshipGraphStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools, err = appendConfiguredAgentTool(tools, queryRelationshipsTool, toolConfig)
			if err != nil {
				return nil, err
			}
		default:
			return nil, fmt.Errorf("%w: 未知 Agent tool %s", ErrAgentConfigInvalid, name)
		}
	}
	return tools, nil
}

// appendConfiguredAgentTool 按工具配置包装后追加到工具列表。
// 参数 tools 表示当前已经创建的工具列表；参数 baseTool 表示本次创建的原始工具；参数 toolConfig 表示工具运行时配置。
func appendConfiguredAgentTool(tools []tool.BaseTool, baseTool tool.BaseTool, toolConfig runtimeAgentTool) ([]tool.BaseTool, error) {
	wrappedTool, err := wrapToolApproval(baseTool, toolConfig)
	if err != nil {
		return nil, err
	}
	return append(tools, wrapEmptyJSONArguments(wrappedTool)), nil
}

// childToolsConfig 创建子 Agent 自身使用的普通工具配置。
// 参数 tools 表示本次请求为子 Agent 创建的普通工具列表。
func childToolsConfig(tools []tool.BaseTool) adk.ToolsConfig {
	return adk.ToolsConfig{
		ToolsNodeConfig: compose.ToolsNodeConfig{
			Tools:               tools,
			ExecuteSequentially: true,
		},
	}
}

// streamChatAgentEvents 将 schema.Message Agent 事件转换为统一文本结果。
// 参数 iterator 表示 Eino ADK 事件迭代器；参数 checkPointID 表示本轮运行使用的 checkpoint 标识；参数 taskByAgent 表示子 Agent 名称到任务标识的映射；参数 emit 表示文本增量回调。
func streamChatAgentEvents(iterator *adk.AsyncIterator[*adk.TypedAgentEvent[*schema.Message]], checkPointID string, taskByAgent map[string]string, emit func(delta AgentDelta) error) (AgentResult, error) {
	result := AgentResult{Task: taskDirect}
	var full strings.Builder
	nextReplyIndex := 0
	childSeen := false
	for {
		event, ok := iterator.Next()
		if !ok {
			break
		}
		if event.Err != nil {
			return result, event.Err
		}
		if event.Action != nil && event.Action.Interrupted != nil {
			return result, agentInterruptedErrorFromInfo(checkPointID, event.Action.Interrupted)
		}
		if event.Output == nil || event.Output.MessageOutput == nil {
			continue
		}

		task := taskForAgent(event.AgentName, taskByAgent)
		if task != taskDirect {
			childSeen = true
		}
		if task == taskDirect && childSeen {
			continue
		}
		if err := emitChatMessageVariant(event.AgentName, task, event.Output.MessageOutput, &nextReplyIndex, &full, &result, emit); err != nil {
			return result, err
		}
	}
	return result, nil
}

// emitChatMessageVariant 输出 schema.Message 事件中的助手文本。
// 参数 agentName 表示 Eino 事件来源 Agent 名称；参数 task 表示事件对应任务；参数 variant 表示 Eino 消息事件；参数 nextReplyIndex 表示下一段可见助手回复序号；参数 full 表示完整内容构建器；参数 result 表示最终结果；参数 emit 表示文本增量回调。
func emitChatMessageVariant(agentName string, task string, variant *adk.TypedMessageVariant[*schema.Message], nextReplyIndex *int, full *strings.Builder, result *AgentResult, emit func(delta AgentDelta) error) error {
	if variant.IsStreaming {
		if variant.MessageStream == nil {
			return nil
		}
		defer variant.MessageStream.Close()
		chunks := make([]*schema.Message, 0, 8)
		replyIndex := 0
		for {
			chunk, err := variant.MessageStream.Recv()
			if errors.Is(err, io.EOF) {
				if msg := concatChatMessageChunks(chunks); msg != nil {
					appendChatMessageMemoryEvents(agentName, task, variant, msg, result)
				}
				return nil
			}
			if err != nil {
				return err
			}
			if chunk != nil {
				chunks = append(chunks, chunk)
			}
			if !isAssistantChatMessage(variant, chunk) {
				continue
			}
			if replyIndex == 0 {
				replyIndex = allocateAgentReplyIndex(nextReplyIndex)
			}
			if err := emitTextDelta(agentName, task, replyIndex, chunk.Content, full, result, emit); err != nil {
				return err
			}
		}
	}

	if isAssistantChatMessage(variant, variant.Message) {
		if err := emitTextDelta(agentName, task, allocateAgentReplyIndex(nextReplyIndex), variant.Message.Content, full, result, emit); err != nil {
			return err
		}
	}
	appendChatMessageMemoryEvents(agentName, task, variant, variant.Message, result)
	return nil
}

// concatChatMessageChunks 合并 schema.Message 流式片段，用于在流结束后提取完整工具事件。
// 参数 chunks 表示同一条流式消息的所有片段。
func concatChatMessageChunks(chunks []*schema.Message) *schema.Message {
	if len(chunks) == 0 {
		return nil
	}
	if len(chunks) == 1 {
		return chunks[0]
	}
	msg, err := schema.ConcatMessages(chunks)
	if err != nil {
		return nil
	}
	return msg
}

// appendChatMessageMemoryEvents 从 schema.Message 事件中提取需要入库的记忆事件。
// 参数 agentName 表示 Eino 事件来源 Agent 名称；参数 task 表示事件对应任务；参数 variant 表示 Eino 消息事件；参数 msg 表示完整消息；参数 result 表示最终结果。
func appendChatMessageMemoryEvents(agentName string, task string, variant *adk.TypedMessageVariant[*schema.Message], msg *schema.Message, result *AgentResult) {
	if msg == nil || result == nil {
		return
	}
	if isAssistantChatMessage(variant, msg) {
		appendAgentMemoryEvent(result, AgentMemoryEvent{
			Role:      MessageRoleAssistant,
			Task:      task,
			Content:   msg.Content,
			AgentName: strings.TrimSpace(agentName),
		})
	}
	if len(msg.ToolCalls) > 0 {
		calls := make([]agentFunctionToolCall, 0, len(msg.ToolCalls))
		for _, call := range msg.ToolCalls {
			calls = append(calls, agentFunctionToolCall{
				Name: strings.TrimSpace(call.Function.Name),
			})
		}
		if content, ok := encodeFunctionCallMemoryContent(calls); ok {
			appendAgentMemoryEvent(result, AgentMemoryEvent{
				Role:      MessageRoleFunctionCall,
				Task:      task,
				Content:   content,
				AgentName: strings.TrimSpace(agentName),
			})
		}
	}
	if variant == nil {
		return
	}
	if variant.Role == schema.Tool || msg.Role == schema.Tool {
		toolResult := agentFunctionToolResult{
			ID:      strings.TrimSpace(msg.ToolCallID),
			Content: msg.Content,
		}
		if content, ok := encodeFunctionResultMemoryContent([]agentFunctionToolResult{toolResult}); ok {
			appendAgentMemoryEvent(result, AgentMemoryEvent{
				Role:      MessageRoleFunctionResult,
				Task:      task,
				Content:   content,
				AgentName: strings.TrimSpace(agentName),
			})
		}
	}
}

// appendAgentMemoryEvent 将一个非空内部记忆事件追加到运行结果。
// 参数 result 表示 Agent 最终结果；参数 event 表示需要追加的记忆事件。
func appendAgentMemoryEvent(result *AgentResult, event AgentMemoryEvent) {
	if result == nil || strings.TrimSpace(event.Content) == "" {
		return
	}
	if strings.TrimSpace(event.Task) == "" {
		event.Task = result.Task
	}
	result.MemoryEvents = append(result.MemoryEvents, event)
}

// isAssistantChatMessage 判断 schema.Message 是否为可展示的助手文本。
// 参数 variant 表示 Eino 消息事件；参数 msg 表示待判断消息。
func isAssistantChatMessage(variant *adk.TypedMessageVariant[*schema.Message], msg *schema.Message) bool {
	if msg == nil {
		return false
	}
	if variant.Role == schema.Tool || msg.Role == schema.Tool {
		return false
	}
	if len(msg.ToolCalls) > 0 {
		return false
	}
	return (variant.Role == "" || variant.Role == schema.Assistant || msg.Role == schema.Assistant) && msg.Content != ""
}

// emitTextDelta 写出文本增量并累积完整结果。
// 参数 agentName 表示 Eino 事件来源 Agent 名称；参数 task 表示事件对应任务；参数 replyIndex 表示同一次请求中的可见助手回复段序号；参数 content 表示文本增量；参数 full 表示完整内容构建器；参数 result 表示最终结果；参数 emit 表示文本增量回调。
func emitTextDelta(agentName string, task string, replyIndex int, content string, full *strings.Builder, result *AgentResult, emit func(delta AgentDelta) error) error {
	if content == "" {
		return nil
	}
	if replyIndex <= 0 {
		replyIndex = 1
	}
	result.Task = task
	if strings.TrimSpace(agentName) != "" {
		result.AgentName = agentName
	}
	full.WriteString(content)
	result.Content = full.String()
	appendAgentReplyDelta(result, replyIndex, agentName, task, content)
	return emit(AgentDelta{Task: task, ReplyIndex: replyIndex, Content: content})
}

// allocateAgentReplyIndex 分配下一段可见助手回复的序号。
// 参数 nextReplyIndex 表示当前已分配的最大回复段序号。
func allocateAgentReplyIndex(nextReplyIndex *int) int {
	if nextReplyIndex == nil {
		return 1
	}
	*nextReplyIndex = *nextReplyIndex + 1
	return *nextReplyIndex
}

// appendAgentReplyDelta 将文本增量追加到对应的分段助手回复结果中。
// 参数 result 表示 Agent 最终结果；参数 replyIndex 表示回复段序号；参数 agentName 表示产生回复段的 Eino Agent 名称；参数 task 表示回复段任务来源；参数 content 表示需要追加的文本增量。
func appendAgentReplyDelta(result *AgentResult, replyIndex int, agentName string, task string, content string) {
	if result == nil || content == "" {
		return
	}
	if len(result.Replies) == 0 || result.Replies[len(result.Replies)-1].ReplyIndex != replyIndex {
		result.Replies = append(result.Replies, AgentReply{
			ReplyIndex: replyIndex,
			Task:       task,
			AgentName:  strings.TrimSpace(agentName),
		})
	}
	reply := &result.Replies[len(result.Replies)-1]
	reply.Task = task
	if strings.TrimSpace(agentName) != "" {
		reply.AgentName = agentName
	}
	reply.Content += content
}

// taskForAgent 根据 Eino Agent 名称映射前端展示任务。
// 参数 agentName 表示 Eino ADK 事件来源 Agent 名称；参数 taskByAgent 表示子 Agent 名称到任务标识的映射。
func taskForAgent(agentName string, taskByAgent map[string]string) string {
	if task, ok := taskByAgent[agentName]; ok && strings.TrimSpace(task) != "" {
		return task
	}
	return taskDirect
}
