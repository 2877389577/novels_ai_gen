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
	// Message 表示用户输入的写作需求或问题。
	Message string `json:"message" example:"帮我润色这一段，让语气更紧张"`
	// NovelID 表示当前请求关联的小说 ID，正式 AI 对话必须传入。
	NovelID uint64 `json:"novel_id" binding:"required" example:"1"`
	// ConversationID 表示本轮请求所属 Agent 会话 ID，空值表示开启新会话。
	ConversationID uint64 `json:"conversation_id,omitempty" example:"1"`
	// ChapterID 表示当前请求关联的章节 ID，普通对话可为空。
	ChapterID uint64 `json:"chapter_id,omitempty" example:"1"`
	// ChapterNumber 表示当前请求关联的章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number,omitempty" example:"3"`
}

// ChatApprovalResumeRequest 表示人工审核后恢复 Agent 执行的请求。
type ChatApprovalResumeRequest struct {
	// NovelID 表示待恢复请求关联的小说 ID。
	NovelID uint64 `json:"novel_id" binding:"required" example:"1"`
	// ConversationID 表示待恢复请求所属 Agent 会话 ID，新会话恢复时可为空。
	ConversationID uint64 `json:"conversation_id,omitempty" example:"1"`
	// ChapterID 表示待恢复请求关联的章节 ID，普通对话可为空。
	ChapterID uint64 `json:"chapter_id,omitempty" example:"1"`
	// ChapterNumber 表示待恢复请求关联的章节号，即“第 x 章”中的 x。
	ChapterNumber int `json:"chapter_number,omitempty" example:"3"`
	// CheckPointID 表示 Eino ADK 中断时保存的 checkpoint 标识。
	CheckPointID string `json:"checkpoint_id" binding:"required" example:"agent-approval-abc123"`
	// InterruptID 表示本次人工审核对应的中断点标识。
	InterruptID string `json:"interrupt_id" binding:"required" example:"agent:supervisor;tool:get_content:call_1"`
	// Approved 表示用户是否允许执行该工具。
	Approved bool `json:"approved" example:"true"`
	// Reason 表示用户拒绝或批准时填写的补充原因。
	Reason string `json:"reason,omitempty" example:"这次允许读取章节内容"`
}

// StreamEvent 表示小说写作 Agent NDJSON 流事件。
type StreamEvent struct {
	// Type 表示事件类型，支持 meta、delta、approval_required、done、error。
	Type string `json:"type" example:"delta"`
	// RequestID 表示本次流式请求的追踪标识，用于和后端日志关联。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Stage 表示 meta 事件所处阶段。
	Stage string `json:"stage,omitempty" example:"routed"`
	// Task 表示顶层 Agent 选择的任务类型。
	Task string `json:"task,omitempty" example:"polish"`
	// ReplyIndex 表示同一次请求中的可见助手回复段序号，从 1 开始。
	ReplyIndex int `json:"reply_index,omitempty" example:"1"`
	// Content 表示增量文本或完整文本内容。
	Content string `json:"content,omitempty" example:"雨夜里，门外的脚步声一点点逼近。"`
	// Replies 表示 done 事件中返回的分段助手回复列表。
	Replies []StreamReply `json:"replies,omitempty"`
	// ConversationID 表示本轮回复保存到的 Agent 会话 ID，仅 done 事件返回。
	ConversationID uint64 `json:"conversation_id,omitempty" example:"1"`
	// ConversationTitle 表示本轮回复保存到的 Agent 会话标题，仅 done 事件返回。
	ConversationTitle string `json:"conversation_title,omitempty" example:"讨论第三章节奏"`
	// Message 表示错误或状态说明。
	Message string `json:"message,omitempty" example:"ok"`
	// CheckPointID 表示等待人工审核时用于恢复 Agent 执行的 checkpoint 标识。
	CheckPointID string `json:"checkpoint_id,omitempty" example:"agent-approval-abc123"`
	// InterruptID 表示等待人工审核时需要恢复的中断点标识。
	InterruptID string `json:"interrupt_id,omitempty" example:"agent:supervisor;tool:get_content:call_1"`
	// ToolName 表示等待人工审核的工具名称。
	ToolName string `json:"tool_name,omitempty" example:"get_content"`
	// ToolArguments 表示等待人工审核的工具调用参数 JSON 字符串。
	ToolArguments string `json:"tool_arguments,omitempty" example:"{\"chapter_number\":3}"`
}

