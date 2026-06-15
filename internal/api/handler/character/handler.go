package character

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizcharacter "novels_ai_gen/internal/biz/character"
)

// Handler 表示角色卡 HTTP 处理器。
type Handler struct {
	// service 表示角色卡业务服务。
	service *bizcharacter.Service
}

// CreateRequest 表示 Swagger 文档中的创建角色卡请求参数。
type CreateRequest struct {
	// PortraitURL 表示肖像图链接或对象存储 key，可以为空。
	PortraitURL string `json:"portrait_url" example:"covers/character-a.webp"`
	// Name 表示角色姓名，不能为空。
	Name string `json:"name" binding:"required" example:"林知夏"`
	// Gender 表示角色性别，可以为空。
	Gender string `json:"gender" example:"女"`
	// Tags 表示角色标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
	// Background 表示角色背景，可以为空。
	Background string `json:"background" example:"出身边城旧族。"`
	// Personality 表示角色性格，可以为空。
	Personality string `json:"personality" example:"冷静克制，重诺。"`
	// Ability 表示角色能力，可以为空。
	Ability string `json:"ability" example:"擅长御剑与阵法。"`
	// Goal 表示角色目的，可以为空。
	Goal string `json:"goal" example:"寻找失踪的兄长。"`
}

// UpdateRequest 表示 Swagger 文档中的更新角色卡请求参数。
type UpdateRequest struct {
	// PortraitURL 表示肖像图链接或对象存储 key，可以为空。
	PortraitURL string `json:"portrait_url" example:"covers/character-a.webp"`
	// Name 表示角色姓名，不能为空。
	Name string `json:"name" binding:"required" example:"林知夏"`
	// Gender 表示角色性别，可以为空。
	Gender string `json:"gender" example:"女"`
	// Tags 表示角色标签，可以为空，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
	// Background 表示角色背景，可以为空。
	Background string `json:"background" example:"出身边城旧族。"`
	// Personality 表示角色性格，可以为空。
	Personality string `json:"personality" example:"冷静克制，重诺。"`
	// Ability 表示角色能力，可以为空。
	Ability string `json:"ability" example:"擅长御剑与阵法。"`
	// Goal 表示角色目的，可以为空。
	Goal string `json:"goal" example:"寻找失踪的兄长。"`
}

// CharacterData 表示 Swagger 文档中的角色卡详情响应数据。
type CharacterData struct {
	// ID 表示角色卡主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// PortraitURL 表示肖像图链接或对象存储 key。
	PortraitURL string `json:"portrait_url" example:"covers/character-a.webp"`
	// Name 表示角色姓名。
	Name string `json:"name" example:"林知夏"`
	// Gender 表示角色性别。
	Gender string `json:"gender" example:"女"`
	// Tags 表示角色标签，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
	// Background 表示角色背景。
	Background string `json:"background" example:"出身边城旧族。"`
	// Personality 表示角色性格。
	Personality string `json:"personality" example:"冷静克制，重诺。"`
	// Ability 表示角色能力。
	Ability string `json:"ability" example:"擅长御剑与阵法。"`
	// Goal 表示角色目的。
	Goal string `json:"goal" example:"寻找失踪的兄长。"`
	// CreatedAt 表示创建时间。
	CreatedAt string `json:"created_at" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt string `json:"updated_at" example:"2026-06-14T22:00:00+08:00"`
}

// CharacterSummaryData 表示 Swagger 文档中的角色卡列表摘要响应数据。
type CharacterSummaryData struct {
	// ID 表示角色卡主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// PortraitURL 表示肖像图链接或对象存储 key。
	PortraitURL string `json:"portrait_url" example:"covers/character-a.webp"`
	// Name 表示角色姓名。
	Name string `json:"name" example:"林知夏"`
	// Gender 表示角色性别。
	Gender string `json:"gender" example:"女"`
	// Tags 表示角色标签，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
	// CreatedAt 表示创建时间。
	CreatedAt string `json:"created_at" example:"2026-06-14T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt string `json:"updated_at" example:"2026-06-14T22:00:00+08:00"`
}

