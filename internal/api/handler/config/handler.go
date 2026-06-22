package config

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizchaptersummaryagent "novels_ai_gen/internal/biz/chaptersummaryagent"
	biznovelagent "novels_ai_gen/internal/biz/novelagent"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// Handler 表示配置文件管理 HTTP 处理器。
type Handler struct {
	// manager 表示运行期间共享的配置文件管理器。
	manager *appconfig.ConfigManager
}

// FileData 表示配置文件读取或保存后的响应数据。
type FileData struct {
	// ConfigFile 表示启动 -f 参数指定的实际配置文件绝对路径。
	ConfigFile string `json:"config_file" example:"D:\\Go\\GOPATH\\src\\novels_ai_gen\\config\\config-dev.yaml"`
	// Content 表示配置文件当前文本内容。
	Content string `json:"content" example:"auth:\n  password: admin123\n"`
	// ModifiedAt 表示配置文件在文件系统中的最后修改时间。
	ModifiedAt time.Time `json:"modified_at" example:"2026-06-14T22:00:00+08:00"`
	// ReloadedAt 表示后端最近一次成功加载该配置文件的时间。
	ReloadedAt time.Time `json:"reloaded_at" example:"2026-06-14T22:00:00+08:00"`
}

// UpdateFileRequest 表示保存配置文件接口的请求参数。
type UpdateFileRequest struct {
	// Content 表示需要写入配置文件的完整 YAML 文本。
	Content string `json:"content" example:"auth:\n  password: admin123\n"`
}

// AgentData 表示结构化智能体配置和加载状态。
type AgentData struct {
	// ConfigFile 表示启动 -f 参数指定的实际配置文件绝对路径。
	ConfigFile string `json:"config_file" example:"D:\\Go\\GOPATH\\src\\novels_ai_gen\\config\\config-dev.yaml"`
	// Agent 表示小说写作多层 Agent 配置。
	Agent appconfig.AgentConfig `json:"agent" swaggertype:"object"`
	// ModifiedAt 表示配置文件在文件系统中的最后修改时间。
	ModifiedAt time.Time `json:"modified_at" example:"2026-06-14T22:00:00+08:00"`
	// ReloadedAt 表示后端最近一次成功加载该配置文件的时间。
	ReloadedAt time.Time `json:"reloaded_at" example:"2026-06-14T22:00:00+08:00"`
}

// ChapterSummaryAgentData 表示结构化章节概要 Agent 配置和加载状态。
type ChapterSummaryAgentData struct {
	// ConfigFile 表示启动 -f 参数指定的实际配置文件绝对路径。
	ConfigFile string `json:"config_file" example:"D:\\Go\\GOPATH\\src\\novels_ai_gen\\config\\config-dev.yaml"`
	// ChapterSummaryAgent 表示章节概要独立 Agent 配置。
	ChapterSummaryAgent appconfig.ChapterSummaryAgentConfig `json:"chapter_summary_agent" swaggertype:"object"`
	// ModifiedAt 表示配置文件在文件系统中的最后修改时间。
	ModifiedAt time.Time `json:"modified_at" example:"2026-06-14T22:00:00+08:00"`
	// ReloadedAt 表示后端最近一次成功加载该配置文件的时间。
	ReloadedAt time.Time `json:"reloaded_at" example:"2026-06-14T22:00:00+08:00"`
}

// UpdateAgentRequest 表示保存结构化智能体配置接口的请求参数。
type UpdateAgentRequest struct {
	// Agent 表示需要写入配置文件 ai.agent 子树的智能体配置。
	Agent appconfig.AgentConfig `json:"agent" swaggertype:"object"`
}

// UpdateChapterSummaryAgentRequest 表示保存章节概要 Agent 配置接口的请求参数。
type UpdateChapterSummaryAgentRequest struct {
	// ChapterSummaryAgent 表示需要写入配置文件 ai.chapter_summary_agent 子树的章节概要 Agent 配置。
	ChapterSummaryAgent appconfig.ChapterSummaryAgentConfig `json:"chapter_summary_agent" swaggertype:"object"`
}

// FileSuccessResponse 表示配置文件接口 Swagger 成功响应结构。
type FileSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示配置文件文本和加载状态。
	Data FileData `json:"data"`
}

// AgentSuccessResponse 表示智能体配置接口 Swagger 成功响应结构。
type AgentSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示结构化智能体配置和加载状态。
	Data AgentData `json:"data"`
}

