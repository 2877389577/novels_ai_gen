package novelagent

import (
	"fmt"
	"strings"

	"github.com/cloudwego/eino/schema"

	agenttools "novels_ai_gen/internal/biz/novelagent/tools"
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
	// instruction 表示配置文件中的原始系统提示词。
	instruction string
	// maxIterations 表示 Eino ADK Agent 最大生成循环次数。
	maxIterations int
	// parameters 表示子 Agent 作为工具被调用时的入参定义。
	parameters map[string]*schema.ParameterInfo
	// toolNames 表示子 Agent 可使用的普通工具名称列表。
	toolNames []string
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

// newAgentRuntimeConfig 根据应用配置生成运行时 Agent 配置。
// 参数 cfg 表示当前应用配置快照。
func newAgentRuntimeConfig(cfg *appconfig.AppConfig) (runtimeAgentConfig, error) {
	if cfg == nil {
		return runtimeAgentConfig{}, ErrAgentNotConfigured
	}
	return newRuntimeAgentConfigFromAgent(cfg.AI.Agent)
}

// ValidateAgentConfig 校验结构化小说写作 Agent 配置是否可用于运行时。
// 参数 agentCfg 表示需要校验的多层 Agent 配置。
func ValidateAgentConfig(agentCfg appconfig.AgentConfig) error {
	_, err := newRuntimeAgentConfigFromAgent(agentCfg)
	return err
}

// newRuntimeAgentConfigFromAgent 根据结构化 Agent 配置生成运行时 Agent 配置。
// 参数 agentCfg 表示当前应用配置中的多层 Agent 配置。
func newRuntimeAgentConfigFromAgent(agentCfg appconfig.AgentConfig) (runtimeAgentConfig, error) {
	if isEmptyAgentDefinition(agentCfg.Supervisor) && len(agentCfg.Agent) == 0 {
		return runtimeAgentConfig{}, ErrAgentNotConfigured
	}

	supervisor, err := normalizeSupervisorAgent(agentCfg.Supervisor)
	if err != nil {
		return runtimeAgentConfig{}, err
	}

	children := make([]runtimeAgentDefinition, 0, len(agentCfg.Agent))
	taskByAgent := make(map[string]string, len(agentCfg.Agent))
	names := make(map[string]struct{}, len(agentCfg.Agent))
	for index, childCfg := range agentCfg.Agent {
		if !isChildAgentEnabled(childCfg) {
			continue
		}

		child, err := normalizeChildAgent(childCfg)
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
	if err := validateSupervisorToolChildNameConflict(supervisor.toolNames, names); err != nil {
		return runtimeAgentConfig{}, err
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

	toolNames, err := normalizeAgentTools(def.Tools)
	if err != nil {
		return runtimeAgentDefinition{}, err
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
		toolNames:     toolNames,
	}, nil
}

// normalizeChildAgent 标准化子 Agent 配置。
// 参数 def 表示配置文件中的子 Agent 定义。
func normalizeChildAgent(def appconfig.AgentDefinition) (runtimeAgentDefinition, error) {
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

	toolNames, err := normalizeAgentTools(def.Tools)
	if err != nil {
		return runtimeAgentDefinition{}, err
	}

	task := strings.TrimSpace(def.Task)
	if task == "" {
		task = name
	}
	if task == taskDirect {
		return runtimeAgentDefinition{}, fmt.Errorf("%w: 子 Agent task 不能为 %s", ErrAgentConfigInvalid, taskDirect)
	}

	parameters, err := agentParameterInfos(def.Parameters)
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
		instruction:   instruction,
		maxIterations: maxIterations,
		parameters:    parameters,
		toolNames:     toolNames,
	}, nil
}

// normalizeAgentTools 标准化并校验 Agent 可用普通工具列表。
// 参数 values 表示配置文件中的工具名称列表。
func normalizeAgentTools(values []string) ([]string, error) {
	if len(values) == 0 {
		return nil, nil
	}

	toolNames := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, rawValue := range values {
		name := strings.TrimSpace(rawValue)
		if name == "" {
			return nil, fmt.Errorf("%w: Agent tool 名称不能为空", ErrAgentConfigInvalid)
		}
		if _, ok := seen[name]; ok {
			return nil, fmt.Errorf("%w: Agent tool 名称重复 %s", ErrAgentConfigInvalid, name)
		}
		if name != agenttools.ToolNameGetContent {
			return nil, fmt.Errorf("%w: 未知 Agent tool %s", ErrAgentConfigInvalid, name)
		}
		seen[name] = struct{}{}
		toolNames = append(toolNames, name)
	}
	return toolNames, nil
}

// isChildAgentEnabled 判断子 Agent 是否启用，未配置 enabled 时按启用处理。
// 参数 def 表示配置文件中的子 Agent 定义。
func isChildAgentEnabled(def appconfig.AgentDefinition) bool {
	return def.Enabled == nil || *def.Enabled
}

// validateSupervisorToolChildNameConflict 校验顶层普通工具名称是否与启用子 Agent 名称冲突。
// 参数 toolNames 表示顶层 Agent 普通工具名称列表；参数 childNames 表示启用子 Agent 名称集合。
func validateSupervisorToolChildNameConflict(toolNames []string, childNames map[string]struct{}) error {
	for _, toolName := range toolNames {
		if _, ok := childNames[toolName]; ok {
			return fmt.Errorf("%w: 顶层 Agent tool 名称与子 Agent 名称冲突 %s", ErrAgentConfigInvalid, toolName)
		}
	}
	return nil
}

// agentParameterInfos 将配置文件中的工具参数定义转换为 Eino 参数信息。
// 参数 definitions 表示配置文件中的参数定义集合。
func agentParameterInfos(definitions map[string]appconfig.AgentParameterDefinition) (map[string]*schema.ParameterInfo, error) {
	return agentParameterInfosWithPath(definitions, "parameters")
}

// agentParameterInfosWithPath 递归转换工具参数定义，并携带错误路径。
// 参数 definitions 表示当前层级的参数定义；参数 path 表示错误提示中的配置路径。
func agentParameterInfosWithPath(definitions map[string]appconfig.AgentParameterDefinition, path string) (map[string]*schema.ParameterInfo, error) {
	params := make(map[string]*schema.ParameterInfo, len(definitions))
	for rawName, definition := range definitions {
		name := strings.TrimSpace(rawName)
		if name == "" {
			return nil, fmt.Errorf("%w: %s 参数名不能为空", ErrAgentConfigInvalid, path)
		}

		info, err := agentParameterInfo(definition, path+"."+name)
		if err != nil {
			return nil, err
		}
		params[name] = info
	}
	return params, nil
}

// agentParameterInfo 将单个配置参数定义转换为 Eino 参数信息。
// 参数 definition 表示配置文件中的单个参数定义；参数 path 表示错误提示中的配置路径。
func agentParameterInfo(definition appconfig.AgentParameterDefinition, path string) (*schema.ParameterInfo, error) {
	dataType, err := agentParameterType(definition.Type, path)
	if err != nil {
		return nil, err
	}
	if len(definition.Enum) > 0 && dataType != schema.String {
		return nil, fmt.Errorf("%w: %s enum 仅支持 string 类型", ErrAgentConfigInvalid, path)
	}
	if definition.Items != nil && dataType != schema.Array {
		return nil, fmt.Errorf("%w: %s items 仅支持 array 类型", ErrAgentConfigInvalid, path)
	}
	if len(definition.Properties) > 0 && dataType != schema.Object {
		return nil, fmt.Errorf("%w: %s properties 仅支持 object 类型", ErrAgentConfigInvalid, path)
	}

	info := &schema.ParameterInfo{
		Type:     dataType,
		Desc:     strings.TrimSpace(definition.Description),
		Enum:     trimStringSlice(definition.Enum),
		Required: definition.Required,
	}
	if definition.Items != nil {
		itemInfo, err := agentParameterInfo(*definition.Items, path+".items")
		if err != nil {
			return nil, err
		}
		info.ElemInfo = itemInfo
	}
	if len(definition.Properties) > 0 {
		subParams, err := agentParameterInfosWithPath(definition.Properties, path+".properties")
		if err != nil {
			return nil, err
		}
		info.SubParams = subParams
	}
	return info, nil
}

// agentParameterType 标准化并校验 Eino 工具参数类型。
// 参数 value 表示配置中的类型值；参数 path 表示错误提示中的配置路径。
func agentParameterType(value string, path string) (schema.DataType, error) {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return schema.String, nil
	}

	switch schema.DataType(value) {
	case schema.Object, schema.Number, schema.Integer, schema.String, schema.Array, schema.Null, schema.Boolean:
		return schema.DataType(value), nil
	default:
		return "", fmt.Errorf("%w: %s type 不支持 %s", ErrAgentConfigInvalid, path, value)
	}
}

// trimStringSlice 去除字符串切片中每一项两侧空白。
// 参数 values 表示原始字符串切片。
func trimStringSlice(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	for _, value := range values {
		result = append(result, strings.TrimSpace(value))
	}
	return result
}

// isEmptyAgentDefinition 判断配置文件中的 Agent 定义是否完全为空。
// 参数 def 表示需要判断的 Agent 定义。
func isEmptyAgentDefinition(def appconfig.AgentDefinition) bool {
	return strings.TrimSpace(def.Name) == "" &&
		strings.TrimSpace(def.Task) == "" &&
		strings.TrimSpace(def.Description) == "" &&
		strings.TrimSpace(def.Instruction) == "" &&
		def.MaxIterations == 0 &&
		def.Enabled == nil &&
		len(def.Tools) == 0 &&
		len(def.Parameters) == 0
}