// ListData 表示 Swagger 文档中的角色卡分页列表响应数据。
type ListData struct {
	// Items 表示当前页角色卡摘要列表。
	Items []CharacterSummaryData `json:"items"`
	// Total 表示符合条件的角色卡总数。
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
}

// SuccessResponse 表示单个角色卡接口 Swagger 成功响应结构。
type SuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// Data 表示角色卡响应数据。
	Data CharacterData `json:"data"`
}

// ListSuccessResponse 表示角色卡列表接口 Swagger 成功响应结构。
type ListSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// Data 表示角色卡分页列表响应数据。
	Data ListData `json:"data"`
}

// DeleteData 表示删除角色卡接口响应数据。
type DeleteData struct {
	// Deleted 表示是否已经删除。
	Deleted bool `json:"deleted" example:"true"`
}

// DeleteSuccessResponse 表示删除角色卡接口 Swagger 成功响应结构。
type DeleteSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// Data 表示删除结果。
	Data DeleteData `json:"data"`
}

// NewHandler 创建角色卡 HTTP 处理器。
// 参数 service 表示角色卡业务服务。
func NewHandler(service *bizcharacter.Service) *Handler {
	return &Handler{service: service}
}

// Create 处理创建角色卡请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 创建小说角色卡
// @Description 在指定小说下创建角色卡，角色姓名必填，其余字段选填。
// @Tags characters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param request body CreateRequest true "创建角色卡请求"
// @Success 200 {object} SuccessResponse "创建成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/characters [post]
func (h *Handler) Create(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req bizcharacter.CreateRequest
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

// List 处理角色卡列表查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说角色卡列表
// @Description 分页查询指定小说下的角色卡列表，列表项包含摘要信息。
// @Tags characters
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
// @Router /novels/{novel_id}/characters [get]
func (h *Handler) List(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req bizcharacter.ListRequest
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

// Get 处理角色卡详情查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说角色卡详情
// @Description 根据小说 ID 和角色卡 ID 查询角色卡详情。
// @Tags characters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param character_id path int true "角色卡 ID"
// @Success 200 {object} SuccessResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "角色卡不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/characters/{character_id} [get]
func (h *Handler) Get(c *gin.Context) {
	novelID, characterID, ok := parseCharacterPath(c)
	if !ok {
		return
	}

	data, err := h.service.GetByID(c.Request.Context(), novelID, characterID)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Update 处理更新角色卡请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 更新小说角色卡
// @Description 根据小说 ID 和角色卡 ID 更新角色卡信息，角色姓名必填。
// @Tags characters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param character_id path int true "角色卡 ID"
// @Param request body UpdateRequest true "更新角色卡请求"
// @Success 200 {object} SuccessResponse "更新成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "角色卡不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/characters/{character_id} [put]
func (h *Handler) Update(c *gin.Context) {
	novelID, characterID, ok := parseCharacterPath(c)
	if !ok {
		return
	}

	var req bizcharacter.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Update(c.Request.Context(), novelID, characterID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Delete 处理删除角色卡请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除小说角色卡
// @Description 根据小说 ID 和角色卡 ID 删除角色卡。
// @Tags characters
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param character_id path int true "角色卡 ID"
// @Success 200 {object} DeleteSuccessResponse "删除成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "角色卡不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/characters/{character_id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	novelID, characterID, ok := parseCharacterPath(c)
	if !ok {
		return
	}

	if err := h.service.Delete(c.Request.Context(), novelID, characterID); err != nil {
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

// parseCharacterPath 解析路径中的小说 ID 和角色卡 ID。
// 参数 c 表示 Gin 请求上下文。
func parseCharacterPath(c *gin.Context) (uint64, uint64, bool) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return 0, 0, false
	}

	characterID, ok := parseIDParam(c, "character_id")
	if !ok {
		return 0, 0, false
	}
	return novelID, characterID, true
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

// writeServiceError 将角色卡业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, bizcharacter.ErrNameRequired):
		response.Error(c, http.StatusBadRequest, "角色姓名不能为空")
	case errors.Is(err, bizcharacter.ErrNovelNotFound):
		response.Error(c, http.StatusNotFound, "小说不存在")
	case errors.Is(err, bizcharacter.ErrNotFound):
		response.Error(c, http.StatusNotFound, "角色卡不存在")
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
