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
	defaultMaxTokens   = 4096
	defaultTimeout     = 120 * time.Second
)

const summarySystemPrompt = "你是小说写作 Agent 的长期记忆摘要器。请把旧摘要和新增对话整理成一份紧凑、准确、可持续更新的中文摘要，保留用户偏好、小说设定、角色关系、写作要求、已经确认的修改方向和重要上下文。不要输出寒暄、标题或 Markdown 代码块，只输出摘要正文。"

const promptRecommendationSystemPrompt = "你是小说提示词库推荐判定器。你的任务是判断用户当前输入是否属于小说正文修改、润色、扩写、缩写、风格调整、情绪强化、节奏调整、氛围调整、语言优化或类似写作修改需求，并从用户提供的提示词类型列表中选择最匹配的一项。你必须只输出 JSON，不要输出 Markdown、解释或额外文本。匹配时输出 {\"action\":\"prompt_search\",\"matched\":true,\"prompt_type\":\"类型名\"}；不匹配或无法确定时输出 {\"action\":\"none\",\"matched\":false,\"prompt_type\":\"\"}。prompt_type 必须严格来自可选类型列表。"

// EinoAgentRuntimeFactory 表示基于 Eino ADK 的多层 Agent 运行时工厂。
type EinoAgentRuntimeFactory struct {
	// chapterReader 表示 get_content 工具读取章节正文所需的数据依赖。
	chapterReader agenttools.ChapterReader
}

// NewEinoAgentRuntimeFactory 创建基于 Eino ADK 的多层 Agent 运行时工厂。
// 参数 chapterReader 表示 get_content 工具读取章节正文所需的数据依赖。
func NewEinoAgentRuntimeFactory(chapterReader agenttools.ChapterReader) *EinoAgentRuntimeFactory {
	return &EinoAgentRuntimeFactory{chapterReader: chapterReader}
}

// NewRuntime 按 AI 提供商协议创建 Eino 多层 Agent 运行时。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
func (f *EinoAgentRuntimeFactory) NewRuntime(ctx context.Context, cfg ModelConfig) (AgentRuntime, error) {
	cfg.ProviderType = strings.ToLower(strings.TrimSpace(cfg.ProviderType))
	cfg.APIType = strings.ToLower(strings.TrimSpace(cfg.APIType))

	switch cfg.ProviderType {
	case providerTypeOpenAI:
		return f.newOpenAIRuntime(ctx, cfg)
	case providerTypeClaude:
		return f.newClaudeRuntime(ctx, cfg)
	case providerTypeGemini:
		return f.newGeminiRuntime(ctx, cfg)
	default:
		return nil, fmt.Errorf("不支持的 AI 提供商类型: %s", cfg.ProviderType)
	}
}

// newOpenAIRuntime 根据 OpenAI API 类型创建 Eino Agent 运行时。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
func (f *EinoAgentRuntimeFactory) newOpenAIRuntime(ctx context.Context, cfg ModelConfig) (AgentRuntime, error) {
	switch cfg.APIType {
	case apiTypeResponse:
		timeout := defaultTimeout
		model, err := agenticopenai.NewResponsesModel(ctx, &agenticopenai.ResponsesConfig{
			APIKey:  cfg.APIKey,
			BaseURL: cfg.BaseURL,
			Model:   cfg.Model,
			Timeout: &timeout,
		})
		if err != nil {
			return nil, err
		}
		return agenticAgentRuntime{model: model, chapterReader: f.chapterReader}, nil
	case "", apiTypeCompletions:
		model, err := einoopenai.NewChatModel(ctx, &einoopenai.ChatModelConfig{
			APIKey:  cfg.APIKey,
			BaseURL: cfg.BaseURL,
			Model:   cfg.Model,
			Timeout: defaultTimeout,
		})
		if err != nil {
			return nil, err
		}
		return chatAgentRuntime{model: model, chapterReader: f.chapterReader}, nil
	default:
		return nil, fmt.Errorf("不支持的 OpenAI API 类型: %s", cfg.APIType)
	}
}

