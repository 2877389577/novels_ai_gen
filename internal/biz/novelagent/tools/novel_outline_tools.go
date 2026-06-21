package tools

import (
	"context"
	"errors"
	"fmt"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"

	biznoveloutline "novels_ai_gen/internal/biz/noveloutline"
)

// NovelOutlineStore 表示小说大纲 Agent 工具读写大纲数据所需的数据依赖。
type NovelOutlineStore interface {
	// GetByNovelID 根据小说 ID 查询小说大纲。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	GetByNovelID(ctx context.Context, novelID uint64) (*biznoveloutline.NovelOutline, error)
	// UpsertContent 创建或覆盖小说大纲正文并返回保存后的记录。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 content 表示需要写入的大纲正文。
	UpsertContent(ctx context.Context, novelID uint64, content string) (*biznoveloutline.NovelOutline, error)
}

// QueryNovelOutlineInput 表示 query_novel_outline 工具的输入参数。
type QueryNovelOutlineInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"可选；所属小说 ID，未传时使用本轮 Agent 请求上下文中的小说 ID。"`
}

// UpdateNovelOutlineInput 表示 update_novel_outline 工具的输入参数。
type UpdateNovelOutlineInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"可选；所属小说 ID，未传时使用本轮 Agent 请求上下文中的小说 ID。"`
	// Content 表示需要写入或覆盖的小说大纲正文。
	Content string `json:"content" jsonschema:"required" jsonschema_description:"要写入或覆盖的小说大纲正文；允许传空字符串以清空大纲内容。"`
}

// NewQueryNovelOutlineTool 创建查询小说大纲正文的 Eino 普通工具。
// 参数 store 表示小说大纲读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewQueryNovelOutlineTool(store NovelOutlineStore, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[QueryNovelOutlineInput, string](
		ToolNameQueryNovelOutline,
		description,
		func(ctx context.Context, input QueryNovelOutlineInput) (string, error) {
			return queryNovelOutline(ctx, store, requestNovelID, input)
		},
	)
}

// NewUpdateNovelOutlineTool 创建写入或覆盖小说大纲正文的 Eino 普通工具。
// 参数 store 表示小说大纲读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewUpdateNovelOutlineTool(store NovelOutlineStore, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[UpdateNovelOutlineInput, string](
		ToolNameUpdateNovelOutline,
		description,
		func(ctx context.Context, input UpdateNovelOutlineInput) (string, error) {
			return updateNovelOutline(ctx, store, requestNovelID, input)
		},
	)
}

// queryNovelOutline 根据小说 ID 查询小说大纲正文。
// 参数 ctx 表示请求上下文；参数 store 表示小说大纲读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func queryNovelOutline(ctx context.Context, store NovelOutlineStore, requestNovelID uint64, input QueryNovelOutlineInput) (string, error) {
	if store == nil {
		return "", fmt.Errorf("小说大纲仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return "", err
	}
	outline, err := store.GetByNovelID(ctx, novelID)
	if err != nil {
		if errors.Is(err, biznoveloutline.ErrNotFound) {
			return "", nil
		}
		return "", fmt.Errorf("查询小说大纲失败: %w", err)
	}
	if outline == nil {
		return "", nil
	}
	return outline.Content, nil
}

// updateNovelOutline 根据小说 ID 写入或覆盖小说大纲正文。
// 参数 ctx 表示请求上下文；参数 store 表示小说大纲读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func updateNovelOutline(ctx context.Context, store NovelOutlineStore, requestNovelID uint64, input UpdateNovelOutlineInput) (string, error) {
	if store == nil {
		return "", fmt.Errorf("小说大纲仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return "", err
	}
	outline, err := store.UpsertContent(ctx, novelID, input.Content)
	if err != nil {
		return "", fmt.Errorf("保存小说大纲失败: %w", err)
	}
	if outline == nil {
		return "", biznoveloutline.ErrNotFound
	}
	return outline.Content, nil
}
