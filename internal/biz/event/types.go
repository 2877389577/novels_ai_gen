package event

import (
	"fmt"
	"time"

	bizcharacter "novels_ai_gen/internal/biz/character"
	biznovel "novels_ai_gen/internal/biz/novel"
)

// EventGraph 表示小说事件图视口数据库模型。
type EventGraph struct {
	// ID 表示事件图主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:事件图主键ID" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;uniqueIndex:idx_event_graphs_novel_id;comment:所属小说ID" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// ViewportX 表示事件图画布视口 X 坐标。
	ViewportX float64 `json:"viewport_x" gorm:"column:viewport_x;not null;default:0;comment:事件图画布视口X坐标" example:"0"`
	// ViewportY 表示事件图画布视口 Y 坐标。
	ViewportY float64 `json:"viewport_y" gorm:"column:viewport_y;not null;default:0;comment:事件图画布视口Y坐标" example:"0"`
	// ViewportZoom 表示事件图画布视口缩放比例。
	ViewportZoom float64 `json:"viewport_zoom" gorm:"column:viewport_zoom;not null;default:1;comment:事件图画布视口缩放比例" example:"1"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-16T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-16T10:00:00+08:00"`
}

// TableName 返回事件图视口模型对应的数据表名称。
func (EventGraph) TableName() string {
	return "novel_event_graphs"
}

// Event 表示小说事件数据库模型。
type Event struct {
	// ID 表示事件主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:事件主键ID" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;index:idx_novel_events_novel_id;comment:所属小说ID" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// Name 表示事件名称，不能为空。
	Name string `json:"name" gorm:"column:name;type:varchar(255);not null;comment:事件名称，不能为空" example:"寒桥之战"`
	// Cause 表示事件起因，可以为空。
	Cause string `json:"cause" gorm:"column:cause;type:text;comment:事件起因，可以为空" example:"北境雪灾导致民怨沸腾。"`
	// Process 表示事件经过，可以为空。
	Process string `json:"process" gorm:"column:process;type:text;comment:事件经过，可以为空" example:"林霜夜率三百死士奇袭寒霜桥。"`
	// Result 表示事件结果，可以为空。
	Result string `json:"result" gorm:"column:result;type:text;comment:事件结果，可以为空" example:"守将阵亡，寒霜桥易主。"`
	// Impact 表示事件造成的影响，可以为空。
	Impact string `json:"impact" gorm:"column:impact;type:text;comment:事件造成的影响，可以为空" example:"天下大乱的序幕被拉开。"`
	// Location 表示事件发生地点，可以为空。
	Location string `json:"location" gorm:"column:location;type:varchar(255);comment:事件发生地点，可以为空" example:"北境·寒霜桥"`
	// PositionX 表示事件节点在画布中的 X 坐标。
	PositionX float64 `json:"position_x" gorm:"column:position_x;not null;default:0;comment:事件节点在画布中的X坐标" example:"120"`
	// PositionY 表示事件节点在画布中的 Y 坐标。
	PositionY float64 `json:"position_y" gorm:"column:position_y;not null;default:0;comment:事件节点在画布中的Y坐标" example:"80"`
	// Participants 表示事件参与者关联列表。
	Participants []Participant `json:"-" gorm:"foreignKey:EventID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:事件参与者关联列表"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-16T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-16T10:00:00+08:00"`
}

// TableName 返回事件模型对应的数据表名称。
func (Event) TableName() string {
	return "novel_events"
}

// Participant 表示小说事件参与者数据库模型。
type Participant struct {
	// ID 表示事件参与者记录主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:事件参与者记录主键ID" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;index:idx_event_participants_novel_id;comment:所属小说ID" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// EventID 表示所属事件 ID。
	EventID uint64 `json:"event_id" gorm:"column:event_id;not null;uniqueIndex:idx_event_participants_event_character,priority:1;index:idx_event_participants_event_id;comment:所属事件ID" example:"1"`
	// Event 表示所属事件关联，用于生成外键和级联删除约束。
	Event Event `json:"-" gorm:"foreignKey:EventID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属事件关联"`
	// CharacterID 表示参与事件的角色卡 ID。
	CharacterID uint64 `json:"character_id" gorm:"column:character_id;not null;uniqueIndex:idx_event_participants_event_character,priority:2;index:idx_event_participants_character_id;comment:参与事件的角色卡ID" example:"1"`
	// Character 表示参与事件的角色卡关联。
	Character bizcharacter.Character `json:"-" gorm:"foreignKey:CharacterID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:参与事件的角色卡关联"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-16T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-16T10:00:00+08:00"`
}

