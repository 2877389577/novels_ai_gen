package novelagent

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
	"sync"
	"time"
)

// agentApprovalStore 表示内存中的 Agent 人工审核 checkpoint 与待审核记录存储。
type agentApprovalStore struct {
	// mu 表示保护 checkpoint 与待审核记录映射的读写锁。
	mu sync.RWMutex
	// checkpoints 表示 Eino ADK checkpoint 序列化数据，键为 checkpoint ID。
	checkpoints map[string][]byte
	// pending 表示仍在等待用户审核的工具调用记录，键由 checkpoint ID 和 interrupt ID 组成。
	pending map[string]pendingToolApproval
	// now 表示获取当前时间的方法，便于测试替换。
	now func() time.Time
}

// pendingToolApproval 表示一次等待用户审核的工具调用记录。
type pendingToolApproval struct {
	// CheckPointID 表示 Eino ADK checkpoint 标识。
	CheckPointID string
	// InterruptID 表示本次工具审核对应的中断点标识。
	InterruptID string
	// ToolName 表示等待审核的工具名称。
	ToolName string
	// ToolArguments 表示等待审核的工具调用参数 JSON 字符串。
	ToolArguments string
	// Message 表示展示给用户的审核提示。
	Message string
	// Request 表示触发中断时的原始对话请求。
	Request ChatRequest
	// CreatedAt 表示待审核记录创建时间。
	CreatedAt time.Time
}

// newAgentApprovalStore 创建内存人工审核存储。
func newAgentApprovalStore() *agentApprovalStore {
	return &agentApprovalStore{
		checkpoints: make(map[string][]byte),
		pending:     make(map[string]pendingToolApproval),
		now:         time.Now,
	}
}

// Get 读取指定 checkpoint 的序列化数据。
// 参数 ctx 表示请求上下文；参数 checkPointID 表示 checkpoint 标识。
func (s *agentApprovalStore) Get(ctx context.Context, checkPointID string) ([]byte, bool, error) {
	if err := ctx.Err(); err != nil {
		return nil, false, err
	}
	if s == nil {
		return nil, false, nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, ok := s.checkpoints[checkPointID]
	if !ok {
		return nil, false, nil
	}
	copied := append([]byte(nil), data...)
	return copied, true, nil
}

// Set 写入指定 checkpoint 的序列化数据。
// 参数 ctx 表示请求上下文；参数 checkPointID 表示 checkpoint 标识；参数 checkPoint 表示 Eino 序列化后的 checkpoint 数据。
func (s *agentApprovalStore) Set(ctx context.Context, checkPointID string, checkPoint []byte) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if s == nil {
		return fmt.Errorf("人工审核 checkpoint 存储未初始化")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.checkpoints == nil {
		s.checkpoints = make(map[string][]byte)
	}
	s.checkpoints[checkPointID] = append([]byte(nil), checkPoint...)
	return nil
}

// Delete 删除指定 checkpoint 和相关待审核记录。
// 参数 ctx 表示请求上下文；参数 checkPointID 表示 checkpoint 标识。
func (s *agentApprovalStore) Delete(ctx context.Context, checkPointID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if s == nil {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.checkpoints, checkPointID)
	prefix := checkPointID + "\x00"
	for key := range s.pending {
		if strings.HasPrefix(key, prefix) {
			delete(s.pending, key)
		}
	}
	return nil
}

// SavePending 保存一次等待人工审核的工具调用记录。
// 参数 approval 表示需要保存的待审核工具调用记录。
func (s *agentApprovalStore) SavePending(approval pendingToolApproval) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pending == nil {
		s.pending = make(map[string]pendingToolApproval)
	}
	if approval.CreatedAt.IsZero() {
		approval.CreatedAt = s.now()
	}
	s.pending[pendingToolApprovalKey(approval.CheckPointID, approval.InterruptID)] = approval
}

// FindPending 读取一次待审核工具调用记录。
// 参数 checkPointID 表示 checkpoint 标识；参数 interruptID 表示中断点标识。
func (s *agentApprovalStore) FindPending(checkPointID string, interruptID string) (pendingToolApproval, bool) {
	if s == nil {
		return pendingToolApproval{}, false
	}
	key := pendingToolApprovalKey(checkPointID, interruptID)

	s.mu.RLock()
	defer s.mu.RUnlock()
	approval, ok := s.pending[key]
	return approval, ok
}

// DeletePending 删除一次待审核工具调用记录。
// 参数 checkPointID 表示 checkpoint 标识；参数 interruptID 表示中断点标识。
func (s *agentApprovalStore) DeletePending(checkPointID string, interruptID string) {
	if s == nil {
		return
	}
	key := pendingToolApprovalKey(checkPointID, interruptID)

	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.pending, key)
}

// pendingToolApprovalKey 生成待审核工具调用记录映射键。
// 参数 checkPointID 表示 checkpoint 标识；参数 interruptID 表示中断点标识。
func pendingToolApprovalKey(checkPointID string, interruptID string) string {
	return checkPointID + "\x00" + interruptID
}

// newAgentCheckPointID 生成新的 Agent checkpoint 标识。
func newAgentCheckPointID() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("生成 Agent checkpoint 标识失败: %w", err)
	}
	return "agent-approval-" + hex.EncodeToString(buf), nil
}
