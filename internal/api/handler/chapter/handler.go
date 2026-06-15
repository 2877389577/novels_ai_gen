package chapter

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizchapter "novels_ai_gen/internal/biz/chapter"
)

// Handler 表示章节 HTTP 处理器。
type Handler struct {
	// service 表示章节业务服务。
	service *bizchapter.Service
}

// CreateRequest 表示 Swagger 文档中的创建章节请求参数。
type CreateRequest struct {
	// ChapterNumber 表示章节号，必须由客户端传入且大于 0。
	ChapterNumber int `json:"chapter_number" binding:"required" minimum:"1" example:"1"`
	// Title 表示章节名，不能为空。
	Title string `json:"title" binding:"required" example:"初入长夜"`
	// Content 表示章节正文，可以为空。
	Content string `json:"content" example:"夜色像墨一样铺开。"`
}

// UpdateRequest 表示 Swagger 文档中的更新章节请求参数。
type UpdateRequest struct {
	// Title 表示章节名，不能为空。
	Title string `json:"title" binding:"required" example:"初入长夜"`
	// Content 表示章节正文，可以为空。
	Content string `json:"content" example:"夜色像墨一样铺开。"`
}

// ChapterData 表示 Swagger 文档中的章节详情响应数据。
type ChapterData struct {
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
	CreatedAt string `json:"created_at" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt string `json:"updated_at" example:"2026-06-14T22:00:00+08:00"`
}

// ChapterSummaryData 表示 Swagger 文档中的章节列表摘要响应数据，不包含正文。
type ChapterSummaryData struct {
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
	CreatedAt string `json:"created_at" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt string `json:"updated_at" example:"2026-06-14T22:00:00+08:00"`
}

// ListData 表示 Swagger 文档中的章节分页列表响应数据。
type ListData struct {
	// Items 表示当前页章节摘要列表。
	Items []ChapterSummaryData `json:"items"`
	// Total 表示符合条件的章节总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}

// NextChapterNumberData 表示 Swagger 文档中的下一章节号响应数据。
type NextChapterNumberData struct {
	// NovelID 表示小说主键 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// NextChapterNumber 表示建议创建下一章时使用的章节号。
	NextChapterNumber int `json:"next_chapter_number" example:"2"`
}

// WordCountData 表示 Swagger 文档中的小说总字数响应数据。
type WordCountData struct {
	// NovelID 表示小说主键 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// WordCount 表示小说所有章节累计后的正文非空白字符数量。
	WordCount int64 `json:"word_count" example:"12345"`
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

// SuccessResponse 表示单个章节接口 Swagger 成功响应结构。
type SuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示章节响应数据。
	Data ChapterData `json:"data"`
}

// ListSuccessResponse 表示章节列表接口 Swagger 成功响应结构。
type ListSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示章节分页列表响应数据。
	Data ListData `json:"data"`
}

// NextChapterNumberSuccessResponse 表示下一章节号接口 Swagger 成功响应结构。
type NextChapterNumberSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示下一章节号响应数据。
	Data NextChapterNumberData `json:"data"`
}

// WordCountSuccessResponse 表示小说总字数接口 Swagger 成功响应结构。
type WordCountSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示小说总字数响应数据。
	Data WordCountData `json:"data"`
}

// DeleteData 表示删除章节接口响应数据。
type DeleteData struct {
	// Deleted 表示是否已经删除。
	Deleted bool `json:"deleted" example:"true"`
}

// DeleteSuccessResponse 表示删除章节接口 Swagger 成功响应结构。
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

// NewHandler 创建章节 HTTP 处理器。
// 参数 service 表示章节业务服务。
func NewHandler(service *bizchapter.Service) *Handler {
	return &Handler{service: service}
}

