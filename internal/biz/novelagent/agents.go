package novelagent

import (
	"strings"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

const (
	agentNameSupervisor = "novel_supervisor"
	agentNamePolish     = "polish"
	taskDirect          = "direct"
	taskPolish          = "polish"
	taskRouter          = "router"
)

// supervisorInstruction 读取顶层 Agent 的系统指令。
// 参数 cfg 表示当前应用配置快照。
func supervisorInstruction(cfg *appconfig.AppConfig) (string, error) {
	return promptTemplate(cfg, taskRouter)
}

// polishInstruction 渲染润色子 Agent 的系统指令。
// 参数 cfg 表示当前应用配置快照；参数 req 表示流式对话请求。
func polishInstruction(cfg *appconfig.AppConfig, req ChatRequest) (string, error) {
	template, err := promptTemplate(cfg, taskPolish)
	if err != nil {
		return "", err
	}
	return renderPrompt(template, promptParams(req))
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
