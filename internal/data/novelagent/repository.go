package novelagent

import (
	"context"
	"errors"
	"fmt"

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

// ListConversationsByNovelID 查询指定小说下的 Agent 会话列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) ListConversationsByNovelID(ctx context.Context, novelID uint64) ([]biznovelagent.Conversation, error) {
	var items []biznovelagent.Conversation
	if err := r.db.WithContext(ctx).
		Where("novel_id = ?", novelID).
		Order("updated_at DESC").
		Order("id DESC").
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询 Agent 会话列表失败: %w", err)
	}
	return items, nil
}

// FindLatestConversationByNovelID 查询指定小说最近更新的 Agent 会话。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) FindLatestConversationByNovelID(ctx context.Context, novelID uint64) (*biznovelagent.Conversation, bool, error) {
	var item biznovelagent.Conversation
	result := r.db.WithContext(ctx).
		Where("novel_id = ?", novelID).
		Order("updated_at DESC").
		Order("id DESC").
		Limit(1).
		Find(&item)
	if result.Error != nil {
		return nil, false, fmt.Errorf("查询 Agent 会话失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, false, nil
	}
	return &item, true, nil
}

// FindConversationByID 根据小说 ID 和会话 ID 查询 Agent 会话。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID。
func (r *Repository) FindConversationByID(ctx context.Context, novelID uint64, conversationID uint64) (*biznovelagent.Conversation, bool, error) {
	var item biznovelagent.Conversation
	result := r.db.WithContext(ctx).
		Where("id = ? AND novel_id = ?", conversationID, novelID).
		Limit(1).
		Find(&item)
	if result.Error != nil {
		return nil, false, fmt.Errorf("查询 Agent 会话失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, false, nil
	}
	return &item, true, nil
}

// CreateConversation 创建指定小说下的 Agent 会话。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 title 表示会话标题。
func (r *Repository) CreateConversation(ctx context.Context, novelID uint64, title string) (*biznovelagent.Conversation, error) {
	conversation := &biznovelagent.Conversation{NovelID: novelID, Title: title}
	if err := r.db.WithContext(ctx).Create(conversation).Error; err != nil {
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

// AppendMessagesAndUpdateSummary 以事务追加 Agent 记忆消息、更新会话摘要并刷新会话更新时间。
// 参数 ctx 表示请求上下文；参数 conversationID 表示 Agent 会话主键 ID；参数 messages 表示需要写入的消息列表；参数 summary 表示需要写回的摘要更新，nil 表示不更新摘要。
func (r *Repository) AppendMessagesAndUpdateSummary(ctx context.Context, conversationID uint64, messages []biznovelagent.MessageRecord, summary *biznovelagent.ConversationSummaryUpdate) error {
	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		now := tx.NowFunc()
		if len(messages) > 0 {
			if err := tx.Create(&messages).Error; err != nil {
				return fmt.Errorf("写入 Agent 记忆消息失败: %w", err)
			}
		}
		updates := map[string]any{
			"updated_at": now,
		}
		if summary != nil {
			updates["summary"] = summary.Summary
			updates["summary_message_id"] = summary.SummaryMessageID
			updates["summary_updated_at"] = summary.SummaryUpdatedAt
		}
		if err := tx.Model(&biznovelagent.Conversation{}).
			Where("id = ?", conversationID).
			Updates(updates).Error; err != nil {
			return fmt.Errorf("更新 Agent 会话状态失败: %w", err)
		}
		return nil
	}); err != nil {
		return err
	}
	return nil
}

// ClearMessagesByConversationID 清空指定 Agent 会话的记忆消息和摘要。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 conversationID 表示 Agent 会话主键 ID。
func (r *Repository) ClearMessagesByConversationID(ctx context.Context, novelID uint64, conversationID uint64) (int64, error) {
	var cleared int64
	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var conversation biznovelagent.Conversation
		if err := tx.Where("id = ? AND novel_id = ?", conversationID, novelID).First(&conversation).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return biznovelagent.ErrConversationNotFound
			}
			return fmt.Errorf("查询 Agent 会话失败: %w", err)
		}
		result := tx.Where("conversation_id = ?", conversationID).Delete(&biznovelagent.MessageRecord{})
		if result.Error != nil {
			return fmt.Errorf("清空 Agent 记忆消息失败: %w", result.Error)
		}
		cleared = result.RowsAffected
		if err := tx.Model(&biznovelagent.Conversation{}).
			Where("id = ?", conversationID).
			Updates(map[string]any{
				"summary":            "",
				"summary_message_id": nil,
				"summary_updated_at": nil,
				"updated_at":         tx.NowFunc(),
			}).Error; err != nil {
			return fmt.Errorf("清空 Agent 会话摘要失败: %w", err)
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return cleared, nil
}

// ClearMessagesByNovelID 清空指定小说下所有 Agent 会话的记忆消息和摘要。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) ClearMessagesByNovelID(ctx context.Context, novelID uint64) (int64, error) {
	var cleared int64
	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Where("novel_id = ?", novelID).Delete(&biznovelagent.MessageRecord{})
		if result.Error != nil {
			return fmt.Errorf("清空 Agent 记忆消息失败: %w", result.Error)
		}
		cleared = result.RowsAffected
		if err := tx.Model(&biznovelagent.Conversation{}).
			Where("novel_id = ?", novelID).
			Updates(map[string]any{
				"summary":            "",
				"summary_message_id": nil,
				"summary_updated_at": nil,
				"updated_at":         tx.NowFunc(),
			}).Error; err != nil {
			return fmt.Errorf("清空 Agent 会话摘要失败: %w", err)
		}
		return nil
	}); err != nil {
		return 0, err
	}
	return cleared, nil
}
