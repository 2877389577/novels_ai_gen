package novelagent

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"
	appconfig "novels_ai_gen/internal/bootstrap/config"
	"novels_ai_gen/internal/requestid"
)

const (
	defaultConversationTitle   = "新会话"
	maxConversationTitleLength = 50
)

// Repository 表示小说写作 Agent 读取 AI 提供商配置的数据依赖。
type Repository interface {
	// GetByID 根据 ID 查询 AI 提供商。
	// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
	GetByID(ctx context.Context, id uint64) (*bizaiprovider.Provider, error)
}

// MemoryRepository 表示小说写作 Agent 记忆读写数据依赖。
type MemoryRepository interface {
	// ListConversationsByNovelID 查询指定小说下的 Agent 会话列表。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	ListConversationsByNovelID(ctx context.Context, novelID uint64) ([]Conversation, error)
	// FindLatestConversationByNovelID 查询指定小说最近更新的 Agent 会话。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	FindLatestConversationByNovelID(ctx context.Context, novelID uint64) (*Conversation, bool, error)
	// FindConversationByID 根据小说 ID 和会话 ID 查询 Agent 会话。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID。
	FindConversationByID(ctx context.Context, novelID uint64, conversationID uint64) (*Conversation, bool, error)
	// CreateConversation 创建指定小说下的 Agent 会话。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 title 表示会话标题。
	CreateConversation(ctx context.Context, novelID uint64, title string) (*Conversation, error)
	// ListRecentMessages 查询指定会话最近的 Agent 记忆消息，并按时间正序返回。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 limit 表示最多返回的消息数量。
	ListRecentMessages(ctx context.Context, conversationID uint64, limit int) ([]MessageRecord, error)
	// ListRecentMessagesByUserRounds 查询指定会话最近若干个用户轮次的 Agent 记忆消息，并按时间正序返回。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 rounds 表示最多返回的最近用户消息轮次数量。
	ListRecentMessagesByUserRounds(ctx context.Context, conversationID uint64, rounds int) ([]MessageRecord, error)
	// ListMessagesAfterID 查询指定消息 ID 之后的 Agent 记忆消息，并按时间正序返回。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 afterID 表示已经纳入摘要的最新消息 ID；参数 limit 表示最多返回的消息数量，小于等于 0 表示不限制。
	ListMessagesAfterID(ctx context.Context, conversationID uint64, afterID uint64, limit int) ([]MessageRecord, error)
	// AppendMessagesAndUpdateSummary 以事务追加 Agent 记忆消息并可选更新会话摘要。
	// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 messages 表示需要写入的消息列表；参数 summary 表示需要写回的摘要更新，nil 表示不更新摘要。
	AppendMessagesAndUpdateSummary(ctx context.Context, conversationID uint64, messages []MessageRecord, summary *ConversationSummaryUpdate) error
	// DeleteConversationByID 删除指定小说下的 Agent 会话及其记忆消息。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	// 参数 conversationID 表示 Agent 会话主键 ID。
	DeleteConversationByID(ctx context.Context, novelID uint64, conversationID uint64) error
}

// Cipher 表示小说写作 Agent 解密 AI 提供商 API Key 的依赖。
type Cipher interface {
	// Decrypt 解密 AI 提供商 API Key 密文。
	// 参数 value 表示保存于数据库中的 API Key 密文。
	Decrypt(value string) (string, error)
}

// PromptProvider 表示可读取当前运行配置快照的依赖。
type PromptProvider interface {
	// Current 返回当前有效应用配置快照。
	Current() *appconfig.AppConfig
}

// Service 表示小说写作 Agent 业务服务。
type Service struct {
	// repo 表示 AI 提供商仓储。
	repo Repository
	// cipher 表示 AI 提供商 API Key 解密器。
	cipher Cipher
	// prompts 表示运行时提示词配置来源。
	prompts PromptProvider
	// runtimeFactory 表示 Eino 多层 Agent 运行时工厂。
	runtimeFactory AgentRuntimeFactory
	// memoryRepo 表示会话级 Agent 记忆仓储。
	memoryRepo MemoryRepository
	// approvalStore 表示人工审核 checkpoint 与待审核记录的内存存储。
	approvalStore *agentApprovalStore
	// runManager 表示进程内 AI 对话后台运行任务管理器。
	runManager *agentRunManager
}

// loggedAgentError 表示已经写过错误日志的 Agent 错误包装。
type loggedAgentError struct {
	// err 表示被包装的原始错误。
	err error
}

// Error 返回原始错误文本。
func (e *loggedAgentError) Error() string {
	if e == nil || e.err == nil {
		return ""
	}
	return e.err.Error()
}

