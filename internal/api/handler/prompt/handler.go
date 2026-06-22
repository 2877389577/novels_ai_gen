package prompt

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizprompt "novels_ai_gen/internal/biz/prompt"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// Handler 表示 AI 提示词类型库与提示词库 HTTP 处理器。
type Handler struct {
	// service 表示提示词业务服务。
	service *bizprompt.Service
}

// PromptTypeRequest 表示 Swagger 文档中的提示词类型请求参数。
type PromptTypeRequest struct {
	// Name 表示提示词类型名称。
	Name string `json:"name" example:"润色"`
}

// PromptCreateRequest 表示 Swagger 文档中的创建提示词请求参数。
type PromptCreateRequest struct {
	// Content 表示提示词正文，trim 后不能为空。
	Content string `json:"content" example:"请在保持剧情不变的前提下润色以下正文。"`
	// PromptType 表示提示词类型，必须存在于配置文件 ai.prompt_types 中。
	PromptType string `json:"prompt_type" example:"润色"`
	// Description 表示提示词简介，可以为空。
	Description string `json:"description" example:"用于让章节语言更细腻。"`
}

// PromptUpdateRequest 表示 Swagger 文档中的更新提示词请求参数。
type PromptUpdateRequest struct {
	// Content 表示提示词正文，trim 后不能为空。
	Content string `json:"content" example:"请在保持剧情不变的前提下润色以下正文。"`
	// PromptType 表示提示词类型，必须存在于配置文件 ai.prompt_types 中。
	PromptType string `json:"prompt_type" example:"润色"`
	// Description 表示提示词简介，可以为空。
	Description string `json:"description" example:"用于让章节语言更细腻。"`
}

// PromptData 表示 Swagger 文档中的提示词详情数据。
type PromptData struct {
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

// PromptSummaryData 表示 Swagger 文档中的提示词列表摘要数据。
type PromptSummaryData struct {
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

// PromptListData 表示 Swagger 文档中的提示词分页列表数据。
type PromptListData struct {
	// Items 表示当前页提示词摘要列表。
	Items []PromptSummaryData `json:"items"`
	// Total 表示符合条件的提示词总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}

// PromptDeleteData 表示 Swagger 文档中的删除提示词结果。
type PromptDeleteData struct {
	// Deleted 表示是否已经删除提示词。
	Deleted bool `json:"deleted" example:"true"`
}

// PromptTypesData 表示提示词类型列表和配置文件加载状态。
type PromptTypesData struct {
	// Items 表示提示词类型列表。
	Items []string `json:"items" example:"润色,情感,扩写"`
	// ConfigFile 表示启动 -f 参数指定的实际配置文件绝对路径。
	ConfigFile string `json:"config_file" example:"D:\\Go\\GOPATH\\src\\novels_ai_gen\\config\\config-dev.yaml"`
	// ModifiedAt 表示配置文件在文件系统中的最后修改时间。
	ModifiedAt time.Time `json:"modified_at" example:"2026-06-20T12:00:00+08:00"`
	// ReloadedAt 表示后端最近一次成功加载该配置文件的时间。
	ReloadedAt time.Time `json:"reloaded_at" example:"2026-06-20T12:00:00+08:00"`
}

// PromptTypesSuccessResponse 表示提示词类型接口 Swagger 成功响应结构。
type PromptTypesSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示提示词类型列表和配置文件加载状态。
	Data PromptTypesData `json:"data"`
}

// PromptSuccessResponse 表示提示词详情接口 Swagger 成功响应结构。
type PromptSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示提示词详情。
	Data PromptData `json:"data"`
}

// PromptListSuccessResponse 表示提示词分页列表接口 Swagger 成功响应结构。
type PromptListSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示提示词分页列表。
	Data PromptListData `json:"data"`
}

// PromptDeleteSuccessResponse 表示删除提示词接口 Swagger 成功响应结构。
type PromptDeleteSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示删除提示词结果。
	Data PromptDeleteData `json:"data"`
}

// NewHandler 创建 AI 提示词 HTTP 处理器。
// 参数 service 表示提示词业务服务。
func NewHandler(service *bizprompt.Service) *Handler {
	return &Handler{service: service}
}

