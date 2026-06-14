package chapter

import (
	"context"
	"errors"
	"fmt"
	"strings"

	bizchapter "novels_ai_gen/internal/biz/chapter"
	biznovel "novels_ai_gen/internal/biz/novel"

	"gorm.io/gorm"
)

// Repository 表示基于 GORM 的章节数据仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建章节数据仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateWithNextNumber 创建章节并自动分配下一章节号。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的章节模型。
func (r *Repository) CreateWithNextNumber(ctx context.Context, item *bizchapter.Chapter) error {
	if item == nil {
		return fmt.Errorf("章节记录不能为空")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, item.NovelID); err != nil {
			return err
		}

		maxNumber, err := maxChapterNumber(tx, item.NovelID)
		if err != nil {
			return err
		}
		item.ChapterNumber = maxNumber + 1

		if err := tx.Create(item).Error; err != nil {
			if isUniqueConstraintError(err) {
				return bizchapter.ErrChapterNumberConflict
			}
			return fmt.Errorf("写入章节记录失败: %w", err)
		}
		return nil
	})
}

// ListByNovelID 查询指定小说下的章节分页列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
func (r *Repository) ListByNovelID(ctx context.Context, novelID uint64, offset int, limit int) ([]bizchapter.Chapter, int64, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, 0, err
	}

	var total int64
	if err := db.Model(&bizchapter.Chapter{}).Where("novel_id = ?", novelID).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("统计章节记录失败: %w", err)
	}

	var items []bizchapter.Chapter
	if err := db.
		Where("novel_id = ?", novelID).
		Order("chapter_number DESC").
		Offset(offset).
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("查询章节记录失败: %w", err)
	}

	return items, total, nil
}

// GetByID 根据小说 ID 和章节 ID 查询章节。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 chapterID 表示章节主键 ID。
func (r *Repository) GetByID(ctx context.Context, novelID uint64, chapterID uint64) (*bizchapter.Chapter, error) {
	var item bizchapter.Chapter
	if err := r.db.WithContext(ctx).
		Where("novel_id = ? AND id = ?", novelID, chapterID).
		First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, bizchapter.ErrNotFound
		}
		return nil, fmt.Errorf("查询章节记录失败: %w", err)
	}
	return &item, nil
}

// Update 更新章节记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要保存的章节模型。
func (r *Repository) Update(ctx context.Context, item *bizchapter.Chapter) error {
	if item == nil {
		return fmt.Errorf("章节记录不能为空")
	}

	result := r.db.WithContext(ctx).
		Model(&bizchapter.Chapter{}).
		Where("id = ? AND novel_id = ?", item.ID, item.NovelID).
		Updates(map[string]any{
			"title":      item.Title,
			"content":    item.Content,
			"word_count": item.WordCount,
		})
	if result.Error != nil {
		return fmt.Errorf("保存章节记录失败: %w", result.Error)
	}

	if err := r.db.WithContext(ctx).
		Where("id = ? AND novel_id = ?", item.ID, item.NovelID).
		First(item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return bizchapter.ErrNotFound
		}
		return fmt.Errorf("刷新章节记录失败: %w", err)
	}
	return nil
}

// Delete 根据小说 ID 和章节 ID 删除章节。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 chapterID 表示章节主键 ID。
func (r *Repository) Delete(ctx context.Context, novelID uint64, chapterID uint64) error {
	result := r.db.WithContext(ctx).
		Where("novel_id = ? AND id = ?", novelID, chapterID).
		Delete(&bizchapter.Chapter{})
	if result.Error != nil {
		return fmt.Errorf("删除章节记录失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return bizchapter.ErrNotFound
	}
	return nil
}

// ensureNovelExists 确认章节所属小说存在。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID。
func ensureNovelExists(db *gorm.DB, novelID uint64) error {
	var total int64
	if err := db.Model(&biznovel.Novel{}).Where("id = ?", novelID).Count(&total).Error; err != nil {
		return fmt.Errorf("查询小说记录失败: %w", err)
	}
	if total == 0 {
		return bizchapter.ErrNovelNotFound
	}
	return nil
}

// maxChapterNumber 查询指定小说当前最大章节号。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID。
func maxChapterNumber(db *gorm.DB, novelID uint64) (int, error) {
	var maxNumber int
	if err := db.
		Model(&bizchapter.Chapter{}).
		Select("COALESCE(MAX(chapter_number), 0)").
		Where("novel_id = ?", novelID).
		Scan(&maxNumber).Error; err != nil {
		return 0, fmt.Errorf("查询最大章节号失败: %w", err)
	}
	return maxNumber, nil
}

// isUniqueConstraintError 判断数据库错误是否为唯一约束冲突。
// 参数 err 表示数据库返回的错误。
func isUniqueConstraintError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(err.Error())
	return strings.Contains(message, "duplicate") ||
		strings.Contains(message, "unique constraint") ||
		strings.Contains(message, "1062") ||
		strings.Contains(message, "23505")
}
