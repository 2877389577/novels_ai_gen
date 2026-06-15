package character

import (
	"time"

	biznovel "novels_ai_gen/internal/biz/novel"
)

// Character 表示小说角色卡数据库模型。
type Character struct {
	// ID 表示角色卡主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:角色卡主键ID" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;index:idx_novel_characters_novel_id;comment:所属小说ID" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// PortraitURL 表示肖像图链接或对象存储 key，可以为空。
	PortraitURL string `json:"portrait_url" gorm:"column:portrait_url;type:varchar(1000);comment:肖像图链接或对象存储key，可以为空" example:"covers/character-a.webp"`
	// Name 表示角色姓名，不能为空。
	Name string `json:"name" gorm:"column:name;type:varchar(255);not null;comment:角色姓名，不能为空" example:"林知夏"`
	// Gender 表示角色性别，可以为空。
	Gender string `json:"gender" gorm:"column:gender;type:varchar(64);comment:角色性别，可以为空" example:"女"`
	// Tags 表示角色标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" gorm:"column:tags;type:varchar(1000);comment:角色标签，可以为空，多个标签使用英文逗号分隔" example:"主角,剑修"`
	// Background 表示角色背景，可以为空。
	Background string `json:"background" gorm:"column:background;type:text;comment:角色背景，可以为空" example:"出身边城旧族。"`
	// Personality 表示角色性格，可以为空。
	Personality string `json:"personality" gorm:"column:personality;type:text;comment:角色性格，可以为空" example:"冷静克制，重诺。"`
	// Ability 表示角色能力，可以为空。
	Ability string `json:"ability" gorm:"column:ability;type:text;comment:角色能力，可以为空" example:"擅长御剑与阵法。"`
	// Goal 表示角色目的，可以为空。
	Goal string `json:"goal" gorm:"column:goal;type:text;comment:角色目的，可以为空" example:"寻找失踪的兄长。"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-14T22:00:00+08:00"`
}

// TableName 返回角色卡模型对应的数据表名称。
func (Character) TableName() string {
	return "novel_characters"
}

// CreateRequest 表示创建角色卡请求参数。
type CreateRequest struct {
	// PortraitURL 表示肖像图链接或对象存储 key，可以为空。
	PortraitURL string `json:"portrait_url" example:"covers/character-a.webp"`
	// Name 表示角色姓名，不能为空。
	Name string `json:"name" binding:"required" example:"林知夏"`
	// Gender 表示角色性别，可以为空。
	Gender string `json:"gender" example:"女"`
	// Tags 表示角色标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
	// Background 表示角色背景，可以为空。
	Background string `json:"background" example:"出身边城旧族。"`
	// Personality 表示角色性格，可以为空。
	Personality string `json:"personality" example:"冷静克制，重诺。"`
	// Ability 表示角色能力，可以为空。
	Ability string `json:"ability" example:"擅长御剑与阵法。"`
	// Goal 表示角色目的，可以为空。
	Goal string `json:"goal" example:"寻找失踪的兄长。"`
}

// UpdateRequest 表示更新角色卡请求参数。
type UpdateRequest struct {
	// PortraitURL 表示肖像图链接或对象存储 key，可以为空。
	PortraitURL string `json:"portrait_url" example:"covers/character-a.webp"`
	// Name 表示角色姓名，不能为空。
	Name string `json:"name" binding:"required" example:"林知夏"`
	// Gender 表示角色性别，可以为空。
	Gender string `json:"gender" example:"女"`
	// Tags 表示角色标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
	// Background 表示角色背景，可以为空。
	Background string `json:"background" example:"出身边城旧族。"`
	// Personality 表示角色性格，可以为空。
	Personality string `json:"personality" example:"冷静克制，重诺。"`
	// Ability 表示角色能力，可以为空。
	Ability string `json:"ability" example:"擅长御剑与阵法。"`
	// Goal 表示角色目的，可以为空。
	Goal string `json:"goal" example:"寻找失踪的兄长。"`
}

// ListRequest 表示角色卡列表查询参数。
type ListRequest struct {
	// Page 表示当前页码，从 1 开始。
	Page int `form:"page" example:"1"`
	// PageSize 表示每页数量，最大为 100。
	PageSize int `form:"page_size" example:"20"`
}

// CharacterResponse 表示角色卡详情响应数据。
type CharacterResponse struct {
	// ID 表示角色卡主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// PortraitURL 表示肖像图链接或对象存储 key。
	PortraitURL string `json:"portrait_url" example:"covers/character-a.webp"`
	// Name 表示角色姓名。
	Name string `json:"name" example:"林知夏"`
	// Gender 表示角色性别。
	Gender string `json:"gender" example:"女"`
	// Tags 表示角色标签，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
	// Background 表示角色背景。
	Background string `json:"background" example:"出身边城旧族。"`
	// Personality 表示角色性格。
	Personality string `json:"personality" example:"冷静克制，重诺。"`
	// Ability 表示角色能力。
	Ability string `json:"ability" example:"擅长御剑与阵法。"`
	// Goal 表示角色目的。
	Goal string `json:"goal" example:"寻找失踪的兄长。"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-14T22:00:00+08:00"`
}

// CharacterSummaryResponse 表示角色卡列表中的摘要响应数据。
type CharacterSummaryResponse struct {
	// ID 表示角色卡主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// PortraitURL 表示肖像图链接或对象存储 key。
	PortraitURL string `json:"portrait_url" example:"covers/character-a.webp"`
	// Name 表示角色姓名。
	Name string `json:"name" example:"林知夏"`
	// Gender 表示角色性别。
	Gender string `json:"gender" example:"女"`
	// Tags 表示角色标签，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-14T22:00:00+08:00"`
}

// ListResponse 表示角色卡分页列表响应数据。
type ListResponse struct {
	// Items 表示当前页角色卡摘要列表。
	Items []CharacterSummaryResponse `json:"items"`
	// Total 表示符合条件的角色卡总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}