// Unwrap 返回被包装的原始错误，供 errors.Is 和 errors.As 继续匹配。
func (e *loggedAgentError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

// markAgentErrorLogged 标记错误已经在 Agent 内部写过日志。
// 参数 err 表示需要标记的错误。
func markAgentErrorLogged(err error) error {
	if err == nil || isAgentErrorLogged(err) {
		return err
	}
	return &loggedAgentError{err: err}
}

// isAgentErrorLogged 判断错误链中是否已经包含 Agent 日志标记。
// 参数 err 表示需要检查的错误。
func isAgentErrorLogged(err error) bool {
	var logged *loggedAgentError
	return errors.As(err, &logged)
}

// savedTurnInfo 表示本轮成功入库后的会话信息。
type savedTurnInfo struct {
	// ConversationID 表示本轮消息保存到的 Agent 会话 ID。
	ConversationID uint64
	// ConversationTitle 表示本轮消息保存到的 Agent 会话标题。
	ConversationTitle string
}

// NewService 创建小说写作 Agent 业务服务。
// 参数 repo 表示 AI 提供商仓储；参数 cipher 表示 API Key 解密器；参数 prompts 表示提示词配置来源；参数 runtimeFactory 表示 Eino 多层 Agent 运行时工厂；参数 memoryRepo 表示会话级 Agent 记忆仓储。
func NewService(repo Repository, cipher Cipher, prompts PromptProvider, runtimeFactory AgentRuntimeFactory, memoryRepo MemoryRepository) *Service {
	if runtimeFactory == nil {
		runtimeFactory = NewEinoAgentRuntimeFactory(nil, nil, nil, nil, nil)
	}
	return &Service{
		repo:           repo,
		cipher:         cipher,
		prompts:        prompts,
		runtimeFactory: runtimeFactory,
		memoryRepo:     memoryRepo,
		approvalStore:  newAgentApprovalStore(),
		runManager:     newAgentRunManager(),
	}
}

// ensureApprovalStore 返回可用的人工审核内存存储。
func (s *Service) ensureApprovalStore() *agentApprovalStore {
	if s.approvalStore == nil {
		s.approvalStore = newAgentApprovalStore()
	}
	return s.approvalStore
}

// ensureRunManager 返回可用的 AI 对话后台运行任务管理器。
func (s *Service) ensureRunManager() *agentRunManager {
	if s.runManager == nil {
		s.runManager = newAgentRunManager()
	}
	return s.runManager
}

// logAgentRunError 写出后台 Agent 任务的兜底错误日志。
// 参数 ctx 表示任务上下文；参数 message 表示日志消息；参数 err 表示任务错误；参数 run 表示后台运行任务。
func (*Service) logAgentRunError(ctx context.Context, message string, err error, run *agentRun) {
	if err == nil || isAgentErrorLogged(err) || IsCanceledError(ctx, err) {
		return
	}
	fields := []any{
		"error", err,
		"request_id", requestid.FromContext(ctx),
	}
	if run != nil {
		fields = append(fields,
			"run_id", run.id,
			"novel_id", run.req.NovelID,
			"conversation_id", run.req.ConversationID,
			"chapter_id", run.req.ChapterID,
			"chapter_number", run.req.ChapterNumber,
		)
	}
	slog.ErrorContext(ctx, message, fields...)
}

// StreamChat 创建小说写作 Agent 后台对话任务，并订阅该任务的流事件。
// 参数 ctx 表示当前 HTTP 订阅请求上下文；参数 req 表示流式对话请求；参数 writer 表示 NDJSON 事件写出器。
func (s *Service) StreamChat(ctx context.Context, req ChatRequest, writer EventWriter) error {
	req = normalizeChatRequest(req)
	if err := ValidateChatRequest(req); err != nil {
		return err
	}
	if writer == nil {
		return fmt.Errorf("Agent 流事件写出器不能为空")
	}

	run, err := s.startChatRun(ctx, req)
	if err != nil {
		return err
	}
	return s.StreamRun(ctx, run.id, writer)
}

// startChatRun 创建后台执行的小说写作 Agent 对话任务。
// 参数 ctx 表示创建任务的请求上下文；参数 req 表示流式对话请求。
func (s *Service) startChatRun(ctx context.Context, req ChatRequest) (*agentRun, error) {
	runCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))
	run, err := s.ensureRunManager().NewRun(runCtx, cancel, req)
	if err != nil {
		cancel()
		return nil, err
	}
	_ = run.WriteEvent(StreamEvent{Type: "meta", Stage: "accepted", Message: "Agent 任务已进入后台执行"})
	go s.executeChatRun(run)
	return run, nil
}

// executeChatRun 在后台执行小说写作 Agent 对话任务。
// 参数 run 表示需要执行的后台任务。
func (s *Service) executeChatRun(run *agentRun) {
	status := AgentRunStatusCompleted
	if err := s.executeChat(run.ctx, run.req, run); err != nil {
		if IsCanceledError(run.ctx, err) {
			status = AgentRunStatusCancelled
			_ = run.WriteEvent(StreamEvent{Type: "cancelled", RequestID: requestid.FromContext(run.ctx), Message: "本次 AI 回复已取消。"})
		} else {
			status = AgentRunStatusFailed
			s.logAgentRunError(run.ctx, "小说写作 Agent 后台任务失败", err, run)
			_ = run.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(run.ctx), Message: friendlyError(err)})
		}
	}
	if s.ensureRunManager().Status(run) == AgentRunStatusApprovalRequired {
		s.ensureRunManager().Pause(run)
		return
	}
	s.ensureRunManager().Finish(run, status)
}

// executeChat 执行小说写作 Agent 对话并写出流事件。
// 参数 ctx 表示后台运行上下文；参数 req 表示流式对话请求；参数 writer 表示事件写出器。
func (s *Service) executeChat(ctx context.Context, req ChatRequest, writer EventWriter) error {
	cfg := s.currentConfig()
	modelConfig, err := s.runtimeModelConfig(ctx, cfg)
	if err != nil {
		return err
	}
	entryConfig := modelConfig.Default
	memory, err := s.memoryForRun(ctx, cfg, req.NovelID, req.ConversationID)
	if err != nil {
		return err
	}

	runtime, err := s.runtimeFactory.NewRuntime(ctx, modelConfig)
	if err != nil {
		slog.ErrorContext(ctx, "小说写作 Agent 创建运行时失败",
			"error", err,
			"provider_id", entryConfig.ProviderID,
			"provider_type", entryConfig.ProviderType,
			"api_type", entryConfig.APIType,
			"model", entryConfig.Model,
			"base_url_configured", strings.TrimSpace(entryConfig.BaseURL) != "",
		)
		return markAgentErrorLogged(fmt.Errorf("%w: %w", ErrModelStreamFailed, err))
	}

	if err := writer.WriteEvent(StreamEvent{Type: "meta", Stage: "started", Message: "Agent 已开始处理"}); err != nil {
		return err
	}

	if err := writer.WriteEvent(StreamEvent{Type: "meta", Stage: "routed", Message: "顶层 Agent 将自行决定是否调用子 Agent"}); err != nil {
		return err
	}

	checkPointID, err := newAgentCheckPointID()
	if err != nil {
		return err
	}
	approvalStore := s.ensureApprovalStore()
	control := AgentRunControl{CheckPointID: checkPointID, CheckPointStore: approvalStore}
	result, err := runtime.Stream(ctx, cfg, req, memory, control, func(delta AgentDelta) error {
		if delta.Content == "" {
			return nil
		}
		return writer.WriteEvent(StreamEvent{Type: "delta", Task: delta.Task, ReplyIndex: delta.ReplyIndex, Content: delta.Content})
	})
	if err != nil {
		if IsCanceledError(ctx, err) {
			return ctx.Err()
		}
		var interrupted *AgentInterruptedError
		if errors.As(err, &interrupted) {
			approvalStore.SavePending(pendingApprovalFromInterrupt(req, interrupted))
			return writer.WriteEvent(approvalRequiredStreamEvent(interrupted))
		}
		slog.ErrorContext(ctx, "小说写作 Agent 执行失败",
			"error", err,
			"provider_id", entryConfig.ProviderID,
			"provider_type", entryConfig.ProviderType,
			"api_type", entryConfig.APIType,
			"model", entryConfig.Model,
			"base_url_configured", strings.TrimSpace(entryConfig.BaseURL) != "",
		)
		_ = writer.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(ctx), Task: result.Task, Message: friendlyError(err)})
		return markAgentErrorLogged(fmt.Errorf("%w: %w", ErrModelStreamFailed, err))
	}
	if IsCanceledError(ctx, nil) {
		return ctx.Err()
	}
	if !hasDisplayableAgentReply(result) {
		slog.ErrorContext(ctx, "小说写作 Agent 返回空内容",
			"error", ErrAgentEmptyResponse,
			"provider_id", entryConfig.ProviderID,
			"provider_type", entryConfig.ProviderType,
			"api_type", entryConfig.APIType,
			"model", entryConfig.Model,
			"base_url_configured", strings.TrimSpace(entryConfig.BaseURL) != "",
		)
		_ = writer.WriteEvent(StreamEvent{
			Type:      "error",
			RequestID: requestid.FromContext(ctx),
			Task:      result.Task,
			Message:   friendlyError(ErrAgentEmptyResponse),
		})
		return markAgentErrorLogged(fmt.Errorf("%w: %w", ErrModelStreamFailed, ErrAgentEmptyResponse))
	}
	savedTurn, err := s.saveSuccessfulTurn(ctx, cfg, runtime, req, result, entryConfig, nil)
	if err != nil {
		if IsCanceledError(ctx, err) {
			return ctx.Err()
		}
		slog.ErrorContext(ctx, "小说写作 Agent 记忆保存失败",
			"error", err,
			"provider_id", entryConfig.ProviderID,
			"model", entryConfig.Model,
			"novel_id", req.NovelID,
			"chapter_id", req.ChapterID,
			"chapter_number", req.ChapterNumber,
		)
		_ = writer.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(ctx), Task: result.Task, Message: "AI 记忆保存失败，本次回复未完成入库"})
		return markAgentErrorLogged(fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err))
	}

	return writer.WriteEvent(StreamEvent{
		Type:              "done",
		Task:              result.Task,
		Content:           result.Content,
		Replies:           streamRepliesForResult(result),
		ConversationID:    savedTurn.ConversationID,
		ConversationTitle: savedTurn.ConversationTitle,
		Message:           "ok",
	})
}

