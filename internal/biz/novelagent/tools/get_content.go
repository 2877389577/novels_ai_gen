package tools

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"

	bizchapter "novels_ai_gen/internal/biz/chapter"
)

const (
	// ToolNameGetContent 表示读取当前请求关联章节正文的 Agent 工具名称。
	ToolNameGetContent = "get_content"
)

var (
	// ErrChapterContextRequired 表示调用 get_content 时缺少章节上下文。
	ErrChapterContextRequired = errors.New("get_content chapter context required")
)

// ChapterReader 表示 get_content 工具读取章节正文所需的数据依赖。
type ChapterReader interface {
	// GetByID 根据小说 ID 和章节 ID 查询章节。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 chapterID 表示章节主键 ID。
	GetByID(ctx context.Context, novelID uint64, chapterID uint64) (*bizchapter.Chapter, error)
}

// GetContentInput 表示 get_content 工具的输入参数。
type GetContentInput struct{}

// GetContentOutput 表示 get_content 工具返回给 Agent 的章节正文数据。
type GetContentOutput struct {
	// ChapterNumber 表示章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number"`
	// Title 表示章节名。
	Title string `json:"title"`
	// Content 表示章节正文。
	Content string `json:"content"`
	// WordCount 表示章节正文的非空白字符数量。
	WordCount int `json:"word_count"`
	// UpdatedAt 表示章节最近更新时间。
	UpdatedAt time.Time `json:"updated_at"`
}

// NewGetContentTool 创建读取当前请求关联章节正文的 Eino 普通工具。
// 参数 reader 表示章节读取依赖；参数 novelID 表示当前请求关联的小说 ID；参数 chapterID 表示当前请求关联的章节 ID。
func NewGetContentTool(reader ChapterReader, novelID uint64, chapterID uint64) (tool.InvokableTool, error) {
	return utils.InferTool[GetContentInput, GetContentOutput](
		ToolNameGetContent,
		"读取当前请求关联章节的标题、正文、字数和更新时间。当需要章节全文时调用。",
		func(ctx context.Context, input GetContentInput) (GetContentOutput, error) {
			return getContent(ctx, reader, novelID, chapterID)
		},
	)
}

// getContent 从章节仓储读取当前请求关联章节正文。
// 参数 ctx 表示请求上下文；参数 reader 表示章节读取依赖；参数 novelID 表示当前请求关联的小说 ID；参数 chapterID 表示当前请求关联的章节 ID。
func getContent(ctx context.Context, reader ChapterReader, novelID uint64, chapterID uint64) (GetContentOutput, error) {
	if reader == nil {
		return GetContentOutput{}, fmt.Errorf("章节读取仓储未初始化")
	}
	if novelID == 0 || chapterID == 0 {
		return GetContentOutput{}, ErrChapterContextRequired
	}

	chapter, err := reader.GetByID(ctx, novelID, chapterID)
	if err != nil {
		return GetContentOutput{}, fmt.Errorf("读取章节正文失败: %w", err)
	}
	if chapter == nil {
		return GetContentOutput{}, bizchapter.ErrNotFound
	}

	return GetContentOutput{
		ChapterNumber: chapter.ChapterNumber,
		Title:         chapter.Title,
		Content:       chapter.Content,
		WordCount:     chapter.WordCount,
		UpdatedAt:     chapter.UpdatedAt,
	}, nil
}
