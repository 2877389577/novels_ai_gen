package novelagent

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sort"
	"sync"
	"time"
)

const (
	defaultAgentRunReplayLimit  = 512
	defaultAgentRunCleanupDelay = 10 * time.Minute
	agentRunIDBytes             = 18
)

// AgentRunStatus 表示一次 AI 对话后台运行任务的状态。
type AgentRunStatus string

const (
	// AgentRunStatusRunning 表示 AI 对话任务正在执行。
	AgentRunStatusRunning AgentRunStatus = "running"
	// AgentRunStatusApprovalRequired 表示 AI 对话任务正在等待人工审核工具调用。
	AgentRunStatusApprovalRequired AgentRunStatus = "approval_required"
	// AgentRunStatusCompleted 表示 AI 对话任务已经成功完成。
	AgentRunStatusCompleted AgentRunStatus = "completed"
	// AgentRunStatusFailed 表示 AI 对话任务执行失败。
	AgentRunStatusFailed AgentRunStatus = "failed"
	// AgentRunStatusCancelled 表示 AI 对话任务已被用户手动停止。
	AgentRunStatusCancelled AgentRunStatus = "cancelled"
)

// AgentRunSnapshot 表示前端可查询到的 AI 对话运行任务快照。
type AgentRunSnapshot struct {
	// RunID 表示 AI 对话后台运行任务 ID。
	RunID string `json:"run_id" example:"agent-run-abc123"`
	// Status 表示 AI 对话后台运行任务状态。
	Status AgentRunStatus `json:"status" example:"running"`
	// NovelID 表示任务所属小说 ID。
	NovelID uint64 `json:"novel_id" example:"1"`
	// ConversationID 表示任务所属 Agent 会话 ID，新会话任务为空。
	ConversationID uint64 `json:"conversation_id,omitempty" example:"1"`
	// ChapterID 表示任务关联章节 ID，普通小说级对话为空。
	ChapterID uint64 `json:"chapter_id,omitempty" example:"1"`
	// ChapterNumber 表示任务关联章节号，普通小说级对话为空。
	ChapterNumber int `json:"chapter_number,omitempty" example:"3"`
	// Message 表示任务对应的用户原始消息。
	Message string `json:"message" example:"帮我润色这一段"`
	// CreatedAt 表示任务创建时间。
	CreatedAt time.Time `json:"created_at" example:"2026-06-24T22:00:00+08:00"`
	// UpdatedAt 表示任务最近更新时间。
	UpdatedAt time.Time `json:"updated_at" example:"2026-06-24T22:01:00+08:00"`
}

// AgentRunListResponse 表示 AI 对话运行中任务列表响应。
type AgentRunListResponse struct {
	// Items 表示当前小说仍在运行或等待人工审核的 AI 对话任务。
	Items []AgentRunSnapshot `json:"items"`
}

// AgentRunStopResponse 表示停止 AI 对话后台运行任务后的响应。
type AgentRunStopResponse struct {
	// Stopped 表示是否已经向任务发出停止信号。
	Stopped bool `json:"stopped" example:"true"`
}

// agentRunManager 表示进程内 AI 对话运行任务管理器。
type agentRunManager struct {
	// mu 表示保护 runs 映射和任务内部订阅状态的互斥锁。
	mu sync.Mutex
	// runs 表示当前进程仍保留的 AI 对话任务。
	runs map[string]*agentRun
	// replayLimit 表示每个任务最多保留的历史流事件数量。
	replayLimit int
	// cleanupDelay 表示终态任务在内存中继续保留的时间。
	cleanupDelay time.Duration
}

// agentRun 表示单个 AI 对话后台运行任务。
type agentRun struct {
	// manager 表示拥有当前任务的管理器。
	manager *agentRunManager
	// id 表示任务唯一标识。
	id string
	// ctx 表示任务执行上下文，只受用户停止或服务进程生命周期影响。
	ctx context.Context
	// cancel 表示停止任务执行的方法。
	cancel context.CancelFunc
	// req 表示创建当前任务时使用的原始聊天请求。
	req ChatRequest
	// status 表示当前任务状态。
	status AgentRunStatus
	// events 表示可供重新订阅时回放的流事件。
	events []StreamEvent
	// subscribers 表示仍在监听当前任务流事件的订阅者。
	subscribers map[chan StreamEvent]struct{}
	// createdAt 表示任务创建时间。
	createdAt time.Time
	// updatedAt 表示任务最近更新时间。
	updatedAt time.Time
	// checkpointID 表示等待人工审核时对应的 checkpoint 标识。
	checkpointID string
	// interruptID 表示等待人工审核时对应的中断点标识。
	interruptID string
}

// newAgentRunManager 创建 AI 对话运行任务管理器。
func newAgentRunManager() *agentRunManager {
	return newAgentRunManagerWithOptions(defaultAgentRunReplayLimit, defaultAgentRunCleanupDelay)
}

