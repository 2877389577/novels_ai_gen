package config

import (
	"bytes"
	"fmt"
	"os"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// PromptTypesSnapshot 表示提示词类型配置和配置文件加载状态。
type PromptTypesSnapshot struct {
	// ConfigFile 表示启动 -f 参数指定的实际配置文件绝对路径。
	ConfigFile string
	// Items 表示当前配置文件中的提示词类型列表。
	Items []string
	// ModifiedAt 表示配置文件在文件系统中的最后修改时间。
	ModifiedAt time.Time
	// ReloadedAt 表示后端最近一次成功加载该配置文件的时间。
	ReloadedAt time.Time
}

// ReadPromptTypes 读取当前运行时生效的提示词类型配置。
func (m *ConfigManager) ReadPromptTypes() (PromptTypesSnapshot, error) {
	if m == nil {
		return PromptTypesSnapshot{}, fmt.Errorf("配置管理器未初始化")
	}

	m.fileMu.Lock()
	defer m.fileMu.Unlock()

	return m.readPromptTypesLocked()
}

// CreatePromptType 新增提示词类型并热加载配置。
// 参数 name 表示需要新增的提示词类型名称。
func (m *ConfigManager) CreatePromptType(name string) (PromptTypesSnapshot, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return PromptTypesSnapshot{}, ErrPromptTypeNameRequired
	}

	return m.updatePromptTypes(func(items []string) ([]string, error) {
		if promptTypeExists(items, name) {
			return nil, ErrPromptTypeConflict
		}
		return append(items, name), nil
	})
}

// RenamePromptType 重命名提示词类型并热加载配置。
// 参数 oldName 表示旧提示词类型名称；参数 newName 表示新提示词类型名称。
func (m *ConfigManager) RenamePromptType(oldName string, newName string) (PromptTypesSnapshot, error) {
	oldName = strings.TrimSpace(oldName)
	newName = strings.TrimSpace(newName)
	if oldName == "" || newName == "" {
		return PromptTypesSnapshot{}, ErrPromptTypeNameRequired
	}
	if oldName == newName {
		return m.ReadPromptTypes()
	}

	return m.updatePromptTypes(func(items []string) ([]string, error) {
		index := promptTypeIndex(items, oldName)
		if index < 0 {
			return nil, ErrPromptTypeNotFound
		}
		if promptTypeExists(items, newName) {
			return nil, ErrPromptTypeConflict
		}
		items[index] = newName
		return items, nil
	})
}

// DeletePromptType 删除提示词类型并热加载配置。
// 参数 name 表示需要删除的提示词类型名称。
func (m *ConfigManager) DeletePromptType(name string) (PromptTypesSnapshot, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return PromptTypesSnapshot{}, ErrPromptTypeNameRequired
	}

	return m.updatePromptTypes(func(items []string) ([]string, error) {
		index := promptTypeIndex(items, name)
		if index < 0 {
			return nil, ErrPromptTypeNotFound
		}
		return append(items[:index], items[index+1:]...), nil
	})
}

// updatePromptTypes 在持有文件锁时更新提示词类型配置并热加载。
// 参数 mutate 表示基于当前提示词类型列表生成新列表的方法。
func (m *ConfigManager) updatePromptTypes(mutate func(items []string) ([]string, error)) (PromptTypesSnapshot, error) {
	if m == nil {
		return PromptTypesSnapshot{}, fmt.Errorf("配置管理器未初始化")
	}

	m.fileMu.Lock()
	defer m.fileMu.Unlock()

	data, err := os.ReadFile(m.configFile)
	if err != nil {
		return PromptTypesSnapshot{}, fmt.Errorf("读取配置文件失败: %w", err)
	}

	m.mu.RLock()
	items := m.currentPromptTypesLocked()
	m.mu.RUnlock()
	items, err = normalizePromptTypeList(items)
	if err != nil {
		return PromptTypesSnapshot{}, err
	}
	nextItems, err := mutate(items)
	if err != nil {
		return PromptTypesSnapshot{}, err
	}
	nextItems, err = normalizePromptTypeList(nextItems)
	if err != nil {
		return PromptTypesSnapshot{}, err
	}

	content, err := patchPromptTypesContent(data, nextItems)
	if err != nil {
		return PromptTypesSnapshot{}, err
	}

	cfg, err := parseConfigContent(content)
	if err != nil {
		return PromptTypesSnapshot{}, err
	}
	if _, err := m.writeParsedConfigLocked(content, cfg); err != nil {
		return PromptTypesSnapshot{}, err
	}
	return m.readPromptTypesLocked()
}

