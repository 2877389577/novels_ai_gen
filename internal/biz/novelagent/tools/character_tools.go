package tools

import (
	"context"
	"fmt"
	"strings"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"

	bizcharacter "novels_ai_gen/internal/biz/character"
)

const characterToolPageSize = 5

// CharacterStore 表示角色信息 Agent 工具读写角色卡数据所需的数据依赖。
type CharacterStore interface {
	// ListByNovelIDAsc 查询指定小说下按角色 ID 升序排列的角色卡分页列表。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
	ListByNovelIDAsc(ctx context.Context, novelID uint64, offset int, limit int) ([]bizcharacter.Character, int64, error)
	// SearchByName 根据小说 ID 和角色名精确查询角色卡列表。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 name 表示角色姓名。
	SearchByName(ctx context.Context, novelID uint64, name string) ([]bizcharacter.Character, error)
	// SaveCharacter 新增或更新角色卡核心设定字段。
	// 参数 ctx 表示请求上下文；参数 item 表示需要新增或更新的角色卡模型。
	SaveCharacter(ctx context.Context, item *bizcharacter.Character) error
}

// ListCharactersInput 表示 list_characters 工具的输入参数。
type ListCharactersInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"所属小说 ID；未传时使用本轮 Agent 请求上下文中的小说 ID。"`
	// Page 表示当前页码，从 1 开始；每页固定返回 5 个角色。
	Page int `json:"page,omitempty" jsonschema_description:"当前页码，从 1 开始；小于等于 0 时按第 1 页处理；每页固定返回 5 个角色。"`
}

// CharacterToolData 表示角色信息工具返回给 Agent 的角色核心设定数据。
type CharacterToolData struct {
	// ID 表示角色卡主键 ID。
	ID uint64 `json:"id"`
	// NovelID 表示角色所属小说 ID。
	NovelID uint64 `json:"novel_id"`
	// Name 表示角色姓名。
	Name string `json:"name"`
	// Gender 表示角色性别，可以为空。
	Gender string `json:"gender"`
	// Tags 表示角色标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags"`
	// Background 表示角色背景，可以为空。
	Background string `json:"background"`
	// Personality 表示角色性格，可以为空。
	Personality string `json:"personality"`
	// Ability 表示角色能力，可以为空。
	Ability string `json:"ability"`
	// Goal 表示角色目的，可以为空。
	Goal string `json:"goal"`
}

// ListCharactersOutput 表示 list_characters 工具返回给 Agent 的分页角色列表。
type ListCharactersOutput struct {
	// NovelID 表示本次查询实际使用的小说 ID。
	NovelID uint64 `json:"novel_id"`
	// Page 表示本次查询的当前页码。
	Page int `json:"page"`
	// PageSize 表示每页固定返回的角色数量。
	PageSize int `json:"page_size"`
	// Total 表示指定小说下的角色总数。
	Total int64 `json:"total"`
	// TotalPages 表示指定小说下的角色总页数。
	TotalPages int `json:"total_pages"`
	// Characters 表示当前页角色核心设定列表。
	Characters []CharacterToolData `json:"characters"`
}

