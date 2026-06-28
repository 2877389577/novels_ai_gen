package novelagent

import (
	"context"
	"testing"

	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"
)

// TestAgentMemoryEventsForSaveKeepsToolEvents 验证保存层保留助手和内部工具记忆事件。
// 参数 t 表示当前测试上下文。
func TestAgentMemoryEventsForSaveKeepsToolEvents(t *testing.T) {
	result := AgentResult{
		Task:       "direct",
		AgentName:  "supervisor",
		ProviderID: 7,
		Model:      "test-model",
		MemoryEvents: []AgentMemoryEvent{
			{Role: MessageRoleAssistant, Content: "助手回复"},
			{Role: MessageRoleFunctionCall, Content: "Tool Call:list_characters"},
			{Role: MessageRoleFunctionResult, Content: "Tool ID:call-1, Original token count:2, Output:ok"},
			{Role: MessageRoleFunctionCall, Content: "   "},
			{Role: MessageRoleUser, Content: "不应保存"},
		},
	}

	got := agentMemoryEventsForSave(result)
	if len(got) != 3 {
		t.Fatalf("agentMemoryEventsForSave() len = %d, want 3", len(got))
	}
	wantRoles := []MessageRole{
		MessageRoleAssistant,
		MessageRoleFunctionCall,
		MessageRoleFunctionResult,
	}
	for index, wantRole := range wantRoles {
		if got[index].Role != wantRole {
			t.Fatalf("agentMemoryEventsForSave()[%d].Role = %q, want %q", index, got[index].Role, wantRole)
		}
		if got[index].Task != result.Task {
			t.Fatalf("agentMemoryEventsForSave()[%d].Task = %q, want %q", index, got[index].Task, result.Task)
		}
		if got[index].AgentName != result.AgentName {
			t.Fatalf("agentMemoryEventsForSave()[%d].AgentName = %q, want %q", index, got[index].AgentName, result.AgentName)
		}
		if got[index].ProviderID != result.ProviderID {
			t.Fatalf("agentMemoryEventsForSave()[%d].ProviderID = %d, want %d", index, got[index].ProviderID, result.ProviderID)
		}
		if got[index].Model != result.Model {
			t.Fatalf("agentMemoryEventsForSave()[%d].Model = %q, want %q", index, got[index].Model, result.Model)
		}
	}
}

// TestMessageResponsesFiltersToolMemory 验证前端历史响应仍过滤内部工具记忆。
// 参数 t 表示当前测试上下文。
func TestMessageResponsesFiltersToolMemory(t *testing.T) {
	messages := []MessageRecord{
		{ID: 1, Role: MessageRoleUser, Content: "用户消息"},
		{ID: 2, Role: MessageRoleFunctionCall, Content: "Tool Call:list_characters"},
		{ID: 3, Role: MessageRoleFunctionResult, Content: "Tool ID:call-1, Original token count:2, Output:ok"},
		{ID: 4, Role: MessageRoleAssistant, Content: "助手回复"},
	}

	got := messageResponses(messages)
	if len(got) != 2 {
		t.Fatalf("messageResponses() len = %d, want 2", len(got))
	}
	if got[0].Role != MessageRoleUser || got[0].Content != "用户消息" {
		t.Fatalf("messageResponses()[0] = role %q content %q", got[0].Role, got[0].Content)
	}
	if got[1].Role != MessageRoleAssistant || got[1].Content != "助手回复" {
		t.Fatalf("messageResponses()[1] = role %q content %q", got[1].Role, got[1].Content)
	}
}

// TestAgentModelOverrideConfigCarriesHTTPProxy 验证提供商代理会传入模型运行时配置。
// 参数 t 表示当前测试上下文。
func TestAgentModelOverrideConfigCarriesHTTPProxy(t *testing.T) {
	service := &Service{
		repo: testNovelAgentProviderRepository{
			provider: &bizaiprovider.Provider{
				ID:           7,
				ProviderType: "openai",
				APIType:      apiTypeCompletions,
				BaseURL:      "https://api.openai.com/v1",
				HTTPProxy:    "http://127.0.0.1:7890",
				Enabled:      true,
			},
		},
		cipher: testNovelAgentCipher{plaintext: "sk-test"},
	}

	got, err := service.agentModelOverrideConfig(
		context.Background(),
		"顶层 Agent",
		7,
		"gpt-5",
		" high ",
		" test-agent ",
	)
	if err != nil {
		t.Fatalf("agentModelOverrideConfig() error = %v", err)
	}
	if got.HTTPProxy != "http://127.0.0.1:7890" {
		t.Fatalf("HTTPProxy = %q, want %q", got.HTTPProxy, "http://127.0.0.1:7890")
	}
	if got.UserAgent != "test-agent" {
		t.Fatalf("UserAgent = %q, want %q", got.UserAgent, "test-agent")
	}
}

// testNovelAgentProviderRepository 表示 Agent 服务测试使用的 AI 提供商仓储。
type testNovelAgentProviderRepository struct {
	// provider 表示测试返回的 AI 提供商。
	provider *bizaiprovider.Provider
}

// GetByID 根据 ID 查询测试 AI 提供商。
// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
func (r testNovelAgentProviderRepository) GetByID(ctx context.Context, id uint64) (*bizaiprovider.Provider, error) {
	_ = ctx
	if r.provider == nil || r.provider.ID != id {
		return nil, bizaiprovider.ErrNotFound
	}
	return r.provider, nil
}

// testNovelAgentCipher 表示 Agent 服务测试使用的密钥解密器。
type testNovelAgentCipher struct {
	// plaintext 表示解密后返回的 API Key 明文。
	plaintext string
}

// Decrypt 返回测试 API Key 明文。
// 参数 value 表示保存于数据库中的 API Key 密文。
func (c testNovelAgentCipher) Decrypt(value string) (string, error) {
	_ = value
	return c.plaintext, nil
}