// NextChapterNumber 处理下一章节号查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询下一章节号
// @Description 查询指定小说下一章建议使用的章节号；没有章节时返回 1，否则返回当前最大章节号加 1。
// @Tags chapters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Success 200 {object} NextChapterNumberSuccessResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/next-chapter-number [get]
func (h *Handler) NextChapterNumber(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	data, err := h.service.NextChapterNumber(c.Request.Context(), novelID)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// WordCount 处理小说总字数查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说总字数
// @Description 查询指定小说所有章节 word_count 的累计值；没有章节时返回 0。
// @Tags chapters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Success 200 {object} WordCountSuccessResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/word-count [get]
func (h *Handler) WordCount(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	data, err := h.service.WordCount(c.Request.Context(), novelID)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Create 处理创建章节请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 创建小说章节
// @Description 在指定小说下创建章节，章节号必须由客户端传入且同一本小说内不能重复。
// @Tags chapters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param request body CreateRequest true "创建章节请求"
// @Success 200 {object} SuccessResponse "创建成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 409 {object} ErrorBody "章节号冲突"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/chapters [post]
func (h *Handler) Create(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req bizchapter.CreateRequest
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

// List 处理章节列表查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说章节列表
// @Description 分页查询指定小说下的章节列表，列表项不包含正文。
// @Tags chapters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param page query int false "当前页码" default(1)
// @Param page_size query int false "每页数量" default(20)
// @Success 200 {object} ListSuccessResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/chapters [get]
func (h *Handler) List(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req bizchapter.ListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.List(c.Request.Context(), novelID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Get 处理章节详情查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说章节详情
// @Description 根据小说 ID 和章节 ID 查询章节详情，详情包含正文。
// @Tags chapters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param chapter_id path int true "章节 ID"
// @Success 200 {object} SuccessResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "章节不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/chapters/{chapter_id} [get]
func (h *Handler) Get(c *gin.Context) {
	novelID, chapterID, ok := parseChapterPath(c)
	if !ok {
		return
	}

	data, err := h.service.GetByID(c.Request.Context(), novelID, chapterID)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Update 处理更新章节请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 更新小说章节
// @Description 根据小说 ID 和章节 ID 更新章节标题和正文，字数由后端重新计算。
// @Tags chapters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param chapter_id path int true "章节 ID"
// @Param request body UpdateRequest true "更新章节请求"
// @Success 200 {object} SuccessResponse "更新成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "章节不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/chapters/{chapter_id} [put]
func (h *Handler) Update(c *gin.Context) {
	novelID, chapterID, ok := parseChapterPath(c)
	if !ok {
		return
	}

	var req bizchapter.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Update(c.Request.Context(), novelID, chapterID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Delete 处理删除章节请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除小说章节
// @Description 根据小说 ID 和章节 ID 删除章节，删除后不重排章节号。
// @Tags chapters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param chapter_id path int true "章节 ID"
// @Success 200 {object} DeleteSuccessResponse "删除成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "章节不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/chapters/{chapter_id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	novelID, chapterID, ok := parseChapterPath(c)
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), novelID, chapterID); err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, DeleteData{Deleted: true})
}

// parseNovelID 解析路径中的小说 ID。
// 参数 c 表示 Gin 请求上下文。
func parseNovelID(c *gin.Context) (uint64, bool) {
	if c.Param("novel_id") != "" {
		return parseIDParam(c, "novel_id")
	}
	return parseIDParam(c, "id")
}

// parseChapterPath 解析路径中的小说 ID 和章节 ID。
// 参数 c 表示 Gin 请求上下文。
func parseChapterPath(c *gin.Context) (uint64, uint64, bool) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return 0, 0, false
	}

	chapterID, ok := parseIDParam(c, "chapter_id")
	if !ok {
		return 0, 0, false
	}
	return novelID, chapterID, true
}

// parseIDParam 解析指定路径参数中的正整数 ID。
// 参数 c 表示 Gin 请求上下文；参数 name 表示路径参数名称。
func parseIDParam(c *gin.Context, name string) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return 0, false
	}
	return id, true
}

// writeServiceError 将章节业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, bizchapter.ErrTitleRequired):
		response.Error(c, http.StatusBadRequest, "章节名不能为空")
	case errors.Is(err, bizchapter.ErrChapterNumberRequired):
		response.Error(c, http.StatusBadRequest, "章节号必须大于 0")
	case errors.Is(err, bizchapter.ErrNovelNotFound):
		response.Error(c, http.StatusNotFound, "小说不存在")
	case errors.Is(err, bizchapter.ErrNotFound):
		response.Error(c, http.StatusNotFound, "章节不存在")
	case errors.Is(err, bizchapter.ErrChapterNumberConflict):
		response.Error(c, http.StatusConflict, "章节号已存在，请重试")
	default:
		recordInternalError(c, err)
		response.Error(c, http.StatusInternalServerError, "服务器内部错误")
	}
}

// recordInternalError 将内部错误挂到 Gin 上下文，供请求日志中间件统一记录。
// 参数 c 表示 Gin 请求上下文；参数 err 表示需要记录的内部错误。
func recordInternalError(c *gin.Context, err error) {
	if err == nil {
		return
	}
	c.Error(err)
}