// ChapterSummaryAgentSuccessResponse 表示章节概要 Agent 配置接口 Swagger 成功响应结构。
type ChapterSummaryAgentSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示结构化章节概要 Agent 配置和加载状态。
	Data ChapterSummaryAgentData `json:"data"`
}

// NewHandler 创建配置文件管理 HTTP 处理器。
// 参数 manager 表示运行期间共享的配置文件管理器。
func NewHandler(manager *appconfig.ConfigManager) *Handler {
	return &Handler{manager: manager}
}

// GetFile 读取当前启动配置文件文本。
//
// @Summary 读取后端配置文件
// @Description 返回当前后端启动 -f 参数指定配置文件的原始文本内容。
// @Tags config
// @Security Bearer
// @Produce json
// @Success 200 {object} FileSuccessResponse "读取成功"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /config/file [get]
func (h *Handler) GetFile(c *gin.Context) {
	snapshot, err := h.manager.ReadFile()
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "读取配置文件失败", "error", err)
		response.Error(c, http.StatusInternalServerError, "读取配置文件失败")
		return
	}

	response.OK(c, toFileData(snapshot))
}

// UpdateFile 保存当前启动配置文件文本并热加载 auth.password。
//
// @Summary 保存后端配置文件
// @Description 保存当前后端启动 -f 参数指定配置文件的完整 YAML 文本，成功后热加载 auth.password。
// @Tags config
// @Security Bearer
// @Accept json
// @Produce json
// @Param request body UpdateFileRequest true "配置文件文本"
// @Success 200 {object} FileSuccessResponse "保存成功"
// @Failure 400 {object} response.ErrorBody "配置内容错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /config/file [put]
func (h *Handler) UpdateFile(c *gin.Context) {
	var req UpdateFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	snapshot, err := h.manager.UpdateFile(req.Content)
	if err != nil {
		handleUpdateError(c, err)
		return
	}

	response.OK(c, toFileData(snapshot))
}

// GetAgent 读取当前结构化小说写作 Agent 配置。
//
// @Summary 读取智能体配置
// @Description 返回当前后端启动配置文件中的 ai.agent 结构化配置。
// @Tags config
// @Security Bearer
// @Produce json
// @Success 200 {object} AgentSuccessResponse "读取成功"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /config/agent [get]
func (h *Handler) GetAgent(c *gin.Context) {
	snapshot, err := h.manager.ReadAgentConfig()
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "读取智能体配置失败", "error", err)
		response.Error(c, http.StatusInternalServerError, "读取智能体配置失败")
		return
	}

	response.OK(c, toAgentData(snapshot))
}

// UpdateAgent 保存结构化小说写作 Agent 配置并热加载。
//
// @Summary 保存智能体配置
// @Description 只替换当前启动配置文件中的 ai.agent 子树，保存成功后立即热加载。
// @Tags config
// @Security Bearer
// @Accept json
// @Produce json
// @Param request body UpdateAgentRequest true "智能体配置"
// @Success 200 {object} AgentSuccessResponse "保存成功"
// @Failure 400 {object} response.ErrorBody "配置内容错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /config/agent [put]
func (h *Handler) UpdateAgent(c *gin.Context) {
	var req UpdateAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	snapshot, err := h.manager.UpdateAgentConfig(req.Agent, biznovelagent.ValidateAgentConfig)
	if err != nil {
		handleAgentUpdateError(c, err)
		return
	}

	response.OK(c, toAgentData(snapshot))
}

// GetChapterSummaryAgent 读取当前结构化章节概要 Agent 配置。
//
// @Summary 读取章节概要 Agent 配置
// @Description 返回当前后端启动配置文件中的 ai.chapter_summary_agent 结构化配置。
// @Tags config
// @Security Bearer
// @Produce json
// @Success 200 {object} ChapterSummaryAgentSuccessResponse "读取成功"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /config/chapter-summary-agent [get]
func (h *Handler) GetChapterSummaryAgent(c *gin.Context) {
	snapshot, err := h.manager.ReadChapterSummaryAgentConfig()
	if err != nil {
		slog.ErrorContext(c.Request.Context(), "读取章节概要 Agent 配置失败", "error", err)
		response.Error(c, http.StatusInternalServerError, "读取章节概要 Agent 配置失败")
		return
	}

	response.OK(c, toChapterSummaryAgentData(snapshot))
}

