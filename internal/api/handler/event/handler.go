package event

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizevent "novels_ai_gen/internal/biz/event"
)

// Handler 表示小说事件 HTTP 处理器。
type Handler struct {
	// service 表示小说事件业务服务。
	service *bizevent.Service
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

// RelationDeleteData 表示删除事件关系线后的响应数据。
type RelationDeleteData struct {
	// Deleted 表示后端是否已经删除该事件关系线。
	Deleted bool `json:"deleted" example:"true"`
}

// NewHandler 创建小说事件 HTTP 处理器。
// 参数 service 表示小说事件业务服务。
func NewHandler(service *bizevent.Service) *Handler {
	return &Handler{service: service}
}

// GetGraph 处理事件图查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询事件图
// @Description 返回指定小说的事件节点、关系线和画布视口。
// @Tags events
// @Produce json
// @Param id path int true "小说 ID"
// @Success 200 {object} bizevent.GraphResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/event-graph [get]
func (h *Handler) GetGraph(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	data, err := h.service.GetGraph(c.Request.Context(), novelID)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// SaveLayout 处理事件图布局保存请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 保存事件图布局
// @Description 保存事件图视口和事件节点坐标。
// @Tags events
// @Accept json
// @Produce json
// @Param id path int true "小说 ID"
// @Param request body bizevent.LayoutRequest true "事件图布局"
// @Success 200 {object} bizevent.GraphResponse "保存成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/event-graph/layout [put]
func (h *Handler) SaveLayout(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req bizevent.LayoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.SaveLayout(c.Request.Context(), novelID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Create 处理事件创建请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 创建事件
// @Description 在指定小说下创建一个剧情事件。
// @Tags events
// @Accept json
// @Produce json
// @Param id path int true "小说 ID"
// @Param request body bizevent.CreateRequest true "事件创建参数"
// @Success 200 {object} bizevent.EventResponse "创建成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/events [post]
func (h *Handler) Create(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req bizevent.CreateRequest
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

// List 处理事件列表查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询事件列表
// @Description 分页查询指定小说下的剧情事件。
// @Tags events
// @Produce json
// @Param id path int true "小说 ID"
// @Param page query int false "页码"
// @Param page_size query int false "每页数量"
// @Success 200 {object} bizevent.ListResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/events [get]
func (h *Handler) List(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req bizevent.ListRequest
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

// Get 处理事件详情查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询事件详情
// @Description 查询指定小说下的单个剧情事件详情。
// @Tags events
// @Produce json
// @Param id path int true "小说 ID"
// @Param event_id path int true "事件 ID"
// @Success 200 {object} bizevent.EventResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "事件不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/events/{event_id} [get]
func (h *Handler) Get(c *gin.Context) {
	novelID, eventID, ok := parseEventPath(c)
	if !ok {
		return
	}

	data, err := h.service.GetByID(c.Request.Context(), novelID, eventID)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Update 处理事件更新请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 更新事件
// @Description 更新指定小说下的剧情事件。
// @Tags events
// @Accept json
// @Produce json
// @Param id path int true "小说 ID"
// @Param event_id path int true "事件 ID"
// @Param request body bizevent.UpdateRequest true "事件更新参数"
// @Success 200 {object} bizevent.EventResponse "更新成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "事件不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/events/{event_id} [put]
func (h *Handler) Update(c *gin.Context) {
	novelID, eventID, ok := parseEventPath(c)
	if !ok {
		return
	}

	var req bizevent.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Update(c.Request.Context(), novelID, eventID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Delete 处理事件删除请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除事件
// @Description 删除指定小说下的剧情事件，并一并删除相关关系线。
// @Tags events
// @Produce json
// @Param id path int true "小说 ID"
// @Param event_id path int true "事件 ID"
// @Success 200 {object} bizevent.DeleteResponse "删除成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "事件不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/events/{event_id} [delete]
func (h *Handler) Delete(c *gin.Context) {
	novelID, eventID, ok := parseEventPath(c)
	if !ok {
		return
	}

	data, err := h.service.Delete(c.Request.Context(), novelID, eventID)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// CreateRelation 处理事件关系线创建请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 创建事件关系线
// @Description 创建两个事件之间的有向关系线。
// @Tags events
// @Accept json
// @Produce json
// @Param id path int true "小说 ID"
// @Param request body bizevent.RelationCreateRequest true "关系线创建参数"
// @Success 200 {object} bizevent.RelationResponse "创建成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/event-relations [post]
func (h *Handler) CreateRelation(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req bizevent.RelationCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.CreateRelation(c.Request.Context(), novelID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// UpdateRelation 处理事件关系线更新请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 更新事件关系线
// @Description 更新事件关系线备注。
// @Tags events
// @Accept json
// @Produce json
// @Param id path int true "小说 ID"
// @Param relation_id path int true "关系线 ID"
// @Param request body bizevent.RelationUpdateRequest true "关系线更新参数"
// @Success 200 {object} bizevent.RelationResponse "更新成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "关系线不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/event-relations/{relation_id} [put]
func (h *Handler) UpdateRelation(c *gin.Context) {
	novelID, relationID, ok := parseRelationPath(c)
	if !ok {
		return
	}

	var req bizevent.RelationUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.UpdateRelation(c.Request.Context(), novelID, relationID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// DeleteRelation 处理事件关系线删除请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除事件关系线
// @Description 删除指定事件关系线。
// @Tags events
// @Produce json
// @Param id path int true "小说 ID"
// @Param relation_id path int true "关系线 ID"
// @Success 200 {object} RelationDeleteData "删除成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 404 {object} ErrorBody "关系线不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{id}/event-relations/{relation_id} [delete]
func (h *Handler) DeleteRelation(c *gin.Context) {
	novelID, relationID, ok := parseRelationPath(c)
	if !ok {
		return
	}

	if err := h.service.DeleteRelation(c.Request.Context(), novelID, relationID); err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, RelationDeleteData{Deleted: true})
}

// parseNovelID 解析路径中的小说 ID。
// 参数 c 表示 Gin 请求上下文。
func parseNovelID(c *gin.Context) (uint64, bool) {
	if c.Param("novel_id") != "" {
		return parseIDParam(c, "novel_id")
	}
	return parseIDParam(c, "id")
}

// parseEventPath 解析小说事件路径参数。
// 参数 c 表示 Gin 请求上下文。
func parseEventPath(c *gin.Context) (uint64, uint64, bool) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return 0, 0, false
	}
	eventID, ok := parseIDParam(c, "event_id")
	if !ok {
		return 0, 0, false
	}
	return novelID, eventID, true
}

// parseRelationPath 解析事件关系线路径参数。
// 参数 c 表示 Gin 请求上下文。
func parseRelationPath(c *gin.Context) (uint64, uint64, bool) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return 0, 0, false
	}
	relationID, ok := parseIDParam(c, "relation_id")
	if !ok {
		return 0, 0, false
	}
	return novelID, relationID, true
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

// writeServiceError 将小说事件业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, bizevent.ErrNovelNotFound):
		response.Error(c, http.StatusNotFound, "小说不存在")
	case errors.Is(err, bizevent.ErrNotFound):
		response.Error(c, http.StatusNotFound, "事件不存在")
	case errors.Is(err, bizevent.ErrNameRequired):
		response.Error(c, http.StatusBadRequest, "事件名称不能为空")
	case errors.Is(err, bizevent.ErrCharacterNotFound):
		response.Error(c, http.StatusBadRequest, "事件参与者引用了不存在的角色")
	case errors.Is(err, bizevent.ErrRelationNotFound):
		response.Error(c, http.StatusNotFound, "事件关系线不存在")
	case errors.Is(err, bizevent.ErrInvalidViewport):
		response.Error(c, http.StatusBadRequest, "事件图视口参数错误")
	case errors.Is(err, bizevent.ErrInvalidNode):
		response.Error(c, http.StatusBadRequest, "事件图节点参数错误")
	case errors.Is(err, bizevent.ErrSelfRelation):
		response.Error(c, http.StatusBadRequest, "事件不能连接到自身")
	case errors.Is(err, bizevent.ErrDuplicateRelation):
		response.Error(c, http.StatusBadRequest, "同一方向的事件关系线已经存在")
	case errors.Is(err, bizevent.ErrRelationEndpointMissing):
		response.Error(c, http.StatusBadRequest, "事件关系线两端事件必须存在")
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
