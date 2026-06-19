package novelagent

import (
	"fmt"
	"strings"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

const (
	defaultSupervisorMaxIterations = 8
	defaultChildMaxIterations      = 6
	taskDirect                     = "direct"
)

// runtimeAgentDefinition 表示运行时可直接创建 Eino Agent 的配置。
type runtimeAgentDefinition struct {
	// name 表示 Eino ADK Agent 名称，子 Agent 会同时作为 tool 名称。
	name string
	// task 表示子 Agent 产生流式事件时返回给前端的任务标识。
	task string
	// description 表示 Agent 能力描述。
	description string
	// instruction 表示已经标准化或渲染后的系统提示词。
	instruction string
	// maxIterations 表示 Eino ADK Agent 最大生成循环次数。
	maxIterations int
}

// runtimeAgentConfig 表示一次请求使用的多层 Agent 运行时配置。
type runtimeAgentConfig struct {
	// supervisor 表示顶层 Agent 配置。
	supervisor runtimeAgentDefinition
	// children 表示可被顶层 Agent 当成工具调用的子 Agent 配置。
	children []runtimeAgentDefinition
	// taskByAgent 表示子 Agent 名称到前端任务标识的映射。
	taskByAgent map[string]string
}

// newAgentRuntimeConfig 根据应用配置和请求参数生成运行时 Agent 配置。
// 参数 cfg 表示当前应用配置快照；参数 req 表示流式聊天请求。
func newAgentRuntimeConfig(cfg *appconfig.AppConfig, req ChatRequest) (runtimeAgentConfig, error) {
	if cfg == nil {
		return runtimeAgentConfig{}, ErrAgentNotConfigured
	}
	agentCfg := cfg.AI.Agent
	if isEmptyAgentDefinition(agentCfg.Supervisor) && len(agentCfg.Children) == 0 {
		return runtimeAgentConfig{}, ErrAgentNotConfigured
	}

	supervisor, err := normalizeSupervisorAgent(agentCfg.Supervisor)
	if err != nil {
		return runtimeAgentConfig{}, err
	}

	children := make([]runtimeAgentDefinition, 0, len(agentCfg.Children))
	taskByAgent := make(map[string]string, len(agentCfg.Children))
	names := make(map[string]struct{}, len(agentCfg.Children))
	for index, childCfg := range agentCfg.Children {
		child, err := normalizeChildAgent(childCfg, req)
		if err != nil {
			return runtimeAgentConfig{}, fmt.Errorf("子 Agent 配置 %d 无效: %w", index+1, err)
		}
		if _, ok := names[child.name]; ok {
			return runtimeAgentConfig{}, fmt.Errorf("%w: 子 Agent 名称重复 %s", ErrAgentConfigInvalid, child.name)
		}
		names[child.name] = struct{}{}
		children = append(children, child)
		taskByAgent[child.name] = child.task
	}

	return runtimeAgentConfig{
		supervisor:  supervisor,
		children:    children,
		taskByAgent: taskByAgent,
	}, nil
}

// normalizeSupervisorAgent 标准化顶层 Agent 配置。
// 参数 def 表示配置文件中的顶层 Agent 定义。
func normalizeSupervisorAgent(def appconfig.AgentDefinition) (runtimeAgentDefinition, error) {
	name := strings.TrimSpace(def.Name)
	description := strings.TrimSpace(def.Description)
	instruction := strings.TrimSpace(def.Instruction)
	if name == "" {
		return runtimeAgentDefinition{}, fmt.Errorf("%w: 顶层 Agent name 不能为空", ErrAgentConfigInvalid)
	}
	if description == "" {
		return runtimeAgentDefinition{}, fmt.Errorf("%w: 顶层 Agent description 不能为空", ErrAgentConfigInvalid)
	}
	if instruction == "" {
		return runtimeAgentDefinition{}, fmt.Errorf("%w: 顶层 Agent instruction 不能为空", ErrAgentConfigInvalid)
	}

	maxIterations := def.MaxIterations
	if maxIterations <= 0 {
		maxIterations = defaultSupervisorMaxIterations
	}
	return runtimeAgentDefinition{
		name:          name,
		description:   description,
		instruction:   instruction,
		maxIterations: maxIterations,
	}, nil
}

// normalizeChildAgent 标准化子 Agent 配置，并渲染系统提示词变量。
// 参数 def 表示配置文件中的子 Agent 定义；参数 req 表示流式聊天请求。
func normalizeChildAgent(def appconfig.AgentDefinition, req ChatRequest) (runtimeAgentDefinition, error) {
	name := strings.TrimSpace(def.Name)
	description := strings.TrimSpace(def.Description)
	instruction := strings.TrimSpace(def.Instruction)
	if name == "" {
		return runtimeAgentDefinition{}, fmt.Errorf("%w: 子 Agent name 不能为空", ErrAgentConfigInvalid)
	}
	if description == "" {
		return runtimeAgentDefinition{}, fmt.Errorf("%w: 子 Agent description 不能为空", ErrAgentConfigInvalid)
	}
	if instruction == "" {
		return runtimeAgentDefinition{}, fmt.Errorf("%w: 子 Agent instruction 不能为空", ErrAgentConfigInvalid)
	}
	if len(def.Tools) > 0 {
		return runtimeAgentDefinition{}, fmt.Errorf("%w: 子 Agent tools 暂未支持", ErrAgentToolsUnsupported)
	}

	task := strings.TrimSpace(def.Task)
	if task == "" {
		task = name
	}
	if task == taskDirect {
		return runtimeAgentDefinition{}, fmt.Errorf("%w: 子 Agent task 不能为 %s", ErrAgentConfigInvalid, taskDirect)
	}

	renderedInstruction, err := renderPrompt(instruction, promptParams(req))
	if err != nil {
		return runtimeAgentDefinition{}, err
	}

	maxIterations := def.MaxIterations
	if maxIterations <= 0 {
		maxIterations = defaultChildMaxIterations
	}
	return runtimeAgentDefinition{
		name:          name,
		task:          task,
		description:   description,
		instruction:   strings.TrimSpace(renderedInstruction),
		maxIterations: maxIterations,
	}, nil
}

// isEmptyAgentDefinition 判断配置文件中的 Agent 定义是否完全为空。
// 参数 def 表示需要判断的 Agent 定义。
func isEmptyAgentDefinition(def appconfig.AgentDefinition) bool {
	return strings.TrimSpace(def.Name) == "" &&
		strings.TrimSpace(def.Task) == "" &&
		strings.TrimSpace(def.Description) == "" &&
		strings.TrimSpace(def.Instruction) == "" &&
		def.MaxIterations == 0 &&
		len(def.Tools) == 0
}

// promptParams 组装提示词模板变量，变量值只来自前端提交的 prompt_params。
// 参数 req 表示流式对话请求。
func promptParams(req ChatRequest) map[string]string {
	values := make(map[string]string, len(req.PromptParams))
	for key, value := range req.PromptParams {
		key = strings.TrimSpace(key)
		if key == "" {
			continue
		}
		values[key] = strings.TrimSpace(value)
	}
	return values
}