// newAgentRunManagerWithOptions 创建可配置的 AI 对话运行任务管理器。
// 参数 replayLimit 表示每个任务最多保留的流事件数量；参数 cleanupDelay 表示终态任务保留时长。
func newAgentRunManagerWithOptions(replayLimit int, cleanupDelay time.Duration) *agentRunManager {
	if replayLimit <= 0 {
		replayLimit = defaultAgentRunReplayLimit
	}
	return &agentRunManager{
		runs:         make(map[string]*agentRun),
		replayLimit:  replayLimit,
		cleanupDelay: cleanupDelay,
	}
}

// NewRun 创建一个新的 AI 对话后台运行任务。
// 参数 ctx 表示任务执行上下文；参数 cancel 表示任务停止方法；参数 req 表示原始聊天请求。
func (m *agentRunManager) NewRun(ctx context.Context, cancel context.CancelFunc, req ChatRequest) (*agentRun, error) {
	runID, err := newAgentRunID()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	run := &agentRun{
		manager:     m,
		id:          runID,
		ctx:         ctx,
		cancel:      cancel,
		req:         req,
		status:      AgentRunStatusRunning,
		subscribers: make(map[chan StreamEvent]struct{}),
		createdAt:   now,
		updatedAt:   now,
	}

	m.mu.Lock()
	m.runs[runID] = run
	m.mu.Unlock()
	return run, nil
}

// WriteEvent 写入一个任务流事件并广播给所有订阅者。
// 参数 event 表示需要记录并广播的流事件。
func (r *agentRun) WriteEvent(event StreamEvent) error {
	if event.RunID == "" {
		event.RunID = r.id
	}
	r.manager.Publish(r, event)
	return nil
}

// Publish 记录任务流事件并广播给订阅者。
// 参数 run 表示事件所属任务；参数 event 表示需要广播的流事件。
func (m *agentRunManager) Publish(run *agentRun, event StreamEvent) {
	m.mu.Lock()
	if current := m.runs[run.id]; current != run {
		m.mu.Unlock()
		return
	}
	run.updatedAt = time.Now()
	run.events = append(run.events, event)
	if len(run.events) > m.replayLimit {
		run.events = append([]StreamEvent(nil), run.events[len(run.events)-m.replayLimit:]...)
	}
	switch event.Type {
	case "approval_required":
		run.status = AgentRunStatusApprovalRequired
		run.checkpointID = event.CheckPointID
		run.interruptID = event.InterruptID
	case "done":
		run.status = AgentRunStatusCompleted
	case "error":
		run.status = AgentRunStatusFailed
	case "cancelled":
		run.status = AgentRunStatusCancelled
	}
	subscribers := make([]chan StreamEvent, 0, len(run.subscribers))
	for subscriber := range run.subscribers {
		subscribers = append(subscribers, subscriber)
	}
	m.mu.Unlock()

	for _, subscriber := range subscribers {
		select {
		case subscriber <- event:
		default:
			m.unsubscribe(run.id, subscriber, true)
		}
	}
}

// Finish 将任务切换到终态并关闭所有订阅者。
// 参数 run 表示需要收口的任务；参数 status 表示任务最终状态。
func (m *agentRunManager) Finish(run *agentRun, status AgentRunStatus) {
	m.mu.Lock()
	if current := m.runs[run.id]; current != run {
		m.mu.Unlock()
		return
	}
	run.status = status
	run.updatedAt = time.Now()
	subscribers := make([]chan StreamEvent, 0, len(run.subscribers))
	for subscriber := range run.subscribers {
		subscribers = append(subscribers, subscriber)
		delete(run.subscribers, subscriber)
	}
	m.mu.Unlock()

	for _, subscriber := range subscribers {
		close(subscriber)
	}
	m.scheduleCleanup(run.id)
}

// Pause 关闭当前任务订阅者但保留任务活跃状态。
// 参数 run 表示进入等待状态的任务。
func (m *agentRunManager) Pause(run *agentRun) {
	m.mu.Lock()
	if current := m.runs[run.id]; current != run {
		m.mu.Unlock()
		return
	}
	run.updatedAt = time.Now()
	subscribers := make([]chan StreamEvent, 0, len(run.subscribers))
	for subscriber := range run.subscribers {
		subscribers = append(subscribers, subscriber)
		delete(run.subscribers, subscriber)
	}
	m.mu.Unlock()

	for _, subscriber := range subscribers {
		close(subscriber)
	}
}

// Subscribe 订阅指定任务的流事件，并优先回放已缓存事件。
// 参数 ctx 表示当前 HTTP 订阅请求上下文；参数 runID 表示任务 ID。
func (m *agentRunManager) Subscribe(ctx context.Context, runID string) (AgentRunSnapshot, <-chan StreamEvent, func(), bool) {
	m.mu.Lock()
	run, ok := m.runs[runID]
	if !ok {
		m.mu.Unlock()
		return AgentRunSnapshot{}, nil, nil, false
	}
	events := append([]StreamEvent(nil), run.events...)
	bufferSize := len(events) + 16
	if bufferSize < 32 {
		bufferSize = 32
	}
	subscriber := make(chan StreamEvent, bufferSize)
	for _, event := range events {
		subscriber <- event
	}
	closeAfterReplay := agentRunStatusIsTerminal(run.status) || run.status == AgentRunStatusApprovalRequired
	if closeAfterReplay {
		close(subscriber)
	} else {
		run.subscribers[subscriber] = struct{}{}
	}
	snapshot := run.snapshot()
	m.mu.Unlock()

	unsubscribe := func() {
		m.unsubscribe(runID, subscriber, true)
	}
	if ctx != nil && !closeAfterReplay {
		go func() {
			<-ctx.Done()
			unsubscribe()
		}()
	}
	return snapshot, subscriber, unsubscribe, true
}

