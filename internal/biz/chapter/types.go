package chapter

import (
	"time"

	biznovel "novels_ai_gen/internal/biz/novel"
)

// Chapter 表示小说章节数据库模型。
type Chapter struct {
	// ID 表示章节主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:章节主键ID" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" gorm:"column:novel_id;not null;uniqueIndex:idx_novel_chapters_novel_number,priority:1;index:idx_novel_chapters_lookup,priority:1;comment:所属小说ID" example:"1"`
	// Novel 表示所属小说关联，用于生成外键和级联删除约束。
	Novel biznovel.Novel `json:"-" gorm:"foreignKey:NovelID;references:ID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;comment:所属小说关联"`
	// ChapterNumber 表示章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number" gorm:"column:chapter_number;not null;uniqueIndex:idx_novel_chapters_novel_number,priority:2;index:idx_novel_chapters_lookup,priority:2;comment:章节号，即第x章中的x" example:"1"`
	// Title 表示章节名，不能为空。
	Title string `json:"title" gorm:"column:title;type:varchar(255);not null;comment:章节名，不能为空" example:"初入长夜"`
	// Content 表示章节正文，可以为空。
	Content string `json:"content" gorm:"column:content;type:text;comment:章节正文，可以为空" example:"夜色像墨一样铺开。"`
	// WordCount 表示正文中非空白 Unicode 字符数量。
	WordCount int `json:"word_count" gorm:"column:word_count;not null;default:0;comment:正文中非空白Unicode字符数量" example:"8"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-14T22:00:00+08:00"`
}

// TableName 返回章节模型对应的数据表名称。
func (Chapter) TableName() string {
	return "novel_chapters"
}

// CreateRequest 表示创建章节请求参数。
type CreateRequest struct {
	// ChapterNumber 表示章节号，必须由客户端传入且大于 0。
	ChapterNumber int `json:"chapter_number" binding:"required" minimum:"1" example:"1"`
	// Title 表示章节名，不能为空。
	Title string `json:"title" binding:"required" example:"初入长夜"`
	// Content 表示章节正文，可以为空。
	Content string `json:"content" example:"夜色像墨一样铺开。"`
}

// UpdateRequest 表示更新章节请求参数。
type UpdateRequest struct {
	// Title 表示章节名，不能为空。
	Title string `json:"title" binding:"required" example:"初入长夜"`
	// Content 表示章节正文，可以为空。
	Content string `json:"content" example:"夜色像墨一样铺开。"`
}

// ListRequest 表示章节列表查询参数。
type ListRequest struct {
	// Page 表示当前页码，从 1 开始。
	Page int `form:"page" example:"1"`
	// PageSize 表示每页数量，最大为 100。
	PageSize int `form:"page_size" example:"20"`
}

// ChapterResponse 表示章节详情响应数据。
type ChapterResponse struct {
	// ID 表示章节主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// ChapterNumber 表示章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number" example:"1"`
	// Title 表示章节名。
	Title string `json:"title" example:"初入长夜"`
	// Content 表示章节正文。
	Content string `json:"content" example:"夜色像墨一样铺开。"`
	// WordCount 表示正文中非空白 Unicode 字符数量。
	WordCount int `json:"word_count" example:"8"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-14T22:00:00+08:00"`
}

// ChapterSummaryResponse 表示章节列表中的摘要响应数据，不包含正文。
type ChapterSummaryResponse struct {
	// ID 表示章节主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// ChapterNumber 表示章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number" example:"1"`
	// Title 表示章节名。
	Title string `json:"title" example:"初入长夜"`
	// WordCount 表示正文中非空白 Unicode 字符数量。
	WordCount int `json:"word_count" example:"8"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-14T22:00:00+08:00"`
}

// ListResponse 表示章节分页列表响应数据。
type ListResponse struct {
	// Items 表示当前页章节摘要列表。
	Items []ChapterSummaryResponse `json:"items"`
	// Total 表示符合条件的章节总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}

// NextChapterNumberResponse 表示下一章节号查询响应数据。
type NextChapterNumberResponse struct {
	// NovelID 表示小说主键 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// NextChapterNumber 表示建议创建下一章时使用的章节号。
	NextChapterNumber int `json:"next_chapter_number" example:"2"`
}

// WordCountResponse 表示小说总字数响应数据。
type WordCountResponse struct {
	// NovelID 表示小说主键 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// WordCount 表示小说所有章节累计后的正文非空白字符数量。
	WordCount int64 `json:"word_count" example:"12345"`
}
