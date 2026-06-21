package tools

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"

	biznovelsummary "novels_ai_gen/internal/biz/novelsummary"
)

// NovelSummaryStore 表示小说滚动总结 Agent 工具读写总结数据所需的数据依赖。
type NovelSummaryStore interface {
	// GetByNovelID 根据小说 ID 查询小说滚动总结。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	GetByNovelID(ctx context.Context, novelID uint64) (*biznovelsummary.NovelSummary, error)
	// UpsertContentAndRange 创建或覆盖小说滚动总结内容和覆盖章节范围并返回保存后的记录。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示需要写入的总结内容和覆盖章节范围。
	UpsertContentAndRange(ctx context.Context, novelID uint64, req biznovelsummary.SaveRequest) (*biznovelsummary.NovelSummary, error)
}

// QueryNovelSummaryInput 表示 query_novel_summary 工具的输入参数。
type QueryNovelSummaryInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"可选；所属小说 ID，未传时使用本轮 Agent 请求上下文中的小说 ID。"`
}

// NovelSummaryData 表示小说滚动总结工具返回的总结数据。
type NovelSummaryData struct {
	// ID 表示小说总结主键 ID。
	ID uint64 `json:"id"`
	// NovelID 表示总结所属小说 ID。
	NovelID uint64 `json:"novel_id"`
	// Content 表示小说滚动剧情总结内容。
	Content string `json:"content"`
	// StartChapterNumber 表示当前总结覆盖的起始章节号，0 表示未知或未记录。
	StartChapterNumber int `json:"start_chapter_number"`
	// EndChapterNumber 表示当前总结覆盖的结束章节号，0 表示未知或未记录。
	EndChapterNumber int `json:"end_chapter_number"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at"`
}

// QueryNovelSummaryOutput 表示 query_novel_summary 工具返回给 Agent 的查询结果。
type QueryNovelSummaryOutput struct {
	// NovelID 表示本次查询实际使用的小说 ID。
	NovelID uint64 `json:"novel_id"`
	// Exists 表示当前小说是否已经存在滚动总结。
	Exists bool `json:"exists"`
	// Summary 表示查询到的小说滚动总结，不存在时为空。
	Summary *NovelSummaryData `json:"summary,omitempty"`
}

// UpdateNovelSummaryInput 表示 update_novel_summary 工具的输入参数。
type UpdateNovelSummaryInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"可选；所属小说 ID，未传时使用本轮 Agent 请求上下文中的小说 ID。"`
	// Content 表示需要写入或覆盖的小说滚动剧情总结内容。
	Content string `json:"content" jsonschema:"required" jsonschema_description:"要写入或覆盖的小说滚动剧情总结内容；允许传空字符串以清空总结内容。"`
	// StartChapterNumber 表示当前总结覆盖的起始章节号，0 表示未知或未记录。
	StartChapterNumber int `json:"start_chapter_number" jsonschema:"required" jsonschema_description:"当前总结覆盖的起始章节号；0 表示未知或暂不记录范围；记录范围时必须和 end_chapter_number 一起大于 0。"`
	// EndChapterNumber 表示当前总结覆盖的结束章节号，0 表示未知或未记录。
	EndChapterNumber int `json:"end_chapter_number" jsonschema:"required" jsonschema_description:"当前总结覆盖的结束章节号；0 表示未知或暂不记录范围；记录范围时必须大于等于 start_chapter_number。"`
}

// UpdateNovelSummaryOutput 表示 update_novel_summary 工具返回给 Agent 的保存结果。
type UpdateNovelSummaryOutput struct {
	// ID 表示小说总结主键 ID。
	ID uint64 `json:"id"`
	// NovelID 表示总结所属小说 ID。
	NovelID uint64 `json:"novel_id"`
	// Content 表示更新后的小说滚动剧情总结内容。
	Content string `json:"content"`
	// StartChapterNumber 表示更新后的总结覆盖起始章节号，0 表示未知或未记录。
	StartChapterNumber int `json:"start_chapter_number"`
	// EndChapterNumber 表示更新后的总结覆盖结束章节号，0 表示未知或未记录。
	EndChapterNumber int `json:"end_chapter_number"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at"`
}

