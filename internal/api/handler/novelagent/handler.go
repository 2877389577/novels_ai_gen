package novelagent

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

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
	// NovelID 表示当前请求关联的小说 ID，正式 AI 对话必须传入。
	NovelID uint64 `json:"novel_id" binding:"required" example:"1"`
	// ChapterID 表示当前请求关联的章节 ID，普通对话可为空。
	ChapterID uint64 `json:"chapter_id,omitempty" example:"1"`
	// ChapterNumber 表示当前请求关联的章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number,omitempty" example:"3"`
}

// PromptRecommendationRequest 表示 Swagger 文档中的提示词库推荐判定请求。
type PromptRecommendationRequest struct {
	// ProviderID 表示本次推荐判定使用的 AI 提供商 ID。
	ProviderID uint64 `json:"provider_id" example:"1"`
	// Model 表示本次推荐判定使用的模型标识。
	Model string `json:"model" example:"gpt-5"`
	// Message 表示用户当前尚未发送的 AI 输入框原文。
	Message string `json:"message" example:"帮我把这一段润色得更有压迫感"`
}

// PromptRecommendationData 表示 Swagger 文档中的提示词库推荐判定结果。
type PromptRecommendationData struct {
	// Action 表示前端下一步动作，prompt_search 表示查询数据库提示词，none 表示无需推荐。
	Action string `json:"action" example:"prompt_search"`
	// Matched 表示是否匹配到小说修改或润色相关意图。
	Matched bool `json:"matched" example:"true"`
	// PromptType 表示匹配到的提示词类型，不匹配时为空。
	PromptType string `json:"prompt_type" example:"润色"`
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

// MessageData 表示 Swagger 文档中的 Agent 历史消息响应数据。
type MessageData struct {
	// ID 表示 Agent 消息主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示消息所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// ChapterID 表示本轮消息关联的章节 ID，普通小说级对话可为空。
	ChapterID uint64 `json:"chapter_id,omitempty" example:"1"`
	// Role 表示消息角色，仅包含 user 或 assistant。
	Role string `json:"role" example:"user"`
	// Task 表示产生助手消息的任务类型，用户消息为空。
	Task string `json:"task,omitempty" example:"polish"`
	// Content 表示消息正文。
	Content string `json:"content" example:"帮我润色这一章"`
	// CreatedAt 表示创建时间。
	CreatedAt string `json:"created_at" example:"2026-06-19T22:00:00+08:00"`
}

// MessageListData 表示 Swagger 文档中的 Agent 历史消息列表响应数据。
type MessageListData struct {
	// Items 表示最近的 Agent 历史消息列表，按时间正序排列。
	Items []MessageData `json:"items"`
}

// MessageListSuccessResponse 表示 Agent 历史消息列表接口 Swagger 成功响应结构。
type MessageListSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示 Agent 历史消息列表。
	Data MessageListData `json:"data"`
}

// ClearMessagesData 表示 Swagger 文档中的清空 Agent 历史响应数据。
type ClearMessagesData struct {
	// Cleared 表示本次清空的消息数量。
	Cleared int64 `json:"cleared" example:"2"`
}

// ClearMessagesSuccessResponse 表示清空 Agent 历史接口 Swagger 成功响应结构。
type ClearMessagesSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示清空结果。
	Data ClearMessagesData `json:"data"`
}

// PromptRecommendationSuccessResponse 表示提示词库推荐判定接口 Swagger 成功响应结构。
type PromptRecommendationSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示提示词库推荐判定结果。
	Data PromptRecommendationData `json:"data"`
}

// NewHandler 创建小说写作 Agent HTTP 处理器。
// 参数 service 表示小说写作 Agent 业务服务。
func NewHandler(service *biznovelagent.Service) *Handler {
	return &Handler{service: service}
}

// ListMessages 查询指定小说最近的 Agent 历史消息。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说 Agent 历史消息
// @Description 查询指定小说最近 20 条 Agent 历史消息，按时间正序返回。
// @Tags ai-agents
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Success 200 {object} MessageListSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/agent-messages [get]
func (h *Handler) ListMessages(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	data, err := h.service.ListMessages(c.Request.Context(), novelID)
	if err != nil {
		writeAgentError(c, err)
		return
	}
	response.OK(c, data)
}

