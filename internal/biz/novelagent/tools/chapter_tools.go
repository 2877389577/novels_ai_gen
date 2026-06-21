package tools

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"

	bizchapter "novels_ai_gen/internal/biz/chapter"
)

var (
	// ErrNovelContextRequired 表示章节工具调用时缺少小说上下文。
	ErrNovelContextRequired = errors.New("novel context required")
	// ErrChapterSelectorInvalid 表示章节工具调用时章节定位条件无效。
	ErrChapterSelectorInvalid = errors.New("chapter selector invalid")
	// ErrChapterFieldInvalid 表示章节查询工具请求了不支持的字段。
	ErrChapterFieldInvalid = errors.New("chapter field invalid")
)

var allQueryChapterFields = []string{
	"id",
	"novel_id",
	"chapter_number",
	"title",
	"content",
	"summary",
	"word_count",
	"created_at",
	"updated_at",
}

var allowedQueryChapterFields = map[string]struct{}{
	"id":             {},
	"novel_id":       {},
	"chapter_number": {},
	"title":          {},
	"content":        {},
	"summary":        {},
	"word_count":     {},
	"created_at":     {},
	"updated_at":     {},
}

// QueryChaptersInput 表示 query_chapters 工具的输入参数。
type QueryChaptersInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"可选；所属小说 ID，未传时使用本轮 Agent 请求上下文中的小说 ID。"`
	// ChapterID 表示章节主键 ID，非 0 时按主键查询单章。
	ChapterID uint64 `json:"chapter_id,omitempty" jsonschema_description:"章节主键 ID，用于按数据库章节 ID 定位并查询单章；不能和 chapter_number 或章节号范围同时使用。"`
	// ChapterNumber 表示章节号，非 0 时按章节号查询单章。
	ChapterNumber int `json:"chapter_number,omitempty" jsonschema_description:"章节号，用于按“第几章”定位并查询单章；不能和 chapter_id 或章节号范围同时使用。"`
	// StartChapterNumber 表示章节号范围起点，需要与 EndChapterNumber 同时传入。
	StartChapterNumber int `json:"start_chapter_number,omitempty" jsonschema_description:"章节号范围起点，需要与 end_chapter_number 同时传入；用于查询连续章节范围。"`
	// EndChapterNumber 表示章节号范围终点，需要与 StartChapterNumber 同时传入。
	EndChapterNumber int `json:"end_chapter_number,omitempty" jsonschema_description:"章节号范围终点，需要与 start_chapter_number 同时传入，且不能小于起始章节号。"`
	// Fields 表示需要返回的章节字段列表，空列表表示返回全部字段。
	Fields []string `json:"fields,omitempty" jsonschema_description:"需要返回的章节字段列表；空列表表示返回全部字段；可选字段为 id、novel_id(所属小说ID)、chapter_number(章节号)、title(章节名)、content(章节正文)、summary(章节总结)、word_count(章节正文字数)、created_at、updated_at。"`
}

// QueryChapterData 表示 query_chapters 工具返回的单章数据。
type QueryChapterData struct {
	// ID 表示章节主键 ID。
	ID *uint64 `json:"id,omitempty"`
	// NovelID 表示所属小说 ID。
	NovelID *uint64 `json:"novel_id,omitempty"`
	// ChapterNumber 表示章节号，即“第 x 章”中的 x。
	ChapterNumber *int `json:"chapter_number,omitempty"`
	// Title 表示章节名。
	Title *string `json:"title,omitempty"`
	// Content 表示章节正文。
	Content *string `json:"content,omitempty"`
	// Summary 表示章节总结。
	Summary *string `json:"summary,omitempty"`
	// WordCount 表示章节正文的非空白字符数量。
	WordCount *int `json:"word_count,omitempty"`
	// CreatedAt 表示章节创建时间。
	CreatedAt *time.Time `json:"created_at,omitempty"`
	// UpdatedAt 表示章节最近更新时间。
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}

// QueryChaptersOutput 表示 query_chapters 工具返回给 Agent 的章节数据集合。
type QueryChaptersOutput struct {
	// NovelID 表示本次查询实际使用的小说 ID。
	NovelID uint64 `json:"novel_id"`
	// Count 表示本次查询命中的章节数量。
	Count int `json:"count"`
	// Fields 表示本次返回的字段列表。
	Fields []string `json:"fields"`
	// Chapters 表示查询到的章节数据列表。
	Chapters []QueryChapterData `json:"chapters"`
}

// UpdateChapterSummaryInput 表示 update_chapter_summary 工具的输入参数。
type UpdateChapterSummaryInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"可选；所属小说 ID，未传时使用本轮 Agent 请求上下文中的小说 ID。"`
	// ChapterID 表示章节主键 ID，非 0 时按主键定位章节。
	ChapterID uint64 `json:"chapter_id,omitempty" jsonschema_description:"章节主键 ID，用于按数据库章节 ID 定位单章；必须和 chapter_number 二选一，不能同时传入。"`
	// ChapterNumber 表示章节号，非 0 时按章节号定位章节。
	ChapterNumber int `json:"chapter_number,omitempty" jsonschema_description:"章节号，用于按“第几章”定位单章；必须和 chapter_id 二选一，不能同时传入。"`
	// Summary 表示需要写入的章节总结，允许为空字符串以清空总结。
	Summary string `json:"summary" jsonschema:"required" jsonschema_description:"要写入的章节总结，只会更新章节 summary 字段；允许传空字符串以清空总结。"`
}

