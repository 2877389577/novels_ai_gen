package novelagent

import (
	"errors"
	"strings"
	"testing"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// TestNewAgentRuntimeConfig 验证配置可以生成动态多子 Agent 运行时配置。
func TestNewAgentRuntimeConfig(t *testing.T) {
	cfg := testAgentConfig()
	req := ChatRequest{
		PromptParams: map[string]string{
			"userMsg": "让语气更紧张",
			"text":    "雨夜里，门外响起脚步声。",
		},
	}

	got, err := newAgentRuntimeConfig(cfg, req)
	if err != nil {
		t.Fatalf("newAgentRuntimeConfig failed: %v", err)
	}

	if got.supervisor.name != "novel_supervisor" {
		t.Fatalf("supervisor name = %q, want novel_supervisor", got.supervisor.name)
	}
	if got.supervisor.maxIterations != defaultSupervisorMaxIterations {
		t.Fatalf("supervisor maxIterations = %d, want %d", got.supervisor.maxIterations, defaultSupervisorMaxIterations)
	}
	if len(got.children) != 2 {
		t.Fatalf("children length = %d, want 2", len(got.children))
	}
	if got.children[0].task != "polish" {
		t.Fatalf("first child task = %q, want polish", got.children[0].task)
	}
	if got.children[0].maxIterations != defaultChildMaxIterations {
		t.Fatalf("first child maxIterations = %d, want %d", got.children[0].maxIterations, defaultChildMaxIterations)
	}
	if !strings.Contains(got.children[0].instruction, "让语气更紧张") || !strings.Contains(got.children[0].instruction, "雨夜里，门外响起脚步声。") {
		t.Fatalf("first child instruction was not rendered: %q", got.children[0].instruction)
	}
	if got.children[1].task != "outline_task" {
		t.Fatalf("second child task = %q, want outline_task", got.children[1].task)
	}
	if got.children[1].maxIterations != 3 {
		t.Fatalf("second child maxIterations = %d, want 3", got.children[1].maxIterations)
	}
}

// TestNewAgentRuntimeConfigErrors 验证无效 Agent 配置会返回可识别错误。
func TestNewAgentRuntimeConfigErrors(t *testing.T) {
	tests := []struct {
		name       string
		cfg        *appconfig.AppConfig
		mutate     func(cfg *appconfig.AppConfig)
		wantErr    error
		wantSubstr string
	}{
		{
			name:    "nil config",
			cfg:     nil,
			wantErr: ErrAgentNotConfigured,
		},
		{
			name: "legacy prompt is not configured",
			cfg:  &appconfig.AppConfig{},
			mutate: func(cfg *appconfig.AppConfig) {
				cfg.AI.Agent = appconfig.AgentConfig{}
			},
			wantErr: ErrAgentNotConfigured,
		},
		{
			name: "missing supervisor name",
			mutate: func(cfg *appconfig.AppConfig) {
				cfg.AI.Agent.Supervisor.Name = ""
			},
			wantErr: ErrAgentConfigInvalid,
		},
		{
			name: "duplicate child name",
			mutate: func(cfg *appconfig.AppConfig) {
				cfg.AI.Agent.Children = append(cfg.AI.Agent.Children, cfg.AI.Agent.Children[0])
			},
			wantErr: ErrAgentConfigInvalid,
		},
		{
			name: "child task direct",
			mutate: func(cfg *appconfig.AppConfig) {
				cfg.AI.Agent.Children[0].Task = taskDirect
			},
			wantErr: ErrAgentConfigInvalid,
		},
		{
			name: "child tools unsupported",
			mutate: func(cfg *appconfig.AppConfig) {
				cfg.AI.Agent.Children[0].Tools = []string{"search"}
			},
			wantErr:    ErrAgentToolsUnsupported,
			wantSubstr: "子 Agent tools 暂未支持",
		},
		{
			name: "missing prompt variable",
			mutate: func(cfg *appconfig.AppConfig) {
				cfg.AI.Agent.Children[0].Instruction = "缺失变量：{missing}"
			},
			wantErr: ErrPromptVariableMissing,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := tt.cfg
			if cfg == nil && tt.name != "nil config" {
				cfg = testAgentConfig()
			}
			if tt.mutate != nil && cfg != nil {
				tt.mutate(cfg)
			}

			_, err := newAgentRuntimeConfig(cfg, ChatRequest{
				PromptParams: map[string]string{
					"userMsg": "生成内容",
					"text":    "正文",
				},
			})
			requireErrorIs(t, err, tt.wantErr)
			if tt.wantSubstr != "" && !strings.Contains(err.Error(), tt.wantSubstr) {
				t.Fatalf("error = %q, want substring %q", err.Error(), tt.wantSubstr)
			}
		})
	}
}

// TestTaskForAgent 验证子 Agent 名称会映射为配置中的任务标识。
func TestTaskForAgent(t *testing.T) {
	taskByAgent := map[string]string{
		"polish":  "polish",
		"outline": "outline_task",
	}
	tests := []struct {
		name      string
		agentName string
		want      string
	}{
		{name: "known polish", agentName: "polish", want: "polish"},
		{name: "known outline", agentName: "outline", want: "outline_task"},
		{name: "unknown agent", agentName: "novel_supervisor", want: taskDirect},
		{name: "empty agent", agentName: "", want: taskDirect},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := taskForAgent(tt.agentName, taskByAgent); got != tt.want {
				t.Fatalf("taskForAgent(%q) = %q, want %q", tt.agentName, got, tt.want)
			}
		})
	}
}

// testAgentConfig 创建用于测试的小说写作 Agent 配置。
func testAgentConfig() *appconfig.AppConfig {
	return &appconfig.AppConfig{
		AI: appconfig.AIConfig{
			Agent: appconfig.AgentConfig{
				Supervisor: appconfig.AgentDefinition{
					Name:        "novel_supervisor",
					Description: "负责理解用户意图，并决定直接回答或调用小说写作子 Agent。",
					Instruction: "你是小说写作智能体的顶层 Agent。",
				},
				Children: []appconfig.AgentDefinition{
					{
						Name:        "polish",
						Description: "负责小说章节正文润色的机器人工具。",
						Instruction: "用户需求：{userMsg}\n小说内容：{text}",
					},
					{
						Name:          "outline",
						Task:          "outline_task",
						Description:   "负责生成小说大纲的机器人工具。",
						Instruction:   "根据用户需求生成大纲：{userMsg}",
						MaxIterations: 3,
					},
				},
			},
		},
	}
}

// requireErrorIs 断言错误链包含指定目标错误。
// 参数 t 表示测试对象；参数 err 表示实际错误；参数 target 表示期望匹配的目标错误。
func requireErrorIs(t *testing.T, err error, target error) {
	t.Helper()
	if !errors.Is(err, target) {
		t.Fatalf("error = %v, want errors.Is target %v", err, target)
	}
}
