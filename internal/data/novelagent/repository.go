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

// CountMessagesAfterID 统计指定消息 ID 之后的 Agent 记忆消息数量。
// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 afterID 表示已经纳入摘要的最新消息 ID。
func (r *Repository) CountMessagesAfterID(ctx context.Context, conversationID uint64, afterID uint64) (int64, error) {
	var count int64
	query := r.db.WithContext(ctx).Model(&biznovelagent.MessageRecord{}).
		Where("conversation_id = ?", conversationID)
	if afterID > 0 {
		query = query.Where("id > ?", afterID)
	}
	if err := query.Count(&count).Error; err != nil {
		return 0, fmt.Errorf("统计 Agent 记忆消息失败: %w", err)
	}
	return count, nil
}

// ListMessagesAfterID 查询指定消息 ID 之后的 Agent 记忆消息，并按时间正序返回。
// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 afterID 表示已经纳入摘要的最新消息 ID；参数 limit 表示最多返回的消息数量。
func (r *Repository) ListMessagesAfterID(ctx context.Context, conversationID uint64, afterID uint64, limit int) ([]biznovelagent.MessageRecord, error) {
	if limit <= 0 {
		return []biznovelagent.MessageRecord{}, nil
	}

	var items []biznovelagent.MessageRecord
	query := r.db.WithContext(ctx).
		Where("conversation_id = ?", conversationID)
	if afterID > 0 {
		query = query.Where("id > ?", afterID)
	}
	if err := query.
		Order("created_at ASC").
		Order("id ASC").
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询待摘要 Agent 记忆消息失败: %w", err)
	}
	return items, nil
}

// AppendMessagesAndUpdateSummary 以事务追加 Agent 记忆消息并可选更新会话摘要。
// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 messages 表示需要写入的消息列表；参数 summary 表示需要写回的摘要更新，nil 表示不更新摘要。
func (r *Repository) AppendMessagesAndUpdateSummary(ctx context.Context, conversationID uint64, messages []biznovelagent.MessageRecord, summary *biznovelagent.ConversationSummaryUpdate) error {
	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if len(messages) > 0 {
			if err := tx.Create(&messages).Error; err != nil {
				return fmt.Errorf("写入 Agent 记忆消息失败: %w", err)
			}
		}
		if summary != nil {
			if err := tx.Model(&biznovelagent.Conversation{}).
				Where("id = ?", conversationID).
				Updates(map[string]any{
					"summary":            summary.Summary,
					"summary_message_id": summary.SummaryMessageID,
					"summary_updated_at": summary.SummaryUpdatedAt,
				}).Error; err != nil {
				return fmt.Errorf("更新 Agent 会话摘要失败: %w", err)
			}
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
	if err := r.db.WithContext(ctx).
		Model(&biznovelagent.Conversation{}).
		Where("id = ?", conversation.ID).
		Updates(map[string]any{
			"summary":            "",
			"summary_message_id": nil,
			"summary_updated_at": nil,
		}).Error; err != nil {
		return 0, fmt.Errorf("清空 Agent 会话摘要失败: %w", err)
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
