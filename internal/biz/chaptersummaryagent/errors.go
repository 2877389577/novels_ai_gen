package chaptersummaryagent

import "errors"

var (
	// ErrChapterSummaryAgentNotConfigured 表示章节概要 Agent 配置未提供。
	ErrChapterSummaryAgentNotConfigured = errors.New("chapter summary agent not configured")
	// ErrChapterSummaryAgentConfigInvalid 表示章节概要 Agent 配置内容不合法。
	ErrChapterSummaryAgentConfigInvalid = errors.New("chapter summary agent config invalid")
	// ErrChapterSummaryTaskInvalid 表示章节概要生成任务不合法。
	ErrChapterSummaryTaskInvalid = errors.New("chapter summary task invalid")
)