// readPromptTypesLocked 在持有文件锁时读取提示词类型配置快照。
func (m *ConfigManager) readPromptTypesLocked() (PromptTypesSnapshot, error) {
	info, err := os.Stat(m.configFile)
	if err != nil {
		return PromptTypesSnapshot{}, fmt.Errorf("读取配置文件状态失败: %w", err)
	}

	m.mu.RLock()
	reloadedAt := m.reloadedAt
	items := m.currentPromptTypesLocked()
	m.mu.RUnlock()

	return PromptTypesSnapshot{
		ConfigFile: m.configFile,
		Items:      items,
		ModifiedAt: info.ModTime(),
		ReloadedAt: reloadedAt,
	}, nil
}

// currentPromptTypesLocked 返回当前运行配置中的提示词类型副本。
func (m *ConfigManager) currentPromptTypesLocked() []string {
	if m.cfg == nil {
		return nil
	}
	items := make([]string, len(m.cfg.AI.PromptTypes))
	copy(items, m.cfg.AI.PromptTypes)
	return items
}

// patchPromptTypesContent 将配置文件 YAML 文本中的 ai.prompt_types 子树替换为提示词类型数组。
// 参数 content 表示原始配置文件内容；参数 items 表示新的提示词类型列表。
func patchPromptTypesContent(content []byte, items []string) (string, error) {
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

	node, err := promptTypesYAMLNode(items)
	if err != nil {
		return "", err
	}
	setMappingValue(aiMapping, "prompt_types", node)

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

// promptTypesYAMLNode 将提示词类型列表转换为 YAML 节点。
// 参数 items 表示提示词类型列表。
func promptTypesYAMLNode(items []string) (*yaml.Node, error) {
	data, err := yaml.Marshal(items)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}

	var root yaml.Node
	if err := yaml.Unmarshal(data, &root); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}
	if len(root.Content) == 0 {
		return &yaml.Node{Kind: yaml.SequenceNode, Tag: "!!seq"}, nil
	}
	return root.Content[0], nil
}

// validatePromptTypeList 校验提示词类型列表。
// 参数 items 表示提示词类型列表。
func validatePromptTypeList(items []string) error {
	_, err := normalizePromptTypeList(items)
	return err
}

// normalizePromptTypeList 标准化并校验提示词类型列表。
// 参数 items 表示提示词类型列表。
func normalizePromptTypeList(items []string) ([]string, error) {
	normalized := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		name := strings.TrimSpace(item)
		if name == "" {
			return nil, ErrPromptTypeNameRequired
		}
		if _, ok := seen[name]; ok {
			return nil, ErrPromptTypeConflict
		}
		seen[name] = struct{}{}
		normalized = append(normalized, name)
	}
	return normalized, nil
}

// promptTypeExists 判断提示词类型列表中是否包含指定名称。
// 参数 items 表示提示词类型列表；参数 name 表示需要查找的类型名称。
func promptTypeExists(items []string, name string) bool {
	return promptTypeIndex(items, name) >= 0
}

// promptTypeIndex 返回提示词类型在列表中的位置。
// 参数 items 表示提示词类型列表；参数 name 表示需要查找的类型名称。
func promptTypeIndex(items []string, name string) int {
	for index, item := range items {
		if item == name {
			return index
		}
	}
	return -1
}
