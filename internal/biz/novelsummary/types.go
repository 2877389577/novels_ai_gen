package novelsummary

import (
	"time"

	biznovel "novels_ai_gen/internal/biz/novel"
)

// NovelSummary 表示小说滚动总结数据库模型。
type NovelSummary struct {
	// ID 表示小说总结主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:小说总结主键ID" example:"1"`
	// NovelID 表示总结所属小说 ID，一部小说只保留一条滚动总结。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;uniqueIndex:idx_novel_summaries_novel_id;comment:总结所属小说ID，一部小说只保留一条滚动总结" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// Content 表示小说滚动剧情总结内容，允许为空字符串。
	Content string `json:"content" gorm:"column:content;type:text;not null;comment:小说滚动剧情总结内容，允许为空字符串" example:"主角在废土城市发现旧时代遗迹，团队关系逐渐成形。"`
	// StartChapterNumber 表示当前总结覆盖的起始章节号，0 表示未知或未记录。
	StartChapterNumber int `json:"start_chapter_number" gorm:"column:start_chapter_number;not null;default:0;comment:小说总结覆盖的起始章节号，0表示未知或未记录" example:"1"`
	// EndChapterNumber 表示当前总结覆盖的结束章节号，0 表示未知或未记录。
	EndChapterNumber int `json:"end_chapter_number" gorm:"column:end_chapter_number;not null;default:0;comment:小说总结覆盖的结束章节号，0表示未知或未记录" example:"100"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-21T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-21T12:00:00+08:00"`
}

// TableName 返回小说滚动总结模型对应的数据表名称。
func (NovelSummary) TableName() string {
	return "novel_summaries"
}

// SaveRequest 表示创建或更新小说滚动总结的请求参数。
type SaveRequest struct {
	// Content 表示需要保存的小说滚动剧情总结内容，允许为空字符串。
	Content string `json:"content" example:"主角在废土城市发现旧时代遗迹，团队关系逐渐成形。"`
	// StartChapterNumber 表示当前总结覆盖的起始章节号，0 表示未知或未记录。
	StartChapterNumber int `json:"start_chapter_number" example:"1"`
	// EndChapterNumber 表示当前总结覆盖的结束章节号，0 表示未知或未记录。
	EndChapterNumber int `json:"end_chapter_number" example:"100"`
}

// NovelSummaryResponse 表示小说滚动总结响应数据。
type NovelSummaryResponse struct {
	// ID 表示小说总结主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示总结所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Content 表示小说滚动剧情总结内容。
	Content string `json:"content" example:"主角在废土城市发现旧时代遗迹，团队关系逐渐成形。"`
	// StartChapterNumber 表示当前总结覆盖的起始章节号，0 表示未知或未记录。
	StartChapterNumber int `json:"start_chapter_number" example:"1"`
	// EndChapterNumber 表示当前总结覆盖的结束章节号，0 表示未知或未记录。
	EndChapterNumber int `json:"end_chapter_number" example:"100"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-21T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-21T12:00:00+08:00"`
}

// DeleteResponse 表示删除小说滚动总结后的响应数据。
type DeleteResponse struct {
	// Deleted 表示是否已经删除小说滚动总结。
	Deleted bool `json:"deleted" example:"true"`
}
