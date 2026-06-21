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

	agenticclaude "github.com/cloudwego/eino-ext/components/model/agenticclaude"
	agenticgemini "github.com/cloudwego/eino-ext/components/model/agenticgemini"
	agenticopenai "github.com/cloudwego/eino-ext/components/model/agenticopenai"
	einoopenai "github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/adk"
	einomodel "github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
	"google.golang.org/genai"

	agenttools "novels_ai_gen/internal/biz/novelagent/tools"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

const (
	providerTypeOpenAI = "openai"
	providerTypeClaude = "claude"
	providerTypeGemini = "gemini"
	apiTypeResponse    = "response"
	apiTypeCompletions = "completions"
	modelPathChat      = "chat"
	modelPathAgentic   = "agentic"
	defaultMaxTokens   = 4096
	defaultTimeout     = 120 * time.Second
)

const summarySystemPrompt = "你是小说写作 Agent 的长期记忆摘要器。请把旧摘要和新增对话整理成一份紧凑、准确、可持续更新的中文摘要，保留用户偏好、小说设定、角色关系、写作要求、已经确认的修改方向和重要上下文。不要输出寒暄、标题或 Markdown 代码块，只输出摘要正文。"

const conversationTitleSystemPrompt = "你是小说写作 AI 会话标题生成器。请根据用户开启会话时发送的第一句话，生成一个中文会话标题。标题必须不超过 50 个字，简洁具体，不要输出解释、引号、前缀、Markdown 或多行内容。"

const promptRecommendationSystemPrompt = "你是小说提示词库推荐判定器。你的任务是判断用户当前输入是否属于小说正文修改、润色、扩写、缩写、风格调整、情绪强化、节奏调整、氛围调整、语言优化或类似写作修改需求，并从用户提供的提示词类型列表中选择最匹配的一项。你必须只输出 JSON，不要输出 Markdown、解释或额外文本。匹配时输出 {\"action\":\"prompt_search\",\"matched\":true,\"prompt_type\":\"类型名\"}；不匹配或无法确定时输出 {\"action\":\"none\",\"matched\":false,\"prompt_type\":\"\"}。prompt_type 必须严格来自可选类型列表。"

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
}

// NewEinoAgentRuntimeFactory 创建基于 Eino ADK 的多层 Agent 运行时工厂。
// 参数 chapterReader 表示 get_content 工具读取章节正文所需的数据依赖；参数 novelSummaryStore 表示小说滚动总结工具读写总结所需的数据依赖；参数 novelOutlineStore 表示小说大纲工具读写大纲所需的数据依赖；参数 characterStore 表示角色信息工具读写角色卡数据所需的数据依赖。
func NewEinoAgentRuntimeFactory(chapterReader agenttools.ChapterReader, novelSummaryStore agenttools.NovelSummaryStore, novelOutlineStore agenttools.NovelOutlineStore, characterStore agenttools.CharacterStore) *EinoAgentRuntimeFactory {
	return &EinoAgentRuntimeFactory{chapterReader: chapterReader, novelSummaryStore: novelSummaryStore, novelOutlineStore: novelOutlineStore, characterStore: characterStore}
}

// NewRuntime 按 AI 提供商协议创建 Eino 多层 Agent 运行时。
// 参数 ctx 表示请求上下文；参数 cfg 表示入口模型和启用 Agent 自定义模型配置。
func (f *EinoAgentRuntimeFactory) NewRuntime(ctx context.Context, cfg RuntimeModelConfig) (AgentRuntime, error) {
	cfg = normalizeRuntimeModelConfig(cfg)
	defaultPath, err := modelPathForConfig(cfg.Default)
	if err != nil {
		return nil, err
	}
	if err := validateRuntimeModelPath(defaultPath, cfg); err != nil {
		return nil, err
	}

	registry := newAgentModelConfigRegistry(cfg)
	switch defaultPath {
	case modelPathChat:
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
			model:             defaultModel,
			supervisorModel:   supervisorModel,
			childModels:       childModels,
			modelConfigs:      registry,
			chapterReader:     f.chapterReader,
			novelSummaryStore: f.novelSummaryStore,
			novelOutlineStore: f.novelOutlineStore,
			characterStore:    f.characterStore,
		}, nil
	case modelPathAgentic:
		defaultModel, err := f.newAgenticModel(ctx, cfg.Default, cfg.Retry)
		if err != nil {
			return nil, err
		}
		supervisorModel := defaultModel
		if cfg.Supervisor != nil {
			supervisorModel, err = f.newAgenticModel(ctx, *cfg.Supervisor, cfg.Retry)
			if err != nil {
				return nil, err
			}
		}
		childModels, err := f.newAgenticChildModels(ctx, cfg.Children, cfg.Retry)
		if err != nil {
			return nil, err
		}
		return agenticAgentRuntime{
			model:             defaultModel,
			supervisorModel:   supervisorModel,
			childModels:       childModels,
			modelConfigs:      registry,
			chapterReader:     f.chapterReader,
			novelSummaryStore: f.novelSummaryStore,
			novelOutlineStore: f.novelOutlineStore,
			characterStore:    f.characterStore,
		}, nil
	default:
		return nil, fmt.Errorf("不支持的 Agent 模型路径: %s", defaultPath)
	}
}