// newClaudeRuntime 创建 Claude 协议的 Eino Agent 运行时。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
func (f *EinoAgentRuntimeFactory) newClaudeRuntime(ctx context.Context, cfg ModelConfig) (AgentRuntime, error) {
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
	return agenticAgentRuntime{model: model, chapterReader: f.chapterReader}, nil
}

// newGeminiRuntime 创建 Gemini 协议的 Eino Agent 运行时。
// 参数 ctx 表示请求上下文；参数 cfg 表示模型创建配置。
func (f *EinoAgentRuntimeFactory) newGeminiRuntime(ctx context.Context, cfg ModelConfig) (AgentRuntime, error) {
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
	return agenticAgentRuntime{model: model, chapterReader: f.chapterReader}, nil
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

// chatAgentRuntime 表示基于 schema.Message 的 Eino ADK 多层 Agent 运行时。
type chatAgentRuntime struct {
	// model 表示支持 OpenAI completions 协议的 Eino ChatModel。
	model einomodel.BaseChatModel
	// chapterReader 表示 get_content 工具读取章节正文所需的数据依赖。
	chapterReader agenttools.ChapterReader
}

// Stream 流式执行基于 schema.Message 的小说写作 Agent。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 memory 表示需要注入模型上下文的小说级记忆；参数 emit 表示文本增量回调。
func (r chatAgentRuntime) Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, memory AgentMemoryInput, emit func(delta AgentDelta) error) (AgentResult, error) {
	agentCfg, err := newAgentRuntimeConfig(cfg)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	agent, err := newChatSupervisorAgent(ctx, r.model, agentCfg, req, r.chapterReader)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	runner := adk.NewTypedRunner(adk.TypedRunnerConfig[*schema.Message]{
		Agent:           agent,
		EnableStreaming: true,
	})
	return streamChatAgentEvents(runner.Run(ctx, chatRunMessages(req, memory)), agentCfg.taskByAgent, emit)
}

// Summarize 使用 schema.Message 模型生成小说级 Agent 滚动摘要。
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

// agenticAgentRuntime 表示基于 schema.AgenticMessage 的 Eino ADK 多层 Agent 运行时。
type agenticAgentRuntime struct {
	// model 表示 Eino AgenticModel。
	model einomodel.AgenticModel
	// chapterReader 表示 get_content 工具读取章节正文所需的数据依赖。
	chapterReader agenttools.ChapterReader
}

// Stream 流式执行基于 schema.AgenticMessage 的小说写作 Agent。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 memory 表示需要注入模型上下文的小说级记忆；参数 emit 表示文本增量回调。
func (r agenticAgentRuntime) Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, memory AgentMemoryInput, emit func(delta AgentDelta) error) (AgentResult, error) {
	agentCfg, err := newAgentRuntimeConfig(cfg)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	agent, err := newAgenticSupervisorAgent(ctx, r.model, agentCfg, req, r.chapterReader)
	if err != nil {
		return AgentResult{Task: taskDirect}, err
	}

	runner := adk.NewTypedRunner(adk.TypedRunnerConfig[*schema.AgenticMessage]{
		Agent:           agent,
		EnableStreaming: true,
	})
	return streamAgenticAgentEvents(runner.Run(ctx, agenticRunMessages(req, memory)), agentCfg.taskByAgent, emit)
}

// Summarize 使用 schema.AgenticMessage 模型生成小说级 Agent 滚动摘要。
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

// chatRunMessages 构造 schema.Message 路径的 Agent 输入消息列表。
// 参数 req 表示本轮聊天请求；参数 memory 表示需要注入模型上下文的小说级记忆。
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
	if prompt := requestContextPrompt(req); prompt != "" {
		messages = append(messages, schema.SystemMessage(prompt))
	}
	messages = append(messages, schema.UserMessage(req.Message))
	return messages
}

