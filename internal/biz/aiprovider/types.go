package aiprovider

import "time"

// Provider 表示 AI 提供商数据库模型。
type Provider struct {
	// ID 表示 AI 提供商主键 ID。
	ID uint64 `json:"id" gorm:"column:id;primaryKey;autoIncrement;comment:AI提供商主键ID" example:"1"`
	// Name 表示 AI 提供商名称，不能为空且唯一。
	Name string `json:"name" gorm:"column:name;type:varchar(255);not null;uniqueIndex:ux_ai_providers_name;comment:AI提供商名称，不能为空且唯一" example:"默认 OpenAI"`
	// ProviderType 表示 AI 提供商类型，只能是 openai、claude、gemini。
	ProviderType string `json:"provider_type" gorm:"column:provider_type;type:varchar(64);not null;comment:AI提供商类型，只能是openai、claude、gemini" example:"openai"`
	// APIKeyCiphertext 表示加密后的 API Key 密文，接口不回显。
	APIKeyCiphertext string `json:"-" gorm:"column:api_key_ciphertext;type:text;not null;comment:加密后的API Key密文，接口不回显"`
	// APIKeyMask 表示 API Key 掩码，仅用于列表和详情展示。
	APIKeyMask string `json:"masked_api_key" gorm:"column:api_key_mask;type:varchar(255);not null;comment:API Key掩码，仅用于列表和详情展示" example:"sk-p...abcd"`
	// BaseURL 表示 AI 提供商接口基础地址，可以为空。
	BaseURL string `json:"base_url" gorm:"column:base_url;type:varchar(1000);comment:AI提供商接口基础地址，可以为空" example:"https://api.openai.com/v1"`
	// APIType 表示 AI 接口类型，只能是 response 或 completions；OpenAI 提供商固定使用 completions。
	APIType string `json:"api_type" gorm:"column:api_type;type:varchar(64);not null;default:completions;comment:AI接口类型，只能是response或completions，OpenAI提供商固定使用completions" example:"completions"`
	// Enabled 表示是否启用该 AI 提供商。
	Enabled bool `json:"enabled" gorm:"column:enabled;not null;default:true;index:idx_ai_providers_enabled;comment:是否启用该AI提供商" example:"true"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;comment:创建时间" example:"2026-06-18T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" gorm:"column:updated_at;comment:更新时间" example:"2026-06-18T12:00:00+08:00"`
}

// TableName 返回 AI 提供商模型对应的数据表名称。
func (Provider) TableName() string {
	return "ai_providers"
}

// CreateRequest 表示创建 AI 提供商请求参数。
type CreateRequest struct {
	// Name 表示 AI 提供商名称，不能为空且唯一。
	Name string `json:"name" binding:"required" example:"默认 OpenAI"`
	// ProviderType 表示 AI 提供商类型，只能是 openai、claude、gemini。
	ProviderType string `json:"provider_type" binding:"required" example:"openai"`
	// APIKey 表示 AI 提供商 API Key，创建时不能为空。
	APIKey string `json:"api_key" binding:"required" example:"sk-xxx"`
	// BaseURL 表示 AI 提供商接口基础地址，可以为空。
	BaseURL string `json:"base_url" example:"https://api.openai.com/v1"`
	// APIType 表示 AI 接口类型，只能是 response 或 completions；OpenAI 提供商固定使用 completions。
	APIType string `json:"api_type" example:"completions"`
	// Enabled 表示是否启用该 AI 提供商；nil 表示默认启用。
	Enabled *bool `json:"enabled" example:"true"`
}

// UpdateRequest 表示更新 AI 提供商请求参数。
type UpdateRequest struct {
	// Name 表示 AI 提供商名称，不能为空且唯一。
	Name string `json:"name" binding:"required" example:"默认 OpenAI"`
	// ProviderType 表示 AI 提供商类型，只能是 openai、claude、gemini。
	ProviderType string `json:"provider_type" binding:"required" example:"openai"`
	// APIKey 表示新的 AI 提供商 API Key；为空时保留原密钥。
	APIKey string `json:"api_key" example:"sk-xxx"`
	// BaseURL 表示 AI 提供商接口基础地址，可以为空。
	BaseURL string `json:"base_url" example:"https://api.openai.com/v1"`
	// APIType 表示 AI 接口类型，只能是 response 或 completions；为空时保留原值。
	APIType string `json:"api_type" example:"completions"`
	// Enabled 表示是否启用该 AI 提供商；nil 表示保留原值。
	Enabled *bool `json:"enabled" example:"true"`
}

// ListRequest 表示 AI 提供商列表查询参数。
type ListRequest struct {
	// Page 表示当前页码，从 1 开始。
	Page int `form:"page" example:"1"`
	// PageSize 表示每页数量，最大为 100。
	PageSize int `form:"page_size" example:"20"`
}

// ProviderResponse 表示 AI 提供商响应数据。
type ProviderResponse struct {
	// ID 表示 AI 提供商主键 ID。
	ID uint64 `json:"id" example:"1"`
	// Name 表示 AI 提供商名称。
	Name string `json:"name" example:"默认 OpenAI"`
	// ProviderType 表示 AI 提供商类型。
	ProviderType string `json:"provider_type" example:"openai"`
	// MaskedAPIKey 表示 API Key 掩码。
	MaskedAPIKey string `json:"masked_api_key" example:"sk-p...abcd"`
	// BaseURL 表示 AI 提供商接口基础地址。
	BaseURL string `json:"base_url" example:"https://api.openai.com/v1"`
	// APIType 表示 AI 接口类型。
	APIType string `json:"api_type" example:"completions"`
	// Enabled 表示是否启用该 AI 提供商。
	Enabled bool `json:"enabled" example:"true"`
	// CreatedAt 表示创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-18T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-18T12:00:00+08:00"`
}

// ListResponse 表示 AI 提供商分页列表响应数据。
type ListResponse struct {
	// Items 表示当前页 AI 提供商列表。
	Items []ProviderResponse `json:"items"`
	// Total 表示符合条件的 AI 提供商总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}

// ModelListRequest 表示根据 AI 提供商官方协议查询模型列表的请求参数。
type ModelListRequest struct {
	// ProviderType 表示 AI 提供商类型，只能是 openai、claude、gemini。
	ProviderType string `json:"provider_type" binding:"required" example:"openai"`
	// APIKey 表示用于请求官方模型列表接口的 API Key。
	APIKey string `json:"api_key" binding:"required" example:"sk-xxx"`
	// BaseURL 表示 AI 提供商接口基础地址；为空时按协议使用默认地址。
	BaseURL string `json:"base_url" example:"https://api.openai.com/v1"`
}

// ModelInfo 表示 AI 提供商官方模型列表中的单个模型。
type ModelInfo struct {
	// ID 表示模型标识。
	ID string `json:"id" example:"gpt-5"`
	// DisplayName 表示模型展示名称；官方未提供时使用模型标识。
	DisplayName string `json:"display_name" example:"GPT-5"`
	// OwnedBy 表示模型归属方；官方未提供时为空。
	OwnedBy string `json:"owned_by" example:"openai"`
	// CreatedAt 表示模型创建时间；官方未提供时为空。
	CreatedAt string `json:"created_at" example:"2026-06-18T12:00:00Z"`
	// SupportedGenerationMethods 表示 Gemini 等协议返回的模型生成能力。
	SupportedGenerationMethods []string `json:"supported_generation_methods"`
}

// ModelListResponse 表示 AI 提供商官方模型列表响应数据。
type ModelListResponse struct {
	// Items 表示官方返回并标准化后的模型列表。
	Items []ModelInfo `json:"items"`
}