// newChatModel 创建 schema.Message 路径使用的 Eino ChatModel。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
func (f *EinoAgentRuntimeFactory) newChatModel(ctx context.Context, cfg ModelConfig) (einomodel.BaseChatModel, error) {
	_ = f
	model, err := einoopenai.NewChatModel(ctx, &einoopenai.ChatModelConfig{
		APIKey:  cfg.APIKey,
		BaseURL: cfg.BaseURL,
		Model:   cfg.Model,
		Timeout: defaultTimeout,
	})
	if err != nil {
		return nil, err
	}
	return model, nil
}

// newAgenticModel 创建 schema.AgenticMessage 路径使用的 Eino AgenticModel。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
func (f *EinoAgentRuntimeFactory) newAgenticModel(ctx context.Context, cfg ModelConfig, retry RuntimeRetryConfig) (einomodel.AgenticModel, error) {
	_ = f
	switch cfg.ProviderType {
	case providerTypeOpenAI:
		timeout := defaultTimeout
		maxRetries := retry.MaxRetries
		model, err := agenticopenai.NewResponsesModel(ctx, &agenticopenai.ResponsesConfig{
			APIKey:     cfg.APIKey,
			BaseURL:    cfg.BaseURL,
			Model:      cfg.Model,
			Timeout:    &timeout,
			MaxRetries: &maxRetries,
		})
		if err != nil {
			return nil, err
		}
		return model, nil
	case providerTypeClaude:
		model, err := agenticclaude.New(ctx, &agenticclaude.Config{
			APIKey:     cfg.APIKey,
			BaseURL:    cfg.BaseURL,
			Model:      cfg.Model,
			MaxTokens:  defaultMaxTokens,
			HTTPClient: &http.Client{Timeout: defaultTimeout},
		})
		if err != nil {
			return nil, err
		}
		return model, nil
	case providerTypeGemini:
		timeout := defaultTimeout
		clientConfig := &genai.ClientConfig{
			APIKey: cfg.APIKey,
			HTTPOptions: genai.HTTPOptions{
				BaseURL:    normalizeGeminiBaseURL(cfg.BaseURL),
				APIVersion: "v1beta",
				Timeout:    &timeout,
			},
		}
		client, err := genai.NewClient(ctx, clientConfig)
		if err != nil {
			return nil, err
		}

		maxTokens := defaultMaxTokens
		model, err := agenticgemini.New(ctx, &agenticgemini.Config{
			Client:    client,
			Model:     cfg.Model,
			MaxTokens: &maxTokens,
		})
		if err != nil {
			return nil, err
		}
		return model, nil
	default:
		return nil, fmt.Errorf("不支持的 Agentic AI 提供商类型: %s", cfg.ProviderType)
	}
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

// newAgenticChildModels 创建启用子 Agent 的 AgenticModel 覆盖集合。
// 参数 ctx 表示请求上下文；参数 configs 表示按子 Agent 名称索引的模型覆盖配置。
func (f *EinoAgentRuntimeFactory) newAgenticChildModels(ctx context.Context, configs map[string]ModelConfig, retry RuntimeRetryConfig) (map[string]einomodel.AgenticModel, error) {
	if len(configs) == 0 {
		return nil, nil
	}
	models := make(map[string]einomodel.AgenticModel, len(configs))
	for name, cfg := range configs {
		model, err := f.newAgenticModel(ctx, cfg, retry)
		if err != nil {
			return nil, fmt.Errorf("创建子 Agent %s 自定义模型失败: %w", name, err)
		}
		models[name] = model
	}
	return models, nil
}

// normalizeGeminiBaseURL 将系统保存的 Gemini API 根地址转换为 genai 客户端可用的基础地址。
// 参数 baseURL 表示配置中的 Gemini Base URL。
func normalizeGeminiBaseURL(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	for _, suffix := range []string{"/v1beta", "/v1"} {
		if strings.HasSuffix(baseURL, suffix) {
			return strings.TrimSuffix(baseURL, suffix)
		}
	}
	return baseURL
}

// normalizeRuntimeModelConfig 标准化一次 Agent 运行中的所有模型配置。
// 参数 cfg 表示入口模型和启用 Agent 自定义模型配置。
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
	cfg.APIType = strings.ToLower(strings.TrimSpace(cfg.APIType))
	cfg.BaseURL = strings.TrimSpace(cfg.BaseURL)
	cfg.Model = strings.TrimSpace(cfg.Model)
	return cfg
}