// agenticRunMessages 构造 schema.AgenticMessage 路径的 Agent 输入消息列表。
// 参数 req 表示本轮聊天请求；参数 memory 表示需要注入模型上下文的小说级记忆。
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
	if prompt := requestContextPrompt(req); prompt != "" {
		messages = append(messages, schema.SystemAgenticMessage(prompt))
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
	if req.NovelID == 0 || req.ChapterID == 0 {
		return ""
	}
	return "本轮请求已关联当前小说的当前章节。若用户请求需要读取当前章节正文，请调用可用的 get_content 工具，或调用具备该能力的章节处理子 Agent；不要要求用户粘贴全文，当前章节的真实章节号以工具读取到的章节数据为准。"
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
// 参数 ctx 表示请求上下文；参数 model 表示 Eino ChatModel；参数 cfg 表示运行时 Agent 配置；参数 req 表示流式聊天请求；参数 chapterReader 表示章节读取依赖。
func newChatSupervisorAgent(ctx context.Context, model einomodel.BaseChatModel, cfg runtimeAgentConfig, req ChatRequest, chapterReader agenttools.ChapterReader) (*adk.TypedChatModelAgent[*schema.Message], error) {
	if err := adk.SetLanguage(adk.LanguageChinese); err != nil {
		return nil, err
	}

	supervisorTools, err := configuredAgentTools(req, cfg.supervisor, chapterReader)
	if err != nil {
		return nil, err
	}

	tools := make([]tool.BaseTool, 0, len(supervisorTools)+len(cfg.children))
	tools = append(tools, supervisorTools...)
	returnDirectly := make(map[string]bool, len(cfg.children))
	for _, child := range cfg.children {
		childTools, err := configuredAgentTools(req, child, chapterReader)
		if err != nil {
			return nil, err
		}
		childAgent, err := adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.Message]{
			Name:          child.name,
			Description:   child.description,
			Instruction:   child.instruction,
			Model:         model,
			ToolsConfig:   childToolsConfig(childTools),
			MaxIterations: child.maxIterations,
		})
		if err != nil {
			return nil, fmt.Errorf("创建子 Agent %s 失败: %w", child.name, err)
		}
		tools = append(tools, adk.NewAgentTool(
			ctx,
			childAgent,
			adk.WithAgentInputSchema(schema.NewParamsOneOfByParams(child.parameters)),
		))
		returnDirectly[child.name] = true
	}

	return adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.Message]{
		Name:        cfg.supervisor.name,
		Description: cfg.supervisor.description,
		Instruction: cfg.supervisor.instruction,
		Model:       model,
		ToolsConfig: adk.ToolsConfig{
			ToolsNodeConfig: compose.ToolsNodeConfig{
				Tools:               tools,
				ExecuteSequentially: true,
			},
			EmitInternalEvents: true,
			ReturnDirectly:     returnDirectly,
		},
		MaxIterations: cfg.supervisor.maxIterations,
	})
}

// newAgenticSupervisorAgent 创建基于 schema.AgenticMessage 的顶层 Agent，并把配置中的子 Agent 包装为 tool。
// 参数 ctx 表示请求上下文；参数 model 表示 Eino AgenticModel；参数 cfg 表示运行时 Agent 配置；参数 req 表示流式聊天请求；参数 chapterReader 表示章节读取依赖。
func newAgenticSupervisorAgent(ctx context.Context, model einomodel.AgenticModel, cfg runtimeAgentConfig, req ChatRequest, chapterReader agenttools.ChapterReader) (*adk.TypedChatModelAgent[*schema.AgenticMessage], error) {
	if err := adk.SetLanguage(adk.LanguageChinese); err != nil {
		return nil, err
	}

	supervisorTools, err := configuredAgentTools(req, cfg.supervisor, chapterReader)
	if err != nil {
		return nil, err
	}

	tools := make([]tool.BaseTool, 0, len(supervisorTools)+len(cfg.children))
	tools = append(tools, supervisorTools...)
	returnDirectly := make(map[string]bool, len(cfg.children))
	for _, child := range cfg.children {
		childTools, err := configuredAgentTools(req, child, chapterReader)
		if err != nil {
			return nil, err
		}
		childAgent, err := adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.AgenticMessage]{
			Name:          child.name,
			Description:   child.description,
			Instruction:   child.instruction,
			Model:         model,
			ToolsConfig:   childToolsConfig(childTools),
			MaxIterations: child.maxIterations,
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
		Instruction: cfg.supervisor.instruction,
		Model:       model,
		ToolsConfig: adk.ToolsConfig{
			ToolsNodeConfig: compose.ToolsNodeConfig{
				Tools:               tools,
				ExecuteSequentially: true,
			},
			EmitInternalEvents: true,
			ReturnDirectly:     returnDirectly,
		},
		MaxIterations: cfg.supervisor.maxIterations,
	})
}