// StreamReply 表示 Swagger 文档中的单段 Agent 助手回复。
type StreamReply struct {
	// ReplyIndex 表示同一次请求中的可见助手回复段序号，从 1 开始。
	ReplyIndex int `json:"reply_index" example:"1"`
	// Task 表示产生该回复段的任务来源。
	Task string `json:"task,omitempty" example:"polish"`
	// Content 表示该回复段的完整文本内容。
	Content string `json:"content" example:"我先读取当前章节内容。"`
}

// MessageData 表示 Swagger 文档中的 Agent 历史消息响应数据。
type MessageData struct {
	// ID 表示 Agent 消息主键 ID。
	ID uint64 `json:"id" example:"1"`
	// ConversationID 表示消息所属 Agent 会话 ID。
	ConversationID uint64 `json:"conversation_id" example:"1"`
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

// ConversationData 表示 Swagger 文档中的 Agent 会话响应数据。
type ConversationData struct {
	// ID 表示 Agent 会话主键 ID。
	ID uint64 `json:"id" example:"1"`
	// NovelID 表示会话所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// Title 表示 Agent 会话标题。
	Title string `json:"title" example:"讨论第三章节奏"`
	// CreatedAt 表示创建时间。
	CreatedAt string `json:"created_at" example:"2026-06-19T22:00:00+08:00"`
	// UpdatedAt 表示更新时间。
	UpdatedAt string `json:"updated_at" example:"2026-06-19T22:00:00+08:00"`
}

// ConversationListData 表示 Swagger 文档中的 Agent 会话列表响应数据。
type ConversationListData struct {
	// Items 表示当前小说下的 Agent 会话列表，按更新时间倒序排列。
	Items []ConversationData `json:"items"`
}

// ConversationListSuccessResponse 表示 Agent 会话列表接口 Swagger 成功响应结构。
type ConversationListSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示 Agent 会话列表。
	Data ConversationListData `json:"data"`
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

// DeleteConversationData 表示 Swagger 文档中的删除 Agent 会话响应数据。
type DeleteConversationData struct {
	// Deleted 表示 Agent 会话是否已经删除。
	Deleted bool `json:"deleted" example:"true"`
}

// DeleteConversationSuccessResponse 表示删除 Agent 会话接口 Swagger 成功响应结构。
type DeleteConversationSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示删除结果。
	Data DeleteConversationData `json:"data"`
}

// NewHandler 创建小说写作 Agent HTTP 处理器。
// 参数 service 表示小说写作 Agent 业务服务。
func NewHandler(service *biznovelagent.Service) *Handler {
	return &Handler{service: service}
}

// ListConversations 查询指定小说下的 Agent 会话列表。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说 Agent 会话列表
// @Description 查询指定小说下的 Agent 会话列表，按更新时间倒序返回。
// @Tags ai-agents
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Success 200 {object} ConversationListSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/agent-conversations [get]
func (h *Handler) ListConversations(c *gin.Context) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return
	}

	data, err := h.service.ListConversations(c.Request.Context(), novelID)
	if err != nil {
		writeAgentError(c, err)
		return
	}
	response.OK(c, data)
}

// ListConversationMessages 查询指定 Agent 会话最近的历史消息。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询指定 Agent 会话历史消息
// @Description 查询指定小说下某个 Agent 会话最近 20 条历史消息，按时间正序返回。
// @Tags ai-agents
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param conversation_id path int true "Agent 会话 ID"
// @Success 200 {object} MessageListSuccessResponse "查询成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 404 {object} response.ErrorBody "Agent 会话不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/agent-conversations/{conversation_id}/messages [get]
func (h *Handler) ListConversationMessages(c *gin.Context) {
	novelID, conversationID, ok := parseNovelConversationID(c)
	if !ok {
		return
	}

	data, err := h.service.ListConversationMessages(c.Request.Context(), novelID, conversationID)
	if err != nil {
		writeAgentError(c, err)
		return
	}
	response.OK(c, data)
}

// DeleteConversation 删除指定 Agent 会话及其历史消息。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 删除指定 Agent 会话
// @Description 删除指定小说下某个 Agent 会话，并同步删除该会话已保存的历史消息和概要。
// @Tags ai-agents
// @Accept json
// @Produce json
// @Security Bearer
// @Param novel_id path int true "小说 ID"
// @Param conversation_id path int true "Agent 会话 ID"
// @Success 200 {object} DeleteConversationSuccessResponse "删除成功"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 404 {object} response.ErrorBody "Agent 会话不存在"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /novels/{novel_id}/agent-conversations/{conversation_id} [delete]
func (h *Handler) DeleteConversation(c *gin.Context) {
	novelID, conversationID, ok := parseNovelConversationID(c)
	if !ok {
		return
	}

	data, err := h.service.DeleteConversation(c.Request.Context(), novelID, conversationID)
	if err != nil {
		writeAgentError(c, err)
		return
	}
	response.OK(c, data)
}