// UpdateChapterSummaryOutput 表示 update_chapter_summary 工具返回给 Agent 的章节总结更新结果。
type UpdateChapterSummaryOutput struct {
	// ID 表示章节主键 ID。
	ID uint64 `json:"id"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id"`
	// ChapterNumber 表示章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number"`
	// Title 表示章节名。
	Title string `json:"title"`
	// Summary 表示更新后的章节总结。
	Summary string `json:"summary"`
	// UpdatedAt 表示章节最近更新时间。
	UpdatedAt time.Time `json:"updated_at"`
}

// NewQueryChaptersTool 创建按条件查询章节数据的 Eino 普通工具。
// 参数 reader 表示章节读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewQueryChaptersTool(reader ChapterReader, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[QueryChaptersInput, QueryChaptersOutput](
		ToolNameQueryChapters,
		description,
		func(ctx context.Context, input QueryChaptersInput) (QueryChaptersOutput, error) {
			return queryChapters(ctx, reader, requestNovelID, input)
		},
	)
}

// NewUpdateChapterSummaryTool 创建更新章节总结的 Eino 普通工具。
// 参数 reader 表示章节读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewUpdateChapterSummaryTool(reader ChapterReader, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[UpdateChapterSummaryInput, UpdateChapterSummaryOutput](
		ToolNameUpdateChapterSummary,
		description,
		func(ctx context.Context, input UpdateChapterSummaryInput) (UpdateChapterSummaryOutput, error) {
			return updateChapterSummary(ctx, reader, requestNovelID, input)
		},
	)
}

// queryChapters 根据输入条件查询章节数据。
// 参数 ctx 表示请求上下文；参数 reader 表示章节读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func queryChapters(ctx context.Context, reader ChapterReader, requestNovelID uint64, input QueryChaptersInput) (QueryChaptersOutput, error) {
	if reader == nil {
		return QueryChaptersOutput{}, fmt.Errorf("章节读取仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return QueryChaptersOutput{}, err
	}
	fields, dbFields, err := normalizeRequestedChapterFields(input.Fields)
	if err != nil {
		return QueryChaptersOutput{}, err
	}

	condition, err := queryConditionFromInput(novelID, input, dbFields)
	if err != nil {
		return QueryChaptersOutput{}, err
	}
	chapters, err := reader.QueryChapters(ctx, condition)
	if err != nil {
		return QueryChaptersOutput{}, fmt.Errorf("查询章节数据失败: %w", err)
	}

	return QueryChaptersOutput{
		NovelID:  novelID,
		Count:    len(chapters),
		Fields:   fields,
		Chapters: queryChapterDataList(chapters, fields),
	}, nil
}