// ResumeToolApproval 创建人工审核恢复后台任务，并订阅该任务的流事件。
// 参数 ctx 表示当前 HTTP 订阅请求上下文；参数 req 表示人工审核恢复请求；参数 writer 表示 NDJSON 事件写出器。
func (s *Service) ResumeToolApproval(ctx context.Context, req ChatApprovalResumeRequest, writer EventWriter) error {
	req = normalizeChatApprovalResumeRequest(req)
	if err := ValidateChatApprovalResumeRequest(req); err != nil {
		return err
	}
	if writer == nil {
		return fmt.Errorf("Agent 流事件写出器不能为空")
	}

	run, err := s.startApprovalRun(ctx, req)
	if err != nil {
		return err
	}
	return s.StreamRun(ctx, run.id, writer)
}

// startApprovalRun 创建后台执行的人工审核恢复任务。
// 参数 ctx 表示创建任务的请求上下文；参数 req 表示人工审核恢复请求。
func (s *Service) startApprovalRun(ctx context.Context, req ChatApprovalResumeRequest) (*agentRun, error) {
	approvalStore := s.ensureApprovalStore()
	pendingApproval, ok := approvalStore.FindPending(req.CheckPointID, req.InterruptID)
	if !ok || pendingApproval.Request.NovelID != req.NovelID {
		return nil, ErrAgentApprovalNotFound
	}
	s.ensureRunManager().FinishApprovalRun(req.CheckPointID, req.InterruptID)

	runCtx, cancel := context.WithCancel(context.WithoutCancel(ctx))
	run, err := s.ensureRunManager().NewRun(runCtx, cancel, pendingApproval.Request)
	if err != nil {
		cancel()
		return nil, err
	}
	_ = run.WriteEvent(StreamEvent{Type: "meta", Stage: "accepted", Message: "Agent 恢复任务已进入后台执行"})
	go s.executeApprovalRun(run, req, pendingApproval)
	return run, nil
}

// executeApprovalRun 在后台执行人工审核恢复任务。
// 参数 run 表示需要执行的后台任务；参数 req 表示人工审核恢复请求；参数 pendingApproval 表示原始待审核工具调用。
func (s *Service) executeApprovalRun(run *agentRun, req ChatApprovalResumeRequest, pendingApproval pendingToolApproval) {
	status := AgentRunStatusCompleted
	if err := s.executeApproval(run.ctx, req, run, pendingApproval); err != nil {
		if IsCanceledError(run.ctx, err) {
			status = AgentRunStatusCancelled
			_ = run.WriteEvent(StreamEvent{Type: "cancelled", RequestID: requestid.FromContext(run.ctx), Message: "本次 AI 回复已取消。"})
		} else {
			status = AgentRunStatusFailed
			s.logAgentRunError(run.ctx, "小说写作 Agent 人工审核恢复后台任务失败", err, run)
			_ = run.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(run.ctx), Message: friendlyError(err)})
		}
	}
	if s.ensureRunManager().Status(run) == AgentRunStatusApprovalRequired {
		s.ensureRunManager().Pause(run)
		return
	}
	s.ensureRunManager().Finish(run, status)
}