// modelPathForConfig 判断模型配置使用的 Eino 消息路径。
// 参数 cfg 表示模型创建配置。
func modelPathForConfig(cfg ModelConfig) (string, error) {
	switch cfg.ProviderType {
	case providerTypeOpenAI:
		switch cfg.APIType {
		case "", apiTypeCompletions:
			return modelPathChat, nil
		case apiTypeResponse:
			return modelPathAgentic, nil
		default:
			return "", fmt.Errorf("不支持的 OpenAI API 类型: %s", cfg.APIType)
		}
	case providerTypeClaude, providerTypeGemini:
		return modelPathAgentic, nil
	default:
		return "", fmt.Errorf("不支持的 AI 提供商类型: %s", cfg.ProviderType)
	}
}

// validateRuntimeModelPath 校验自定义模型是否与入口模型使用相同 Eino 消息路径。
// 参数 defaultPath 表示入口模型路径；参数 cfg 表示一次运行中的模型配置集合。
func validateRuntimeModelPath(defaultPath string, cfg RuntimeModelConfig) error {
	if cfg.Supervisor != nil {
		if err := validateModelPath("顶层 Agent", defaultPath, *cfg.Supervisor); err != nil {
			return err
		}
	}
	for name, childCfg := range cfg.Children {
		if err := validateModelPath("子 Agent "+name, defaultPath, childCfg); err != nil {
			return err
		}
	}
	return nil
}

// validateModelPath 校验单个自定义模型路径是否兼容入口模型路径。
// 参数 label 表示错误提示中的 Agent 名称；参数 defaultPath 表示入口模型路径；参数 cfg 表示自定义模型配置。
func validateModelPath(label string, defaultPath string, cfg ModelConfig) error {
	path, err := modelPathForConfig(cfg)
	if err != nil {
		return fmt.Errorf("%w: %s 自定义模型协议无效: %v", ErrAgentConfigInvalid, label, err)
	}
	if path != defaultPath {
		return fmt.Errorf("%w: %s 自定义模型路径 %s 与入口模型路径 %s 不兼容", ErrAgentConfigInvalid, label, path, defaultPath)
	}
	return nil
}

// agentModelConfigRegistry 表示 Agent 名称到实际模型配置的查询表。
type agentModelConfigRegistry struct {
	// defaultConfig 表示继承前端请求的入口模型配置。
	defaultConfig ModelConfig
	// supervisorConfigured 表示顶层 Agent 是否配置了自定义模型。
	supervisorConfigured bool
	// supervisorConfig 表示顶层 Agent 实际使用的模型配置。
	supervisorConfig ModelConfig
	// childConfigs 表示启用子 Agent 的自定义模型配置，未出现的子 Agent 继承入口模型。
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
}

