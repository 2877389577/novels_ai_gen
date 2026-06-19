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

// EventCreateRequest 表示 Swagger 文档中的事件创建请求参数。
type EventCreateRequest struct {
	// Name 表示事件名称，不能为空。
	Name string `json:"name" binding:"required" example:"寒桥之战"`
	// Cause 表示事件起因，可以为空。
	Cause string `json:"cause" example:"北境雪灾导致民怨沸腾。"`
	// Process 表示事件经过，可以为空。
	Process string `json:"process" example:"林霜夜率三百死士奇袭寒霜桥。"`
	// Result 表示事件结果，可以为空。
	Result string `json:"result" example:"守将阵亡，寒霜桥易主。"`
	// Impact 表示事件造成的影响，可以为空。
	Impact string `json:"impact" example:"天下大乱的序幕被拉开。"`
	// Location 表示事件发生地点，可以为空。
	Location string `json:"location" example:"北境·寒霜桥"`
	// ParticipantIDs 表示参与该事件的角色卡 ID 列表。
	ParticipantIDs []uint64 `json:"participant_ids" example:"1,2"`
	// PositionX 表示事件节点初始画布 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示事件节点初始画布 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
}

// EventUpdateRequest 表示 Swagger 文档中的事件更新请求参数。
type EventUpdateRequest struct {
	// Name 表示事件名称，不能为空。
	Name string `json:"name" binding:"required" example:"寒桥之战"`
	// Cause 表示事件起因，可以为空。
	Cause string `json:"cause" example:"北境雪灾导致民怨沸腾。"`
	// Process 表示事件经过，可以为空。
	Process string `json:"process" example:"林霜夜率三百死士奇袭寒霜桥。"`
	// Result 表示事件结果，可以为空。
	Result string `json:"result" example:"守将阵亡，寒霜桥易主。"`
	// Impact 表示事件造成的影响，可以为空。
	Impact string `json:"impact" example:"天下大乱的序幕被拉开。"`
	// Location 表示事件发生地点，可以为空。
	Location string `json:"location" example:"北境·寒霜桥"`
	// ParticipantIDs 表示参与该事件的角色卡 ID 列表。
	ParticipantIDs []uint64 `json:"participant_ids" example:"1,2"`
	// PositionX 表示事件节点画布 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示事件节点画布 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
}

// LayoutNodeRequest 表示 Swagger 文档中的事件图节点布局请求参数。
type LayoutNodeRequest struct {
	// EventID 表示事件主键 ID。
	EventID uint64 `json:"event_id" example:"1"`
	// PositionX 表示事件节点画布 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示事件节点画布 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
}

// LayoutRequest 表示 Swagger 文档中的事件图布局保存请求参数。
type LayoutRequest struct {
	// Viewport 表示事件图画布视口。
	Viewport ViewportData `json:"viewport"`
	// Nodes 表示需要保存坐标的事件节点列表。
	Nodes []LayoutNodeRequest `json:"nodes"`
}

// RelationCreateRequest 表示 Swagger 文档中的事件关系线创建请求参数。
type RelationCreateRequest struct {
	// SourceEventID 表示前置事件 ID。
	SourceEventID uint64 `json:"source_event_id" binding:"required" example:"1"`
	// TargetEventID 表示后续事件 ID。
	TargetEventID uint64 `json:"target_event_id" binding:"required" example:"2"`
	// Note 表示关系线备注，可以为空。
	Note string `json:"note" example:"直接导致"`
}

// RelationUpdateRequest 表示 Swagger 文档中的事件关系线更新请求参数。
type RelationUpdateRequest struct {
	// Note 表示关系线备注，可以为空。
	Note string `json:"note" example:"直接导致"`
}

// ParticipantData 表示 Swagger 文档中的事件参与角色摘要数据。
type ParticipantData struct {
	// ID 表示角色卡主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Name 表示角色姓名。
	Name string `json:"name" example:"林霜夜"`
	// Gender 表示角色性别。
	Gender string `json:"gender" example:"男"`
	// Tags 表示角色标签，多个标签使用英文逗号分隔。
	Tags string `json:"tags" example:"主角,剑修"`
}