// SearchCharactersByNameInput 表示 search_characters_by_name 工具的输入参数。
type SearchCharactersByNameInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"所属小说 ID；未传时使用本轮 Agent 请求上下文中的小说 ID。"`
	// Name 表示需要精确搜索的角色姓名。
	Name string `json:"name" jsonschema:"required" jsonschema_description:"需要精确搜索的角色姓名；允许存在多个同名角色，工具会返回全部匹配项。"`
}

// SearchCharactersByNameOutput 表示 search_characters_by_name 工具返回给 Agent 的角色搜索结果。
type SearchCharactersByNameOutput struct {
	// NovelID 表示本次查询实际使用的小说 ID。
	NovelID uint64 `json:"novel_id"`
	// Count 表示本次搜索命中的角色数量。
	Count int `json:"count"`
	// Characters 表示命中的角色核心设定列表。
	Characters []CharacterToolData `json:"characters"`
}

// SaveCharacterInput 表示 save_character 工具的输入参数。
type SaveCharacterInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"所属小说 ID；未传时使用本轮 Agent 请求上下文中的小说 ID。"`
	// ID 表示角色卡主键 ID；为 0 或不传时新增角色，大于 0 时更新该角色。
	ID uint64 `json:"id,omitempty" jsonschema_description:"角色卡主键 ID；为 0 或不传时新增角色，大于 0 时更新该角色。"`
	// Name 表示角色姓名，不能为空。
	Name string `json:"name" jsonschema:"required" jsonschema_description:"角色姓名，trim 后不能为空。"`
	// Gender 表示角色性别，可以为空。
	Gender string `json:"gender,omitempty" jsonschema_description:"角色性别，可以为空。"`
	// Tags 表示角色标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags,omitempty" jsonschema_description:"角色标签，可以为空；多个标签建议使用英文逗号分隔。"`
	// Background 表示角色背景，可以为空。
	Background string `json:"background,omitempty" jsonschema_description:"角色背景，可以为空。"`
	// Personality 表示角色性格，可以为空。
	Personality string `json:"personality,omitempty" jsonschema_description:"角色性格，可以为空。"`
	// Ability 表示角色能力，可以为空。
	Ability string `json:"ability,omitempty" jsonschema_description:"角色能力，可以为空。"`
	// Goal 表示角色目的，可以为空。
	Goal string `json:"goal,omitempty" jsonschema_description:"角色目的，可以为空。"`
}

// SaveCharacterOutput 表示 save_character 工具返回给 Agent 的保存后角色数据。
type SaveCharacterOutput struct {
	// Character 表示新增或更新后的角色核心设定。
	Character CharacterToolData `json:"character"`
}

// NewListCharactersTool 创建分页读取角色核心设定列表的 Eino 普通工具。
// 参数 store 表示角色卡读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewListCharactersTool(store CharacterStore, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[ListCharactersInput, ListCharactersOutput](
		ToolNameListCharacters,
		description,
		func(ctx context.Context, input ListCharactersInput) (ListCharactersOutput, error) {
			return listCharacters(ctx, store, requestNovelID, input)
		},
	)
}

// NewSearchCharactersByNameTool 创建按角色名精确搜索角色核心设定的 Eino 普通工具。
// 参数 store 表示角色卡读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewSearchCharactersByNameTool(store CharacterStore, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[SearchCharactersByNameInput, SearchCharactersByNameOutput](
		ToolNameSearchCharactersByName,
		description,
		func(ctx context.Context, input SearchCharactersByNameInput) (SearchCharactersByNameOutput, error) {
			return searchCharactersByName(ctx, store, requestNovelID, input)
		},
	)
}

// NewSaveCharacterTool 创建新增或更新角色核心设定的 Eino 普通工具。
// 参数 store 表示角色卡读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewSaveCharacterTool(store CharacterStore, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[SaveCharacterInput, SaveCharacterOutput](
		ToolNameSaveCharacter,
		description,
		func(ctx context.Context, input SaveCharacterInput) (SaveCharacterOutput, error) {
			return saveCharacter(ctx, store, requestNovelID, input)
		},
	)
}

// listCharacters 根据小说 ID 和页码分页读取角色核心设定。
// 参数 ctx 表示请求上下文；参数 store 表示角色卡读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func listCharacters(ctx context.Context, store CharacterStore, requestNovelID uint64, input ListCharactersInput) (ListCharactersOutput, error) {
	if store == nil {
		return ListCharactersOutput{}, fmt.Errorf("角色卡仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return ListCharactersOutput{}, err
	}
	page := normalizeCharacterToolPage(input.Page)
	offset := (page - 1) * characterToolPageSize
	items, total, err := store.ListByNovelIDAsc(ctx, novelID, offset, characterToolPageSize)
	if err != nil {
		return ListCharactersOutput{}, fmt.Errorf("查询角色列表失败: %w", err)
	}

	return ListCharactersOutput{
		NovelID:    novelID,
		Page:       page,
		PageSize:   characterToolPageSize,
		Total:      total,
		TotalPages: characterToolTotalPages(total),
		Characters: characterToolDataList(items),
	}, nil
}