// updateChapterSummary 根据输入条件更新章节总结。
// 参数 ctx 表示请求上下文；参数 reader 表示章节读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func updateChapterSummary(ctx context.Context, reader ChapterReader, requestNovelID uint64, input UpdateChapterSummaryInput) (UpdateChapterSummaryOutput, error) {
	if reader == nil {
		return UpdateChapterSummaryOutput{}, fmt.Errorf("章节读取仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return UpdateChapterSummaryOutput{}, err
	}
	if err := validateUpdateSummarySelector(input.ChapterID, input.ChapterNumber); err != nil {
		return UpdateChapterSummaryOutput{}, err
	}

	chapter, err := reader.UpdateChapterSummary(ctx, bizchapter.UpdateChapterSummaryCondition{
		NovelID:       novelID,
		ChapterID:     input.ChapterID,
		ChapterNumber: input.ChapterNumber,
		Summary:       input.Summary,
	})
	if err != nil {
		return UpdateChapterSummaryOutput{}, fmt.Errorf("更新章节总结失败: %w", err)
	}
	if chapter == nil {
		return UpdateChapterSummaryOutput{}, bizchapter.ErrNotFound
	}

	return UpdateChapterSummaryOutput{
		ID:            chapter.ID,
		NovelID:       chapter.NovelID,
		ChapterNumber: chapter.ChapterNumber,
		Title:         chapter.Title,
		Summary:       chapter.Summary,
		UpdatedAt:     chapter.UpdatedAt,
	}, nil
}

// resolveNovelID 返回工具调用实际使用的小说 ID。
// 参数 inputNovelID 表示工具入参中的小说 ID；参数 requestNovelID 表示本次 Agent 请求关联的小说 ID。
func resolveNovelID(inputNovelID uint64, requestNovelID uint64) (uint64, error) {
	if inputNovelID > 0 {
		return inputNovelID, nil
	}
	if requestNovelID > 0 {
		return requestNovelID, nil
	}
	return 0, ErrNovelContextRequired
}

// queryConditionFromInput 将工具输入转换为章节查询条件。
// 参数 novelID 表示实际使用的小说 ID；参数 input 表示工具输入；参数 fields 表示已经校验的数据库字段列表。
func queryConditionFromInput(novelID uint64, input QueryChaptersInput, fields []string) (bizchapter.QueryChaptersCondition, error) {
	if err := validateQuerySelector(input); err != nil {
		return bizchapter.QueryChaptersCondition{}, err
	}
	return bizchapter.QueryChaptersCondition{
		NovelID:            novelID,
		ChapterID:          input.ChapterID,
		ChapterNumber:      input.ChapterNumber,
		StartChapterNumber: input.StartChapterNumber,
		EndChapterNumber:   input.EndChapterNumber,
		Fields:             fields,
	}, nil
}

// validateQuerySelector 校验章节查询工具的章节定位条件。
// 参数 input 表示工具输入。
func validateQuerySelector(input QueryChaptersInput) error {
	modeCount := 0
	if input.ChapterID > 0 {
		modeCount++
	}
	if input.ChapterNumber > 0 {
		modeCount++
	}
	hasRangeInput := input.StartChapterNumber != 0 || input.EndChapterNumber != 0
	if hasRangeInput {
		modeCount++
		if input.StartChapterNumber <= 0 || input.EndChapterNumber <= 0 {
			return fmt.Errorf("%w: 章节号范围必须同时提供有效起止章节号", ErrChapterSelectorInvalid)
		}
		if input.StartChapterNumber > input.EndChapterNumber {
			return fmt.Errorf("%w: 起始章节号不能大于结束章节号", ErrChapterSelectorInvalid)
		}
	}
	if input.ChapterNumber < 0 {
		return fmt.Errorf("%w: 章节号必须大于 0", ErrChapterSelectorInvalid)
	}
	if modeCount != 1 {
		return fmt.Errorf("%w: chapter_id、chapter_number、章节号范围必须且只能选择一种", ErrChapterSelectorInvalid)
	}
	return nil
}