// EventData 表示 Swagger 文档中的事件响应数据。
type EventData struct {
	// ID 表示事件主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Name 表示事件名称。
	Name string `json:"name" example:"寒桥之战"`
	// Cause 表示事件起因。
	Cause string `json:"cause" example:"北境雪灾导致民怨沸腾。"`
	// Process 表示事件经过。
	Process string `json:"process" example:"林霜夜率三百死士奇袭寒霜桥。"`
	// Result 表示事件结果。
	Result string `json:"result" example:"守将阵亡，寒霜桥易主。"`
	// Impact 表示事件造成的影响。
	Impact string `json:"impact" example:"天下大乱的序幕被拉开。"`
	// Location 表示事件发生地点。
	Location string `json:"location" example:"北境·寒霜桥"`
	// PositionX 表示事件节点在画布中的 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示事件节点在画布中的 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
	// Participants 表示参与该事件的角色卡摘要列表。
	Participants []ParticipantData `json:"participants"`
	// CreatedAt 表示创建时间。
	CreatedAt string `json:"created_at" example:"2026-06-16T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt string `json:"updated_at" example:"2026-06-16T10:00:00+08:00"`
}

// EventListData 表示 Swagger 文档中的事件列表响应数据。
type EventListData struct {
	// Items 表示当前页事件列表。
	Items []EventData `json:"items"`
	// Total 表示符合条件的事件总数。
	Total int64 `json:"total" example:"1"`
	// Page 表示当前页码。
	Page int `json:"page" example:"1"`
	// PageSize 表示每页数量。
	PageSize int `json:"page_size" example:"20"`
}

// ViewportData 表示 Swagger 文档中的事件图视口数据。
type ViewportData struct {
	// X 表示画布视口 X 坐标。
	X float64 `json:"x" example:"0"`
	// Y 表示画布视口 Y 坐标。
	Y float64 `json:"y" example:"0"`
	// Zoom 表示画布视口缩放比例。
	Zoom float64 `json:"zoom" example:"1"`
}

// RelationData 表示 Swagger 文档中的事件关系线响应数据。
type RelationData struct {
	// ID 表示事件关系线主键 ID。
	ID uint64 `json:"id" example:"1"`
	// SourceEventID 表示前置事件 ID。
	SourceEventID uint64 `json:"source_event_id" example:"1"`
	// TargetEventID 表示后续事件 ID。
	TargetEventID uint64 `json:"target_event_id" example:"2"`
	// Note 表示事件关系线备注。
	Note string `json:"note" example:"直接导致"`
	// CreatedAt 表示创建时间。
	CreatedAt string `json:"created_at" example:"2026-06-16T10:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt string `json:"updated_at" example:"2026-06-16T10:00:00+08:00"`
}

// EventGraphData 表示 Swagger 文档中的事件图响应数据。
type EventGraphData struct {
	// NovelID 表示小说主键 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Viewport 表示事件图画布视口。
	Viewport ViewportData `json:"viewport"`
	// Nodes 表示事件图中的事件节点列表。
	Nodes []EventData `json:"nodes"`
	// Edges 表示事件图中的有向关系线列表。
	Edges []RelationData `json:"edges"`
	// UpdatedAt 表示事件图布局最后更新时间，尚未保存时为空。
	UpdatedAt string `json:"updated_at" example:"2026-06-16T10:00:00+08:00"`
}

// EventDeleteData 表示 Swagger 文档中的删除事件响应数据。
type EventDeleteData struct {
	// Deleted 表示后端是否已经删除该事件。
	Deleted bool `json:"deleted" example:"true"`
	// DeletedRelationCount 表示随事件一并删除的关系线数量。
	DeletedRelationCount int64 `json:"deleted_relation_count" example:"2"`
}

// EventSuccessResponse 表示单个事件接口 Swagger 成功响应结构。
type EventSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示事件响应数据。
	Data EventData `json:"data"`
}

// EventListSuccessResponse 表示事件列表接口 Swagger 成功响应结构。
type EventListSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示事件列表响应数据。
	Data EventListData `json:"data"`
}

// EventGraphSuccessResponse 表示事件图接口 Swagger 成功响应结构。
type EventGraphSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示事件图响应数据。
	Data EventGraphData `json:"data"`
}

// EventDeleteSuccessResponse 表示删除事件接口 Swagger 成功响应结构。
type EventDeleteSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示删除事件响应数据。
	Data EventDeleteData `json:"data"`
}

// EventRelationSuccessResponse 表示事件关系线接口 Swagger 成功响应结构。
type EventRelationSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示事件关系线响应数据。
	Data RelationData `json:"data"`
}

// RelationDeleteSuccessResponse 表示删除事件关系线接口 Swagger 成功响应结构。
type RelationDeleteSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示删除事件关系线响应数据。
	Data RelationDeleteData `json:"data"`
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
// @Success 200 {object} EventGraphSuccessResponse "查询成功"
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
// @Param request body LayoutRequest true "事件图布局"
// @Success 200 {object} EventGraphSuccessResponse "保存成功"
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
// @Param request body EventCreateRequest true "事件创建参数"
// @Success 200 {object} EventSuccessResponse "创建成功"
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
// @Success 200 {object} EventListSuccessResponse "查询成功"
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
// @Success 200 {object} EventSuccessResponse "查询成功"
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
// @Param request body EventUpdateRequest true "事件更新参数"
// @Success 200 {object} EventSuccessResponse "更新成功"
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
// @Success 200 {object} EventDeleteSuccessResponse "删除成功"
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
// @Param request body RelationCreateRequest true "关系线创建参数"
// @Success 200 {object} EventRelationSuccessResponse "创建成功"
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
// @Param request body RelationUpdateRequest true "关系线更新参数"
// @Success 200 {object} EventRelationSuccessResponse "更新成功"
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
// @Success 200 {object} RelationDeleteSuccessResponse "删除成功"
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
