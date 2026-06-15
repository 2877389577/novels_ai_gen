package relationship

import (
	"fmt"
	"time"

	bizcharacter "novels_ai_gen/internal/biz/character"
	biznovel "novels_ai_gen/internal/biz/novel"
)

// Graph 表示小说角色关系图主表模型。
type Graph struct {
	// ID 表示角色关系图主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:角色关系图主键ID" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;uniqueIndex:idx_relationship_graphs_novel_id;comment:所属小说ID" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// ViewportX 表示画布视口 X 坐标。
	ViewportX float64 `json:"viewport_x" gorm:"column:viewport_x;not null;default:0;comment:画布视口X坐标" example:"0"`
	// ViewportY 表示画布视口 Y 坐标。
	ViewportY float64 `json:"viewport_y" gorm:"column:viewport_y;not null;default:0;comment:画布视口Y坐标" example:"0"`
	// ViewportZoom 表示画布视口缩放比例。
	ViewportZoom float64 `json:"viewport_zoom" gorm:"column:viewport_zoom;not null;default:1;comment:画布视口缩放比例" example:"1"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-15T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-15T10:00:00+08:00"`
}

// TableName 返回角色关系图主表名称。
func (Graph) TableName() string {
	return "novel_relationship_graphs"
}

// Node 表示角色关系图中的角色节点模型。
type Node struct {
	// ID 表示角色关系图节点主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:角色关系图节点主键ID" example:"1"`
	// GraphID 表示所属角色关系图 ID。
	GraphID uint64 `json:"graph_id" gorm:"column:graph_id;not null;index:idx_relationship_nodes_graph_id;comment:所属角色关系图ID" example:"1"`
	// Graph 表示所属角色关系图关联，用于生成外键和级联删除约束。
	Graph Graph `json:"-" gorm:"foreignKey:GraphID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属角色关系图关联"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;uniqueIndex:idx_relationship_nodes_novel_character,priority:1;index:idx_relationship_nodes_novel_id;comment:所属小说ID" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// CharacterID 表示画布节点引用的角色卡 ID。
	CharacterID uint64 `json:"character_id" gorm:"column:character_id;not null;uniqueIndex:idx_relationship_nodes_novel_character,priority:2;comment:画布节点引用的角色卡ID" example:"1"`
	// Character 表示画布节点引用的角色卡关联。
	Character bizcharacter.Character `json:"-" gorm:"foreignKey:CharacterID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:画布节点引用的角色卡关联"`
	// PositionX 表示节点在画布中的 X 坐标。
	PositionX float64 `json:"position_x" gorm:"column:position_x;not null;default:0;comment:节点在画布中的X坐标" example:"120"`
	// PositionY 表示节点在画布中的 Y 坐标。
	PositionY float64 `json:"position_y" gorm:"column:position_y;not null;default:0;comment:节点在画布中的Y坐标" example:"80"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-15T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-15T10:00:00+08:00"`
}

// TableName 返回角色关系图节点表名称。
func (Node) TableName() string {
	return "novel_relationship_graph_nodes"
}

// Edge 表示角色关系图中的无方向关系线模型。
type Edge struct {
	// ID 表示角色关系图关系线主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:角色关系图关系线主键ID" example:"1"`
	// GraphID 表示所属角色关系图 ID。
	GraphID uint64 `json:"graph_id" gorm:"column:graph_id;not null;index:idx_relationship_edges_graph_id;comment:所属角色关系图ID" example:"1"`
	// Graph 表示所属角色关系图关联，用于生成外键和级联删除约束。
	Graph Graph `json:"-" gorm:"foreignKey:GraphID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属角色关系图关联"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;uniqueIndex:idx_relationship_edges_novel_pair,priority:1;index:idx_relationship_edges_novel_id;comment:所属小说ID" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// CharacterAID 表示无方向关系线中较小的角色卡 ID。
	CharacterAID uint64 `json:"character_a_id" gorm:"column:character_a_id;not null;uniqueIndex:idx_relationship_edges_novel_pair,priority:2;comment:无方向关系线中较小的角色卡ID" example:"1"`
	// CharacterA 表示无方向关系线中较小角色卡关联。
	CharacterA bizcharacter.Character `json:"-" gorm:"foreignKey:CharacterAID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:无方向关系线中较小角色卡关联"`
	// CharacterBID 表示无方向关系线中较大的角色卡 ID。
	CharacterBID uint64 `json:"character_b_id" gorm:"column:character_b_id;not null;uniqueIndex:idx_relationship_edges_novel_pair,priority:3;comment:无方向关系线中较大的角色卡ID" example:"2"`
	// CharacterB 表示无方向关系线中较大角色卡关联。
	CharacterB bizcharacter.Character `json:"-" gorm:"foreignKey:CharacterBID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:无方向关系线中较大角色卡关联"`
	// Note 表示关系线备注，用于描述两个角色之间的关系。
	Note string `json:"note" gorm:"column:note;type:text;comment:关系线备注，用于描述两个角色之间的关系" example:"旧友"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-15T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-15T10:00:00+08:00"`
}