// executeApproval 根据用户人工审核结果恢复小说写作 Agent 流式对话。
// 参数 ctx 表示后台运行上下文；参数 req 表示人工审核恢复请求；参数 writer 表示事件写出器；参数 pendingApproval 表示原始待审核工具调用。
func (s *Service) executeApproval(ctx context.Context, req ChatApprovalResumeRequest, writer EventWriter, pendingApproval pendingToolApproval) error {
	approvalStore := s.ensureApprovalStore()
	originalReq := pendingApproval.Request
	cfg := s.currentConfig()
	modelConfig, err := s.runtimeModelConfig(ctx, cfg)
	if err != nil {
		return err
	}
	entryConfig := modelConfig.Default
	memory, err := s.memoryForRun(ctx, cfg, originalReq.NovelID, originalReq.ConversationID)
	if err != nil {
		return err
	}

	runtime, err := s.runtimeFactory.NewRuntime(ctx, modelConfig)
	if err != nil {
		slog.ErrorContext(ctx, "小说写作 Agent 创建恢复运行时失败",
			"error", err,
			"provider_id", entryConfig.ProviderID,
			"provider_type", entryConfig.ProviderType,
			"api_type", entryConfig.APIType,
			"model", entryConfig.Model,
			"base_url_configured", strings.TrimSpace(entryConfig.BaseURL) != "",
		)
		return markAgentErrorLogged(fmt.Errorf("%w: %w", ErrModelStreamFailed, err))
	}

	if err := writer.WriteEvent(StreamEvent{Type: "meta", Stage: "resumed", Message: "Agent 已根据人工审核继续处理"}); err != nil {
		return err
	}

	control := AgentRunControl{
		CheckPointID:    req.CheckPointID,
		InterruptID:     req.InterruptID,
		CheckPointStore: approvalStore,
	}
	approval := ToolApprovalResumeData{Approved: req.Approved, Reason: req.Reason}
	result, err := runtime.Resume(ctx, cfg, originalReq, memory, control, approval, func(delta AgentDelta) error {
		if delta.Content == "" {
			return nil
		}
		return writer.WriteEvent(StreamEvent{Type: "delta", Task: delta.Task, ReplyIndex: delta.ReplyIndex, Content: delta.Content})
	})
	if err != nil {
		if IsCanceledError(ctx, err) {
			return ctx.Err()
		}
		var interrupted *AgentInterruptedError
		if errors.As(err, &interrupted) {
			approvalStore.DeletePending(req.CheckPointID, req.InterruptID)
			approvalStore.SavePending(pendingApprovalFromInterrupt(originalReq, interrupted))
			return writer.WriteEvent(approvalRequiredStreamEvent(interrupted))
		}
		slog.ErrorContext(ctx, "小说写作 Agent 恢复执行失败",
			"error", err,
			"provider_id", entryConfig.ProviderID,
			"provider_type", entryConfig.ProviderType,
			"api_type", entryConfig.APIType,
			"model", entryConfig.Model,
			"base_url_configured", strings.TrimSpace(entryConfig.BaseURL) != "",
		)
		_ = writer.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(ctx), Task: result.Task, Message: friendlyError(err)})
		return markAgentErrorLogged(fmt.Errorf("%w: %w", ErrModelStreamFailed, err))
	}
	if IsCanceledError(ctx, nil) {
		return ctx.Err()
	}
	if !hasDisplayableAgentReply(result) {
		slog.ErrorContext(ctx, "小说写作 Agent 恢复后返回空内容",
			"error", ErrAgentEmptyResponse,
			"provider_id", entryConfig.ProviderID,
			"provider_type", entryConfig.ProviderType,
			"api_type", entryConfig.APIType,
			"model", entryConfig.Model,
			"base_url_configured", strings.TrimSpace(entryConfig.BaseURL) != "",
		)
		_ = writer.WriteEvent(StreamEvent{
			Type:      "error",
			RequestID: requestid.FromContext(ctx),
			Task:      result.Task,
			Message:   friendlyError(ErrAgentEmptyResponse),
		})
		return markAgentErrorLogged(fmt.Errorf("%w: %w", ErrModelStreamFailed, ErrAgentEmptyResponse))
	}
	savedTurn, err := s.saveSuccessfulTurn(ctx, cfg, runtime, originalReq, result, entryConfig, &pendingApproval)
	if err != nil {
		if IsCanceledError(ctx, err) {
			return ctx.Err()
		}
		slog.ErrorContext(ctx, "小说写作 Agent 恢复后记忆保存失败",
			"error", err,
			"provider_id", entryConfig.ProviderID,
			"model", entryConfig.Model,
			"novel_id", originalReq.NovelID,
			"chapter_id", originalReq.ChapterID,
			"chapter_number", originalReq.ChapterNumber,
		)
		_ = writer.WriteEvent(StreamEvent{Type: "error", RequestID: requestid.FromContext(ctx), Task: result.Task, Message: "AI 记忆保存失败，本次回复未完成入库"})
		return markAgentErrorLogged(fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err))
	}
	approvalStore.DeletePending(req.CheckPointID, req.InterruptID)
	_ = approvalStore.Delete(ctx, req.CheckPointID)

	return writer.WriteEvent(StreamEvent{
		Type:              "done",
		Task:              result.Task,
		Content:           result.Content,
		Replies:           streamRepliesForResult(result),
		ConversationID:    savedTurn.ConversationID,
		ConversationTitle: savedTurn.ConversationTitle,
		Message:           "ok",
	})
}

// StreamRun 订阅指定 AI 对话后台运行任务的流事件。
// 参数 ctx 表示当前 HTTP 请求上下文；参数 runID 表示任务 ID；参数 writer 表示 NDJSON 事件写出器。
func (s *Service) StreamRun(ctx context.Context, runID string, writer EventWriter) error {
	if strings.TrimSpace(runID) == "" {
		return ErrAgentRunNotFound
	}
	if writer == nil {
		return fmt.Errorf("Agent 流事件写出器不能为空")
	}
	_, events, unsubscribe, ok := s.ensureRunManager().Subscribe(ctx, runID)
	if !ok {
		return ErrAgentRunNotFound
	}
	defer unsubscribe()

	for {
		select {
		case event, ok := <-events:
			if !ok {
				return nil
			}
			if err := writer.WriteEvent(event); err != nil {
				return nil
			}
		case <-ctx.Done():
			return nil
		}
	}
}

// StopRun 手动停止指定 AI 对话后台运行任务。
// 参数 ctx 表示请求上下文；参数 runID 表示任务 ID。
func (s *Service) StopRun(ctx context.Context, runID string) (AgentRunStopResponse, error) {
	_ = ctx
	stopped, ok := s.ensureRunManager().Stop(strings.TrimSpace(runID))
	if !ok {
		return AgentRunStopResponse{}, ErrAgentRunNotFound
	}
	return AgentRunStopResponse{Stopped: stopped}, nil
}

// ListRuns 查询指定小说仍在运行或等待审核的 AI 对话任务。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) ListRuns(ctx context.Context, novelID uint64) (AgentRunListResponse, error) {
	_ = ctx
	if novelID == 0 {
		return AgentRunListResponse{}, ErrNovelIDRequired
	}
	return AgentRunListResponse{Items: s.ensureRunManager().ListActiveByNovelID(novelID)}, nil
}

