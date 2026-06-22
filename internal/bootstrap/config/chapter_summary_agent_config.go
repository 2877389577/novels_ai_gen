package config

import (
	"bytes"
	"fmt"
	"os"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// ChapterSummaryAgentConfigValidator 表示保存章节概要 Agent 配置前执行的业务校验函数。
type ChapterSummaryAgentConfigValidator func(agent ChapterSummaryAgentConfig) error

// ChapterSummaryAgentSnapshot 表示章节概要 Agent 配置和配置文件加载状态。
type ChapterSummaryAgentSnapshot struct {
	// ConfigFile 表示启动 -f 参数指定的实际配置文件绝对路径。
	ConfigFile string
	// ChapterSummaryAgent 表示当前配置文件中的章节概要 Agent 配置。
	ChapterSummaryAgent ChapterSummaryAgentConfig
	// ModifiedAt 表示配置文件在文件系统中的最后修改时间。
	ModifiedAt time.Time
	// ReloadedAt 表示后端最近一次成功加载该配置文件的时间。
	ReloadedAt time.Time
}

// ReadChapterSummaryAgentConfig 读取当前运行时生效的章节概要 Agent 配置。
func (m *ConfigManager) ReadChapterSummaryAgentConfig() (ChapterSummaryAgentSnapshot, error) {
	if m == nil {
		return ChapterSummaryAgentSnapshot{}, fmt.Errorf("配置管理器未初始化")
	}

	m.fileMu.Lock()
	defer m.fileMu.Unlock()

	return m.readChapterSummaryAgentConfigLocked()
}

// UpdateChapterSummaryAgentConfig 只替换配置文件中的 ai.chapter_summary_agent 子树并热加载配置。
// 参数 agent 表示前端提交的章节概要 Agent 配置；参数 validate 表示保存前执行的业务校验函数。
func (m *ConfigManager) UpdateChapterSummaryAgentConfig(agent ChapterSummaryAgentConfig, validate ChapterSummaryAgentConfigValidator) (ChapterSummaryAgentSnapshot, error) {
	if m == nil {
		return ChapterSummaryAgentSnapshot{}, fmt.Errorf("配置管理器未初始化")
	}

	m.fileMu.Lock()
	defer m.fileMu.Unlock()

	data, err := os.ReadFile(m.configFile)
	if err != nil {
		return ChapterSummaryAgentSnapshot{}, fmt.Errorf("读取配置文件失败: %w", err)
	}

	content, err := patchChapterSummaryAgentConfigContent(data, agent)
	if err != nil {
		return ChapterSummaryAgentSnapshot{}, err
	}

	cfg, err := parseConfigContent(content)
	if err != nil {
		return ChapterSummaryAgentSnapshot{}, err
	}
	if validate != nil {
		if err := validate(cfg.AI.ChapterSummaryAgent); err != nil {
			return ChapterSummaryAgentSnapshot{}, fmt.Errorf("章节概要 Agent 配置校验失败: %w", err)
		}
	}

	if _, err := m.writeParsedConfigLocked(content, cfg); err != nil {
		return ChapterSummaryAgentSnapshot{}, err
	}
	return m.readChapterSummaryAgentConfigLocked()
}

// readChapterSummaryAgentConfigLocked 在持有文件锁时读取章节概要 Agent 配置快照。
func (m *ConfigManager) readChapterSummaryAgentConfigLocked() (ChapterSummaryAgentSnapshot, error) {
	info, err := os.Stat(m.configFile)
	if err != nil {
		return ChapterSummaryAgentSnapshot{}, fmt.Errorf("读取配置文件状态失败: %w", err)
	}

	m.mu.RLock()
	reloadedAt := m.reloadedAt
	var agent ChapterSummaryAgentConfig
	if m.cfg != nil {
		agent = m.cfg.AI.ChapterSummaryAgent
	}
	m.mu.RUnlock()

	return ChapterSummaryAgentSnapshot{
		ConfigFile:          m.configFile,
		ChapterSummaryAgent: agent,
		ModifiedAt:          info.ModTime(),
		ReloadedAt:          reloadedAt,
	}, nil
}

// patchChapterSummaryAgentConfigContent 将配置文件 YAML 文本中的 ai.chapter_summary_agent 子树替换为结构化章节概要 Agent 配置。
// 参数 content 表示原始配置文件内容；参数 agent 表示新的章节概要 Agent 配置。
func patchChapterSummaryAgentConfigContent(content []byte, agent ChapterSummaryAgentConfig) (string, error) {
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

	agentNode, err := chapterSummaryAgentConfigYAMLNode(agent)
	if err != nil {
		return "", err
	}
	setMappingValue(aiMapping, "chapter_summary_agent", agentNode)

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

// chapterSummaryAgentConfigYAMLNode 将章节概要 Agent 配置转换为 YAML 节点。
// 参数 agent 表示需要写入配置文件的章节概要 Agent 配置。
func chapterSummaryAgentConfigYAMLNode(agent ChapterSummaryAgentConfig) (*yaml.Node, error) {
	section := chapterSummaryAgentConfigYAMLSection{
		Retry: agent.Retry,
		Agent: agent.Agent,
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
		return nil, fmt.Errorf("%w: 章节概要 Agent 配置不能为空", ErrInvalidConfigContent)
	}
	return root.Content[0], nil
}

// chapterSummaryAgentConfigYAMLSection 表示写入配置文件时使用的 ai.chapter_summary_agent 字段顺序。
type chapterSummaryAgentConfigYAMLSection struct {
	// Retry 表示章节概要 Agent 调用上游模型失败时的重试配置。
	Retry AgentRetryConfig `yaml:"retry"`
	// Agent 表示生成章节概要的单层 Agent 配置。
	Agent AgentDefinition `yaml:"agent"`
}