// ListTypes 处理提示词类型列表查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询提示词类型列表
// @Description 返回配置文件 ai.prompt_types 中的全局提示词类型列表。
// @Tags ai-prompts
// @Security Bearer
// @Produce json
// @Success 200 {object} PromptTypesSuccessResponse "查询成功"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/prompt-types [get]
func (h *Handler) ListTypes(c *gin.Context) {
	snapshot, err := h.service.ListPromptTypes(c.Request.Context())
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "查询提示词类型失败", "error", err)
		response.Error(c, http.StatusInternalServerError, "查询提示词类型失败")
		return
	}
	response.OK(c, toPromptTypesData(snapshot))
}

// CreateType 处理新增提示词类型请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 新增提示词类型
// @Description 向配置文件 ai.prompt_types 追加一个全局提示词类型并热加载。
// @Tags ai-prompts
// @Security Bearer
// @Accept json
// @Produce json
// @Param request body PromptTypeRequest true "提示词类型名称"
// @Success 200 {object} PromptTypesSuccessResponse "新增成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 409 {object} response.ErrorBody "提示词类型已存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/prompt-types [post]
func (h *Handler) CreateType(c *gin.Context) {
	var req bizprompt.TypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	snapshot, err := h.service.CreatePromptType(c.Request.Context(), req)
	if err != nil {
		writePromptTypeError(c, err, http.StatusNotFound)
		return
	}
	response.OK(c, toPromptTypesData(snapshot))
}

// RenameType 处理重命名提示词类型请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 重命名提示词类型
// @Description 重命名配置文件 ai.prompt_types 中的类型，并同步更新数据库中使用旧类型的提示词。
// @Tags ai-prompts
// @Security Bearer
// @Accept json
// @Produce json
// @Param name query string true "旧提示词类型名称"
// @Param request body PromptTypeRequest true "新提示词类型名称"
// @Success 200 {object} PromptTypesSuccessResponse "重命名成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "提示词类型不存在"
// @Failure 409 {object} response.ErrorBody "提示词类型已存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/prompt-types [put]
func (h *Handler) RenameType(c *gin.Context) {
	var req bizprompt.TypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	snapshot, err := h.service.RenamePromptType(c.Request.Context(), c.Query("name"), req)
	if err != nil {
		writePromptTypeError(c, err, http.StatusNotFound)
		return
	}
	response.OK(c, toPromptTypesData(snapshot))
}

// DeleteType 处理删除提示词类型请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除提示词类型
// @Description 删除配置文件 ai.prompt_types 中的类型；已被提示词引用时禁止删除。
// @Tags ai-prompts
// @Security Bearer
// @Produce json
// @Param name query string true "提示词类型名称"
// @Success 200 {object} PromptTypesSuccessResponse "删除成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "提示词类型不存在"
// @Failure 409 {object} response.ErrorBody "提示词类型仍被使用"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/prompt-types [delete]
func (h *Handler) DeleteType(c *gin.Context) {
	snapshot, err := h.service.DeletePromptType(c.Request.Context(), c.Query("name"))
	if err != nil {
		writePromptTypeError(c, err, http.StatusNotFound)
		return
	}
	response.OK(c, toPromptTypesData(snapshot))
}

// Create 处理创建提示词请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 创建提示词
// @Description 创建用于小说修改或润色的 AI 提示词。
// @Tags ai-prompts
// @Security Bearer
// @Accept json
// @Produce json
// @Param request body PromptCreateRequest true "提示词内容"
// @Success 200 {object} PromptSuccessResponse "创建成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/prompts [post]
func (h *Handler) Create(c *gin.Context) {
	var req bizprompt.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Create(c.Request.Context(), req)
	if err != nil {
		writePromptError(c, err)
		return
	}
	response.OK(c, data)
}

// List 处理提示词分页列表查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询提示词列表
// @Description 分页查询提示词列表，列表项不返回提示词正文。
// @Tags ai-prompts
// @Security Bearer
// @Produce json
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Param prompt_type query string false "提示词类型"
// @Success 200 {object} PromptListSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/prompts [get]
func (h *Handler) List(c *gin.Context) {
	var req bizprompt.ListRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.List(c.Request.Context(), req)
	if err != nil {
		writePromptError(c, err)
		return
	}
	response.OK(c, data)
}

