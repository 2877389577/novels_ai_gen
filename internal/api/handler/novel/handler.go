package novel

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	biznovel "novels_ai_gen/internal/biz/novel"
)

// Handler 表示小说 HTTP 处理器。
type Handler struct {
	// service 表示小说业务服务。
	service *biznovel.Service
}

// CreateRequest 表示 Swagger 文档中的创建小说请求参数。
type CreateRequest struct {
	// Name 表示小说名，不能为空。
	Name string `json:"name" binding:"required" example:"长夜余火"`
	// Status 表示小说状态，只允许连载中或已完结，未传时默认连载中。
	Status string `json:"status" example:"连载中" enums:"连载中,已完结"`
	// AuthorName 表示作者名，可以为空。
	AuthorName string `json:"author_name" example:"爱潜水的乌贼"`
	// Description 表示简介，可以为空。
	Description string `json:"description" example:"一部关于废土冒险的小说"`
	// Tags 表示标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"玄幻,冒险"`
	// CoverURL 表示封面链接，可以为空。
	CoverURL string `json:"cover_url" example:"https://example.com/cover.jpg"`
}

// UpdateRequest 表示 Swagger 文档中的更新小说请求参数。
type UpdateRequest struct {
	// Name 表示小说名，不能为空。
	Name string `json:"name" binding:"required" example:"长夜余火"`
	// Status 表示小说状态，只允许连载中或已完结，未传或空字符串时保留原状态。
	Status string `json:"status" example:"连载中" enums:"连载中,已完结"`
	// AuthorName 表示作者名，可以为空。
	AuthorName string `json:"author_name" example:"爱潜水的乌贼"`
	// Description 表示简介，可以为空。
	Description string `json:"description" example:"一部关于废土冒险的小说"`
	// Tags 表示标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"玄幻,冒险"`
	// CoverURL 表示封面链接，可以为空。
	CoverURL string `json:"cover_url" example:"https://example.com/cover.jpg"`
}

// NovelData 表示 Swagger 文档中的小说响应数据。
type NovelData struct {
	// ID 表示小说主键 ID。
	ID uint64 `json:"id" example:"1"`
	// Name 表示小说名。
	Name string `json:"name" example:"长夜余火"`
	// Status 表示小说状态，只允许连载中或已完结。
	Status string `json:"status" example:"连载中" enums:"连载中,已完结"`
	// AuthorName 表示作者名。
	AuthorName string `json:"author_name" example:"爱潜水的乌贼"`
	// Description 表示简介。
	Description string `json:"description" example:"一部关于废土冒险的小说"`
	// Tags 表示标签，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"玄幻,冒险"`
	// CoverURL 表示封面链接。
	CoverURL string `json:"cover_url" example:"https://example.com/cover.jpg"`
	// CreatedAt 表示创建时间。
	CreatedAt string `json:"created_at" example:"2026-06-13T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt string `json:"updated_at" example:"2026-06-13T22:00:00+08:00"`
}

// ListData 表示 Swagger 文档中的小说分页列表响应数据。
type ListData struct {
	// Items 表示当前页小说列表。
	Items []NovelData `json:"items"`
	// Total 表示符合条件的小说总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}

// ErrorBody 表示 Swagger 文档中的错误响应结构。
type ErrorBody struct {
	// Code 表示错误响应码，使用 HTTP 状态码。
	Code int `json:"code" example:"400"`
	// Message 表示用户可理解的错误提示。
	Message string `json:"message" example:"请求参数错误"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
}

// SuccessResponse 表示单个小说接口 Swagger 成功响应结构。
type SuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示小说响应数据。
	Data NovelData `json:"data"`
}

// ListSuccessResponse 表示小说列表接口 Swagger 成功响应结构。
type ListSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示小说分页列表响应数据。
	Data ListData `json:"data"`
}

// DeleteData 表示删除小说接口响应数据。
type DeleteData struct {
	// Deleted 表示是否已经删除。
	Deleted bool `json:"deleted" example:"true"`
}

// DeleteSuccessResponse 表示删除小说接口 Swagger 成功响应结构。
type DeleteSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示删除结果。
	Data DeleteData `json:"data"`
}

// NewHandler 创建小说 HTTP 处理器。
// 参数 service 表示小说业务服务。
func NewHandler(service *biznovel.Service) *Handler {
	return &Handler{service: service}
}

// Create 处理创建小说请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 创建小说
// @Description 创建一条小说记录。
// @Tags novels
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body CreateRequest true "创建小说请求"
// @Success 200 {object} SuccessResponse "创建成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels [post]
func (h *Handler) Create(c *gin.Context) {
	var req biznovel.CreateRequest
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

// List 处理小说列表查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说列表
// @Description 分页查询小说列表。
// @Tags novels
// @Accept json
// @Produce json
// @Security Bearer
// @Param page query int false "当前页码" default(1)
// @Param page_size query int false "每页数量" default(20)
// @Success 200 {object} ListSuccessResponse "查询成功"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels [get]
func (h *Handler) List(c *gin.Context) {
	var req biznovel.ListRequest
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

// Get 处理小说详情查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说详情
// @Description 根据 ID 查询小说详情。
// @Tags novels
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "小说 ID"
// @Success 200 {object} SuccessResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id} [get]
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

// Update 处理更新小说请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 更新小说
// @Description 根据 ID 更新小说记录。
// @Tags novels
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "小说 ID"
// @Param request body UpdateRequest true "更新小说请求"
// @Success 200 {object} SuccessResponse "更新成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id} [put]
func (h *Handler) Update(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var req biznovel.UpdateRequest
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

// Delete 处理删除小说请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除小说
// @Description 根据 ID 真删小说记录。
// @Tags novels
// @Accept json
// @Produce json
// @Security Bearer
// @Param id path int true "小说 ID"
// @Success 200 {object} DeleteSuccessResponse "删除成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), id); err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, DeleteData{Deleted: true})
}

// parseID 解析路径中的小说 ID。
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
	case errors.Is(err, biznovel.ErrNameRequired):
		response.Error(c, http.StatusBadRequest, "小说名不能为空")
	case errors.Is(err, biznovel.ErrInvalidStatus):
		response.Error(c, http.StatusBadRequest, "小说状态仅支持连载中或已完结")
	case errors.Is(err, biznovel.ErrNotFound):
		response.Error(c, http.StatusNotFound, "小说不存在")
	default:
		response.Error(c, http.StatusInternalServerError, "服务器内部错误")
	}
}
