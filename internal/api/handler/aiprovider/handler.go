package aiprovider

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"
)

// Handler 表示 AI 提供商 HTTP 处理器。
type Handler struct {
	// service 表示 AI 提供商业务服务。
	service *bizaiprovider.Service
}

// CreateRequest 表示 Swagger 文档中的创建 AI 提供商请求参数。
type CreateRequest struct {
	// Name 表示 AI 提供商名称，不能为空且唯一。
	Name string `json:"name" binding:"required" example:"默认 OpenAI"`
	// ProviderType 表示 AI 提供商类型，只能是 openai、claude、gemini。
	ProviderType string `json:"provider_type" binding:"required" example:"openai"`
	// APIKey 表示 AI 提供商 API Key，创建时不能为空。
	APIKey string `json:"api_key" binding:"required" example:"sk-xxx"`
	// BaseURL 表示 AI 提供商接口基础地址，可以为空。
	BaseURL string `json:"base_url" example:"https://api.openai.com/v1"`
	// APIType 表示 AI 接口类型，只能是 response 或 completions，未传时默认 response。
	APIType string `json:"api_type" example:"response"`
	// Enabled 表示是否启用该 AI 提供商；未传时默认 true。
	Enabled *bool `json:"enabled" example:"true"`
}

// UpdateRequest 表示 Swagger 文档中的更新 AI 提供商请求参数。
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
	APIType string `json:"api_type" example:"response"`
	// Enabled 表示是否启用该 AI 提供商；未传时保留原值。
	Enabled *bool `json:"enabled" example:"true"`
}

