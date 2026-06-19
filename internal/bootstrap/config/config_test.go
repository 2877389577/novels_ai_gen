package config

import "testing"

// TestParseConfigContentAIProviderSecretKey 验证配置文本可以解析 AI 提供商加密密钥。
func TestParseConfigContentAIProviderSecretKey(t *testing.T) {
	secretKey := "plain-provider-secret"
	cfg, err := parseConfigContent("ai:\n  provider_secret_key: \"" + secretKey + "\"\n")
	if err != nil {
		t.Fatalf("parseConfigContent failed: %v", err)
	}

	if cfg.AI.ProviderSecretKey != secretKey {
		t.Fatalf("provider secret key = %q, want %q", cfg.AI.ProviderSecretKey, secretKey)
	}
}

// TestAIProviderSecretKeyEnvOverride 验证环境变量可以覆盖 YAML 中的 AI 提供商加密密钥。
func TestAIProviderSecretKeyEnvOverride(t *testing.T) {
	fileKey := "file-provider-secret"
	envKey := "env-provider-secret"
	t.Setenv("AI_PROVIDER_SECRET_KEY", envKey)

	cfg, err := parseConfigContent("ai:\n  provider_secret_key: \"" + fileKey + "\"\n")
	if err != nil {
		t.Fatalf("parseConfigContent failed: %v", err)
	}

	if cfg.AI.ProviderSecretKey != envKey {
		t.Fatalf("provider secret key = %q, want env override %q", cfg.AI.ProviderSecretKey, envKey)
	}
}

// TestParseConfigContentAIAgent 验证配置文本可以解析小说写作多层 Agent 配置。
func TestParseConfigContentAIAgent(t *testing.T) {
	cfg, err := parseConfigContent(`ai:
  agent:
    supervisor:
      name: novel_supervisor
      description: 负责理解用户意图，并决定直接回答或调用小说写作子 Agent。
      instruction: |
        你是小说写作智能体的顶层 Agent，负责理解用户意图并给出写作帮助。
      max_iterations: 8
    children:
      - name: polish
        task: polish
        description: 负责小说章节正文润色的机器人工具。
        instruction: |
          根据用户的需求，润色这段小说：
          用户需求：{userMsg}
          小说内容：{text}
        max_iterations: 6
        tools: []
      - name: outline
        description: 负责生成小说大纲的机器人工具。
        instruction: |
          根据用户需求生成大纲：{userMsg}
`)
	if err != nil {
		t.Fatalf("parseConfigContent failed: %v", err)
	}

	if cfg.AI.Agent.Supervisor.Name != "novel_supervisor" {
		t.Fatalf("supervisor name = %q, want novel_supervisor", cfg.AI.Agent.Supervisor.Name)
	}
	if cfg.AI.Agent.Supervisor.MaxIterations != 8 {
		t.Fatalf("supervisor max_iterations = %d, want 8", cfg.AI.Agent.Supervisor.MaxIterations)
	}
	if len(cfg.AI.Agent.Children) != 2 {
		t.Fatalf("children length = %d, want 2", len(cfg.AI.Agent.Children))
	}
	if cfg.AI.Agent.Children[0].Name != "polish" || cfg.AI.Agent.Children[0].Task != "polish" {
		t.Fatalf("first child = %+v, want polish task", cfg.AI.Agent.Children[0])
	}
	if cfg.AI.Agent.Children[1].Name != "outline" {
		t.Fatalf("second child name = %q, want outline", cfg.AI.Agent.Children[1].Name)
	}
}

// TestParseConfigContentLegacyAIPromptIgnored 验证旧版 ai.prompt 不再映射为有效 Agent 配置。
func TestParseConfigContentLegacyAIPromptIgnored(t *testing.T) {
	cfg, err := parseConfigContent(`ai:
  prompt:
    router:
      prompt: |
        你是小说写作智能体的顶层 Agent。
    polish:
      prompt: |
        根据用户的需求，润色这段小说：{text}
`)
	if err != nil {
		t.Fatalf("parseConfigContent failed: %v", err)
	}

	if cfg.AI.Agent.Supervisor.Name != "" {
		t.Fatalf("legacy prompt should not fill supervisor, got %+v", cfg.AI.Agent.Supervisor)
	}
	if len(cfg.AI.Agent.Children) != 0 {
		t.Fatalf("legacy prompt should not fill children, got %d", len(cfg.AI.Agent.Children))
	}
}