// Stream 流式执行基于 schema.Message 的小说写作 Agent。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 memory 表示需要注入模型上下文的会话级记忆；参数 emit 表示文本增量回调。
func (r chatAgentRuntime) Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, memory AgentMemoryInput, emit func(delta AgentDelta) error) (AgentResult, error) {
	agentCfg, err := newAgentRuntimeConfig(cfg)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	agent, err := newChatSupervisorAgent(ctx, r.model, r.supervisorModel, r.childModels, agentCfg, req, r.chapterReader, r.novelSummaryStore, r.novelOutlineStore, r.characterStore)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	runner := adk.NewTypedRunner(adk.TypedRunnerConfig[*schema.Message]{
		Agent:           agent,
		EnableStreaming: true,
	})
	result, err := streamChatAgentEvents(runner.Run(ctx, chatRunMessages(req, memory)), agentCfg.taskByAgent, emit)
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

// RecommendPromptType 使用 schema.Message 模型判断当前输入是否需要提示词库推荐。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示推荐判定所需的用户输入和提示词类型。
func (r chatAgentRuntime) RecommendPromptType(ctx context.Context, cfg *appconfig.AppConfig, input PromptRecommendationInput) (PromptRecommendationResponse, error) {
	_ = cfg
	messages := []*schema.Message{
		schema.SystemMessage(promptRecommendationSystemPrompt),
		schema.UserMessage(promptRecommendationUserPrompt(input)),
	}
	output, err := r.model.Generate(ctx, messages)
	if err != nil {
		return noPromptRecommendation(), err
	}
	if output == nil {
		return noPromptRecommendation(), nil
	}
	return parsePromptRecommendation(output.Content, input.PromptTypes), nil
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

// agenticAgentRuntime 表示基于 schema.AgenticMessage 的 Eino ADK 多层 Agent 运行时。
type agenticAgentRuntime struct {
	// model 表示 Eino AgenticModel。
	model einomodel.AgenticModel
	// supervisorModel 表示顶层 Agent 实际使用的 Eino AgenticModel。
	supervisorModel einomodel.AgenticModel
	// childModels 表示启用子 Agent 的自定义 AgenticModel，未配置的子 Agent 使用入口模型。
	childModels map[string]einomodel.AgenticModel
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
}

// Stream 流式执行基于 schema.AgenticMessage 的小说写作 Agent。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 memory 表示需要注入模型上下文的会话级记忆；参数 emit 表示文本增量回调。
func (r agenticAgentRuntime) Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, memory AgentMemoryInput, emit func(delta AgentDelta) error) (AgentResult, error) {
	agentCfg, err := newAgentRuntimeConfig(cfg)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	agent, err := newAgenticSupervisorAgent(ctx, r.model, r.supervisorModel, r.childModels, agentCfg, req, r.chapterReader, r.novelSummaryStore, r.novelOutlineStore, r.characterStore)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	runner := adk.NewTypedRunner(adk.TypedRunnerConfig[*schema.AgenticMessage]{
		Agent:           agent,
		EnableStreaming: true,
	})
	result, err := streamAgenticAgentEvents(runner.Run(ctx, agenticRunMessages(req, memory)), agentCfg.taskByAgent, emit)
	if err != nil {
		return result, err
	}
	return applyResultModelInfo(result, agentCfg.supervisor.name, r.modelConfigs), nil
}

// Summarize 使用 schema.AgenticMessage 模型生成会话级 Agent 滚动摘要。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示需要压缩进摘要的历史上下文。
func (r agenticAgentRuntime) Summarize(ctx context.Context, cfg *appconfig.AppConfig, input AgentSummaryInput) (string, error) {
	messages := []*schema.AgenticMessage{
		schema.SystemAgenticMessage(summarySystemPrompt),
		schema.UserAgenticMessage(summaryUserPrompt(input)),
	}
	output, err := r.model.Generate(ctx, messages)
	if err != nil {
		return "", err
	}
	return normalizeSummaryContent(agenticMessageText(output))
}

// RecommendPromptType 使用 schema.AgenticMessage 模型判断当前输入是否需要提示词库推荐。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示推荐判定所需的用户输入和提示词类型。
func (r agenticAgentRuntime) RecommendPromptType(ctx context.Context, cfg *appconfig.AppConfig, input PromptRecommendationInput) (PromptRecommendationResponse, error) {
	_ = cfg
	messages := []*schema.AgenticMessage{
		schema.SystemAgenticMessage(promptRecommendationSystemPrompt),
		schema.UserAgenticMessage(promptRecommendationUserPrompt(input)),
	}
	output, err := r.model.Generate(ctx, messages)
	if err != nil {
		return noPromptRecommendation(), err
	}
	return parsePromptRecommendation(agenticMessageText(output), input.PromptTypes), nil
}

// GenerateConversationTitle 使用 schema.AgenticMessage 模型生成新 Agent 会话标题。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 input 表示标题生成输入。
func (r agenticAgentRuntime) GenerateConversationTitle(ctx context.Context, cfg *appconfig.AppConfig, input AgentConversationTitleInput) (string, error) {
	_ = cfg
	messages := []*schema.AgenticMessage{
		schema.SystemAgenticMessage(conversationTitleSystemPrompt),
		schema.UserAgenticMessage(conversationTitleUserPrompt(input)),
	}
	output, err := r.model.Generate(ctx, messages)
	if err != nil {
		return "", err
	}
	return normalizeConversationTitleContent(agenticMessageText(output))
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
		case MessageRoleAssistant:
			messages = append(messages, schema.AssistantMessage(item.Content, nil))
		}
	}
	messages = append(messages, schema.UserMessage(req.Message))
	return messages
}

// agenticRunMessages 构造 schema.AgenticMessage 路径的 Agent 输入消息列表。
// 参数 req 表示本轮聊天请求；参数 memory 表示需要注入模型上下文的会话级记忆。
func agenticRunMessages(req ChatRequest, memory AgentMemoryInput) []*schema.AgenticMessage {
	messages := make([]*schema.AgenticMessage, 0, len(memory.Messages)+3)
	if prompt := memorySummaryPrompt(memory.Summary); prompt != "" {
		messages = append(messages, schema.SystemAgenticMessage(prompt))
	}
	for _, item := range memory.Messages {
		content := strings.TrimSpace(item.Content)
		if content == "" {
			continue
		}
		switch item.Role {
		case MessageRoleUser:
			messages = append(messages, schema.UserAgenticMessage(item.Content))
		case MessageRoleAssistant:
			messages = append(messages, assistantAgenticMessage(item.Content))
		}
	}
	messages = append(messages, schema.UserAgenticMessage(req.Message))
	return messages
}