// TableName 返回角色关系图关系线表名称。
func (Edge) TableName() string {
	return "novel_relationship_graph_edges"
}

// Viewport 表示关系图画布视口。
type Viewport struct {
	// X 表示画布视口 X 坐标。
	X float64 `json:"x" example:"0"`
	// Y 表示画布视口 Y 坐标。
	Y float64 `json:"y" example:"0"`
	// Zoom 表示画布视口缩放比例。
	Zoom float64 `json:"zoom" example:"1"`
}

// NodeRequest 表示保存关系图时提交的角色节点。
type NodeRequest struct {
	// CharacterID 表示画布节点引用的角色卡 ID。
	CharacterID uint64 `json:"character_id" binding:"required" example:"1"`
	// PositionX 表示节点在画布中的 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示节点在画布中的 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
}

// EdgeRequest 表示保存关系图时提交的无方向关系线。
type EdgeRequest struct {
	// ID 表示前端关系线 ID，后端会按角色对重新计算。
	ID string `json:"id" example:"rel-1-2"`
	// CharacterAID 表示关系线一端的角色卡 ID。
	CharacterAID uint64 `json:"character_a_id" binding:"required" example:"1"`
	// CharacterBID 表示关系线另一端的角色卡 ID。
	CharacterBID uint64 `json:"character_b_id" binding:"required" example:"2"`
	// Note 表示关系线备注，用于描述两个角色之间的关系。
	Note string `json:"note" example:"旧友"`
}

// SaveRequest 表示保存整张角色关系图的请求参数。
type SaveRequest struct {
	// Viewport 表示画布视口。
	Viewport Viewport `json:"viewport"`
	// Nodes 表示当前画布中的角色节点列表。
	Nodes []NodeRequest `json:"nodes"`
	// Edges 表示当前画布中的无方向关系线列表。
	Edges []EdgeRequest `json:"edges"`
}

// NodeResponse 表示关系图返回给前端的角色节点。
type NodeResponse struct {
	// CharacterID 表示画布节点引用的角色卡 ID。
	CharacterID uint64 `json:"character_id" example:"1"`
	// PositionX 表示节点在画布中的 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示节点在画布中的 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
}

// EdgeResponse 表示关系图返回给前端的无方向关系线。
type EdgeResponse struct {
	// ID 表示关系线稳定 ID，由两个角色 ID 计算得到。
	ID string `json:"id" example:"rel-1-2"`
	// CharacterAID 表示无方向关系线中较小的角色卡 ID。
	CharacterAID uint64 `json:"character_a_id" example:"1"`
	// CharacterBID 表示无方向关系线中较大的角色卡 ID。
	CharacterBID uint64 `json:"character_b_id" example:"2"`
	// Note 表示关系线备注，用于描述两个角色之间的关系。
	Note string `json:"note" example:"旧友"`
}

// GraphResponse 表示角色关系图接口响应数据。
type GraphResponse struct {
	// NovelID 表示小说主键 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Viewport 表示画布视口。
	Viewport Viewport `json:"viewport"`
	// Nodes 表示当前画布中的角色节点列表。
	Nodes []NodeResponse `json:"nodes"`
	// Edges 表示当前画布中的无方向关系线列表。
	Edges []EdgeResponse `json:"edges"`
	// UpdatedAt 表示关系图最后更新时间；关系图尚未保存时为空。
	UpdatedAt *time.Time `json:"updated_at" example:"2026-06-15T10:00:00+08:00"`
}

// EdgeID 根据无方向角色对生成稳定关系线 ID。
// 参数 characterAID 表示关系线一端角色卡 ID；参数 characterBID 表示关系线另一端角色卡 ID。
func EdgeID(characterAID uint64, characterBID uint64) string {
	a, b := normalizePair(characterAID, characterBID)
	return fmt.Sprintf("rel-%d-%d", a, b)
}