// NewQueryNovelSummaryTool 创建查询小说滚动总结的 Eino 普通工具。
// 参数 store 表示小说滚动总结读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewQueryNovelSummaryTool(store NovelSummaryStore, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[QueryNovelSummaryInput, QueryNovelSummaryOutput](
		ToolNameQueryNovelSummary,
		description,
		func(ctx context.Context, input QueryNovelSummaryInput) (QueryNovelSummaryOutput, error) {
			return queryNovelSummary(ctx, store, requestNovelID, input)
		},
	)
}

// NewUpdateNovelSummaryTool 创建写入或覆盖小说滚动总结的 Eino 普通工具。
// 参数 store 表示小说滚动总结读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewUpdateNovelSummaryTool(store NovelSummaryStore, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[UpdateNovelSummaryInput, UpdateNovelSummaryOutput](
		ToolNameUpdateNovelSummary,
		description,
		func(ctx context.Context, input UpdateNovelSummaryInput) (UpdateNovelSummaryOutput, error) {
			return updateNovelSummary(ctx, store, requestNovelID, input)
		},
	)
}

// queryNovelSummary 根据小说 ID 查询小说滚动总结。
// 参数 ctx 表示请求上下文；参数 store 表示小说滚动总结读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func queryNovelSummary(ctx context.Context, store NovelSummaryStore, requestNovelID uint64, input QueryNovelSummaryInput) (QueryNovelSummaryOutput, error) {
	if store == nil {
		return QueryNovelSummaryOutput{}, fmt.Errorf("小说总结仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return QueryNovelSummaryOutput{}, err
	}
	summary, err := store.GetByNovelID(ctx, novelID)
	if err != nil {
		if errors.Is(err, biznovelsummary.ErrNotFound) {
			return QueryNovelSummaryOutput{NovelID: novelID, Exists: false}, nil
		}
		return QueryNovelSummaryOutput{}, fmt.Errorf("查询小说总结失败: %w", err)
	}
	if summary == nil {
		return QueryNovelSummaryOutput{NovelID: novelID, Exists: false}, nil
	}

	return QueryNovelSummaryOutput{
		NovelID: novelID,
		Exists:  true,
		Summary: novelSummaryDataFromModel(*summary),
	}, nil
}

// updateNovelSummary 根据小说 ID 写入或覆盖小说滚动总结。
// 参数 ctx 表示请求上下文；参数 store 表示小说滚动总结读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func updateNovelSummary(ctx context.Context, store NovelSummaryStore, requestNovelID uint64, input UpdateNovelSummaryInput) (UpdateNovelSummaryOutput, error) {
	if store == nil {
		return UpdateNovelSummaryOutput{}, fmt.Errorf("小说总结仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return UpdateNovelSummaryOutput{}, err
	}
	saveReq := biznovelsummary.SaveRequest{
		Content:            input.Content,
		StartChapterNumber: input.StartChapterNumber,
		EndChapterNumber:   input.EndChapterNumber,
	}
	if err := biznovelsummary.ValidateSaveRequest(saveReq); err != nil {
		return UpdateNovelSummaryOutput{}, err
	}
	summary, err := store.UpsertContentAndRange(ctx, novelID, saveReq)
	if err != nil {
		return UpdateNovelSummaryOutput{}, fmt.Errorf("保存小说总结失败: %w", err)
	}
	if summary == nil {
		return UpdateNovelSummaryOutput{}, biznovelsummary.ErrNotFound
	}

	return UpdateNovelSummaryOutput{
		ID:                 summary.ID,
		NovelID:            summary.NovelID,
		Content:            summary.Content,
		StartChapterNumber: summary.StartChapterNumber,
		EndChapterNumber:   summary.EndChapterNumber,
		CreatedAt:          summary.CreatedAt,
		UpdatedAt:          summary.UpdatedAt,
	}, nil
}

// novelSummaryDataFromModel 将小说滚动总结模型转换为工具输出数据。
// 参数 summary 表示小说滚动总结数据库模型。
func novelSummaryDataFromModel(summary biznovelsummary.NovelSummary) *NovelSummaryData {
	return &NovelSummaryData{
		ID:                 summary.ID,
		NovelID:            summary.NovelID,
		Content:            summary.Content,
		StartChapterNumber: summary.StartChapterNumber,
		EndChapterNumber:   summary.EndChapterNumber,
		CreatedAt:          summary.CreatedAt,
		UpdatedAt:          summary.UpdatedAt,
	}
}
