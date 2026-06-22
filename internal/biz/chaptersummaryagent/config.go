package chaptersummaryagent

import (
	"fmt"
	"strings"
	"time"

	bizchapter "novels_ai_gen/internal/biz/chapter"
	biznovelagent "novels_ai_gen/internal/biz/novelagent"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// runtimeChapterSummaryAgentConfig 表示章节概要 Agent 单次运行使用的配置。
type runtimeChapterSummaryAgentConfig struct {
	// enabled 表示章节概要 Agent 是否启用。
	enabled bool
	// name 表示章节概要 Agent 名称。
	name string
	// providerID 表示章节概要 Agent 使用的 AI 提供商 ID。
	providerID uint64
	// model 表示章节概要 Agent 使用的模型标识。
	model string
	// reasoningEffort 表示 GPT 类模型使用的推理强度。
	reasoningEffort string
	// description 表示章节概要 Agent 能力描述。
	description string
	// instruction 表示章节概要 Agent 系统提示词。
	instruction string
	// maxIterations 表示章节概要 Agent 最大生成循环次数配置。
	maxIterations int
	// retry 表示上游模型失败时的重试配置。
	retry biznovelagent.RuntimeRetryConfig
}

// ValidateChapterSummaryAgentConfig 校验结构化章节概要 Agent 配置是否可用于运行时。
// 参数 cfg 表示需要校验的章节概要 Agent 配置。
func ValidateChapterSummaryAgentConfig(cfg appconfig.ChapterSummaryAgentConfig) error {
	_, err := newRuntimeChapterSummaryAgentConfig(cfg)
	return err
}

// newRuntimeChapterSummaryAgentConfig 根据结构化配置生成运行时章节概要 Agent 配置。
// 参数 cfg 表示当前应用配置中的章节概要 Agent 配置。
func newRuntimeChapterSummaryAgentConfig(cfg appconfig.ChapterSummaryAgentConfig) (runtimeChapterSummaryAgentConfig, error) {
	def := cfg.Agent
	enabled := def.Enabled == nil || *def.Enabled
	if !enabled && isEmptyChapterSummaryAgentDefinition(def) {
		return runtimeChapterSummaryAgentConfig{enabled: false, retry: chapterSummaryRetryConfig(cfg.Retry)}, nil
	}

	name := strings.TrimSpace(def.Name)
	description := strings.TrimSpace(def.Description)
	instruction := strings.TrimSpace(def.Instruction)
	model := strings.TrimSpace(def.Model)
	reasoningEffort := strings.ToLower(strings.TrimSpace(def.ReasoningEffort))

	if name == "" {
		return runtimeChapterSummaryAgentConfig{}, fmt.Errorf("%w: 章节概要 Agent name 不能为空", ErrChapterSummaryAgentConfigInvalid)
	}
	if enabled && def.ProviderID == 0 {
		return runtimeChapterSummaryAgentConfig{}, fmt.Errorf("%w: 章节概要 Agent provider_id 不能为空", ErrChapterSummaryAgentConfigInvalid)
	}
	if enabled && model == "" {
		return runtimeChapterSummaryAgentConfig{}, fmt.Errorf("%w: 章节概要 Agent model 不能为空", ErrChapterSummaryAgentConfigInvalid)
	}
	if reasoningEffort != "" && reasoningEffort != "low" && reasoningEffort != "medium" && reasoningEffort != "high" {
		return runtimeChapterSummaryAgentConfig{}, fmt.Errorf("%w: 章节概要 Agent reasoning_effort 仅支持 low、medium、high", ErrChapterSummaryAgentConfigInvalid)
	}
	if description == "" {
		return runtimeChapterSummaryAgentConfig{}, fmt.Errorf("%w: 章节概要 Agent description 不能为空", ErrChapterSummaryAgentConfigInvalid)
	}
	if instruction == "" {
		return runtimeChapterSummaryAgentConfig{}, fmt.Errorf("%w: 章节概要 Agent instruction 不能为空", ErrChapterSummaryAgentConfigInvalid)
	}
	if def.MaxIterations < 0 {
		return runtimeChapterSummaryAgentConfig{}, fmt.Errorf("%w: 章节概要 Agent max_iterations 不能小于 0", ErrChapterSummaryAgentConfigInvalid)
	}

	return runtimeChapterSummaryAgentConfig{
		enabled:         enabled,
		name:            name,
		providerID:      def.ProviderID,
		model:           model,
		reasoningEffort: reasoningEffort,
		description:     description,
		instruction:     def.Instruction,
		maxIterations:   def.MaxIterations,
		retry:           chapterSummaryRetryConfig(cfg.Retry),
	}, nil
}

// chapterSummaryRetryConfig 标准化章节概要 Agent 模型失败重试配置。
// 参数 cfg 表示配置文件中的重试配置。
func chapterSummaryRetryConfig(cfg appconfig.AgentRetryConfig) biznovelagent.RuntimeRetryConfig {
	maxRetries := cfg.MaxRetries
	if maxRetries < 0 {
		maxRetries = 0
	}
	backoff := defaultChapterSummaryBackoff
	if cfg.BackoffMS > 0 {
		backoff = timeMillisecondDuration(cfg.BackoffMS)
	}
	return biznovelagent.RuntimeRetryConfig{
		MaxRetries: maxRetries,
		Backoff:    backoff,
	}
}

// timeMillisecondDuration 将毫秒整数转换为 time.Duration。
// 参数 value 表示毫秒数。
func timeMillisecondDuration(value int) time.Duration {
	return time.Duration(value) * time.Millisecond
}

// validateChapterSummaryTask 校验章节概要生成任务。
// 参数 task 表示需要生成概要的章节快照。
func validateChapterSummaryTask(task bizchapter.ChapterSummaryGenerationTask) error {
	if task.NovelID == 0 {
		return fmt.Errorf("%w: novel_id 不能为空", ErrChapterSummaryTaskInvalid)
	}
	if task.ChapterID == 0 {
		return fmt.Errorf("%w: chapter_id 不能为空", ErrChapterSummaryTaskInvalid)
	}
	return nil
}

// isEmptyChapterSummaryAgentDefinition 判断章节概要 Agent 定义是否完全为空。
// 参数 def 表示需要判断的 Agent 定义。
func isEmptyChapterSummaryAgentDefinition(def appconfig.AgentDefinition) bool {
	return strings.TrimSpace(def.Name) == "" &&
		strings.TrimSpace(def.Task) == "" &&
		strings.TrimSpace(def.Description) == "" &&
		strings.TrimSpace(def.Instruction) == "" &&
		strings.TrimSpace(def.Model) == "" &&
		strings.TrimSpace(def.ReasoningEffort) == "" &&
		def.ProviderID == 0 &&
		def.MaxIterations == 0 &&
		def.Enabled == nil &&
		def.ShareChatHistory == nil &&
		len(def.Tools) == 0 &&
		len(def.Parameters) == 0
}
