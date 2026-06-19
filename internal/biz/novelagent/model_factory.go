package novelagent

import (
	"context"
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
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 emit 表示文本增量回调。
func (r chatAgentRuntime) Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, emit func(delta AgentDelta) error) (AgentResult, error) {
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
	return streamChatAgentEvents(runner.Run(ctx, []*schema.Message{schema.UserMessage(req.Message)}), agentCfg.taskByAgent, emit)
}

// agenticAgentRuntime 表示基于 schema.AgenticMessage 的 Eino ADK 多层 Agent 运行时。
type agenticAgentRuntime struct {
	// model 表示 Eino AgenticModel。
	model einomodel.AgenticModel
	// chapterReader 表示 get_content 工具读取章节正文所需的数据依赖。
	chapterReader agenttools.ChapterReader
}

// Stream 流式执行基于 schema.AgenticMessage 的小说写作 Agent。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 req 表示流式聊天请求；参数 emit 表示文本增量回调。
func (r agenticAgentRuntime) Stream(ctx context.Context, cfg *appconfig.AppConfig, req ChatRequest, emit func(delta AgentDelta) error) (AgentResult, error) {
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
	return streamAgenticAgentEvents(runner.Run(ctx, []*schema.AgenticMessage{schema.UserAgenticMessage(req.Message)}), agentCfg.taskByAgent, emit)
}

// newChatSupervisorAgent 创建基于 schema.Message 的顶层 Agent，并把配置中的子 Agent 包装为 tool。
// 参数 ctx 表示请求上下文；参数 model 表示 Eino ChatModel；参数 cfg 表示运行时 Agent 配置；参数 req 表示流式聊天请求；参数 chapterReader 表示章节读取依赖。
func newChatSupervisorAgent(ctx context.Context, model einomodel.BaseChatModel, cfg runtimeAgentConfig, req ChatRequest, chapterReader agenttools.ChapterReader) (*adk.TypedChatModelAgent[*schema.Message], error) {
	if err := adk.SetLanguage(adk.LanguageChinese); err != nil {
		return nil, err
	}

	tools := make([]tool.BaseTool, 0, len(cfg.children))
	returnDirectly := make(map[string]bool, len(cfg.children))
	for _, child := range cfg.children {
		childTools, err := configuredChildTools(req, child, chapterReader)
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

	tools := make([]tool.BaseTool, 0, len(cfg.children))
	returnDirectly := make(map[string]bool, len(cfg.children))
	for _, child := range cfg.children {
		childTools, err := configuredChildTools(req, child, chapterReader)
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

// configuredChildTools 根据子 Agent 配置创建本次请求可用的普通工具。
// 参数 req 表示流式聊天请求；参数 child 表示子 Agent 运行时配置；参数 chapterReader 表示章节读取依赖。
func configuredChildTools(req ChatRequest, child runtimeAgentDefinition, chapterReader agenttools.ChapterReader) ([]tool.BaseTool, error) {
	if len(child.toolNames) == 0 {
		return nil, nil
	}

	tools := make([]tool.BaseTool, 0, len(child.toolNames))
	for _, name := range child.toolNames {
		switch name {
		case agenttools.ToolNameGetContent:
			getContentTool, err := agenttools.NewGetContentTool(chapterReader, req.NovelID, req.ChapterID)
			if err != nil {
				return nil, fmt.Errorf("创建子 Agent %s 的工具 %s 失败: %w", child.name, name, err)
			}
			tools = append(tools, getContentTool)
		default:
			return nil, fmt.Errorf("%w: 未知子 Agent tool %s", ErrAgentConfigInvalid, name)
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
