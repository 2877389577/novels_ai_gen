package novelagent

import (
	"context"
	"fmt"
	"strings"

	biznovelagent "novels_ai_gen/internal/biz/novelagent"

	"gorm.io/gorm"
)

// Repository 表示基于 GORM 的小说写作 Agent 记忆仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建小说写作 Agent 记忆仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// FindConversationByNovelID 根据小说 ID 查询 Agent 会话。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) FindConversationByNovelID(ctx context.Context, novelID uint64) (*biznovelagent.Conversation, bool, error) {
	var item biznovelagent.Conversation
	result := r.db.WithContext(ctx).Where("novel_id = ?", novelID).Limit(1).Find(&item)
	if result.Error != nil {
		return nil, false, fmt.Errorf("查询 Agent 会话失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, false, nil
	}
	return &item, true, nil
}

// GetOrCreateConversation 获取或创建指定小说的 Agent 会话。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) GetOrCreateConversation(ctx context.Context, novelID uint64) (*biznovelagent.Conversation, error) {
	if conversation, ok, err := r.FindConversationByNovelID(ctx, novelID); err != nil || ok {
		return conversation, err
	}

	conversation := &biznovelagent.Conversation{NovelID: novelID}
	if err := r.db.WithContext(ctx).Create(conversation).Error; err != nil {
		if isUniqueConstraintError(err) {
			if conversation, ok, findErr := r.FindConversationByNovelID(ctx, novelID); findErr != nil || ok {
				return conversation, findErr
			}
		}
		return nil, fmt.Errorf("创建 Agent 会话失败: %w", err)
	}
	return conversation, nil
}

// ListRecentMessages 查询指定会话最近的 Agent 记忆消息，并按时间正序返回。
// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 limit 表示最多返回的消息数量。
func (r *Repository) ListRecentMessages(ctx context.Context, conversationID uint64, limit int) ([]biznovelagent.MessageRecord, error) {
	if limit <= 0 {
		return []biznovelagent.MessageRecord{}, nil
	}

	var items []biznovelagent.MessageRecord
	if err := r.db.WithContext(ctx).
		Where("conversation_id = ?", conversationID).
		Order("created_at DESC").
		Order("id DESC").
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询 Agent 记忆消息失败: %w", err)
	}

	for left, right := 0, len(items)-1; left < right; left, right = left+1, right-1 {
		items[left], items[right] = items[right], items[left]
	}
	return items, nil
}

// AppendMessages 以事务追加一组 Agent 记忆消息。
// 参数 ctx 表示请求上下文；参数 messages 表示需要写入的消息列表。
func (r *Repository) AppendMessages(ctx context.Context, messages []biznovelagent.MessageRecord) error {
	if len(messages) == 0 {
		return nil
	}

	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&messages).Error; err != nil {
			return fmt.Errorf("写入 Agent 记忆消息失败: %w", err)
		}
		return nil
	}); err != nil {
		return err
	}
	return nil
}

// ClearMessagesByNovelID 清空指定小说的 Agent 记忆消息。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) ClearMessagesByNovelID(ctx context.Context, novelID uint64) (int64, error) {
	conversation, ok, err := r.FindConversationByNovelID(ctx, novelID)
	if err != nil || !ok {
		return 0, err
	}

	result := r.db.WithContext(ctx).
		Where("conversation_id = ?", conversation.ID).
		Delete(&biznovelagent.MessageRecord{})
	if result.Error != nil {
		return 0, fmt.Errorf("清空 Agent 记忆消息失败: %w", result.Error)
	}
	return result.RowsAffected, nil
}

// isUniqueConstraintError 判断数据库错误是否为唯一约束冲突。
// 参数 err 表示数据库返回的错误。
func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(err.Error())
	return strings.Contains(message, "duplicate") ||
		strings.Contains(message, "duplicated key") ||
		strings.Contains(message, "unique constraint") ||
		strings.Contains(message, "1062") ||
		strings.Contains(message, "23505")
}