// TableName 返回事件参与者模型对应的数据表名称。
func (Participant) TableName() string {
	return "novel_event_participants"
}

// Relation 表示小说事件之间的有向关系线数据库模型。
type Relation struct {
	// ID 表示事件关系线主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:事件关系线主键ID" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;uniqueIndex:idx_event_relations_novel_pair,priority:1;index:idx_event_relations_novel_id;comment:所属小说ID" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// SourceEventID 表示关系线起点事件 ID。
	SourceEventID uint64 `json:"source_event_id" gorm:"column:source_event_id;not null;uniqueIndex:idx_event_relations_novel_pair,priority:2;index:idx_event_relations_source_id;comment:关系线起点事件ID" example:"1"`
	// SourceEvent 表示关系线起点事件关联。
	SourceEvent Event `json:"-" gorm:"foreignKey:SourceEventID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:关系线起点事件关联"`
	// TargetEventID 表示关系线终点事件 ID。
	TargetEventID uint64 `json:"target_event_id" gorm:"column:target_event_id;not null;uniqueIndex:idx_event_relations_novel_pair,priority:3;index:idx_event_relations_target_id;comment:关系线终点事件ID" example:"2"`
	// TargetEvent 表示关系线终点事件关联。
	TargetEvent Event `json:"-" gorm:"foreignKey:TargetEventID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:关系线终点事件关联"`
	// Note 表示事件关系线备注，可以为空。
	Note string `json:"note" gorm:"column:note;type:text;comment:事件关系线备注，可以为空" example:"直接导致"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-16T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-16T10:00:00+08:00"`
}

// TableName 返回事件关系线模型对应的数据表名称。
func (Relation) TableName() string {
	return "novel_event_relations"
}

// Viewport 表示事件图画布视口。
type Viewport struct {
	// X 表示画布视口 X 坐标。
	X float64 `json:"x" example:"0"`
	// Y 表示画布视口 Y 坐标。
	Y float64 `json:"y" example:"0"`
	// Zoom 表示画布视口缩放比例。
	Zoom float64 `json:"zoom" example:"1"`
}

// CreateRequest 表示创建小说事件请求参数。
type CreateRequest struct {
	// Name 表示事件名称，不能为空。
	Name string `json:"name" binding:"required" example:"寒桥之战"`
	// Cause 表示事件起因，可以为空。
	Cause string `json:"cause" example:"北境雪灾导致民怨沸腾。"`
	// Process 表示事件经过，可以为空。
	Process string `json:"process" example:"林霜夜率三百死士奇袭寒霜桥。"`
	// Result 表示事件结果，可以为空。
	Result string `json:"result" example:"守将阵亡，寒霜桥易主。"`
	// Impact 表示事件造成的影响，可以为空。
	Impact string `json:"impact" example:"天下大乱的序幕被拉开。"`
	// Location 表示事件发生地点，可以为空。
	Location string `json:"location" example:"北境·寒霜桥"`
	// ParticipantIDs 表示参与该事件的角色卡 ID 列表。
	ParticipantIDs []uint64 `json:"participant_ids" example:"1,2"`
	// PositionX 表示事件节点初始画布 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示事件节点初始画布 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
}

// UpdateRequest 表示更新小说事件请求参数。
type UpdateRequest struct {
	// Name 表示事件名称，不能为空。
	Name string `json:"name" binding:"required" example:"寒桥之战"`
	// Cause 表示事件起因，可以为空。
	Cause string `json:"cause" example:"北境雪灾导致民怨沸腾。"`
	// Process 表示事件经过，可以为空。
	Process string `json:"process" example:"林霜夜率三百死士奇袭寒霜桥。"`
	// Result 表示事件结果，可以为空。
	Result string `json:"result" example:"守将阵亡，寒霜桥易主。"`
	// Impact 表示事件造成的影响，可以为空。
	Impact string `json:"impact" example:"天下大乱的序幕被拉开。"`
	// Location 表示事件发生地点，可以为空。
	Location string `json:"location" example:"北境·寒霜桥"`
	// ParticipantIDs 表示参与该事件的角色卡 ID 列表。
	ParticipantIDs []uint64 `json:"participant_ids" example:"1,2"`
	// PositionX 表示事件节点画布 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示事件节点画布 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
}

// ListRequest 表示事件列表查询参数。
type ListRequest struct {
	// Page 表示当前页码，从 1 开始。
	Page int `form:"page" example:"1"`
	// PageSize 表示每页数量，最大为 100。
	PageSize int `form:"page_size" example:"20"`
}