// Get 处理提示词详情查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询提示词详情
// @Description 根据 ID 查询提示词详情，返回完整提示词正文。
// @Tags ai-prompts
// @Security Bearer
// @Produce json
// @Param id path int true "提示词 ID"
// @Success 200 {object} PromptSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "提示词不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/prompts/{id} [get]
func (h *Handler) Get(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	data, err := h.service.GetByID(c.Request.Context(), id)
	if err != nil {
		writePromptError(c, err)
		return
	}
	response.OK(c, data)
}

// Update 处理更新提示词请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 更新提示词
// @Description 根据 ID 更新提示词详情。
// @Tags ai-prompts
// @Security Bearer
// @Accept json
// @Produce json
// @Param id path int true "提示词 ID"
// @Param request body PromptUpdateRequest true "提示词内容"
// @Success 200 {object} PromptSuccessResponse "更新成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "提示词不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/prompts/{id} [put]
func (h *Handler) Update(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	var req bizprompt.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Update(c.Request.Context(), id, req)
	if err != nil {
		writePromptError(c, err)
		return
	}
	response.OK(c, data)
}

// Delete 处理删除提示词请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除提示词
// @Description 根据 ID 删除提示词。
// @Tags ai-prompts
// @Security Bearer
// @Produce json
// @Param id path int true "提示词 ID"
// @Success 200 {object} PromptDeleteSuccessResponse "删除成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 404 {object} response.ErrorBody "提示词不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/prompts/{id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}

	data, err := h.service.Delete(c.Request.Context(), id)
	if err != nil {
		writePromptError(c, err)
		return
	}
	response.OK(c, data)
}

// parseID 解析路径中的提示词 ID。
// 参数 c 表示 Gin 请求上下文。
func parseID(c *gin.Context) (uint64, bool) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return 0, false
	}
	return id, true
}

// writePromptTypeError 将提示词类型业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误；参数 notFoundStatus 表示类型不存在时使用的 HTTP 状态码。
func writePromptTypeError(c *gin.Context, err error, notFoundStatus int) {
	switch {
	case errors.Is(err, bizprompt.ErrTypeNameRequired):
		response.Error(c, http.StatusBadRequest, "提示词类型名称不能为空")
	case errors.Is(err, bizprompt.ErrTypeConflict):
		response.Error(c, http.StatusConflict, "提示词类型已存在")
	case errors.Is(err, bizprompt.ErrTypeInUse):
		response.Error(c, http.StatusConflict, "提示词类型仍被使用")
	case errors.Is(err, bizprompt.ErrTypeNotFound):
		response.Error(c, notFoundStatus, "提示词类型不存在")
	default:
		slog.ErrorContext(c.Request.Context(), "处理提示词类型失败", "error", err)
		response.Error(c, http.StatusInternalServerError, "服务器内部错误")
	}
}

// writePromptError 将提示词业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writePromptError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, bizprompt.ErrContentRequired):
		response.Error(c, http.StatusBadRequest, "提示词正文不能为空")
	case errors.Is(err, bizprompt.ErrTypeRequired):
		response.Error(c, http.StatusBadRequest, "提示词类型不能为空")
	case errors.Is(err, bizprompt.ErrTypeNotFound):
		response.Error(c, http.StatusBadRequest, "提示词类型不存在")
	case errors.Is(err, bizprompt.ErrNotFound):
		response.Error(c, http.StatusNotFound, "提示词不存在")
	default:
		slog.ErrorContext(c.Request.Context(), "处理提示词失败", "error", err)
		response.Error(c, http.StatusInternalServerError, "服务器内部错误")
	}
}

// toPromptTypesData 将配置模块提示词类型快照转换为 HTTP 响应数据。
// 参数 snapshot 表示提示词类型配置和加载状态快照。
func toPromptTypesData(snapshot appconfig.PromptTypesSnapshot) PromptTypesData {
	return PromptTypesData{
		Items:      snapshot.Items,
		ConfigFile: snapshot.ConfigFile,
		ModifiedAt: snapshot.ModifiedAt,
		ReloadedAt: snapshot.ReloadedAt,
	}
}
