package relationship

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizrelationship "novels_ai_gen/internal/biz/relationship"
)

// Handler 表示角色关系图 HTTP 处理器。
type Handler struct {
	// service 表示角色关系图业务服务。
	service *bizrelationship.Service
}

// ViewportData 表示 Swagger 文档中的关系图视口数据。
type ViewportData struct {
	// X 表示画布视口 X 坐标。
	X float64 `json:"x" example:"0"`
	// Y 表示画布视口 Y 坐标。
	Y float64 `json:"y" example:"0"`
	// Zoom 表示画布视口缩放比例。
	Zoom float64 `json:"zoom" example:"1"`
}

// NodeData 表示 Swagger 文档中的关系图节点数据。
type NodeData struct {
	// CharacterID 表示画布节点引用的角色卡 ID。
	CharacterID uint64 `json:"character_id" example:"1"`
	// PositionX 表示节点在画布中的 X 坐标。
	PositionX float64 `json:"position_x" example:"120"`
	// PositionY 表示节点在画布中的 Y 坐标。
	PositionY float64 `json:"position_y" example:"80"`
}

// EdgeData 表示 Swagger 文档中的关系图关系线数据。
type EdgeData struct {
	// ID 表示关系线稳定 ID，由两个角色 ID 计算得到。
	ID string `json:"id" example:"rel-1-2"`
	// CharacterAID 表示无方向关系线中较小的角色卡 ID。
	CharacterAID uint64 `json:"character_a_id" example:"1"`
	// CharacterBID 表示无方向关系线中较大的角色卡 ID。
	CharacterBID uint64 `json:"character_b_id" example:"2"`
	// SourceHandle 表示较小角色卡端使用的连接点 ID。
	SourceHandle string `json:"source_handle" example:"right"`
	// TargetHandle 表示较大角色卡端使用的连接点 ID。
	TargetHandle string `json:"target_handle" example:"left"`
	// Note 表示关系线备注，用于描述两个角色之间的关系。
	Note string `json:"note" example:"旧友"`
}

// SaveRequest 表示 Swagger 文档中的保存角色关系图请求参数。
type SaveRequest struct {
	// Viewport 表示画布视口。
	Viewport ViewportData `json:"viewport"`
	// Nodes 表示当前画布中的角色节点列表。
	Nodes []NodeData `json:"nodes"`
	// Edges 表示当前画布中的无方向关系线列表。
	Edges []EdgeData `json:"edges"`
}

// GraphData 表示 Swagger 文档中的角色关系图响应数据。
type GraphData struct {
	// NovelID 表示小说主键 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Viewport 表示画布视口。
	Viewport ViewportData `json:"viewport"`
	// Nodes 表示当前画布中的角色节点列表。
	Nodes []NodeData `json:"nodes"`
	// Edges 表示当前画布中的无方向关系线列表。
	Edges []EdgeData `json:"edges"`
	// UpdatedAt 表示关系图最后更新时间；关系图尚未保存时为空。
	UpdatedAt string `json:"updated_at" example:"2026-06-15T10:00:00+08:00"`
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

// SuccessResponse 表示角色关系图接口 Swagger 成功响应结构。
type SuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示角色关系图响应数据。
	Data GraphData `json:"data"`
}

// NewHandler 创建角色关系图 HTTP 处理器。
// 参数 service 表示角色关系图业务服务。
func NewHandler(service *bizrelationship.Service) *Handler {
	return &Handler{service: service}
}

// Get 处理角色关系图查询请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说角色关系图
// @Description 查询指定小说的角色关系图，包含画布视口、画布节点和无方向关系线。
// @Tags relationships
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Success 200 {object} SuccessResponse "查询成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/relationship-graph [get]
func (h *Handler) Get(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	data, err := h.service.Get(c.Request.Context(), novelID)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Save 处理角色关系图保存请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 保存小说角色关系图
// @Description 使用整图快照保存指定小说的角色关系图；关系线为无方向关系，同一对角色只能存在一条关系线。
// @Tags relationships
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param request body SaveRequest true "保存角色关系图请求"
// @Success 200 {object} SuccessResponse "保存成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 404 {object} ErrorBody "小说不存在"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/relationship-graph [put]
func (h *Handler) Save(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	var req bizrelationship.SaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Save(c.Request.Context(), novelID, req)
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// parseNovelID 解析路径中的小说 ID。
// 参数 c 表示 Gin 请求上下文。
func parseNovelID(c *gin.Context) (uint64, bool) {
	if c.Param("novel_id") != "" {
		return parseIDParam(c, "novel_id")
	}
	return parseIDParam(c, "id")
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

// writeServiceError 将角色关系图业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, bizrelationship.ErrNovelNotFound):
		response.Error(c, http.StatusNotFound, "小说不存在")
	case errors.Is(err, bizrelationship.ErrCharacterNotFound):
		response.Error(c, http.StatusBadRequest, "关系图引用了不存在的角色")
	case errors.Is(err, bizrelationship.ErrDuplicateNode):
		response.Error(c, http.StatusBadRequest, "同一角色不能重复加入画布")
	case errors.Is(err, bizrelationship.ErrInvalidNode):
		response.Error(c, http.StatusBadRequest, "关系图节点参数错误")
	case errors.Is(err, bizrelationship.ErrInvalidViewport):
		response.Error(c, http.StatusBadRequest, "关系图视口参数错误")
	case errors.Is(err, bizrelationship.ErrSelfRelation):
		response.Error(c, http.StatusBadRequest, "角色不能与自己建立关系")
	case errors.Is(err, bizrelationship.ErrDuplicateRelation):
		response.Error(c, http.StatusBadRequest, "同一对角色不能重复连线")
	case errors.Is(err, bizrelationship.ErrRelationEndpointMissing):
		response.Error(c, http.StatusBadRequest, "关系线两端角色必须已经在画布中")
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
