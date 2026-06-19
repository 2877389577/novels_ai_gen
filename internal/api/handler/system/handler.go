package system

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizsystem "novels_ai_gen/internal/biz/system"
)

// Handler 表示系统维护 HTTP 处理器。
type Handler struct {
	// service 表示系统维护业务服务。
	service *bizsystem.Service
}

// UpdateData 表示系统更新接口 Swagger 响应数据。
type UpdateData struct {
	// Branch 表示本次更新拉取的目标分支。
	Branch string `json:"branch" example:"main"`
	// CommitBefore 表示更新前当前仓库的 commit。
	CommitBefore string `json:"commit_before" example:"f3c2d1e"`
	// CommitAfter 表示更新后当前仓库的 commit。
	CommitAfter string `json:"commit_after" example:"a8b7c6d"`
	// Restarting 表示是否已经启动后台重启脚本。
	Restarting bool `json:"restarting" example:"true"`
}

// UpdateSuccessResponse 表示系统更新接口 Swagger 成功响应结构。
type UpdateSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示系统更新结果。
	Data UpdateData `json:"data"`
}

// NewHandler 创建系统维护 HTTP 处理器。
// 参数 service 表示系统维护业务服务。
func NewHandler(service *bizsystem.Service) *Handler {
	return &Handler{service: service}
}

// Update 处理系统一键更新请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 一键更新并重启系统
// @Description 拉取 GitHub origin/main 最新代码，成功后启动后台脚本重启当前服务。
// @Tags system
// @Security Bearer
// @Produce json
// @Success 200 {object} UpdateSuccessResponse "更新已开始"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 409 {object} response.ErrorBody "更新冲突或工作区存在未提交改动"
// @Failure 500 {object} response.ErrorBody "系统更新失败"
// @Router /system/update [post]
func (h *Handler) Update(c *gin.Context) {
	data, err := h.service.TriggerUpdate(c.Request.Context())
	if err != nil {
		writeUpdateError(c, err)
		return
	}

	response.OK(c, data)
}

// writeUpdateError 将系统更新错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示系统更新业务错误。
func writeUpdateError(c *gin.Context, err error) {
	if errors.Is(err, bizsystem.ErrUpdateInProgress) {
		response.Error(c, http.StatusConflict, "更新正在执行中")
		return
	}
	if errors.Is(err, bizsystem.ErrDirtyWorktree) {
		response.Error(c, http.StatusConflict, "存在未提交改动，已中止更新")
		return
	}

	slog.ErrorContext(c.Request.Context(), "系统更新失败", "error", err)
	response.Error(c, http.StatusInternalServerError, "系统更新失败: "+err.Error())
}