// ListConversations 查询指定小说下的 Agent 会话列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) ListConversations(ctx context.Context, novelID uint64) (ConversationListResponse, error) {
	if novelID == 0 {
		return ConversationListResponse{}, ErrChapterContextInvalid
	}
	if s.memoryRepo == nil {
		return ConversationListResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversations, err := s.memoryRepo.ListConversationsByNovelID(ctx, novelID)
	if err != nil {
		return ConversationListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return ConversationListResponse{Items: conversationResponses(conversations)}, nil
}

// ListConversationMessages 查询指定 Agent 会话最近的历史消息。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID。
func (s *Service) ListConversationMessages(ctx context.Context, novelID uint64, conversationID uint64) (MessageListResponse, error) {
	if novelID == 0 {
		return MessageListResponse{}, ErrChapterContextInvalid
	}
	if conversationID == 0 {
		return MessageListResponse{}, ErrConversationNotFound
	}
	if s.memoryRepo == nil {
		return MessageListResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversation, ok, err := s.memoryRepo.FindConversationByID(ctx, novelID, conversationID)
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	if !ok {
		return MessageListResponse{}, ErrConversationNotFound
	}

	messages, err := s.memoryRepo.ListRecentMessagesByUserRounds(ctx, conversation.ID, memoryRecentRounds(s.currentConfig()))
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return MessageListResponse{Items: messageResponses(messages)}, nil
}

// ListMessages 查询指定小说最近更新会话的 Agent 历史消息。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) ListMessages(ctx context.Context, novelID uint64) (MessageListResponse, error) {
	if novelID == 0 {
		return MessageListResponse{}, ErrChapterContextInvalid
	}
	if s.memoryRepo == nil {
		return MessageListResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversation, ok, err := s.memoryRepo.FindLatestConversationByNovelID(ctx, novelID)
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	if !ok {
		return MessageListResponse{Items: []MessageResponse{}}, nil
	}

	messages, err := s.memoryRepo.ListRecentMessagesByUserRounds(ctx, conversation.ID, memoryRecentRounds(s.currentConfig()))
	if err != nil {
		return MessageListResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return MessageListResponse{Items: messageResponses(messages)}, nil
}

// DeleteConversation 删除指定 Agent 会话及其历史消息。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID。
func (s *Service) DeleteConversation(ctx context.Context, novelID uint64, conversationID uint64) (DeleteConversationResponse, error) {
	if novelID == 0 {
		return DeleteConversationResponse{}, ErrChapterContextInvalid
	}
	if conversationID == 0 {
		return DeleteConversationResponse{}, ErrConversationNotFound
	}
	if s.memoryRepo == nil {
		return DeleteConversationResponse{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	if err := s.memoryRepo.DeleteConversationByID(ctx, novelID, conversationID); err != nil {
		if errors.Is(err, ErrConversationNotFound) {
			return DeleteConversationResponse{}, err
		}
		return DeleteConversationResponse{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return DeleteConversationResponse{Deleted: true}, nil
}

// ValidateChatRequest 校验小说写作 Agent 流式对话请求。
// 参数 req 表示流式对话请求。
func ValidateChatRequest(req ChatRequest) error {
	if strings.TrimSpace(req.Message) == "" {
		return ErrMessageRequired
	}
	if req.NovelID == 0 {
		return ErrNovelIDRequired
	}
	if req.ChapterNumber < 0 {
		return ErrChapterNumberInvalid
	}
	return nil
}

// ValidateChatApprovalResumeRequest 校验人工审核恢复请求。
// 参数 req 表示人工审核恢复请求。
func ValidateChatApprovalResumeRequest(req ChatApprovalResumeRequest) error {
	if req.NovelID == 0 {
		return ErrNovelIDRequired
	}
	if req.ChapterNumber < 0 {
		return ErrChapterNumberInvalid
	}
	if strings.TrimSpace(req.CheckPointID) == "" || strings.TrimSpace(req.InterruptID) == "" {
		return ErrAgentApprovalNotFound
	}
	return nil
}

// providerCredential 查询 AI 提供商并解密 API Key。
// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
func (s *Service) providerCredential(ctx context.Context, id uint64) (*bizaiprovider.Provider, string, error) {
	if s.repo == nil {
		return nil, "", fmt.Errorf("AI 提供商仓储未初始化")
	}
	if s.cipher == nil {
		return nil, "", fmt.Errorf("AI 提供商密钥解密器未初始化")
	}

	provider, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, "", err
	}
	if !provider.Enabled {
		return nil, "", ErrProviderDisabled
	}

	apiKey, err := s.cipher.Decrypt(provider.APIKeyCiphertext)
	if err != nil {
		return nil, "", fmt.Errorf("解密 AI 提供商 API Key 失败: %w", err)
	}
	return provider, apiKey, nil
}

// runtimeModelConfig 解析本轮 Agent 运行需要使用的入口模型和父子 Agent 模型。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照。
func (s *Service) runtimeModelConfig(ctx context.Context, cfg *appconfig.AppConfig) (RuntimeModelConfig, error) {
	agentCfg, err := newAgentRuntimeConfig(cfg)
	if err != nil {
		return RuntimeModelConfig{}, err
	}
	if agentCfg.supervisor.providerID == 0 {
		return RuntimeModelConfig{}, fmt.Errorf("%w: 顶层 Agent 必须配置模型提供商", ErrAgentConfigInvalid)
	}
	defaultConfig, err := s.agentModelOverrideConfig(
		ctx,
		"顶层 Agent",
		agentCfg.supervisor.providerID,
		agentCfg.supervisor.model,
		agentCfg.supervisor.reasoningEffort,
	)
	if err != nil {
		return RuntimeModelConfig{}, err
	}

	runtimeConfig := RuntimeModelConfig{
		Default: defaultConfig,
		Retry:   agentCfg.retry,
	}
	for _, child := range agentCfg.children {
		if child.providerID == 0 {
			continue
		}
		childConfig, err := s.agentModelOverrideConfig(
			ctx,
			"子 Agent "+child.name,
			child.providerID,
			child.model,
			child.reasoningEffort,
		)
		if err != nil {
			return RuntimeModelConfig{}, err
		}
		if runtimeConfig.Children == nil {
			runtimeConfig.Children = make(map[string]ModelConfig)
		}
		runtimeConfig.Children[child.name] = childConfig
	}
	return runtimeConfig, nil
}

// agentModelOverrideConfig 读取单个 Agent 模型对应的提供商凭据。
// 参数 ctx 表示请求上下文；参数 label 表示错误提示中的 Agent 名称；参数 providerID 表示模型提供商 ID；参数 model 表示配置文件中的模型标识；参数 reasoningEffort 表示 GPT 类模型推理强度配置。
func (s *Service) agentModelOverrideConfig(
	ctx context.Context,
	label string,
	providerID uint64,
	model string,
	reasoningEffort string,
) (ModelConfig, error) {
	provider, apiKey, err := s.providerCredential(ctx, providerID)
	if err != nil {
		return ModelConfig{}, fmt.Errorf("%w: %s 模型提供商 %d 不可用: %v", ErrAgentConfigInvalid, label, providerID, err)
	}
	model = strings.TrimSpace(model)
	if strings.TrimSpace(model) == "" {
		return ModelConfig{}, fmt.Errorf("%w: %s 模型不能为空", ErrAgentConfigInvalid, label)
	}
	return ModelConfig{
		ProviderID:      provider.ID,
		ProviderType:    provider.ProviderType,
		APIType:         provider.APIType,
		APIKey:          apiKey,
		BaseURL:         provider.BaseURL,
		Model:           model,
		ReasoningEffort: strings.TrimSpace(reasoningEffort),
	}, nil
}

// currentConfig 返回当前运行配置快照。
func (s *Service) currentConfig() *appconfig.AppConfig {
	if s.prompts == nil {
		return appconfig.Get()
	}
	return s.prompts.Current()
}

// memoryForRun 读取本次 Agent 请求需要注入模型上下文的会话级记忆。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID，0 表示新会话且不注入旧记忆。
func (s *Service) memoryForRun(ctx context.Context, cfg *appconfig.AppConfig, novelID uint64, conversationID uint64) (AgentMemoryInput, error) {
	if novelID == 0 || conversationID == 0 {
		return AgentMemoryInput{}, nil
	}
	if s.memoryRepo == nil {
		return AgentMemoryInput{}, fmt.Errorf("%w: Agent 记忆仓储未初始化", ErrAgentMemoryFailed)
	}

	conversation, ok, err := s.memoryRepo.FindConversationByID(ctx, novelID, conversationID)
	if err != nil {
		return AgentMemoryInput{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	if !ok {
		return AgentMemoryInput{}, ErrConversationNotFound
	}

	messages, err := s.memoryRepo.ListMessagesAfterID(ctx, conversation.ID, conversationSummaryMessageID(conversation), 0)
	if err != nil {
		return AgentMemoryInput{}, fmt.Errorf("%w: %v", ErrAgentMemoryFailed, err)
	}
	return AgentMemoryInput{
		Summary:  conversation.Summary,
		Messages: selectRecentMessagesByTokenBudget(messages, memoryRawHistoryTokens(cfg)),
	}, nil
}

// saveSuccessfulTurn 将成功完成的一轮用户消息和 Agent 内部记忆事件写入会话级 Agent 记忆。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 req 表示本轮聊天请求。
// 参数 result 表示 Agent 最终生成结果；参数 entryConfig 表示本轮入口模型配置；参数 pendingApproval 表示恢复人工审核时的原始待审核工具调用，当前仅为兼容恢复流程保留且不写入记忆。
func (s *Service) saveSuccessfulTurn(
	ctx context.Context,
	cfg *appconfig.AppConfig,
	runtime AgentRuntime,
	req ChatRequest,
	result AgentResult,
	entryConfig ModelConfig,
	pendingApproval *pendingToolApproval,
) (savedTurnInfo, error) {
	_ = pendingApproval
	if req.NovelID == 0 {
		return savedTurnInfo{}, nil
	}
	if err := ctx.Err(); err != nil {
		return savedTurnInfo{}, err
	}
	if s.memoryRepo == nil {
		return savedTurnInfo{}, fmt.Errorf("Agent 记忆仓储未初始化")
	}

	conversation, err := s.conversationForSuccessfulTurn(ctx, cfg, runtime, req)
	if err != nil {
		return savedTurnInfo{}, err
	}

	var chapterID *uint64
	if req.ChapterID != 0 {
		value := req.ChapterID
		chapterID = &value
	}
	assistantProviderID := result.ProviderID
	if assistantProviderID == 0 {
		assistantProviderID = entryConfig.ProviderID
	}
	assistantModel := strings.TrimSpace(result.Model)
	if assistantModel == "" {
		assistantModel = entryConfig.Model
	}
	requestID := requestid.FromContext(ctx)
	messages := []MessageRecord{
		{
			ConversationID: conversation.ID,
			NovelID:        req.NovelID,
			ChapterID:      chapterID,
			Role:           MessageRoleUser,
			Content:        req.Message,
			ProviderID:     entryConfig.ProviderID,
			Model:          entryConfig.Model,
			RequestID:      requestID,
		},
	}
	events := agentMemoryEventsForSave(result)
	for _, event := range events {
		eventProviderID := event.ProviderID
		if eventProviderID == 0 {
			eventProviderID = assistantProviderID
		}
		eventModel := strings.TrimSpace(event.Model)
		if eventModel == "" {
			eventModel = assistantModel
		}
		messages = append(messages, MessageRecord{
			ConversationID: conversation.ID,
			NovelID:        req.NovelID,
			ChapterID:      chapterID,
			Role:           event.Role,
			Task:           event.Task,
			Content:        event.Content,
			ProviderID:     eventProviderID,
			Model:          eventModel,
			RequestID:      requestID,
		})
	}
	summary, err := s.summaryUpdateForTurn(ctx, cfg, runtime, conversation, messages)
	if err != nil {
		return savedTurnInfo{}, err
	}
	if err := ctx.Err(); err != nil {
		return savedTurnInfo{}, err
	}
	if err := s.memoryRepo.AppendMessagesAndUpdateSummary(ctx, conversation.ID, messages, summary); err != nil {
		return savedTurnInfo{}, err
	}
	return savedTurnInfo{
		ConversationID:    conversation.ID,
		ConversationTitle: conversation.Title,
	}, nil
}

// conversationForSuccessfulTurn 返回本轮成功消息应写入的 Agent 会话。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 req 表示本轮聊天请求。
func (s *Service) conversationForSuccessfulTurn(ctx context.Context, cfg *appconfig.AppConfig, runtime AgentRuntime, req ChatRequest) (*Conversation, error) {
	if req.ConversationID != 0 {
		conversation, ok, err := s.memoryRepo.FindConversationByID(ctx, req.NovelID, req.ConversationID)
		if err != nil {
			return nil, err
		}
		if !ok {
			return nil, ErrConversationNotFound
		}
		return conversation, nil
	}

	title, err := s.conversationTitleForMessage(ctx, cfg, runtime, req.Message)
	if err != nil {
		return nil, err
	}
	return s.memoryRepo.CreateConversation(ctx, req.NovelID, title)
}

// conversationTitleForMessage 根据新会话首轮消息生成标题，模型失败时使用用户输入兜底。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 message 表示用户首轮消息。
func (s *Service) conversationTitleForMessage(ctx context.Context, cfg *appconfig.AppConfig, runtime AgentRuntime, message string) (string, error) {
	if runtime == nil {
		return fallbackConversationTitle(message), nil
	}
	title, err := runtime.GenerateConversationTitle(ctx, cfg, AgentConversationTitleInput{Message: message})
	if err != nil {
		if IsCanceledError(ctx, err) {
			return "", err
		}
		slog.WarnContext(ctx, "Agent 会话标题生成失败，使用用户输入兜底", "error", err)
		return fallbackConversationTitle(message), nil
	}
	return normalizeConversationTitle(title, message), nil
}

// IsCanceledError 判断当前错误是否由请求上下文取消或超时引起。
// 参数 ctx 表示请求上下文；参数 err 表示需要判断的错误。
func IsCanceledError(ctx context.Context, err error) bool {
	if ctx != nil && ctx.Err() != nil {
		return true
	}
	return errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded)
}

// summaryUpdateForTurn 计算本轮保存前是否需要生成新的滚动摘要。
// 参数 ctx 表示请求上下文；参数 cfg 表示当前配置快照；参数 runtime 表示本轮使用的 Agent 运行时；参数 conversation 表示当前 Agent 会话；参数 pendingMessages 表示本轮即将写入的用户和助手消息。
func (s *Service) summaryUpdateForTurn(ctx context.Context, cfg *appconfig.AppConfig, runtime AgentRuntime, conversation *Conversation, pendingMessages []MessageRecord) (*ConversationSummaryUpdate, error) {
	if runtime == nil || conversation == nil || len(pendingMessages) == 0 {
		return nil, nil
	}
	rawHistoryTokens := memoryRawHistoryTokens(cfg)
	if rawHistoryTokens <= 0 {
		return nil, nil
	}

	afterID := conversationSummaryMessageID(conversation)
	persistedMessages, err := s.memoryRepo.ListMessagesAfterID(ctx, conversation.ID, afterID, 0)
	if err != nil {
		return nil, err
	}
	candidates := make([]MessageRecord, 0, len(persistedMessages)+len(pendingMessages))
	candidates = append(candidates, persistedMessages...)
	candidates = append(candidates, pendingMessages...)
	summarizeMessages, _ := splitMessagesByTokenBudget(candidates, rawHistoryTokens)
	summarizeMessages = persistedSummaryMessages(summarizeMessages)
	if len(summarizeMessages) == 0 {
		return nil, nil
	}

	summary, err := runtime.Summarize(ctx, cfg, AgentSummaryInput{
		PreviousSummary: conversation.Summary,
		Messages:        summarizeMessages,
	})
	if err != nil {
		return nil, err
	}
	return &ConversationSummaryUpdate{
		Summary:          summary,
		SummaryMessageID: summarizeMessages[len(summarizeMessages)-1].ID,
		SummaryUpdatedAt: time.Now(),
	}, nil
}

// normalizedAgentReplies 返回可展示和可保存的分段助手回复列表。
// 参数 result 表示 Agent 本轮运行的最终结果。
func normalizedAgentReplies(result AgentResult) []AgentReply {
	replies := make([]AgentReply, 0, len(result.Replies))
	for _, reply := range result.Replies {
		if reply.Content == "" {
			continue
		}
		if reply.ReplyIndex <= 0 {
			reply.ReplyIndex = len(replies) + 1
		}
		if strings.TrimSpace(reply.Task) == "" {
			reply.Task = result.Task
		}
		if strings.TrimSpace(reply.AgentName) == "" {
			reply.AgentName = result.AgentName
		}
		if reply.ProviderID == 0 {
			reply.ProviderID = result.ProviderID
		}
		if strings.TrimSpace(reply.Model) == "" {
			reply.Model = result.Model
		}
		replies = append(replies, reply)
	}
	if len(replies) == 0 && result.Content != "" {
		replies = append(replies, AgentReply{
			ReplyIndex: 1,
			Task:       result.Task,
			Content:    result.Content,
			AgentName:  result.AgentName,
			ProviderID: result.ProviderID,
			Model:      result.Model,
		})
	}
	return replies
}

// hasDisplayableAgentReply 判断 Agent 结果是否包含非空白的可展示助手回复。
// 参数 result 表示 Agent 本轮运行的最终结果。
func hasDisplayableAgentReply(result AgentResult) bool {
	for _, reply := range normalizedAgentReplies(result) {
		if strings.TrimSpace(reply.Content) != "" {
			return true
		}
	}
	return false
}

// streamRepliesForResult 将 Agent 运行结果转换为 done 事件中的分段回复列表。
// 参数 result 表示 Agent 本轮运行的最终结果。
func streamRepliesForResult(result AgentResult) []StreamReply {
	replies := normalizedAgentReplies(result)
	if len(replies) == 0 {
		return nil
	}
	items := make([]StreamReply, 0, len(replies))
	for _, reply := range replies {
		items = append(items, StreamReply{
			ReplyIndex: reply.ReplyIndex,
			Task:       reply.Task,
			Content:    reply.Content,
		})
	}
	return items
}

// pendingApprovalFromInterrupt 将 Agent 中断错误转换为待审核记录。
// 参数 req 表示触发中断的原始聊天请求；参数 interrupted 表示人工审核中断错误。
func pendingApprovalFromInterrupt(req ChatRequest, interrupted *AgentInterruptedError) pendingToolApproval {
	if interrupted == nil {
		return pendingToolApproval{Request: req}
	}
	return pendingToolApproval{
		CheckPointID:  interrupted.CheckPointID,
		InterruptID:   interrupted.InterruptID,
		ToolName:      interrupted.ToolName,
		ToolArguments: interrupted.ToolArguments,
		Message:       interrupted.Message,
		Request:       req,
	}
}

// approvalRequiredStreamEvent 将人工审核中断错误转换为前端流事件。
// 参数 interrupted 表示人工审核中断错误。
func approvalRequiredStreamEvent(interrupted *AgentInterruptedError) StreamEvent {
	if interrupted == nil {
		return StreamEvent{Type: "approval_required", Message: toolApprovalRequiredMessage}
	}
	return StreamEvent{
		Type:          "approval_required",
		CheckPointID:  interrupted.CheckPointID,
		InterruptID:   interrupted.InterruptID,
		ToolName:      interrupted.ToolName,
		ToolArguments: interrupted.ToolArguments,
		Message:       interrupted.Message,
	}
}

// agentRepliesForSave 返回需要写入记忆表的分段助手回复列表。
// 参数 result 表示 Agent 本轮运行的最终结果。
func agentRepliesForSave(result AgentResult) []AgentReply {
	return normalizedAgentReplies(result)
}

// agentMemoryEventsForSave 返回需要写入记忆表的助手回复事件列表。
// 参数 result 表示 Agent 本轮运行的最终结果。
func agentMemoryEventsForSave(result AgentResult) []AgentMemoryEvent {
	events := make([]AgentMemoryEvent, 0, len(result.MemoryEvents))
	for _, event := range result.MemoryEvents {
		if !isMemoryEventRoleForSave(event.Role) || strings.TrimSpace(event.Content) == "" {
			continue
		}
		if strings.TrimSpace(event.Task) == "" {
			event.Task = result.Task
		}
		if strings.TrimSpace(event.AgentName) == "" {
			event.AgentName = result.AgentName
		}
		if event.ProviderID == 0 {
			event.ProviderID = result.ProviderID
		}
		if strings.TrimSpace(event.Model) == "" {
			event.Model = result.Model
		}
		events = append(events, event)
	}
	if len(events) > 0 {
		return events
	}

	replies := agentRepliesForSave(result)
	events = make([]AgentMemoryEvent, 0, len(replies))
	for _, reply := range replies {
		events = append(events, AgentMemoryEvent{
			Role:       MessageRoleAssistant,
			Task:       reply.Task,
			Content:    reply.Content,
			AgentName:  reply.AgentName,
			ProviderID: reply.ProviderID,
			Model:      reply.Model,
		})
	}
	return events
}

// isMemoryEventRoleForSave 判断记忆事件角色是否允许作为会话记忆入库。
// 参数 role 表示 Agent 记忆消息角色。
func isMemoryEventRoleForSave(role MessageRole) bool {
	switch role {
	case MessageRoleAssistant:
		return true
	default:
		return false
	}
}

// normalizedPromptTypes 返回配置文件中可用于推荐判定的提示词类型列表。
// 参数 cfg 表示当前配置快照。
func normalizedPromptTypes(cfg *appconfig.AppConfig) []string {
	if cfg == nil || len(cfg.AI.PromptTypes) == 0 {
		return []string{}
	}
	items := make([]string, 0, len(cfg.AI.PromptTypes))
	seen := make(map[string]struct{}, len(cfg.AI.PromptTypes))
	for _, item := range cfg.AI.PromptTypes {
		name := strings.TrimSpace(item)
		if name == "" {
			continue
		}
		if _, ok := seen[name]; ok {
			continue
		}
		seen[name] = struct{}{}
		items = append(items, name)
	}
	return items
}

// fallbackConversationTitle 使用用户首轮输入生成会话标题兜底值。
// 参数 message 表示用户首轮消息。
func fallbackConversationTitle(message string) string {
	return normalizeConversationTitle(message, defaultConversationTitle)
}

// normalizeConversationTitle 清理并截断 Agent 会话标题。
// 参数 title 表示模型生成或候选标题；参数 fallback 表示标题为空时的兜底文本。
func normalizeConversationTitle(title string, fallback string) string {
	title = strings.TrimSpace(title)
	title = strings.TrimPrefix(title, "标题：")
	title = strings.TrimPrefix(title, "标题:")
	title = strings.Trim(title, "\"'`“”‘’")
	title = strings.Join(strings.Fields(title), " ")
	if title == "" {
		title = strings.TrimSpace(fallback)
	}
	if title == "" {
		title = defaultConversationTitle
	}
	return truncateRunes(title, maxConversationTitleLength)
}

// truncateRunes 按 rune 数量截断字符串。
// 参数 value 表示原始字符串；参数 limit 表示最多保留的 rune 数量。
func truncateRunes(value string, limit int) string {
	if limit <= 0 {
		return ""
	}
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

// conversationSummaryMessageID 返回会话已经纳入摘要的最新消息 ID。
// 参数 conversation 表示当前 Agent 会话。
func conversationSummaryMessageID(conversation *Conversation) uint64 {
	if conversation == nil || conversation.SummaryMessageID == nil {
		return 0
	}
	return *conversation.SummaryMessageID
}

// persistedSummaryMessages 返回可安全滚入持久摘要的已入库消息。
// 参数 messages 表示预算外的旧消息列表。
func persistedSummaryMessages(messages []MessageRecord) []MessageRecord {
	items := make([]MessageRecord, 0, len(messages))
	for _, message := range messages {
		if message.ID == 0 {
			continue
		}
		items = append(items, message)
	}
	return items
}

// conversationResponses 将数据库会话模型转换为前端响应结构。
// 参数 conversations 表示数据库中的 Agent 会话列表。
func conversationResponses(conversations []Conversation) []ConversationResponse {
	if len(conversations) == 0 {
		return []ConversationResponse{}
	}

	items := make([]ConversationResponse, 0, len(conversations))
	for _, conversation := range conversations {
		items = append(items, ConversationResponse{
			ID:        conversation.ID,
			NovelID:   conversation.NovelID,
			Title:     normalizeConversationTitle(conversation.Title, defaultConversationTitle),
			CreatedAt: conversation.CreatedAt,
			UpdatedAt: conversation.UpdatedAt,
		})
	}
	return items
}

// messageResponses 将数据库消息模型转换为前端响应结构。
// 参数 messages 表示数据库中的 Agent 记忆消息列表。
func messageResponses(messages []MessageRecord) []MessageResponse {
	if len(messages) == 0 {
		return []MessageResponse{}
	}

	items := make([]MessageResponse, 0, len(messages))
	for _, message := range messages {
		if message.Role != MessageRoleUser && message.Role != MessageRoleAssistant {
			continue
		}
		items = append(items, MessageResponse{
			ID:             message.ID,
			ConversationID: message.ConversationID,
			NovelID:        message.NovelID,
			ChapterID:      message.ChapterID,
			Role:           message.Role,
			Task:           message.Task,
			Content:        message.Content,
			CreatedAt:      message.CreatedAt,
		})
	}
	return items
}

// normalizeChatRequest 标准化小说写作 Agent 请求。
// 参数 req 表示原始流式对话请求。
func normalizeChatRequest(req ChatRequest) ChatRequest {
	req.Message = strings.TrimSpace(req.Message)
	return req
}

// normalizeChatApprovalResumeRequest 标准化人工审核恢复请求。
// 参数 req 表示原始人工审核恢复请求。
func normalizeChatApprovalResumeRequest(req ChatApprovalResumeRequest) ChatApprovalResumeRequest {
	req.CheckPointID = strings.TrimSpace(req.CheckPointID)
	req.InterruptID = strings.TrimSpace(req.InterruptID)
	req.Reason = strings.TrimSpace(req.Reason)
	return req
}

// friendlyError 将内部错误转换为用户可理解的错误消息。
// 参数 err 表示内部错误。
func friendlyError(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, ErrAgentNotConfigured) || errors.Is(err, ErrAgentConfigInvalid) {
		return "AI 写作智能体配置错误，请检查模型配置"
	}
	if errors.Is(err, ErrAgentEmptyResponse) {
		return "AI 没有返回可展示内容，请重试或检查模型配置"
	}
	if strings.TrimSpace(err.Error()) == "" {
		return "AI 生成失败，请稍后再试"
	}
	return "AI 生成失败，请检查模型、密钥或网络后重试"
}