// assistantAgenticMessage 创建 AgenticMessage 路径使用的助手历史消息。
// 参数 content 表示助手历史消息正文。
func assistantAgenticMessage(content string) *schema.AgenticMessage {
	return &schema.AgenticMessage{
		Role: schema.AgenticRoleTypeAssistant,
		ContentBlocks: []*schema.ContentBlock{
			schema.NewContentBlock(&schema.AssistantGenText{Text: content}),
		},
	}
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
		content := strings.TrimSpace(message.Content)
		if content == "" {
			continue
		}
		builder.WriteString(summaryMessageRoleLabel(message.Role))
		builder.WriteString("：")
		builder.WriteString(content)
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
	default:
		return "未知"
	}
}

// promptRecommendationUserPrompt 生成提示词库推荐判定模型的用户消息。
// 参数 input 表示推荐判定所需的用户输入和候选提示词类型。
func promptRecommendationUserPrompt(input PromptRecommendationInput) string {
	typesJSON, err := json.Marshal(input.PromptTypes)
	if err != nil {
		typesJSON = []byte("[]")
	}
	var builder strings.Builder
	builder.WriteString("可选提示词类型：")
	builder.Write(typesJSON)
	builder.WriteString("\n\n用户当前输入：\n")
	builder.WriteString(strings.TrimSpace(input.Message))
	return builder.String()
}

// promptRecommendationPayload 表示模型推荐判定 JSON 的解析结构。
type promptRecommendationPayload struct {
	// Action 表示模型建议的前端动作。
	Action string `json:"action"`
	// Matched 表示模型是否认为用户输入匹配提示词推荐场景。
	Matched bool `json:"matched"`
	// PromptType 表示模型选择的提示词类型。
	PromptType string `json:"prompt_type"`
}

// parsePromptRecommendation 解析并校验模型返回的提示词推荐判定结果。
// 参数 content 表示模型原始输出；参数 promptTypes 表示允许返回的提示词类型列表。
func parsePromptRecommendation(content string, promptTypes []string) PromptRecommendationResponse {
	content = extractPromptRecommendationJSON(content)
	if strings.TrimSpace(content) == "" {
		return noPromptRecommendation()
	}

	var payload promptRecommendationPayload
	if err := json.Unmarshal([]byte(content), &payload); err != nil {
		return noPromptRecommendation()
	}
	action := strings.TrimSpace(payload.Action)
	promptType := strings.TrimSpace(payload.PromptType)
	if action != PromptRecommendationActionSearch || !payload.Matched || !promptRecommendationTypeAllowed(promptTypes, promptType) {
		return noPromptRecommendation()
	}
	return PromptRecommendationResponse{
		Action:     PromptRecommendationActionSearch,
		Matched:    true,
		PromptType: promptType,
	}
}

// extractPromptRecommendationJSON 从模型输出中提取 JSON 对象文本。
// 参数 content 表示模型原始输出。
func extractPromptRecommendationJSON(content string) string {
	content = strings.TrimSpace(content)
	if strings.HasPrefix(content, "```") {
		lines := strings.Split(content, "\n")
		if len(lines) >= 2 {
			lines = lines[1:]
			if len(lines) > 0 && strings.HasPrefix(strings.TrimSpace(lines[len(lines)-1]), "```") {
				lines = lines[:len(lines)-1]
			}
			content = strings.TrimSpace(strings.Join(lines, "\n"))
		}
	}
	start := strings.Index(content, "{")
	end := strings.LastIndex(content, "}")
	if start >= 0 && end >= start {
		return strings.TrimSpace(content[start : end+1])
	}
	return content
}

// promptRecommendationTypeAllowed 判断模型返回的提示词类型是否来自配置文件。
// 参数 promptTypes 表示配置文件中的提示词类型列表；参数 promptType 表示模型返回的提示词类型。
func promptRecommendationTypeAllowed(promptTypes []string, promptType string) bool {
	if promptType == "" {
		return false
	}
	for _, item := range promptTypes {
		if strings.TrimSpace(item) == promptType {
			return true
		}
	}
	return false
}

// noPromptRecommendation 返回不推荐提示词库查询的统一响应。
func noPromptRecommendation() PromptRecommendationResponse {
	return PromptRecommendationResponse{
		Action:     PromptRecommendationActionNone,
		Matched:    false,
		PromptType: "",
	}
}

// normalizeSummaryContent 标准化摘要模型返回的正文。
// 参数 content 表示模型生成的原始摘要文本。
func normalizeSummaryContent(content string) (string, error) {
	summary := strings.TrimSpace(content)
	if summary == "" {
		return "", fmt.Errorf("摘要模型返回空内容")
	}
	return summary, nil
}

