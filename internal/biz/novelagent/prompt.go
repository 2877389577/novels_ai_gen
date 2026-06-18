package novelagent

import (
	"fmt"
	"regexp"
	"strings"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

var promptVariablePattern = regexp.MustCompile(`\{([a-zA-Z][a-zA-Z0-9_]*)\}`)

// promptTemplate 读取指定任务的提示词模板。
// 参数 cfg 表示当前应用配置快照；参数 task 表示任务名称。
func promptTemplate(cfg *appconfig.AppConfig, task string) (string, error) {
	if cfg == nil || cfg.AI.Prompt == nil {
		return "", ErrPromptNotConfigured
	}

	template, ok := cfg.AI.Prompt[task]
	if !ok || strings.TrimSpace(template.Prompt) == "" {
		return "", ErrPromptNotConfigured
	}
	return template.Prompt, nil
}

// renderPrompt 渲染提示词模板中的 {变量名} 占位符。
// 参数 template 表示提示词模板；参数 values 表示占位符变量值。
func renderPrompt(template string, values map[string]string) (string, error) {
	missing := make(map[string]struct{})
	result := promptVariablePattern.ReplaceAllStringFunc(template, func(match string) string {
		parts := promptVariablePattern.FindStringSubmatch(match)
		if len(parts) != 2 {
			return match
		}

		value, ok := values[parts[1]]
		if !ok {
			missing[parts[1]] = struct{}{}
			return match
		}
		return value
	})

	if len(missing) > 0 {
		names := make([]string, 0, len(missing))
		for name := range missing {
			names = append(names, name)
		}
		return "", fmt.Errorf("%w: %s", ErrPromptVariableMissing, strings.Join(names, ", "))
	}
	return result, nil
}
