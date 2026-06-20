package config

import (
	"bytes"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// AgentConfigValidator 表示保存智能体配置前执行的业务校验函数。
type AgentConfigValidator func(agent AgentConfig) error

// AgentSnapshot 表示结构化智能体配置和配置文件加载状态。
type AgentSnapshot struct {
	// ConfigFile 表示启动 -f 参数指定的实际配置文件绝对路径。
	ConfigFile string
	// Agent 表示当前配置文件中的小说写作多层 Agent 配置。
	Agent AgentConfig
	// ModifiedAt 表示配置文件在文件系统中的最后修改时间。
	ModifiedAt time.Time
	// ReloadedAt 表示后端最近一次成功加载该配置文件的时间。
	ReloadedAt time.Time
}

// ReadAgentConfig 读取当前运行时生效的结构化智能体配置。
func (m *ConfigManager) ReadAgentConfig() (AgentSnapshot, error) {
	if m == nil {
		return AgentSnapshot{}, fmt.Errorf("配置管理器未初始化")
	}

	m.fileMu.Lock()
	defer m.fileMu.Unlock()

	return m.readAgentConfigLocked()
}

// UpdateAgentConfig 只替换配置文件中的 ai.agent 子树并热加载配置。
// 参数 agent 表示前端提交的结构化智能体配置；参数 validate 表示保存前执行的业务校验函数。
func (m *ConfigManager) UpdateAgentConfig(agent AgentConfig, validate AgentConfigValidator) (AgentSnapshot, error) {
	if m == nil {
		return AgentSnapshot{}, fmt.Errorf("配置管理器未初始化")
	}

	m.fileMu.Lock()
	defer m.fileMu.Unlock()

	data, err := os.ReadFile(m.configFile)
	if err != nil {
		return AgentSnapshot{}, fmt.Errorf("读取配置文件失败: %w", err)
	}

	content, err := patchAgentConfigContent(data, agent)
	if err != nil {
		return AgentSnapshot{}, err
	}

	cfg, err := parseConfigContent(content)
	if err != nil {
		return AgentSnapshot{}, err
	}
	if validate != nil {
		if err := validate(cfg.AI.Agent); err != nil {
			return AgentSnapshot{}, fmt.Errorf("智能体配置校验失败: %w", err)
		}
	}

	if _, err := m.writeParsedConfigLocked(content, cfg); err != nil {
		return AgentSnapshot{}, err
	}
	return m.readAgentConfigLocked()
}

// writeParsedConfigLocked 在持有文件锁时写入已经成功解析的配置内容并热加载。
// 参数 content 表示需要写入配置文件的完整 YAML 文本；参数 cfg 表示解析后的应用配置。
func (m *ConfigManager) writeParsedConfigLocked(content string, cfg *AppConfig) (FileSnapshot, error) {
	mode := os.FileMode(0644)
	if info, statErr := os.Stat(m.configFile); statErr == nil {
		mode = info.Mode().Perm()
	}
	if err := os.WriteFile(m.configFile, []byte(content), mode); err != nil {
		return FileSnapshot{}, fmt.Errorf("写入配置文件失败: %w", err)
	}

	m.apply(cfg, time.Now())
	slog.Info("配置文件保存并热加载成功", "config_file", m.configFile)
	return m.readFileLocked()
}

// readAgentConfigLocked 在持有文件锁时读取智能体配置快照。
func (m *ConfigManager) readAgentConfigLocked() (AgentSnapshot, error) {
	info, err := os.Stat(m.configFile)
	if err != nil {
		return AgentSnapshot{}, fmt.Errorf("读取配置文件状态失败: %w", err)
	}

	m.mu.RLock()
	reloadedAt := m.reloadedAt
	var agent AgentConfig
	if m.cfg != nil {
		agent = m.cfg.AI.Agent
	}
	m.mu.RUnlock()

	return AgentSnapshot{
		ConfigFile: m.configFile,
		Agent:      agent,
		ModifiedAt: info.ModTime(),
		ReloadedAt: reloadedAt,
	}, nil
}

// patchAgentConfigContent 将配置文件 YAML 文本中的 ai.agent 子树替换为结构化智能体配置。
// 参数 content 表示原始配置文件内容；参数 agent 表示新的智能体配置。
func patchAgentConfigContent(content []byte, agent AgentConfig) (string, error) {
	if strings.TrimSpace(string(content)) == "" {
		return "", ErrConfigContentRequired
	}

	var root yaml.Node
	if err := yaml.Unmarshal(content, &root); err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}

	rootMapping, err := rootDocumentMapping(&root)
	if err != nil {
		return "", err
	}
	aiMapping, err := ensureMappingValue(rootMapping, "ai")
	if err != nil {
		return "", err
	}

	agentNode, err := agentConfigYAMLNode(agent)
	if err != nil {
		return "", err
	}
	setMappingValue(aiMapping, "agent", agentNode)

	var output bytes.Buffer
	encoder := yaml.NewEncoder(&output)
	encoder.SetIndent(2)
	if err := encoder.Encode(&root); err != nil {
		_ = encoder.Close()
		return "", fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}
	if err := encoder.Close(); err != nil {
		return "", fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}
	return output.String(), nil
}