// newChatSupervisorAgent 创建基于 schema.Message 的顶层 Agent，并把配置中的子 Agent 包装为 tool。
// 参数 ctx 表示请求上下文；参数 defaultModel 表示入口 ChatModel；参数 supervisorModel 表示顶层 Agent 使用的 ChatModel；参数 childModels 表示子 Agent 自定义 ChatModel；参数 cfg 表示运行时 Agent 配置；参数 req 表示流式聊天请求；参数 chapterReader 表示章节读取依赖；参数 novelSummaryStore 表示小说滚动总结读写依赖；参数 novelOutlineStore 表示小说大纲读写依赖；参数 characterStore 表示角色信息读写依赖。
func newChatSupervisorAgent(ctx context.Context, defaultModel einomodel.BaseChatModel, supervisorModel einomodel.BaseChatModel, childModels map[string]einomodel.BaseChatModel, cfg runtimeAgentConfig, req ChatRequest, chapterReader agenttools.ChapterReader, novelSummaryStore agenttools.NovelSummaryStore, novelOutlineStore agenttools.NovelOutlineStore, characterStore agenttools.CharacterStore) (*adk.TypedChatModelAgent[*schema.Message], error) {
	if err := adk.SetLanguage(adk.LanguageChinese); err != nil {
		return nil, err
	}

	supervisorTools, err := configuredAgentTools(req, cfg.supervisor, cfg.tools, chapterReader, novelSummaryStore, novelOutlineStore, characterStore)
	if err != nil {
		return nil, err
	}

	tools := make([]tool.BaseTool, 0, len(supervisorTools)+len(cfg.children))
	tools = append(tools, supervisorTools...)
	returnDirectly := make(map[string]bool, len(cfg.children))
	for _, child := range cfg.children {
		childTools, err := configuredAgentTools(req, child, cfg.tools, chapterReader, novelSummaryStore, novelOutlineStore, characterStore)
		if err != nil {
			return nil, err
		}
		childModel := defaultModel
		if configuredModel, ok := childModels[child.name]; ok {
			childModel = configuredModel
		}
		childAgent, err := adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.Message]{
			Name:             child.name,
			Description:      child.description,
			Instruction:      instructionWithRequestContext(child.instruction, req),
			Model:            childModel,
			ToolsConfig:      childToolsConfig(childTools),
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
		MaxIterations:    cfg.supervisor.maxIterations,
		ModelRetryConfig: chatModelRetryConfig(cfg.retry),
	})
}

// newAgenticSupervisorAgent 创建基于 schema.AgenticMessage 的顶层 Agent，并把配置中的子 Agent 包装为 tool。
// 参数 ctx 表示请求上下文；参数 defaultModel 表示入口 AgenticModel；参数 supervisorModel 表示顶层 Agent 使用的 AgenticModel；参数 childModels 表示子 Agent 自定义 AgenticModel；参数 cfg 表示运行时 Agent 配置；参数 req 表示流式聊天请求；参数 chapterReader 表示章节读取依赖；参数 novelSummaryStore 表示小说滚动总结读写依赖；参数 novelOutlineStore 表示小说大纲读写依赖；参数 characterStore 表示角色信息读写依赖。
func newAgenticSupervisorAgent(ctx context.Context, defaultModel einomodel.AgenticModel, supervisorModel einomodel.AgenticModel, childModels map[string]einomodel.AgenticModel, cfg runtimeAgentConfig, req ChatRequest, chapterReader agenttools.ChapterReader, novelSummaryStore agenttools.NovelSummaryStore, novelOutlineStore agenttools.NovelOutlineStore, characterStore agenttools.CharacterStore) (*adk.TypedChatModelAgent[*schema.AgenticMessage], error) {
	if err := adk.SetLanguage(adk.LanguageChinese); err != nil {
		return nil, err
	}
	if err := validateAgenticChildHistorySharing(cfg); err != nil {
		return nil, err
	}

	supervisorTools, err := configuredAgentTools(req, cfg.supervisor, cfg.tools, chapterReader, novelSummaryStore, novelOutlineStore, characterStore)
	if err != nil {
		return nil, err
	}

	tools := make([]tool.BaseTool, 0, len(supervisorTools)+len(cfg.children))
	tools = append(tools, supervisorTools...)
	returnDirectly := make(map[string]bool, len(cfg.children))
	for _, child := range cfg.children {
		childTools, err := configuredAgentTools(req, child, cfg.tools, chapterReader, novelSummaryStore, novelOutlineStore, characterStore)
		if err != nil {
			return nil, err
		}
		childModel := defaultModel
		if configuredModel, ok := childModels[child.name]; ok {
			childModel = configuredModel
		}
		childAgent, err := adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.AgenticMessage]{
			Name:             child.name,
			Description:      child.description,
			Instruction:      instructionWithRequestContext(child.instruction, req),
			Model:            childModel,
			ToolsConfig:      childToolsConfig(childTools),
			MaxIterations:    child.maxIterations,
			ModelRetryConfig: agenticModelRetryConfig(cfg.retry),
		})
		if err != nil {
			return nil, fmt.Errorf("创建子 Agent %s 失败: %w", child.name, err)
		}
		tools = append(tools, adk.NewTypedAgentTool[*schema.AgenticMessage](
			ctx,
			childAgent,
			adk.WithAgentInputSchema(schema.NewParamsOneOfByParams(child.parameters)),
		))
		returnDirectly[child.name] = true
	}

	return adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.AgenticMessage]{
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
		MaxIterations:    cfg.supervisor.maxIterations,
		ModelRetryConfig: agenticModelRetryConfig(cfg.retry),
	})
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

