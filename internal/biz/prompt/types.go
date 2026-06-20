package prompt

import "time"

// Prompt 表示 AI 提示词数据库模型。
type Prompt struct {
	// ID 表示提示词主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:提示词主键ID" example:"1"`
	// PromptType 表示提示词类型，必须存在于配置文件 ai.prompt_types 中。
	PromptType string `json:"prompt_type" gorm:"column:prompt_type;type:varchar(255);not null;index:idx_ai_prompts_prompt_type;comment:提示词类型，必须存在于配置文件ai.prompt_types中" example:"润色"`
	// Description 表示提示词简介，可以为空。
	Description string `json:"description" gorm:"column:description;type:text;comment:提示词简介，可以为空" example:"用于让章节语言更细腻。"`
	// Content 表示提示词正文，不能为空。
	Content string `json:"content" gorm:"column:content;type:text;not null;comment:提示词正文，不能为空" example:"请在保持剧情不变的前提下润色以下正文。"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-20T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;index:idx_ai_prompts_updated_at;comment:更新时间" example:"2026-06-20T12:00:00+08:00"`
}

// TableName 返回提示词模型对应的数据表名称。
func (Prompt) TableName() string {
	return "ai_prompts"
}

// TypeRequest 表示创建或修改提示词类型的请求参数。
type TypeRequest struct {
	// Name 表示提示词类型名称。
	Name string `json:"name" binding:"required" example:"润色"`
}

// CreateRequest 表示创建提示词请求参数。
type CreateRequest struct {
	// Content 表示提示词正文，trim 后不能为空。
	Content string `json:"content" binding:"required" example:"请在保持剧情不变的前提下润色以下正文。"`
	// PromptType 表示提示词类型，必须存在于配置文件 ai.prompt_types 中。
	PromptType string `json:"prompt_type" binding:"required" example:"润色"`
	// Description 表示提示词简介，可以为空。
	Description string `json:"description" example:"用于让章节语言更细腻。"`
}

// UpdateRequest 表示更新提示词请求参数。
type UpdateRequest struct {
	// Content 表示提示词正文，trim 后不能为空。
	Content string `json:"content" binding:"required" example:"请在保持剧情不变的前提下润色以下正文。"`
	// PromptType 表示提示词类型，必须存在于配置文件 ai.prompt_types 中。
	PromptType string `json:"prompt_type" binding:"required" example:"润色"`
	// Description 表示提示词简介，可以为空。
	Description string `json:"description" example:"用于让章节语言更细腻。"`
}

// ListRequest 表示提示词分页查询参数。
type ListRequest struct {
	// Page 表示当前页码，从 1 开始。
	Page int `form:"page" example:"1"`
	// PageSize 表示每页数量，最大为 100。
	PageSize int `form:"page_size" example:"20"`
	// PromptType 表示按提示词类型筛选，可以为空。
	PromptType string `form:"prompt_type" example:"润色"`
}

// RecommendationListRequest 表示提示词推荐列表查询参数。
type RecommendationListRequest struct {
	// PromptType 表示需要推荐的提示词类型，必须存在于配置文件 ai.prompt_types 中。
	PromptType string `form:"prompt_type" binding:"required" example:"润色"`
	// PageSize 表示推荐返回数量，最大为 100。
	PageSize int `form:"page_size" example:"10"`
}

// PromptResponse 表示提示词详情响应数据。
type PromptResponse struct {
	// ID 表示提示词主键 ID。
	ID uint64 `json:"id" example:"1"`
	// PromptType 表示提示词类型。
	PromptType string `json:"prompt_type" example:"润色"`
	// Description 表示提示词简介。
	Description string `json:"description" example:"用于让章节语言更细腻。"`
	// Content 表示提示词正文。
	Content string `json:"content" example:"请在保持剧情不变的前提下润色以下正文。"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-20T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-20T12:00:00+08:00"`
}

// PromptSummaryResponse 表示提示词分页列表中的摘要响应数据。
type PromptSummaryResponse struct {
	// ID 表示提示词主键 ID。
	ID uint64 `json:"id" example:"1"`
	// PromptType 表示提示词类型。
	PromptType string `json:"prompt_type" example:"润色"`
	// Description 表示提示词简介。
	Description string `json:"description" example:"用于让章节语言更细腻。"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-20T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-20T12:00:00+08:00"`
}

// ListResponse 表示提示词分页列表响应数据。
type ListResponse struct {
	// Items 表示当前页提示词摘要列表。
	Items []PromptSummaryResponse `json:"items"`
	// Total 表示符合条件的提示词总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}

// RecommendationListResponse 表示提示词推荐列表响应数据。
type RecommendationListResponse struct {
	// Items 表示推荐提示词列表，包含提示词正文。
	Items []PromptResponse `json:"items"`
	// Total 表示符合条件的提示词总数。
	Total int64 `json:"total" example:"1"`
	// PageSize 表示本次推荐查询数量。
	PageSize int `json:"page_size" example:"10"`
}

// DeleteResponse 表示删除提示词后的响应数据。
type DeleteResponse struct {
	// Deleted 表示是否已经删除提示词。
	Deleted bool `json:"deleted" example:"true"`
}
