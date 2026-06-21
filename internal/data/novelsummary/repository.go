package novelsummary

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	biznovel "novels_ai_gen/internal/biz/novel"
	biznovelsummary "novels_ai_gen/internal/biz/novelsummary"
)

// Repository 表示基于 GORM 的小说滚动总结数据仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建小说滚动总结数据仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create 创建小说滚动总结记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的小说滚动总结模型。
func (r *Repository) Create(ctx context.Context, item *biznovelsummary.NovelSummary) error {
	if item == nil {
		return fmt.Errorf("小说总结记录不能为空")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, item.NovelID); err != nil {
			return err
		}
		if err := tx.Create(item).Error; err != nil {
			if isUniqueConstraintError(err) {
				return biznovelsummary.ErrConflict
			}
			return fmt.Errorf("写入小说总结记录失败: %w", err)
		}
		return nil
	})
}

// GetByNovelID 根据小说 ID 查询小说滚动总结。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) GetByNovelID(ctx context.Context, novelID uint64) (*biznovelsummary.NovelSummary, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, err
	}

	var item biznovelsummary.NovelSummary
	if err := db.Where("novel_id = ?", novelID).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biznovelsummary.ErrNotFound
		}
		return nil, fmt.Errorf("查询小说总结记录失败: %w", err)
	}
	return &item, nil
}

// UpdateContentAndRange 更新小说滚动总结内容和覆盖章节范围并返回更新后的记录。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示需要写入的总结内容和覆盖章节范围。
func (r *Repository) UpdateContentAndRange(ctx context.Context, novelID uint64, req biznovelsummary.SaveRequest) (*biznovelsummary.NovelSummary, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, err
	}

	result := db.Model(&biznovelsummary.NovelSummary{}).
		Where("novel_id = ?", novelID).
		Updates(map[string]any{
			"content":              req.Content,
			"start_chapter_number": req.StartChapterNumber,
			"end_chapter_number":   req.EndChapterNumber,
		})
	if result.Error != nil {
		return nil, fmt.Errorf("更新小说总结记录失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return nil, biznovelsummary.ErrNotFound
	}
	return r.GetByNovelID(ctx, novelID)
}

// UpsertContentAndRange 创建或覆盖小说滚动总结内容和覆盖章节范围并返回保存后的记录。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示需要写入的总结内容和覆盖章节范围。
func (r *Repository) UpsertContentAndRange(ctx context.Context, novelID uint64, req biznovelsummary.SaveRequest) (*biznovelsummary.NovelSummary, error) {
	var saved biznovelsummary.NovelSummary
	if err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, novelID); err != nil {
			return err
		}

		now := time.Now()
		item := biznovelsummary.NovelSummary{
			NovelID:            novelID,
			Content:            req.Content,
			StartChapterNumber: req.StartChapterNumber,
			EndChapterNumber:   req.EndChapterNumber,
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "novel_id"}},
			DoUpdates: clause.Assignments(map[string]any{
				"content":              req.Content,
				"start_chapter_number": req.StartChapterNumber,
				"end_chapter_number":   req.EndChapterNumber,
				"updated_at":           now,
			}),
		}).Create(&item).Error; err != nil {
			return fmt.Errorf("保存小说总结记录失败: %w", err)
		}
		if err := tx.Where("novel_id = ?", novelID).First(&saved).Error; err != nil {
			return fmt.Errorf("刷新小说总结记录失败: %w", err)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return &saved, nil
}

// DeleteByNovelID 根据小说 ID 删除小说滚动总结。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) DeleteByNovelID(ctx context.Context, novelID uint64) error {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return err
	}

	result := db.Where("novel_id = ?", novelID).Delete(&biznovelsummary.NovelSummary{})
	if result.Error != nil {
		return fmt.Errorf("删除小说总结记录失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return biznovelsummary.ErrNotFound
	}
	return nil
}

// ensureNovelExists 确认小说总结所属小说存在。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示小说主键 ID。
func ensureNovelExists(db *gorm.DB, novelID uint64) error {
	if novelID == 0 {
		return biznovelsummary.ErrNovelIDRequired
	}

	var total int64
	if err := db.Model(&biznovel.Novel{}).Where("id = ?", novelID).Count(&total).Error; err != nil {
		return fmt.Errorf("查询小说记录失败: %w", err)
	}
	if total == 0 {
		return biznovelsummary.ErrNovelNotFound
	}
	return nil
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
