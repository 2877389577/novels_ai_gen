package tools

import (
	"context"
	"fmt"
	"strings"

	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"

	bizcharacter "novels_ai_gen/internal/biz/character"
	bizrelationship "novels_ai_gen/internal/biz/relationship"
)

// RelationshipGraphStore 表示角色关系图 Agent 工具读取直接关系所需的数据依赖。
type RelationshipGraphStore interface {
	// QueryDirectRelationshipsByCharacterName 根据角色姓名查询关系图中的直接关联角色。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 name 表示需要精确匹配的角色姓名。
	QueryDirectRelationshipsByCharacterName(ctx context.Context, novelID uint64, name string) ([]bizrelationship.CharacterDirectRelationships, error)
}

// QueryCharacterRelationshipsInput 表示 query_character_relationships 工具的输入参数。
type QueryCharacterRelationshipsInput struct {
	// NovelID 表示所属小说 ID，未传时使用本次 Agent 请求关联的小说 ID。
	NovelID uint64 `json:"novel_id,omitempty" jsonschema_description:"所属小说 ID；未传时使用本轮 Agent 请求上下文中的小说 ID。"`
	// Name 表示需要精确查询直接关系的角色姓名。
	Name string `json:"name" jsonschema:"required" jsonschema_description:"需要精确查询直接关系的角色姓名；如果存在多个同名角色，工具会返回全部同名角色各自的直接关系。"`
}

// RelationshipToolTarget 表示工具返回的一名直接关联角色。
type RelationshipToolTarget struct {
	// ID 表示直接关联角色的角色卡主键 ID。
	ID uint64 `json:"id"`
	// Name 表示直接关联角色的姓名。
	Name string `json:"name"`
	// Note 表示关系线备注。
	Note string `json:"note"`
}

// RelationshipToolCharacter 表示工具命中的角色及其直接关系。
type RelationshipToolCharacter struct {
	// ID 表示命中角色的角色卡主键 ID。
	ID uint64 `json:"id"`
	// Name 表示命中角色的姓名。
	Name string `json:"name"`
	// Relationships 表示该角色在关系图中直接关联的角色列表。
	Relationships []RelationshipToolTarget `json:"relationships"`
}

// QueryCharacterRelationshipsOutput 表示 query_character_relationships 工具返回给 Agent 的直接关系查询结果。
type QueryCharacterRelationshipsOutput struct {
	// NovelID 表示本次查询实际使用的小说 ID。
	NovelID uint64 `json:"novel_id"`
	// QueryName 表示本次查询实际使用的角色姓名。
	QueryName string `json:"query_name"`
	// MatchedCount 表示本次返回的有直接关系的同名角色数量。
	MatchedCount int `json:"matched_count"`
	// Characters 表示命中的同名角色及其各自的直接关系。
	Characters []RelationshipToolCharacter `json:"characters"`
}

// NewQueryCharacterRelationshipsTool 创建查询角色关系图直接关系的 Eino 普通工具。
// 参数 store 表示角色关系图读取依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 description 表示提供给模型的工具提示词。
func NewQueryCharacterRelationshipsTool(store RelationshipGraphStore, requestNovelID uint64, description string) (tool.InvokableTool, error) {
	return utils.InferTool[QueryCharacterRelationshipsInput, QueryCharacterRelationshipsOutput](
		ToolNameQueryCharacterRelationships,
		description,
		func(ctx context.Context, input QueryCharacterRelationshipsInput) (QueryCharacterRelationshipsOutput, error) {
			return queryCharacterRelationships(ctx, store, requestNovelID, input)
		},
	)
}

// queryCharacterRelationships 根据小说 ID 和角色姓名查询关系图中的直接关联角色。
// 参数 ctx 表示请求上下文；参数 store 表示角色关系图读取依赖；参数 requestNovelID 表示当前 Agent 请求关联的小说 ID；参数 input 表示工具入参。
func queryCharacterRelationships(ctx context.Context, store RelationshipGraphStore, requestNovelID uint64, input QueryCharacterRelationshipsInput) (QueryCharacterRelationshipsOutput, error) {
	if store == nil {
		return QueryCharacterRelationshipsOutput{}, fmt.Errorf("角色关系图仓储未初始化")
	}

	novelID, err := resolveNovelID(input.NovelID, requestNovelID)
	if err != nil {
		return QueryCharacterRelationshipsOutput{}, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return QueryCharacterRelationshipsOutput{}, bizcharacter.ErrNameRequired
	}

	items, err := store.QueryDirectRelationshipsByCharacterName(ctx, novelID, name)
	if err != nil {
		return QueryCharacterRelationshipsOutput{}, fmt.Errorf("查询角色关系图失败: %w", err)
	}
	return QueryCharacterRelationshipsOutput{
		NovelID:      novelID,
		QueryName:    name,
		MatchedCount: len(items),
		Characters:   relationshipToolCharacterList(items),
	}, nil
}

// relationshipToolCharacterList 将关系图直接关系查询结果转换为工具输出列表。
// 参数 items 表示关系图直接关系查询结果列表。
func relationshipToolCharacterList(items []bizrelationship.CharacterDirectRelationships) []RelationshipToolCharacter {
	output := make([]RelationshipToolCharacter, 0, len(items))
	for _, item := range items {
		output = append(output, relationshipToolCharacterFromModel(item))
	}
	return output
}

// relationshipToolCharacterFromModel 将单个直接关系查询结果转换为工具输出数据。
// 参数 item 表示关系图直接关系查询结果。
func relationshipToolCharacterFromModel(item bizrelationship.CharacterDirectRelationships) RelationshipToolCharacter {
	relationships := make([]RelationshipToolTarget, 0, len(item.Relationships))
	for _, relationship := range item.Relationships {
		relationships = append(relationships, RelationshipToolTarget{
			ID:   relationship.ID,
			Name: relationship.Name,
			Note: relationship.Note,
		})
	}
	return RelationshipToolCharacter{
		ID:            item.ID,
		Name:          item.Name,
		Relationships: relationships,
	}
}
