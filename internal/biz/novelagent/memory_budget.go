package novelagent

import (
	"context"
	"encoding/json"
	"unicode/utf8"

	"github.com/cloudwego/eino/adk/middlewares/summarization"
	"github.com/cloudwego/eino/schema"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

const (
	defaultMemoryRecentRounds  = 10
	defaultMemoryContextTokens = 32000
	rawHistoryTokenPercent     = 60
	messageTokenOverhead       = 4
)

// memoryRecentRounds 返回兼容旧配置使用的最近对话轮数。
// 参数 cfg 表示当前配置快照。
func memoryRecentRounds(cfg *appconfig.AppConfig) int {
	if cfg == nil || cfg.AI.Agent.Memory.RecentRounds <= 0 {
		return defaultMemoryRecentRounds
	}
	return cfg.AI.Agent.Memory.RecentRounds
}

// memoryContextTokens 返回触发运行时上下文压缩的 Token 阈值。
// 参数 cfg 表示当前配置快照。
func memoryContextTokens(cfg *appconfig.AppConfig) int {
	if cfg == nil {
		return defaultMemoryContextTokens
	}
	return memoryContextTokensFromConfig(cfg.AI.Agent.Memory)
}

// memoryRawHistoryTokens 返回长期摘要之外保留原文历史的 Token 预算。
// 参数 cfg 表示当前配置快照。
func memoryRawHistoryTokens(cfg *appconfig.AppConfig) int {
	if cfg == nil {
		return defaultMemoryContextTokens * rawHistoryTokenPercent / 100
	}
	return memoryRawHistoryTokensFromConfig(cfg.AI.Agent.Memory)
}

// memoryContextTokensFromConfig 返回单个记忆配置生效后的上下文 Token 阈值。
// 参数 memory 表示小说写作 Agent 记忆配置。
func memoryContextTokensFromConfig(memory appconfig.AgentMemoryConfig) int {
	if memory.ContextTokens <= 0 {
		return defaultMemoryContextTokens
	}
	return memory.ContextTokens
}

// memoryRawHistoryTokensFromConfig 返回单个记忆配置生效后的原文历史 Token 预算。
// 参数 memory 表示小说写作 Agent 记忆配置。
func memoryRawHistoryTokensFromConfig(memory appconfig.AgentMemoryConfig) int {
	if memory.RawHistoryTokens > 0 {
		return memory.RawHistoryTokens
	}
	return memoryContextTokensFromConfig(memory) * rawHistoryTokenPercent / 100
}

// tokenCounterForMessages 估算 schema.Message 路径当前上下文使用的 Token 数。
// 参数 ctx 表示请求上下文；参数 input 表示 Eino Summarization 传入的消息和工具定义。
func tokenCounterForMessages(ctx context.Context, input *summarization.TokenCounterInput) (int, error) {
	_ = ctx
	if input == nil {
		return 0, nil
	}
	total := 0
	for _, message := range input.Messages {
		total += estimateSchemaMessageTokens(message)
	}
	for _, toolInfo := range input.Tools {
		total += estimateToolInfoTokens(toolInfo)
	}
	return total, nil
}

// selectRecentMessagesByTokenBudget 按最近完整用户轮次块选择可注入模型的原文历史。
// 参数 messages 表示按时间正序排列的候选消息；参数 tokenBudget 表示允许保留的 Token 预算。
func selectRecentMessagesByTokenBudget(messages []MessageRecord, tokenBudget int) []MessageRecord {
	_, kept := splitMessagesByTokenBudget(messages, tokenBudget)
	return kept
}

// splitMessagesByTokenBudget 将消息拆分为应滚入摘要的旧消息和保留原文的最近消息。
// 参数 messages 表示按时间正序排列的候选消息；参数 tokenBudget 表示最近原文历史 Token 预算。
func splitMessagesByTokenBudget(messages []MessageRecord, tokenBudget int) ([]MessageRecord, []MessageRecord) {
	if len(messages) == 0 || tokenBudget <= 0 {
		return []MessageRecord{}, []MessageRecord{}
	}
	blocks := messageTurnBlocks(messages)
	if len(blocks) == 0 {
		return []MessageRecord{}, []MessageRecord{}
	}

	total := 0
	keepStart := len(messages)
	for index := len(blocks) - 1; index >= 0; index-- {
		block := blocks[index]
		nextTotal := total + block.tokens
		if total > 0 && nextTotal > tokenBudget {
			break
		}
		total = nextTotal
		keepStart = block.start
	}
	if keepStart < 0 || keepStart > len(messages) {
		keepStart = len(messages)
	}

	return copyMessageRecords(messages[:keepStart]), copyMessageRecords(messages[keepStart:])
}

// messageTurnBlock 表示一个不可拆分的用户轮次消息块。
type messageTurnBlock struct {
	// start 表示块在消息切片中的起始下标。
	start int
	// end 表示块在消息切片中的结束下标，不包含该下标。
	end int
	// tokens 表示块内消息的估算 Token 数。
	tokens int
}

// messageTurnBlocks 将消息按用户消息边界切分为轮次块。
// 参数 messages 表示按时间正序排列的消息。
func messageTurnBlocks(messages []MessageRecord) []messageTurnBlock {
	blocks := make([]messageTurnBlock, 0)
	start := 0
	for index, message := range messages {
		if index > start && message.Role == MessageRoleUser {
			blocks = append(blocks, newMessageTurnBlock(messages, start, index))
			start = index
		}
	}
	if start < len(messages) {
		blocks = append(blocks, newMessageTurnBlock(messages, start, len(messages)))
	}
	return blocks
}

// newMessageTurnBlock 创建一个轮次块并计算其 Token 数。
// 参数 messages 表示完整消息列表；参数 start 表示块起始下标；参数 end 表示块结束下标。
func newMessageTurnBlock(messages []MessageRecord, start int, end int) messageTurnBlock {
	total := 0
	for _, message := range messages[start:end] {
		total += estimateMessageRecordTokens(message)
	}
	return messageTurnBlock{
		start:  start,
		end:    end,
		tokens: total,
	}
}

// estimateMessageRecordTokens 估算一条持久记忆消息的 Token 数。
// 参数 message 表示数据库中的 Agent 记忆消息。
func estimateMessageRecordTokens(message MessageRecord) int {
	return messageTokenOverhead + estimateTextTokens(string(message.Role)) + estimateTextTokens(message.Task) + estimateTextTokens(message.Content)
}

// estimateSchemaMessageTokens 估算 schema.Message 的 Token 数。
// 参数 message 表示 Eino ChatModel 消息。
func estimateSchemaMessageTokens(message *schema.Message) int {
	if message == nil {
		return 0
	}
	total := messageTokenOverhead + estimateTextTokens(string(message.Role)) + estimateTextTokens(message.Content)
	for _, toolCall := range message.ToolCalls {
		total += estimateJSONTokens(toolCall)
	}
	total += estimateTextTokens(message.ToolCallID)
	total += estimateTextTokens(message.Name)
	return total
}

// estimateToolInfoTokens 估算工具定义传给模型时消耗的 Token 数。
// 参数 toolInfo 表示 Eino 工具定义。
func estimateToolInfoTokens(toolInfo *schema.ToolInfo) int {
	if toolInfo == nil {
		return 0
	}
	return estimateJSONTokens(toolInfo)
}

// estimateJSONTokens 将结构化内容编码为 JSON 后估算 Token 数。
// 参数 value 表示需要估算的结构化值。
func estimateJSONTokens(value any) int {
	if value == nil {
		return 0
	}
	data, err := json.Marshal(value)
	if err != nil {
		return messageTokenOverhead
	}
	return estimateTextTokens(string(data))
}

// estimateTextTokens 按字符粗略估算文本 Token 数。
// 参数 text 表示需要估算的文本。
func estimateTextTokens(text string) int {
	if text == "" {
		return 0
	}
	runes := utf8.RuneCountInString(text)
	tokens := (runes + 3) / 4
	if tokens < 1 {
		return 1
	}
	return tokens
}

// copyMessageRecords 复制消息切片，避免调用方意外修改共享底层数组。
// 参数 messages 表示需要复制的消息列表。
func copyMessageRecords(messages []MessageRecord) []MessageRecord {
	if len(messages) == 0 {
		return []MessageRecord{}
	}
	result := make([]MessageRecord, len(messages))
	copy(result, messages)
	return result
}