// ProviderData 表示 Swagger 文档中的 AI 提供商响应数据。
type ProviderData struct {
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
	APIType string `json:"api_type" example:"response"`
	// Enabled 表示是否启用该 AI 提供商。
	Enabled bool `json:"enabled" example:"true"`
	// CreatedAt 表示创建时间。
	CreatedAt string `json:"created_at" example:"2026-06-18T12:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt string `json:"updated_at" example:"2026-06-18T12:00:00+08:00"`
}

// ProviderListData 表示 Swagger 文档中的 AI 提供商分页列表响应数据。
type ProviderListData struct {
	// Items 表示当前页 AI 提供商列表。
	Items []ProviderData `json:"items"`
	// Total 表示符合条件的 AI 提供商总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}

// ProviderSuccessResponse 表示单个 AI 提供商接口 Swagger 成功响应结构。
type ProviderSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示 AI 提供商响应数据。
	Data ProviderData `json:"data"`
}

// ProviderListSuccessResponse 表示 AI 提供商列表接口 Swagger 成功响应结构。
type ProviderListSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示 AI 提供商分页列表响应数据。
	Data ProviderListData `json:"data"`
}

// ProviderDeleteData 表示删除 AI 提供商接口响应数据。
type ProviderDeleteData struct {
	// Deleted 表示是否已经删除。
	Deleted bool `json:"deleted" example:"true"`
}

// ProviderDeleteSuccessResponse 表示删除 AI 提供商接口 Swagger 成功响应结构。
type ProviderDeleteSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示删除结果。
	Data ProviderDeleteData `json:"data"`
}

// ModelListRequest 表示 Swagger 文档中的 AI 提供商模型列表查询请求参数。
type ModelListRequest struct {
	// ProviderType 表示 AI 提供商类型，只能是 openai、claude、gemini。
	ProviderType string `json:"provider_type" binding:"required" example:"openai"`
	// APIKey 表示用于请求官方模型列表接口的 API Key。
	APIKey string `json:"api_key" binding:"required" example:"sk-xxx"`
	// BaseURL 表示 AI 提供商接口基础地址；为空时按协议使用默认地址。
	BaseURL string `json:"base_url" example:"https://api.openai.com/v1"`
}

// ModelData 表示 Swagger 文档中的 AI 模型数据。
type ModelData struct {
	// ID 表示模型标识。
	ID string `json:"id" example:"gpt-5"`
	// DisplayName 表示模型展示名称。
	DisplayName string `json:"display_name" example:"GPT-5"`
	// OwnedBy 表示模型归属方。
	OwnedBy string `json:"owned_by" example:"openai"`
	// CreatedAt 表示模型创建时间。
	CreatedAt string `json:"created_at" example:"2026-06-18T12:00:00Z"`
	// SupportedGenerationMethods 表示模型支持的生成能力。
	SupportedGenerationMethods []string `json:"supported_generation_methods"`
}

// ModelListData 表示 AI 提供商模型列表接口响应数据。
type ModelListData struct {
	// Items 表示模型列表。
	Items []ModelData `json:"items"`
}

// ModelListSuccessResponse 表示 AI 提供商模型列表接口 Swagger 成功响应结构。
type ModelListSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示模型列表响应数据。
	Data ModelListData `json:"data"`
}

// NewHandler 创建 AI 提供商 HTTP 处理器。
// 参数 service 表示 AI 提供商业务服务。
func NewHandler(service *bizaiprovider.Service) *Handler {
	return &Handler{service: service}
}

// Create 处理创建 AI 提供商请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 创建 AI 提供商
// @Description 创建一条 AI 提供商记录，API Key 会加密保存且不会回显明文。
// @Tags ai-providers
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body CreateRequest true "创建 AI 提供商请求"
// @Success 200 {object} ProviderSuccessResponse "创建成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 409 {object} response.ErrorBody "AI 提供商名称已存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/providers [post]
func (h *Handler) Create(c *gin.Context) {
	var req bizaiprovider.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Create(c.Request.Context(), req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// List 处理 AI 提供商列表查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询 AI 提供商列表
// @Description 分页查询 AI 提供商列表，响应只包含 API Key 掩码。
// @Tags ai-providers
// @Accept json
// @Produce json
// @Security Bearer
// @Param page query int false "当前页码" default(1)
// @Param page_size query int false "每页数量" default(20)
// @Success 200 {object} ProviderListSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/providers [get]
func (h *Handler) List(c *gin.Context) {
	var req bizaiprovider.ListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.List(c.Request.Context(), req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// ListModels 处理 AI 提供商官方模型列表查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询 AI 提供商官方模型列表
// @Description 根据 provider_type、api_key 和 base_url 直接请求对应 AI 提供商官方模型列表接口，不读取本地数据库。
// @Tags ai-providers
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body ModelListRequest true "模型列表查询请求"
// @Success 200 {object} ModelListSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 502 {object} response.ErrorBody "官方模型列表接口不可用"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/providers/models [post]
func (h *Handler) ListModels(c *gin.Context) {
	var req bizaiprovider.ModelListRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.ListModels(c.Request.Context(), req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// ListModelsByProviderID 处理使用已保存 AI 提供商配置查询官方模型列表请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 根据已保存 AI 提供商查询官方模型列表
// @Description 根据 AI 提供商 ID 读取本地加密密钥并在后端按官方协议查询模型列表，API Key 不会回显到前端。
// @Tags ai-providers
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "AI 提供商 ID"
// @Success 200 {object} ModelListSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 404 {object} response.ErrorBody "AI 提供商不存在"
// @Failure 502 {object} response.ErrorBody "官方模型列表接口不可用"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/providers/{id}/models [post]
func (h *Handler) ListModelsByProviderID(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	data, err := h.service.ListModelsByProviderID(c.Request.Context(), id)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Get 处理 AI 提供商详情查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询 AI 提供商详情
// @Description 根据 ID 查询 AI 提供商详情，响应只包含 API Key 掩码。
// @Tags ai-providers
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "AI 提供商 ID"
// @Success 200 {object} ProviderSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 404 {object} response.ErrorBody "AI 提供商不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/providers/{id} [get]
func (h *Handler) Get(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	data, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Update 处理更新 AI 提供商请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 更新 AI 提供商
// @Description 根据 ID 更新 AI 提供商记录，api_key 为空或省略时保留旧密钥。
// @Tags ai-providers
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "AI 提供商 ID"
// @Param request body UpdateRequest true "更新 AI 提供商请求"
// @Success 200 {object} ProviderSuccessResponse "更新成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 404 {object} response.ErrorBody "AI 提供商不存在"
// @Failure 409 {object} response.ErrorBody "AI 提供商名称已存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/providers/{id} [put]
func (h *Handler) Update(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var req bizaiprovider.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Update(c.Request.Context(), id, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Delete 处理删除 AI 提供商请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除 AI 提供商
// @Description 根据 ID 删除 AI 提供商记录。
// @Tags ai-providers
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "AI 提供商 ID"
// @Success 200 {object} ProviderDeleteSuccessResponse "删除成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 404 {object} response.ErrorBody "AI 提供商不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/providers/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, ProviderDeleteData{Deleted: true})
}

// parseID 解析路径中的 AI 提供商 ID。
// 参数 c 表示 Gin 请求上下文。
func parseID(c *gin.Context) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return 0, false
	}
	return id, true
}

// writeServiceError 将业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, bizaiprovider.ErrNameRequired):
		response.Error(c, http.StatusBadRequest, "AI 提供商名称不能为空")
	case errors.Is(err, bizaiprovider.ErrProviderTypeRequired):
		response.Error(c, http.StatusBadRequest, "AI 提供商类型不能为空")
	case errors.Is(err, bizaiprovider.ErrInvalidProviderType):
		response.Error(c, http.StatusBadRequest, "AI 提供商类型只能是 openai、claude 或 gemini")
	case errors.Is(err, bizaiprovider.ErrAPIKeyRequired):
		response.Error(c, http.StatusBadRequest, "AI 提供商 API Key 不能为空")
	case errors.Is(err, bizaiprovider.ErrInvalidAPIType):
		response.Error(c, http.StatusBadRequest, "AI 接口类型只能是 response 或 completions")
	case errors.Is(err, bizaiprovider.ErrInvalidBaseURL):
		response.Error(c, http.StatusBadRequest, "AI 提供商 Base URL 格式无效")
	case errors.Is(err, bizaiprovider.ErrModelListUnavailable):
		response.Error(c, http.StatusBadGateway, "官方模型列表接口暂时不可用")
	case errors.Is(err, bizaiprovider.ErrModelListInvalid):
		response.Error(c, http.StatusBadGateway, "官方模型列表响应格式无效")
	case errors.Is(err, bizaiprovider.ErrNameConflict):
		response.Error(c, http.StatusConflict, "AI 提供商名称已存在")
	case errors.Is(err, bizaiprovider.ErrNotFound):
		response.Error(c, http.StatusNotFound, "AI 提供商不存在")
	default:
		response.Error(c, http.StatusInternalServerError, "服务器内部错误")
	}
}
