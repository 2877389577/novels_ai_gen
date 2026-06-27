package novelagent

import (
	"fmt"
	"testing"

	"github.com/cloudwego/eino/schema"
)

// TestEncodeFunctionCallMemoryContent 验证工具调用以安全纯文本格式写入记忆。
// 参数 t 表示当前测试上下文。
func TestEncodeFunctionCallMemoryContent(t *testing.T) {
	tests := []struct {
		name   string
		calls  []agentFunctionToolCall
		want   string
		wantOK bool
	}{
		{
			name: "single tool call",
			calls: []agentFunctionToolCall{
				{Name: " list_characters "},
			},
			want:   "Tool Call:list_characters",
			wantOK: true,
		},
		{
			name: "multiple tool calls",
			calls: []agentFunctionToolCall{
				{Name: "list_characters"},
				{Name: "save_character"},
			},
			want:   "Tool Call:list_characters\nTool Call:save_character",
			wantOK: true,
		},
		{
			name: "blank tool name",
			calls: []agentFunctionToolCall{
				{Name: "  "},
			},
			want:   "",
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := encodeFunctionCallMemoryContent(tt.calls)
			if ok != tt.wantOK {
				t.Fatalf("encodeFunctionCallMemoryContent() ok = %v, want %v", ok, tt.wantOK)
			}
			if got != tt.want {
				t.Fatalf("encodeFunctionCallMemoryContent() = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestEncodeFunctionResultMemoryContent 验证工具结果写入完整输出和原始 Token 估算。
// 参数 t 表示当前测试上下文。
func TestEncodeFunctionResultMemoryContent(t *testing.T) {
	output := `{"ok":true,"items":[1,2]}`
	secondOutput := "second result"
	tests := []struct {
		name    string
		results []agentFunctionToolResult
		want    string
		wantOK  bool
	}{
		{
			name: "single tool result",
			results: []agentFunctionToolResult{
				{ID: " call-1 ", Content: output},
			},
			want: fmt.Sprintf(
				"Tool ID:call-1, Original token count:%d, Output:%s",
				estimateTextTokens(output),
				output,
			),
			wantOK: true,
		},
		{
			name: "multiple tool results",
			results: []agentFunctionToolResult{
				{ID: "call-1", Content: output},
				{ID: "call-2", Content: secondOutput},
			},
			want: fmt.Sprintf(
				"Tool ID:call-1, Original token count:%d, Output:%s\nTool ID:call-2, Original token count:%d, Output:%s",
				estimateTextTokens(output),
				output,
				estimateTextTokens(secondOutput),
				secondOutput,
			),
			wantOK: true,
		},
		{
			name: "blank tool result",
			results: []agentFunctionToolResult{
				{ID: "  ", Content: "  "},
			},
			want:   "",
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := encodeFunctionResultMemoryContent(tt.results)
			if ok != tt.wantOK {
				t.Fatalf("encodeFunctionResultMemoryContent() ok = %v, want %v", ok, tt.wantOK)
			}
			if got != tt.want {
				t.Fatalf("encodeFunctionResultMemoryContent() = %q, want %q", got, tt.want)
			}
		})
	}
}

// TestRunMessagesLoadToolMemoryAsAssistantText 验证工具记忆加载时只作为普通助手文本。
// 参数 t 表示当前测试上下文。
func TestRunMessagesLoadToolMemoryAsAssistantText(t *testing.T) {
	memory := AgentMemoryInput{
		Messages: []MessageRecord{
			{Role: MessageRoleUser, Content: "用户消息"},
			{Role: MessageRoleFunctionCall, Content: "Tool Call:list_characters"},
			{Role: MessageRoleFunctionResult, Content: "Tool ID:call-1, Original token count:2, Output:ok"},
		},
	}
	req := ChatRequest{Message: "继续"}

	chatMessages := chatRunMessages(req, memory)
	if len(chatMessages) != 4 {
		t.Fatalf("chatRunMessages() len = %d, want 4", len(chatMessages))
	}
	for _, index := range []int{1, 2} {
		msg := chatMessages[index]
		if msg.Role != schema.Assistant {
			t.Fatalf("chatRunMessages()[%d].Role = %q, want assistant", index, msg.Role)
		}
		if len(msg.ToolCalls) != 0 {
			t.Fatalf("chatRunMessages()[%d].ToolCalls len = %d, want 0", index, len(msg.ToolCalls))
		}
	}
	if chatMessages[1].Content != "Tool Call:list_characters" {
		t.Fatalf("chatRunMessages()[1].Content = %q", chatMessages[1].Content)
	}
	if chatMessages[2].Content != "Tool ID:call-1, Original token count:2, Output:ok" {
		t.Fatalf("chatRunMessages()[2].Content = %q", chatMessages[2].Content)
	}

	agenticMessages := agenticRunMessages(req, memory)
	if len(agenticMessages) != 4 {
		t.Fatalf("agenticRunMessages() len = %d, want 4", len(agenticMessages))
	}
	for _, index := range []int{1, 2} {
		msg := agenticMessages[index]
		if msg.Role != schema.AgenticRoleTypeAssistant {
			t.Fatalf("agenticRunMessages()[%d].Role = %q, want assistant", index, msg.Role)
		}
		if len(msg.ContentBlocks) != 1 {
			t.Fatalf("agenticRunMessages()[%d].ContentBlocks len = %d, want 1", index, len(msg.ContentBlocks))
		}
		block := msg.ContentBlocks[0]
		if block.AssistantGenText == nil {
			t.Fatalf("agenticRunMessages()[%d] missing assistant text block", index)
		}
		if block.FunctionToolCall != nil || block.FunctionToolResult != nil {
			t.Fatalf("agenticRunMessages()[%d] restored a structured tool block", index)
		}
	}
}