// validateUpdateSummarySelector 校验章节总结更新工具的章节定位条件。
// 参数 chapterID 表示章节主键 ID；参数 chapterNumber 表示章节号。
func validateUpdateSummarySelector(chapterID uint64, chapterNumber int) error {
	if chapterNumber < 0 {
		return fmt.Errorf("%w: 章节号必须大于 0", ErrChapterSelectorInvalid)
	}
	if (chapterID == 0 && chapterNumber == 0) || (chapterID > 0 && chapterNumber > 0) {
		return fmt.Errorf("%w: chapter_id 和 chapter_number 必须且只能提供一个", ErrChapterSelectorInvalid)
	}
	return nil
}

// normalizeRequestedChapterFields 标准化查询字段并返回展示字段和数据库查询字段。
// 参数 fields 表示工具调用方请求返回的字段列表。
func normalizeRequestedChapterFields(fields []string) ([]string, []string, error) {
	if len(fields) == 0 {
		return append([]string(nil), allQueryChapterFields...), nil, nil
	}

	normalized := make([]string, 0, len(fields))
	seen := make(map[string]struct{}, len(fields))
	for _, rawField := range fields {
		field := strings.TrimSpace(rawField)
		if field == "" {
			return nil, nil, fmt.Errorf("%w: 字段名不能为空", ErrChapterFieldInvalid)
		}
		if _, ok := allowedQueryChapterFields[field]; !ok {
			return nil, nil, fmt.Errorf("%w: %s", ErrChapterFieldInvalid, field)
		}
		if _, ok := seen[field]; ok {
			continue
		}
		seen[field] = struct{}{}
		normalized = append(normalized, field)
	}
	return normalized, append([]string(nil), normalized...), nil
}

// queryChapterDataList 将章节模型列表转换为工具输出列表。
// 参数 chapters 表示章节模型列表；参数 fields 表示需要输出的字段列表。
func queryChapterDataList(chapters []bizchapter.Chapter, fields []string) []QueryChapterData {
	output := make([]QueryChapterData, 0, len(chapters))
	for _, chapter := range chapters {
		output = append(output, queryChapterDataFromModel(chapter, fields))
	}
	return output
}

// queryChapterDataFromModel 将章节模型转换为按字段筛选后的工具输出。
// 参数 chapter 表示章节模型；参数 fields 表示需要输出的字段列表。
func queryChapterDataFromModel(chapter bizchapter.Chapter, fields []string) QueryChapterData {
	var output QueryChapterData
	for _, field := range fields {
		switch field {
		case "id":
			output.ID = valuePtr(chapter.ID)
		case "novel_id":
			output.NovelID = valuePtr(chapter.NovelID)
		case "chapter_number":
			output.ChapterNumber = valuePtr(chapter.ChapterNumber)
		case "title":
			output.Title = valuePtr(chapter.Title)
		case "content":
			output.Content = valuePtr(chapter.Content)
		case "summary":
			output.Summary = valuePtr(chapter.Summary)
		case "word_count":
			output.WordCount = valuePtr(chapter.WordCount)
		case "created_at":
			output.CreatedAt = valuePtr(chapter.CreatedAt)
		case "updated_at":
			output.UpdatedAt = valuePtr(chapter.UpdatedAt)
		}
	}
	return output
}

// valuePtr 返回传入值的指针，用于区分字段未返回和值为空。
// 参数 value 表示需要取地址的字段值。
func valuePtr[T any](value T) *T {
	return &value
}