// ClearMessages 清空指定小说的 Agent 历史消息。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 清空小说 Agent 历史消息
// @Description 清空指定小说已保存的 Agent 历史消息。
// @Tags ai-agents
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Success 200 {object} ClearMessagesSuccessResponse "清空成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/agent-messages [delete]
func (h *Handler) ClearMessages(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	data, err := h.service.ClearMessages(c.Request.Context(), novelID)
	if err != nil {
		writeAgentError(c, err)
		return
	}
	response.OK(c, data)
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
		if biznovelagent.IsCanceledError(c.Request.Context(), err) {
			return
		}
		_ = writer.WriteEvent(biznovelagent.StreamEvent{
			Type:      "error",
			RequestID: requestid.FromContext(c.Request.Context()),
			Message:   agentErrorMessage(err),
		})
	}
}

// PromptRecommendation 处理提示词库推荐判定请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 提示词库推荐判定
// @Description 使用当前 AI 提供商和模型判断用户输入是否需要查询提示词库推荐；该请求不进入 Agent 记忆。
// @Tags ai-agents
// @Accept json
// @Produce json
// @Security Bearer
// @Param request body PromptRecommendationRequest true "提示词库推荐判定请求"
// @Success 200 {object} PromptRecommendationSuccessResponse "判定成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/agents/prompt-recommendation [post]
func (h *Handler) PromptRecommendation(c *gin.Context) {
	var req PromptRecommendationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.RecommendPromptType(c.Request.Context(), biznovelagent.PromptRecommendationRequest{
		ProviderID: req.ProviderID,
		Model:      req.Model,
		Message:    req.Message,
	})
	if err != nil {
		writeAgentError(c, err)
		return
	}
	response.OK(c, data)
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
	case errors.Is(err, biznovelagent.ErrNovelIDRequired):
		return "当前请求缺少小说 ID"
	case errors.Is(err, biznovelagent.ErrChapterNumberInvalid):
		return "当前章节号无效"
	case errors.Is(err, biznovelagent.ErrChapterContextInvalid):
		return "章节上下文缺少小说 ID"
	case errors.Is(err, biznovelagent.ErrProviderDisabled):
		return "当前 AI 提供商未启用"
	case errors.Is(err, biznovelagent.ErrAgentNotConfigured), errors.Is(err, biznovelagent.ErrAgentConfigInvalid):
		return "AI 写作智能体配置错误"
	case errors.Is(err, biznovelagent.ErrAgentMemoryFailed):
		return "AI 记忆暂时不可用，请稍后再试"
	default:
		return "AI 写作助手暂时不可用，请稍后再试"
	}
}

// parseNovelID 解析路径中的小说 ID。
// 参数 c 表示 Gin 请求上下文。
func parseNovelID(c *gin.Context) (uint64, bool) {
	value := c.Param("id")
	novelID, err := strconv.ParseUint(value, 10, 64)
	if err != nil || novelID == 0 {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return 0, false
	}
	return novelID, true
}

// writeAgentError 根据业务错误写出 Agent HTTP 错误响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeAgentError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, biznovelagent.ErrProviderIDRequired),
		errors.Is(err, biznovelagent.ErrModelRequired),
		errors.Is(err, biznovelagent.ErrMessageRequired),
		errors.Is(err, biznovelagent.ErrNovelIDRequired),
		errors.Is(err, biznovelagent.ErrChapterNumberInvalid),
		errors.Is(err, biznovelagent.ErrProviderDisabled):
		response.Error(c, http.StatusBadRequest, agentErrorMessage(err))
	case errors.Is(err, biznovelagent.ErrChapterContextInvalid):
		response.Error(c, http.StatusBadRequest, agentErrorMessage(err))
	default:
		response.Error(c, http.StatusInternalServerError, agentErrorMessage(err))
	}
}