// validateAgenticChildHistorySharing 校验 Agentic 路径是否包含当前 Eino 不支持的子 Agent 历史共享配置。
// 参数 cfg 表示本次请求使用的运行时 Agent 配置。
func validateAgenticChildHistorySharing(cfg runtimeAgentConfig) error {
	for _, child := range cfg.children {
		if child.shareChatHistory {
			return fmt.Errorf("%w: 子 Agent %s 开启了记忆共享，但当前模型路径暂不支持，请使用 Chat 路径模型或关闭该开关", ErrAgentConfigInvalid, child.name)
		}
	}
	return nil
}

// chatModelRetryConfig 创建 schema.Message 路径使用的 ADK 模型重试配置。
// 参数 retry 表示当前 Agent 运行使用的模型失败重试配置。
func chatModelRetryConfig(retry RuntimeRetryConfig) *adk.ModelRetryConfig {
	if retry.MaxRetries <= 0 {
		return nil
	}
	return &adk.ModelRetryConfig{
		MaxRetries:  retry.MaxRetries,
		IsRetryAble: isRetryableModelError,
		BackoffFunc: fixedRetryBackoff(retry.Backoff),
	}
}

// agenticModelRetryConfig 创建 schema.AgenticMessage 路径使用的 ADK 模型重试配置。
// 参数 retry 表示当前 Agent 运行使用的模型失败重试配置。
func agenticModelRetryConfig(retry RuntimeRetryConfig) *adk.TypedModelRetryConfig[*schema.AgenticMessage] {
	if retry.MaxRetries <= 0 {
		return nil
	}
	return &adk.TypedModelRetryConfig[*schema.AgenticMessage]{
		MaxRetries:  retry.MaxRetries,
		IsRetryAble: isRetryableModelError,
		BackoffFunc: fixedRetryBackoff(retry.Backoff),
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
// 参数 req 表示流式聊天请求；参数 agent 表示 Agent 运行时配置；参数 registry 表示普通工具注册表；参数 chapterReader 表示章节读取依赖；参数 novelSummaryStore 表示小说滚动总结读写依赖；参数 novelOutlineStore 表示小说大纲读写依赖；参数 characterStore 表示角色信息读写依赖。
func configuredAgentTools(req ChatRequest, agent runtimeAgentDefinition, registry map[string]runtimeAgentTool, chapterReader agenttools.ChapterReader, novelSummaryStore agenttools.NovelSummaryStore, novelOutlineStore agenttools.NovelOutlineStore, characterStore agenttools.CharacterStore) ([]tool.BaseTool, error) {
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
			tools = append(tools, getContentTool)
		case agenttools.ToolNameQueryChapters:
			queryChaptersTool, err := agenttools.NewQueryChaptersTool(chapterReader, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, queryChaptersTool)
		case agenttools.ToolNameUpdateChapterSummary:
			updateSummaryTool, err := agenttools.NewUpdateChapterSummaryTool(chapterReader, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, updateSummaryTool)
		case agenttools.ToolNameQueryNovelSummary:
			queryNovelSummaryTool, err := agenttools.NewQueryNovelSummaryTool(novelSummaryStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, queryNovelSummaryTool)
		case agenttools.ToolNameUpdateNovelSummary:
			updateNovelSummaryTool, err := agenttools.NewUpdateNovelSummaryTool(novelSummaryStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, updateNovelSummaryTool)
		case agenttools.ToolNameQueryNovelOutline:
			queryNovelOutlineTool, err := agenttools.NewQueryNovelOutlineTool(novelOutlineStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, queryNovelOutlineTool)
		case agenttools.ToolNameUpdateNovelOutline:
			updateNovelOutlineTool, err := agenttools.NewUpdateNovelOutlineTool(novelOutlineStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, updateNovelOutlineTool)
		case agenttools.ToolNameListCharacters:
			listCharactersTool, err := agenttools.NewListCharactersTool(characterStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, listCharactersTool)
		case agenttools.ToolNameSearchCharactersByName:
			searchCharactersTool, err := agenttools.NewSearchCharactersByNameTool(characterStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, searchCharactersTool)
		case agenttools.ToolNameSaveCharacter:
			saveCharacterTool, err := agenttools.NewSaveCharacterTool(characterStore, req.NovelID, toolConfig.description)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, saveCharacterTool)
		default:
			return nil, fmt.Errorf("%w: 未知 Agent tool %s", ErrAgentConfigInvalid, name)
		}
	}
	return tools, nil
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
// 参数 iterator 表示 Eino ADK 事件迭代器；参数 taskByAgent 表示子 Agent 名称到任务标识的映射；参数 emit 表示文本增量回调。
func streamChatAgentEvents(iterator *adk.AsyncIterator[*adk.TypedAgentEvent[*schema.Message]], taskByAgent map[string]string, emit func(delta AgentDelta) error) (AgentResult, error) {
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

// streamAgenticAgentEvents 将 schema.AgenticMessage Agent 事件转换为统一文本结果。
// 参数 iterator 表示 Eino ADK 事件迭代器；参数 taskByAgent 表示子 Agent 名称到任务标识的映射；参数 emit 表示文本增量回调。
func streamAgenticAgentEvents(iterator *adk.AsyncIterator[*adk.TypedAgentEvent[*schema.AgenticMessage]], taskByAgent map[string]string, emit func(delta AgentDelta) error) (AgentResult, error) {
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
		if err := emitAgenticMessageVariant(event.AgentName, task, event.Output.MessageOutput, &nextReplyIndex, &full, &result, emit); err != nil {
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
		replyIndex := 0
		for {
			chunk, err := variant.MessageStream.Recv()
			if errors.Is(err, io.EOF) {
				return nil
			}
			if err != nil {
				return err
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

	if !isAssistantChatMessage(variant, variant.Message) {
		return nil
	}
	return emitTextDelta(agentName, task, allocateAgentReplyIndex(nextReplyIndex), variant.Message.Content, full, result, emit)
}

// emitAgenticMessageVariant 输出 schema.AgenticMessage 事件中的助手文本。
// 参数 agentName 表示 Eino 事件来源 Agent 名称；参数 task 表示事件对应任务；参数 variant 表示 Eino 消息事件；参数 nextReplyIndex 表示下一段可见助手回复序号；参数 full 表示完整内容构建器；参数 result 表示最终结果；参数 emit 表示文本增量回调。
func emitAgenticMessageVariant(agentName string, task string, variant *adk.TypedMessageVariant[*schema.AgenticMessage], nextReplyIndex *int, full *strings.Builder, result *AgentResult, emit func(delta AgentDelta) error) error {
	if variant.IsStreaming {
		if variant.MessageStream == nil {
			return nil
		}
		defer variant.MessageStream.Close()
		replyIndex := 0
		for {
			chunk, err := variant.MessageStream.Recv()
			if errors.Is(err, io.EOF) {
				return nil
			}
			if err != nil {
				return err
			}
			if !isAssistantAgenticMessage(variant, chunk) {
				continue
			}
			if replyIndex == 0 {
				replyIndex = allocateAgentReplyIndex(nextReplyIndex)
			}
			if err := emitTextDelta(agentName, task, replyIndex, agenticMessageText(chunk), full, result, emit); err != nil {
				return err
			}
		}
	}

	if !isAssistantAgenticMessage(variant, variant.Message) {
		return nil
	}
	return emitTextDelta(agentName, task, allocateAgentReplyIndex(nextReplyIndex), agenticMessageText(variant.Message), full, result, emit)
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
	return (variant.Role == "" || variant.Role == schema.Assistant || msg.Role == schema.Assistant) && strings.TrimSpace(msg.Content) != ""
}

// isAssistantAgenticMessage 判断 schema.AgenticMessage 是否为可展示的助手文本。
// 参数 variant 表示 Eino 消息事件；参数 msg 表示待判断消息。
func isAssistantAgenticMessage(variant *adk.TypedMessageVariant[*schema.AgenticMessage], msg *schema.AgenticMessage) bool {
	if msg == nil {
		return false
	}
	role := msg.Role
	if role == "" {
		role = variant.AgenticRole
	}
	return role == schema.AgenticRoleTypeAssistant && strings.TrimSpace(agenticMessageText(msg)) != ""
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

// agenticMessageText 从 AgenticMessage 中提取模型生成文本。
// 参数 msg 表示 Eino AgenticMessage 流式片段。
func agenticMessageText(msg *schema.AgenticMessage) string {
	if msg == nil {
		return ""
	}

	var builder strings.Builder
	for _, block := range msg.ContentBlocks {
		if block == nil {
			continue
		}
		if block.AssistantGenText != nil {
			builder.WriteString(block.AssistantGenText.Text)
		}
	}
	return builder.String()
}
