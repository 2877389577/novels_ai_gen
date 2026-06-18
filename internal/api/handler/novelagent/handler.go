package novelagent

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	biznovelagent "novels_ai_gen/internal/biz/novelagent"
	"novels_ai_gen/internal/requestid"
)

// Handler 表示小说写作 Agent HTTP 处理器。
type Handler struct {
	// service 表示小说写作 Agent 业务服务。
	service *biznovelagent.Service
}

// ChatRequest 表示小说写作 Agent 流式对话请求。
type ChatRequest struct {
	// ProviderID 表示本次对话使用的 AI 提供商 ID。
	ProviderID uint64 `json:"provider_id" example:"1"`
	// Model 表示本次对话使用的模型标识。
	Model string `json:"model" example:"gpt-5"`
	// Message 表示用户输入的写作需求或问题。
	Message string `json:"message" example:"帮我润色这一段，让语气更紧张"`
	// PromptParams 表示前端传入的提示词占位符参数，键对应模板中的变量名。
	PromptParams map[string]string `json:"prompt_params" example:"text:雨夜里，门外响起了脚步声。"`
}

// StreamEvent 表示小说写作 Agent NDJSON 流事件。
type StreamEvent struct {
	// Type 表示事件类型，支持 meta、delta、done、error。
	Type string `json:"type" example:"delta"`
	// RequestID 表示本次流式请求的追踪标识，用于和后端日志关联。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Stage 表示 meta 事件所处阶段。
	Stage string `json:"stage,omitempty" example:"routed"`
	// Task 表示顶层 Agent 选择的任务类型。
	Task string `json:"task,omitempty" example:"polish"`
	// Content 表示增量文本或完整文本内容。
	Content string `json:"content,omitempty" example:"雨夜里，门外的脚步声一点点逼近。"`
	// Message 表示错误或状态说明。
	Message string `json:"message,omitempty" example:"ok"`
}

// NewHandler 创建小说写作 Agent HTTP 处理器。
// 参数 service 表示小说写作 Agent 业务服务。
func NewHandler(service *biznovelagent.Service) *Handler {
	return &Handler{service: service}
}

// StreamChat 处理小说写作 Agent 流式对话请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 小说写作 Agent 流式对话
// @Description 使用已保存 AI 提供商配置创建 Eino 写作 Agent，并以 NDJSON 流式返回模型输出。
// @Tags ai-agents
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body ChatRequest true "小说写作 Agent 流式对话请求"
// @Success 200 {object} StreamEvent "NDJSON 流事件"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/agents/chat/stream [post]
func (h *Handler) StreamChat(c *gin.Context) {
	var req biznovelagent.ChatRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}
	if err := biznovelagent.ValidateChatRequest(req); err != nil {
		response.Error(c, http.StatusBadRequest, agentErrorMessage(err))
		return
	}

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		response.Error(c, http.StatusInternalServerError, "当前运行环境不支持 AI 流式输出")
		return
	}

	c.Header("Content-Type", "application/x-ndjson; charset=utf-8")
	c.Status(http.StatusOK)

	writer := &ndjsonWriter{
		encoder: json.NewEncoder(c.Writer),
		flusher: flusher,
	}
	if err := h.service.StreamChat(c.Request.Context(), req, writer); err != nil && !writer.hasError {
		_ = writer.WriteEvent(biznovelagent.StreamEvent{
			Type:      "error",
			RequestID: requestid.FromContext(c.Request.Context()),
			Message:   agentErrorMessage(err),
		})
	}
}

// ndjsonWriter 表示基于 HTTP 响应的 NDJSON 流事件写出器。
type ndjsonWriter struct {
	// encoder 表示 JSON 行编码器。
	encoder *json.Encoder
	// flusher 表示 HTTP 响应刷新器。
	flusher http.Flusher
	// hasError 表示是否已经写出 error 事件。
	hasError bool
}

// WriteEvent 写出并刷新一个 NDJSON 流事件。
// 参数 event 表示需要写出的流事件。
func (w *ndjsonWriter) WriteEvent(event biznovelagent.StreamEvent) error {
	if event.Type == "error" {
		w.hasError = true
	}
	if err := w.encoder.Encode(event); err != nil {
		return err
	}
	w.flusher.Flush()
	return nil
}

// agentErrorMessage 将 Agent 内部错误转换为用户可理解的提示。
// 参数 err 表示业务层返回的错误。
func agentErrorMessage(err error) string {
	switch {
	case errors.Is(err, biznovelagent.ErrProviderIDRequired):
		return "请选择 AI 提供商"
	case errors.Is(err, biznovelagent.ErrModelRequired):
		return "请选择 AI 模型"
	case errors.Is(err, biznovelagent.ErrMessageRequired):
		return "请输入要发送给 AI 的内容"
	case errors.Is(err, biznovelagent.ErrProviderDisabled):
		return "当前 AI 提供商未启用"
	case errors.Is(err, biznovelagent.ErrUnsupportedTask):
		return "当前 AI 写作任务暂不支持"
	case errors.Is(err, biznovelagent.ErrPromptNotConfigured):
		return "AI 写作提示词未配置"
	case errors.Is(err, biznovelagent.ErrPromptVariableMissing):
		return "AI 写作提示词变量缺失"
	default:
		return "AI 写作助手暂时不可用，请稍后再试"
	}
}
