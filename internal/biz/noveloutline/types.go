package noveloutline

import (
	"time"

	biznovel "novels_ai_gen/internal/biz/novel"
)

// NovelOutline 表示小说大纲数据库模型。
type NovelOutline struct {
	// ID 表示小说大纲主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:小说大纲主键ID" example:"1"`
	// NovelID 表示大纲所属小说 ID，一部小说只保留一份大纲。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;uniqueIndex:idx_novel_outlines_novel_id;comment:大纲所属小说ID，一部小说只保留一份大纲" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// Content 表示小说大纲正文，允许为空字符串。
	Content string `json:"content" gorm:"column:content;type:text;not null;comment:小说大纲正文，允许为空字符串" example:"第一卷：主角离开边城，踏入王都。"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-21T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-21T12:00:00+08:00"`
}

// TableName 返回小说大纲模型对应的数据表名称。
func (NovelOutline) TableName() string {
	return "novel_outlines"
}

// SaveRequest 表示创建或更新小说大纲的请求参数。
type SaveRequest struct {
	// Content 表示需要保存的小说大纲正文，允许为空字符串。
	Content string `json:"content" example:"第一卷：主角离开边城，踏入王都。"`
}

// NovelOutlineResponse 表示小说大纲响应数据。
type NovelOutlineResponse struct {
	// ID 表示小说大纲主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示大纲所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Content 表示小说大纲正文。
	Content string `json:"content" example:"第一卷：主角离开边城，踏入王都。"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-21T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-21T12:00:00+08:00"`
}

// DeleteResponse 表示删除小说大纲后的响应数据。
type DeleteResponse struct {
	// Deleted 表示是否已经删除小说大纲。
	Deleted bool `json:"deleted" example:"true"`
}