// LayoutNodeRequest 表示保存事件图布局时提交的事件节点坐标。
type LayoutNodeRequest struct {
	// EventID 表示需要保存坐标的事件 ID。
	EventID uint64 `json:"event_id" binding:"required" example:"1"`
	// PositionX 表示节点在画布中的 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示节点在画布中的 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
}

// LayoutRequest 表示保存事件图布局请求参数。
type LayoutRequest struct {
	// Viewport 表示事件图画布视口。
	Viewport Viewport `json:"viewport"`
	// Nodes 表示需要保存坐标的事件节点列表。
	Nodes []LayoutNodeRequest `json:"nodes"`
}

// RelationCreateRequest 表示创建事件关系线请求参数。
type RelationCreateRequest struct {
	// SourceEventID 表示前置事件 ID。
	SourceEventID uint64 `json:"source_event_id" binding:"required" example:"1"`
	// TargetEventID 表示后续事件 ID。
	TargetEventID uint64 `json:"target_event_id" binding:"required" example:"2"`
	// Note 表示关系线备注，可以为空。
	Note string `json:"note" example:"直接导致"`
}

// RelationUpdateRequest 表示更新事件关系线请求参数。
type RelationUpdateRequest struct {
	// Note 表示关系线备注，可以为空。
	Note string `json:"note" example:"直接导致"`
}

// ParticipantResponse 表示事件详情中的参与者摘要。
type ParticipantResponse struct {
	// ID 表示角色卡主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Name 表示角色姓名。
	Name string `json:"name" example:"林霜夜"`
	// Gender 表示角色性别。
	Gender string `json:"gender" example:"男"`
	// Tags 表示角色标签，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
}

// EventResponse 表示小说事件详情响应数据。
type EventResponse struct {
	// ID 表示事件主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Name 表示事件名称。
	Name string `json:"name" example:"寒桥之战"`
	// Cause 表示事件起因。
	Cause string `json:"cause" example:"北境雪灾导致民怨沸腾。"`
	// Process 表示事件经过。
	Process string `json:"process" example:"林霜夜率三百死士奇袭寒霜桥。"`
	// Result 表示事件结果。
	Result string `json:"result" example:"守将阵亡，寒霜桥易主。"`
	// Impact 表示事件造成的影响。
	Impact string `json:"impact" example:"天下大乱的序幕被拉开。"`
	// Location 表示事件发生地点。
	Location string `json:"location" example:"北境·寒霜桥"`
	// PositionX 表示事件节点在画布中的 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示事件节点在画布中的 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
	// Participants 表示参与该事件的角色卡摘要列表。
	Participants []ParticipantResponse `json:"participants"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-16T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-16T10:00:00+08:00"`
}

// ListResponse 表示事件分页列表响应数据。
type ListResponse struct {
	// Items 表示当前页事件列表。
	Items []EventResponse `json:"items"`
	// Total 表示符合条件的事件总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}

// RelationResponse 表示事件关系线响应数据。
type RelationResponse struct {
	// ID 表示事件关系线主键 ID。
	ID uint64 `json:"id" example:"1"`
	// SourceEventID 表示前置事件 ID。
	SourceEventID uint64 `json:"source_event_id" example:"1"`
	// TargetEventID 表示后续事件 ID。
	TargetEventID uint64 `json:"target_event_id" example:"2"`
	// Note 表示事件关系线备注。
	Note string `json:"note" example:"直接导致"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-16T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-16T10:00:00+08:00"`
}

// GraphResponse 表示事件图完整响应数据。
type GraphResponse struct {
	// NovelID 表示小说主键 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Viewport 表示事件图画布视口。
	Viewport Viewport `json:"viewport"`
	// Nodes 表示事件图中的事件节点列表。
	Nodes []EventResponse `json:"nodes"`
	// Edges 表示事件图中的有向关系线列表。
	Edges []RelationResponse `json:"edges"`
	// UpdatedAt 表示事件图布局最后更新时间，尚未保存时为空。
	UpdatedAt *time.Time `json:"updated_at" example:"2026-06-16T10:00:00+08:00"`
}

// DeleteResponse 表示删除事件后的响应数据。
type DeleteResponse struct {
	// Deleted 表示后端是否已经删除该事件。
	Deleted bool `json:"deleted" example:"true"`
	// DeletedRelationCount 表示随事件一并删除的关系线数量。
	DeletedRelationCount int64 `json:"deleted_relation_count" example:"2"`
}

// RelationID 根据有向事件对生成前端可用的稳定关系线 ID。
// 参数 sourceEventID 表示关系线起点事件 ID；参数 targetEventID 表示关系线终点事件 ID。
func RelationID(sourceEventID uint64, targetEventID uint64) string {
	return fmt.Sprintf("event-rel-%d-%d", sourceEventID, targetEventID)
}
