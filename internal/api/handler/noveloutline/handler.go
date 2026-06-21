package noveloutline

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	biznoveloutline "novels_ai_gen/internal/biz/noveloutline"
)

// Handler 表示小说大纲 HTTP 处理器。
type Handler struct {
	// service 表示小说大纲业务服务。
	service *biznoveloutline.Service
}

// OutlineRequest 表示 Swagger 文档中的小说大纲保存请求。
type OutlineRequest struct {
	// Content 表示需要保存的小说大纲正文，允许为空字符串。
	Content string `json:"content" example:"第一卷：主角离开边城，踏入王都。"`
}

// OutlineData 表示 Swagger 文档中的小说大纲响应数据。
type OutlineData struct {
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

// OutlineSuccessResponse 表示小说大纲接口 Swagger 成功响应结构。
type OutlineSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示小说大纲详情。
	Data OutlineData `json:"data"`
}

// DeleteData 表示删除小说大纲后的响应数据。
type DeleteData struct {
	// Deleted 表示是否已经删除小说大纲。
	Deleted bool `json:"deleted" example:"true"`
}

// DeleteSuccessResponse 表示删除小说大纲接口 Swagger 成功响应结构。
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

// NewHandler 创建小说大纲 HTTP 处理器。
// 参数 service 表示小说大纲业务服务。
func NewHandler(service *biznoveloutline.Service) *Handler {
	return &Handler{service: service}
}

// Create 处理创建小说大纲请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 创建小说大纲
// @Description 为指定小说创建当前唯一的大纲；如果已存在则返回冲突。
// @Tags novel-outlines
// @Security Bearer
// @Accept json
// @Produce json
// @Param id path int true "小说 ID"
// @Param request body OutlineRequest true "小说大纲正文"
// @Success 200 {object} OutlineSuccessResponse "创建成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "小说不存在"
// @Failure 409 {object} response.ErrorBody "小说大纲已存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{id}/outline [post]
func (h *Handler) Create(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req biznoveloutline.SaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Create(c.Request.Context(), novelID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	response.OK(c, data)
}

// Get 处理查询小说大纲请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说大纲
// @Description 查询指定小说当前保存的大纲。
// @Tags novel-outlines
// @Security Bearer
// @Produce json
// @Param id path int true "小说 ID"
// @Success 200 {object} OutlineSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "小说或小说大纲不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{id}/outline [get]
func (h *Handler) Get(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	data, err := h.service.GetByNovelID(c.Request.Context(), novelID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	response.OK(c, data)
}

// Update 处理更新小说大纲请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 更新小说大纲
// @Description 更新指定小说当前大纲正文。
// @Tags novel-outlines
// @Security Bearer
// @Accept json
// @Produce json
// @Param id path int true "小说 ID"
// @Param request body OutlineRequest true "小说大纲正文"
// @Success 200 {object} OutlineSuccessResponse "更新成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "小说或小说大纲不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{id}/outline [put]
func (h *Handler) Update(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req biznoveloutline.SaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Update(c.Request.Context(), novelID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	response.OK(c, data)
}

// Delete 处理删除小说大纲请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除小说大纲
// @Description 删除指定小说当前保存的大纲。
// @Tags novel-outlines
// @Security Bearer
// @Produce json
// @Param id path int true "小说 ID"
// @Success 200 {object} DeleteSuccessResponse "删除成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "小说或小说大纲不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{id}/outline [delete]
func (h *Handler) Delete(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	data, err := h.service.Delete(c.Request.Context(), novelID)
	if err != nil {
		writeServiceError(c, err)
		return
	}
	response.OK(c, data)
}

// parseNovelID 解析路径中的小说 ID。
// 参数 c 表示 Gin 请求上下文。
func parseNovelID(c *gin.Context) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return 0, false
	}
	return id, true
}

// writeServiceError 将小说大纲业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, biznoveloutline.ErrNovelIDRequired):
		response.Error(c, http.StatusBadRequest, "小说 ID 不能为空")
	case errors.Is(err, biznoveloutline.ErrNovelNotFound):
		response.Error(c, http.StatusNotFound, "小说不存在")
	case errors.Is(err, biznoveloutline.ErrNotFound):
		response.Error(c, http.StatusNotFound, "小说大纲不存在")
	case errors.Is(err, biznoveloutline.ErrConflict):
		response.Error(c, http.StatusConflict, "小说大纲已存在")
	default:
		slog.ErrorContext(c.Request.Context(), "处理小说大纲失败", "error", err)
		response.Error(c, http.StatusInternalServerError, "服务器内部错误")
	}
}
