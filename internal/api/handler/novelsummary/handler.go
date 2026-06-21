package novelsummary

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	biznovelsummary "novels_ai_gen/internal/biz/novelsummary"
)

// Handler 表示小说滚动总结 HTTP 处理器。
type Handler struct {
	// service 表示小说滚动总结业务服务。
	service *biznovelsummary.Service
}

// SummaryRequest 表示 Swagger 文档中的小说滚动总结保存请求。
type SummaryRequest struct {
	// Content 表示需要保存的小说滚动剧情总结内容，允许为空字符串。
	Content string `json:"content" example:"主角在废土城市发现旧时代遗迹，团队关系逐渐成形。"`
	// StartChapterNumber 表示当前总结覆盖的起始章节号，0 表示未知或未记录。
	StartChapterNumber int `json:"start_chapter_number" example:"1"`
	// EndChapterNumber 表示当前总结覆盖的结束章节号，0 表示未知或未记录。
	EndChapterNumber int `json:"end_chapter_number" example:"100"`
}

// SummaryData 表示 Swagger 文档中的小说滚动总结响应数据。
type SummaryData struct {
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

// SummarySuccessResponse 表示小说滚动总结接口 Swagger 成功响应结构。
type SummarySuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示小说滚动总结详情。
	Data SummaryData `json:"data"`
}

// DeleteData 表示删除小说滚动总结后的响应数据。
type DeleteData struct {
	// Deleted 表示是否已经删除小说滚动总结。
	Deleted bool `json:"deleted" example:"true"`
}

// DeleteSuccessResponse 表示删除小说滚动总结接口 Swagger 成功响应结构。
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

// NewHandler 创建小说滚动总结 HTTP 处理器。
// 参数 service 表示小说滚动总结业务服务。
func NewHandler(service *biznovelsummary.Service) *Handler {
	return &Handler{service: service}
}

// Create 处理创建小说滚动总结请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 创建小说滚动总结
// @Description 为指定小说创建当前唯一的滚动剧情总结，可同时记录总结覆盖的起止章节号；如果已存在则返回冲突。
// @Tags novel-summaries
// @Security Bearer
// @Accept json
// @Produce json
// @Param id path int true "小说 ID"
// @Param request body SummaryRequest true "小说滚动总结内容和覆盖章节范围"
// @Success 200 {object} SummarySuccessResponse "创建成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "小说不存在"
// @Failure 409 {object} response.ErrorBody "小说总结已存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{id}/summary [post]
func (h *Handler) Create(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req biznovelsummary.SaveRequest
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

// Get 处理查询小说滚动总结请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说滚动总结
// @Description 查询指定小说当前保存的滚动剧情总结。
// @Tags novel-summaries
// @Security Bearer
// @Produce json
// @Param id path int true "小说 ID"
// @Success 200 {object} SummarySuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "小说或小说总结不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{id}/summary [get]
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

// Update 处理更新小说滚动总结请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 更新小说滚动总结
// @Description 更新指定小说当前滚动剧情总结的内容和覆盖章节范围。
// @Tags novel-summaries
// @Security Bearer
// @Accept json
// @Produce json
// @Param id path int true "小说 ID"
// @Param request body SummaryRequest true "小说滚动总结内容和覆盖章节范围"
// @Success 200 {object} SummarySuccessResponse "更新成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "小说或小说总结不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{id}/summary [put]
func (h *Handler) Update(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req biznovelsummary.SaveRequest
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

// Delete 处理删除小说滚动总结请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除小说滚动总结
// @Description 删除指定小说当前保存的滚动剧情总结。
// @Tags novel-summaries
// @Security Bearer
// @Produce json
// @Param id path int true "小说 ID"
// @Success 200 {object} DeleteSuccessResponse "删除成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "小说或小说总结不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{id}/summary [delete]
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

// writeServiceError 将小说滚动总结业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, biznovelsummary.ErrNovelIDRequired):
		response.Error(c, http.StatusBadRequest, "小说 ID 不能为空")
	case errors.Is(err, biznovelsummary.ErrInvalidChapterRange):
		response.Error(c, http.StatusBadRequest, "小说总结章节范围无效")
	case errors.Is(err, biznovelsummary.ErrNovelNotFound):
		response.Error(c, http.StatusNotFound, "小说不存在")
	case errors.Is(err, biznovelsummary.ErrNotFound):
		response.Error(c, http.StatusNotFound, "小说总结不存在")
	case errors.Is(err, biznovelsummary.ErrConflict):
		response.Error(c, http.StatusConflict, "小说总结已存在")
	default:
		slog.ErrorContext(c.Request.Context(), "处理小说总结失败", "error", err)
		response.Error(c, http.StatusInternalServerError, "服务器内部错误")
	}
}