// UpdateChapterSummaryAgent 保存结构化章节概要 Agent 配置并热加载。
//
// @Summary 保存章节概要 Agent 配置
// @Description 只替换当前启动配置文件中的 ai.chapter_summary_agent 子树，保存成功后立即热加载。
// @Tags config
// @Security Bearer
// @Accept json
// @Produce json
// @Param request body UpdateChapterSummaryAgentRequest true "章节概要 Agent 配置"
// @Success 200 {object} ChapterSummaryAgentSuccessResponse "保存成功"
// @Failure 400 {object} response.ErrorBody "配置内容错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /config/chapter-summary-agent [put]
func (h *Handler) UpdateChapterSummaryAgent(c *gin.Context) {
	var req UpdateChapterSummaryAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	snapshot, err := h.manager.UpdateChapterSummaryAgentConfig(req.ChapterSummaryAgent, bizchaptersummaryagent.ValidateChapterSummaryAgentConfig)
	if err != nil {
		handleChapterSummaryAgentUpdateError(c, err)
		return
	}

	response.OK(c, toChapterSummaryAgentData(snapshot))
}

// handleUpdateError 将配置文件保存错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示保存配置文件时返回的错误。
func handleUpdateError(c *gin.Context, err error) {
	if errors.Is(err, appconfig.ErrConfigContentRequired) {
		response.Error(c, http.StatusBadRequest, "配置内容不能为空")
		return
	}
	if appconfig.IsValidationError(err) {
		response.Error(c, http.StatusBadRequest, "配置内容解析失败，请检查 YAML 格式和字段类型")
		return
	}

	slog.ErrorContext(c.Request.Context(), "保存配置文件失败", "error", err)
	response.Error(c, http.StatusInternalServerError, "保存配置文件失败")
}

// handleAgentUpdateError 将智能体配置保存错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示保存智能体配置时返回的错误。
func handleAgentUpdateError(c *gin.Context, err error) {
	if appconfig.IsValidationError(err) ||
		errors.Is(err, biznovelagent.ErrAgentConfigInvalid) ||
		errors.Is(err, biznovelagent.ErrAgentNotConfigured) {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	slog.ErrorContext(c.Request.Context(), "保存智能体配置失败", "error", err)
	response.Error(c, http.StatusInternalServerError, "保存智能体配置失败")
}

// handleChapterSummaryAgentUpdateError 将章节概要 Agent 配置保存错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示保存章节概要 Agent 配置时返回的错误。
func handleChapterSummaryAgentUpdateError(c *gin.Context, err error) {
	if appconfig.IsValidationError(err) ||
		errors.Is(err, bizchaptersummaryagent.ErrChapterSummaryAgentConfigInvalid) ||
		errors.Is(err, bizchaptersummaryagent.ErrChapterSummaryAgentNotConfigured) {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	slog.ErrorContext(c.Request.Context(), "保存章节概要 Agent 配置失败", "error", err)
	response.Error(c, http.StatusInternalServerError, "保存章节概要 Agent 配置失败")
}

// toFileData 将配置模块快照转换为 HTTP 响应数据。
// 参数 snapshot 表示配置文件文本和加载状态快照。
func toFileData(snapshot appconfig.FileSnapshot) FileData {
	return FileData{
		ConfigFile: snapshot.ConfigFile,
		Content:    snapshot.Content,
		ModifiedAt: snapshot.ModifiedAt,
		ReloadedAt: snapshot.ReloadedAt,
	}
}

// toAgentData 将配置模块智能体快照转换为 HTTP 响应数据。
// 参数 snapshot 表示结构化智能体配置和加载状态快照。
func toAgentData(snapshot appconfig.AgentSnapshot) AgentData {
	return AgentData{
		ConfigFile: snapshot.ConfigFile,
		Agent:      snapshot.Agent,
		ModifiedAt: snapshot.ModifiedAt,
		ReloadedAt: snapshot.ReloadedAt,
	}
}

// toChapterSummaryAgentData 将配置模块章节概要 Agent 快照转换为 HTTP 响应数据。
// 参数 snapshot 表示结构化章节概要 Agent 配置和加载状态快照。
func toChapterSummaryAgentData(snapshot appconfig.ChapterSummaryAgentSnapshot) ChapterSummaryAgentData {
	return ChapterSummaryAgentData{
		ConfigFile:          snapshot.ConfigFile,
		ChapterSummaryAgent: snapshot.ChapterSummaryAgent,
		ModifiedAt:          snapshot.ModifiedAt,
		ReloadedAt:          snapshot.ReloadedAt,
	}
}
