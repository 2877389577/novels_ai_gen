package chaptersummaryagent

import (
	"fmt"
	"strings"

	bizchapter "novels_ai_gen/internal/biz/chapter"
)

// chapterSummaryUserPrompt 根据章节快照构造章节概要 Agent 的用户提示词。
// 参数 task 表示需要生成概要的章节快照。
func chapterSummaryUserPrompt(task bizchapter.ChapterSummaryGenerationTask) string {
	var builder strings.Builder
	builder.WriteString("请为以下小说章节生成概要。\n\n")
	builder.WriteString(fmt.Sprintf("小说 ID：%d\n", task.NovelID))
	builder.WriteString(fmt.Sprintf("章节 ID：%d\n", task.ChapterID))
	if task.ChapterNumber > 0 {
		builder.WriteString(fmt.Sprintf("章节号：第 %d 章\n", task.ChapterNumber))
	}
	builder.WriteString("章节标题：")
	builder.WriteString(task.Title)
	builder.WriteString("\n\n章节正文：\n")
	builder.WriteString(task.Content)
	return builder.String()
}

// normalizeChapterSummaryOutput 规范化模型输出中的换行符，不折叠空格或裁剪正文。
// 参数 value 表示模型返回的章节概要原文。
func normalizeChapterSummaryOutput(value string) string {
	value = strings.ReplaceAll(value, "\r\n", "\n")
	value = strings.ReplaceAll(value, "\r", "\n")
	return value
}