// ListActiveByNovelID 查询指定小说仍在运行或等待审核的任务。
// 参数 novelID 表示小说主键 ID。
func (m *agentRunManager) ListActiveByNovelID(novelID uint64) []AgentRunSnapshot {
	m.mu.Lock()
	defer m.mu.Unlock()

	items := make([]AgentRunSnapshot, 0)
	for _, run := range m.runs {
		if run.req.NovelID != novelID {
			continue
		}
		if run.status != AgentRunStatusRunning && run.status != AgentRunStatusApprovalRequired {
			continue
		}
		items = append(items, run.snapshot())
	}
	sort.SliceStable(items, func(left int, right int) bool {
		return items[left].UpdatedAt.After(items[right].UpdatedAt)
	})
	return items
}

// Stop 向指定任务发出停止信号。
// 参数 runID 表示需要停止的任务 ID。
func (m *agentRunManager) Stop(runID string) (bool, bool) {
	m.mu.Lock()
	run, ok := m.runs[runID]
	if !ok {
		m.mu.Unlock()
		return false, false
	}
	if agentRunStatusIsTerminal(run.status) {
		m.mu.Unlock()
		return false, true
	}
	run.cancel()
	m.mu.Unlock()
	return true, true
}

// Status 返回指定任务的当前状态。
// 参数 run 表示需要查询状态的任务。
func (m *agentRunManager) Status(run *agentRun) AgentRunStatus {
	m.mu.Lock()
	defer m.mu.Unlock()
	if current := m.runs[run.id]; current == run {
		return run.status
	}
	return AgentRunStatusCompleted
}

// FinishApprovalRun 将指定人工审核等待任务从活跃列表中移除。
// 参数 checkpointID 表示 checkpoint 标识；参数 interruptID 表示中断点标识。
func (m *agentRunManager) FinishApprovalRun(checkpointID string, interruptID string) {
	m.mu.Lock()
	var matched *agentRun
	for _, run := range m.runs {
		if run.status == AgentRunStatusApprovalRequired &&
			run.checkpointID == checkpointID &&
			run.interruptID == interruptID {
			matched = run
			break
		}
	}
	m.mu.Unlock()
	if matched != nil {
		m.Finish(matched, AgentRunStatusCompleted)
	}
}

// unsubscribe 取消指定订阅者。
// 参数 runID 表示任务 ID；参数 subscriber 表示订阅通道；参数 closeSubscriber 表示是否关闭通道。
func (m *agentRunManager) unsubscribe(runID string, subscriber chan StreamEvent, closeSubscriber bool) {
	m.mu.Lock()
	run, ok := m.runs[runID]
	if ok {
		if _, exists := run.subscribers[subscriber]; exists {
			delete(run.subscribers, subscriber)
			if closeSubscriber {
				close(subscriber)
			}
		}
	}
	m.mu.Unlock()
}

// scheduleCleanup 安排终态任务清理。
// 参数 runID 表示需要清理的任务 ID。
func (m *agentRunManager) scheduleCleanup(runID string) {
	if m.cleanupDelay <= 0 {
		m.mu.Lock()
		delete(m.runs, runID)
		m.mu.Unlock()
		return
	}
	time.AfterFunc(m.cleanupDelay, func() {
		m.mu.Lock()
		run, ok := m.runs[runID]
		if ok && agentRunStatusIsTerminal(run.status) {
			delete(m.runs, runID)
		}
		m.mu.Unlock()
	})
}

// snapshot 返回任务当前快照。
func (r *agentRun) snapshot() AgentRunSnapshot {
	return AgentRunSnapshot{
		RunID:          r.id,
		Status:         r.status,
		NovelID:        r.req.NovelID,
		ConversationID: r.req.ConversationID,
		ChapterID:      r.req.ChapterID,
		ChapterNumber:  r.req.ChapterNumber,
		Message:        r.req.Message,
		CreatedAt:      r.createdAt,
		UpdatedAt:      r.updatedAt,
	}
}

// agentRunStatusIsTerminal 判断任务状态是否已经结束。
// 参数 status 表示需要判断的任务状态。
func agentRunStatusIsTerminal(status AgentRunStatus) bool {
	return status == AgentRunStatusCompleted ||
		status == AgentRunStatusFailed ||
		status == AgentRunStatusCancelled
}

// newAgentRunID 生成 AI 对话后台运行任务 ID。
func newAgentRunID() (string, error) {
	buf := make([]byte, agentRunIDBytes)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("生成 AI 对话运行任务 ID 失败: %w", err)
	}
	return "agent-run-" + base64.RawURLEncoding.EncodeToString(buf), nil
}