// ListMessages 查询指定小说最近更新会话的 Agent 历史消息。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 查询小说 Agent 历史消息
// @Description 兼容旧接口：查询指定小说最近更新会话的最近 20 条 Agent 历史消息，按时间正序返回。
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

// StreamChat 处理小说写作 Agent 流式对话请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 小说写作 Agent 流式对话
// @Description 使用 Agent 自定义模型配置创建 Eino 写作 Agent，并以 NDJSON 流式返回模型输出。
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

// ResumeToolApproval 处理小说写作 Agent 工具人工审核恢复请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 恢复 AI Agent 工具人工审核
// @Description 用户批准或拒绝工具执行后，从 Eino ADK checkpoint 恢复小说写作 Agent，并继续以 NDJSON 输出。
// @Tags novel-agents
// @Accept json
// @Produce application/x-ndjson
// @Security Bearer
// @Param request body ChatApprovalResumeRequest true "人工审核恢复请求"
// @Success 200 {object} StreamEvent "NDJSON 流事件"
// @Failure 400 {object} response.ErrorBody "请求参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录已过期"
// @Failure 404 {object} response.ErrorBody "人工审核记录不存在或已失效"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /ai/agents/chat/approval/resume [post]
func (h *Handler) ResumeToolApproval(c *gin.Context) {
	var req biznovelagent.ChatApprovalResumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}
	if err := biznovelagent.ValidateChatApprovalResumeRequest(req); err != nil {
		writeAgentError(c, err)
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
	if err := h.service.ResumeToolApproval(c.Request.Context(), req, writer); err != nil && !writer.hasError {
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
	case errors.Is(err, biznovelagent.ErrMessageRequired):
		return "请输入要发送给 AI 的内容"
	case errors.Is(err, biznovelagent.ErrNovelIDRequired):
		return "当前请求缺少小说 ID"
	case errors.Is(err, biznovelagent.ErrChapterNumberInvalid):
		return "当前章节号无效"
	case errors.Is(err, biznovelagent.ErrChapterContextInvalid):
		return "章节上下文缺少小说 ID"
	case errors.Is(err, biznovelagent.ErrConversationNotFound):
		return "Agent 会话不存在"
	case errors.Is(err, biznovelagent.ErrProviderDisabled):
		return "当前 AI 提供商未启用"
	case errors.Is(err, biznovelagent.ErrAgentNotConfigured), errors.Is(err, biznovelagent.ErrAgentConfigInvalid):
		return "AI 写作智能体配置错误"
	case errors.Is(err, biznovelagent.ErrAgentMemoryFailed):
		return "AI 记忆暂时不可用，请稍后再试"
	case errors.Is(err, biznovelagent.ErrAgentApprovalNotFound):
		return "人工审核记录不存在或已失效，请重新发起 AI 请求"
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

// parseNovelConversationID 解析路径中的小说 ID 和 Agent 会话 ID。
// 参数 c 表示 Gin 请求上下文。
func parseNovelConversationID(c *gin.Context) (uint64, uint64, bool) {
	novelID, ok := parseNovelID(c)
	if !ok {
		return 0, 0, false
	}
	value := c.Param("conversation_id")
	conversationID, err := strconv.ParseUint(value, 10, 64)
	if err != nil || conversationID == 0 {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return 0, 0, false
	}
	return novelID, conversationID, true
}

// writeAgentError 根据业务错误写出 Agent HTTP 错误响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeAgentError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, biznovelagent.ErrMessageRequired),
		errors.Is(err, biznovelagent.ErrNovelIDRequired),
		errors.Is(err, biznovelagent.ErrChapterNumberInvalid),
		errors.Is(err, biznovelagent.ErrProviderDisabled):
		response.Error(c, http.StatusBadRequest, agentErrorMessage(err))
	case errors.Is(err, biznovelagent.ErrChapterContextInvalid):
		response.Error(c, http.StatusBadRequest, agentErrorMessage(err))
	case errors.Is(err, biznovelagent.ErrConversationNotFound):
		response.Error(c, http.StatusNotFound, agentErrorMessage(err))
	case errors.Is(err, biznovelagent.ErrAgentApprovalNotFound):
		response.Error(c, http.StatusNotFound, agentErrorMessage(err))
	default:
		response.Error(c, http.StatusInternalServerError, agentErrorMessage(err))
	}
}
