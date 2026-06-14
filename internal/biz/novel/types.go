package novel

import "time"

// Novel 表示小说数据库模型。
type Novel struct {
	// ID 表示小说主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:小说主键ID" example:"1"`
	// Name 表示小说名，不能为空。
	Name string `json:"name" gorm:"column:name;not null;comment:小说名，不能为空" example:"长夜余火"`
	// AuthorName 表示作者名，可以为空。
	AuthorName string `json:"author_name" gorm:"column:author_name;comment:作者名，可以为空" example:"爱潜水的乌贼"`
	// Description 表示简介，可以为空。
	Description string `json:"description" gorm:"column:description;comment:简介，可以为空" example:"一部关于废土冒险的小说"`
	// Tags 表示标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" gorm:"column:tags;comment:标签，可以为空，多个标签使用英文逗号分隔" example:"玄幻,冒险"`
	// CoverURL 表示封面链接，可以为空。
	CoverURL string `json:"cover_url" gorm:"column:cover_url;comment:封面链接，可以为空" example:"https://example.com/cover.jpg"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-13T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-13T22:00:00+08:00"`
}

// TableName 返回小说模型对应的数据表名称。
func (Novel) TableName() string {
	return "novels"
}

// CreateRequest 表示创建小说请求参数。
type CreateRequest struct {
	// Name 表示小说名，不能为空。
	Name string `json:"name" binding:"required" example:"长夜余火"`
	// AuthorName 表示作者名，可以为空。
	AuthorName string `json:"author_name" example:"爱潜水的乌贼"`
	// Description 表示简介，可以为空。
	Description string `json:"description" example:"一部关于废土冒险的小说"`
	// Tags 表示标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"玄幻,冒险"`
	// CoverURL 表示封面链接，可以为空。
	CoverURL string `json:"cover_url" example:"https://example.com/cover.jpg"`
}

// UpdateRequest 表示更新小说请求参数。
type UpdateRequest struct {
	// Name 表示小说名，不能为空。
	Name string `json:"name" binding:"required" example:"长夜余火"`
	// AuthorName 表示作者名，可以为空。
	AuthorName string `json:"author_name" example:"爱潜水的乌贼"`
	// Description 表示简介，可以为空。
	Description string `json:"description" example:"一部关于废土冒险的小说"`
	// Tags 表示标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"玄幻,冒险"`
	// CoverURL 表示封面链接，可以为空。
	CoverURL string `json:"cover_url" example:"https://example.com/cover.jpg"`
}

// ListRequest 表示小说列表查询参数。
type ListRequest struct {
	// Page 表示当前页码，从 1 开始。
	Page int `form:"page" example:"1"`
	// PageSize 表示每页数量，最大为 100。
	PageSize int `form:"page_size" example:"20"`
}

// NovelResponse 表示小说响应数据。
type NovelResponse struct {
	// ID 表示小说主键 ID。
	ID uint64 `json:"id" example:"1"`
	// Name 表示小说名。
	Name string `json:"name" example:"长夜余火"`
	// AuthorName 表示作者名。
	AuthorName string `json:"author_name" example:"爱潜水的乌贼"`
	// Description 表示简介。
	Description string `json:"description" example:"一部关于废土冒险的小说"`
	// Tags 表示标签，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"玄幻,冒险"`
	// CoverURL 表示封面链接。
	CoverURL string `json:"cover_url" example:"https://example.com/cover.jpg"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-13T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-13T22:00:00+08:00"`
}

// ListResponse 表示小说分页列表响应数据。
type ListResponse struct {
	// Items 表示当前页小说列表。
	Items []NovelResponse `json:"items"`
	// Total 表示符合条件的小说总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}