// configuredAgentTools 根据 Agent 配置创建本次请求可用的普通工具。
// 参数 req 表示流式聊天请求；参数 agent 表示 Agent 运行时配置；参数 chapterReader 表示章节读取依赖。
func configuredAgentTools(req ChatRequest, agent runtimeAgentDefinition, chapterReader agenttools.ChapterReader) ([]tool.BaseTool, error) {
	if len(agent.toolNames) == 0 {
		return nil, nil
	}

	tools := make([]tool.BaseTool, 0, len(agent.toolNames))
	for _, name := range agent.toolNames {
		switch name {
		case agenttools.ToolNameGetContent:
			getContentTool, err := agenttools.NewGetContentTool(chapterReader, req.NovelID, req.ChapterID)
			if err != nil {
				return nil, fmt.Errorf("创建 Agent %s 的工具 %s 失败: %w", agent.name, name, err)
			}
			tools = append(tools, getContentTool)
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
		if err := emitChatMessageVariant(task, event.Output.MessageOutput, &full, &result, emit); err != nil {
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
		if err := emitAgenticMessageVariant(task, event.Output.MessageOutput, &full, &result, emit); err != nil {
			return result, err
		}
	}
	return result, nil
}

// emitChatMessageVariant 输出 schema.Message 事件中的助手文本。
// 参数 task 表示事件对应任务；参数 variant 表示 Eino 消息事件；参数 full 表示完整内容构建器；参数 result 表示最终结果；参数 emit 表示文本增量回调。
func emitChatMessageVariant(task string, variant *adk.TypedMessageVariant[*schema.Message], full *strings.Builder, result *AgentResult, emit func(delta AgentDelta) error) error {
	if variant.IsStreaming {
		if variant.MessageStream == nil {
			return nil
		}
		defer variant.MessageStream.Close()
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
			if err := emitTextDelta(task, chunk.Content, full, result, emit); err != nil {
				return err
			}
		}
	}

	if !isAssistantChatMessage(variant, variant.Message) {
		return nil
	}
	return emitTextDelta(task, variant.Message.Content, full, result, emit)
}

// emitAgenticMessageVariant 输出 schema.AgenticMessage 事件中的助手文本。
// 参数 task 表示事件对应任务；参数 variant 表示 Eino 消息事件；参数 full 表示完整内容构建器；参数 result 表示最终结果；参数 emit 表示文本增量回调。
func emitAgenticMessageVariant(task string, variant *adk.TypedMessageVariant[*schema.AgenticMessage], full *strings.Builder, result *AgentResult, emit func(delta AgentDelta) error) error {
	if variant.IsStreaming {
		if variant.MessageStream == nil {
			return nil
		}
		defer variant.MessageStream.Close()
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
			if err := emitTextDelta(task, agenticMessageText(chunk), full, result, emit); err != nil {
				return err
			}
		}
	}

	if !isAssistantAgenticMessage(variant, variant.Message) {
		return nil
	}
	return emitTextDelta(task, agenticMessageText(variant.Message), full, result, emit)
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
// 参数 task 表示事件对应任务；参数 content 表示文本增量；参数 full 表示完整内容构建器；参数 result 表示最终结果；参数 emit 表示文本增量回调。
func emitTextDelta(task string, content string, full *strings.Builder, result *AgentResult, emit func(delta AgentDelta) error) error {
	if content == "" {
		return nil
	}
	result.Task = task
	full.WriteString(content)
	result.Content = full.String()
	return emit(AgentDelta{Task: task, Content: content})
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