// searchCharactersByName 根据小说 ID 和角色名精确搜索角色核心设定。
// 参数 ctx 表示请求上下文；参数 store 表示角色卡读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func searchCharactersByName(ctx context.Context, store CharacterStore, requestNovelID uint64, input SearchCharactersByNameInput) (SearchCharactersByNameOutput, error) {
	if store == nil {
		return SearchCharactersByNameOutput{}, fmt.Errorf("角色卡仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return SearchCharactersByNameOutput{}, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return SearchCharactersByNameOutput{}, bizcharacter.ErrNameRequired
	}
	items, err := store.SearchByName(ctx, novelID, name)
	if err != nil {
		return SearchCharactersByNameOutput{}, fmt.Errorf("搜索角色信息失败: %w", err)
	}

	return SearchCharactersByNameOutput{
		NovelID:    novelID,
		Count:      len(items),
		Characters: characterToolDataList(items),
	}, nil
}

// saveCharacter 根据小说 ID 新增或更新角色核心设定。
// 参数 ctx 表示请求上下文；参数 store 表示角色卡读写依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func saveCharacter(ctx context.Context, store CharacterStore, requestNovelID uint64, input SaveCharacterInput) (SaveCharacterOutput, error) {
	if store == nil {
		return SaveCharacterOutput{}, fmt.Errorf("角色卡仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return SaveCharacterOutput{}, err
	}
	item := characterFromSaveInput(novelID, input)
	if item.Name == "" {
		return SaveCharacterOutput{}, bizcharacter.ErrNameRequired
	}
	if err := store.SaveCharacter(ctx, item); err != nil {
		return SaveCharacterOutput{}, fmt.Errorf("保存角色信息失败: %w", err)
	}

	return SaveCharacterOutput{Character: characterToolDataFromModel(*item)}, nil
}

// characterFromSaveInput 将保存工具入参转换为角色卡模型。
// 参数 novelID 表示实际使用的小说 ID；参数 input 表示工具入参。
func characterFromSaveInput(novelID uint64, input SaveCharacterInput) *bizcharacter.Character {
	return &bizcharacter.Character{
		ID:          input.ID,
		NovelID:     novelID,
		Name:        strings.TrimSpace(input.Name),
		Gender:      strings.TrimSpace(input.Gender),
		Tags:        strings.TrimSpace(input.Tags),
		Background:  strings.TrimSpace(input.Background),
		Personality: strings.TrimSpace(input.Personality),
		Ability:     strings.TrimSpace(input.Ability),
		Goal:        strings.TrimSpace(input.Goal),
	}
}

// normalizeCharacterToolPage 标准化角色列表工具页码。
// 参数 page 表示工具调用方传入的页码。
func normalizeCharacterToolPage(page int) int {
	if page <= 0 {
		return 1
	}
	return page
}

// characterToolTotalPages 计算角色列表工具分页总页数。
// 参数 total 表示角色总数。
func characterToolTotalPages(total int64) int {
	if total <= 0 {
		return 0
	}
	return int((total + int64(characterToolPageSize) - 1) / int64(characterToolPageSize))
}

// characterToolDataList 将角色模型列表转换为工具输出列表。
// 参数 items 表示角色卡模型列表。
func characterToolDataList(items []bizcharacter.Character) []CharacterToolData {
	output := make([]CharacterToolData, 0, len(items))
	for _, item := range items {
		output = append(output, characterToolDataFromModel(item))
	}
	return output
}

// characterToolDataFromModel 将角色模型转换为工具输出数据。
// 参数 item 表示角色卡数据库模型。
func characterToolDataFromModel(item bizcharacter.Character) CharacterToolData {
	return CharacterToolData{
		ID:          item.ID,
		NovelID:     item.NovelID,
		Name:        item.Name,
		Gender:      item.Gender,
		Tags:        item.Tags,
		Background:  item.Background,
		Personality: item.Personality,
		Ability:     item.Ability,
		Goal:        item.Goal,
	}
}