// rootDocumentMapping 返回 YAML 文档根节点中的对象节点。
// 参数 root 表示 YAML 文档根节点。
func rootDocumentMapping(root *yaml.Node) (*yaml.Node, error) {
	if root.Kind != yaml.DocumentNode || len(root.Content) == 0 {
		return nil, fmt.Errorf("%w: 配置文件根节点必须是 YAML 文档", ErrInvalidConfigContent)
	}

	mapping := root.Content[0]
	if mapping.Kind != yaml.MappingNode {
		return nil, fmt.Errorf("%w: 配置文件根节点必须是对象", ErrInvalidConfigContent)
	}
	return mapping, nil
}

// ensureMappingValue 返回指定键对应的对象节点，不存在时创建对象节点。
// 参数 mapping 表示父级 YAML 对象节点；参数 key 表示需要读取或创建的键名。
func ensureMappingValue(mapping *yaml.Node, key string) (*yaml.Node, error) {
	if mapping.Kind != yaml.MappingNode {
		return nil, fmt.Errorf("%w: %s 所在节点必须是对象", ErrInvalidConfigContent, key)
	}

	if value, ok := findMappingValue(mapping, key); ok {
		if value.Kind != yaml.MappingNode {
			return nil, fmt.Errorf("%w: %s 必须是对象", ErrInvalidConfigContent, key)
		}
		return value, nil
	}

	value := &yaml.Node{Kind: yaml.MappingNode}
	mapping.Content = append(mapping.Content, scalarKeyNode(key), value)
	return value, nil
}

// findMappingValue 在 YAML 对象节点中查找指定键的值节点。
// 参数 mapping 表示父级 YAML 对象节点；参数 key 表示需要查找的键名。
func findMappingValue(mapping *yaml.Node, key string) (*yaml.Node, bool) {
	for index := 0; index+1 < len(mapping.Content); index += 2 {
		if mapping.Content[index].Value == key {
			return mapping.Content[index+1], true
		}
	}
	return nil, false
}

// setMappingValue 设置 YAML 对象节点中指定键的值节点。
// 参数 mapping 表示父级 YAML 对象节点；参数 key 表示需要设置的键名；参数 value 表示新的值节点。
func setMappingValue(mapping *yaml.Node, key string, value *yaml.Node) {
	for index := 0; index+1 < len(mapping.Content); index += 2 {
		if mapping.Content[index].Value == key {
			mapping.Content[index+1] = value
			return
		}
	}
	mapping.Content = append(mapping.Content, scalarKeyNode(key), value)
}

// scalarKeyNode 创建 YAML 对象键节点。
// 参数 value 表示键名文本。
func scalarKeyNode(value string) *yaml.Node {
	return &yaml.Node{
		Kind:  yaml.ScalarNode,
		Tag:   "!!str",
		Value: value,
	}
}

// agentConfigYAMLNode 将智能体配置转换为 YAML 节点。
// 参数 agent 表示需要写入配置文件的智能体配置。
func agentConfigYAMLNode(agent AgentConfig) (*yaml.Node, error) {
	section := agentConfigYAMLSection{
		Memory:     agent.Memory,
		Supervisor: agent.Supervisor,
		Agent:      agent.Agent,
	}

	data, err := yaml.Marshal(section)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}

	var root yaml.Node
	if err := yaml.Unmarshal(data, &root); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}
	if len(root.Content) == 0 {
		return nil, fmt.Errorf("%w: 智能体配置不能为空", ErrInvalidConfigContent)
	}
	return root.Content[0], nil
}

// agentConfigYAMLSection 表示写入配置文件时使用的 ai.agent 字段顺序。
type agentConfigYAMLSection struct {
	// Memory 表示小说写作 Agent 的持久记忆配置。
	Memory AgentMemoryConfig `yaml:"memory"`
	// Supervisor 表示顶层 Agent 配置。
	Supervisor AgentDefinition `yaml:"supervisor"`
	// Agent 表示可被顶层 Agent 当成工具调用的子 Agent 配置列表。
	Agent []AgentDefinition `yaml:"agent"`
}
