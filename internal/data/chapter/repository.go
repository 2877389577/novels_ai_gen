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

// allowedChapterSelectFields 表示章节工具允许按需读取的数据库字段白名单。
var allowedChapterSelectFields = map[string]struct{}{
	"id":             {},
	"novel_id":       {},
	"chapter_number": {},
	"title":          {},
	"content":        {},
	"summary":        {},
	"word_count":     {},
	"created_at":     {},
	"updated_at":     {},
}

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

// Create 创建章节记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的章节模型。
func (r *Repository) Create(ctx context.Context, item *bizchapter.Chapter) error {
	if item == nil {
		return fmt.Errorf("章节记录不能为空")
	}
	if item.ChapterNumber <= 0 {
		return bizchapter.ErrChapterNumberRequired
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, item.NovelID); err != nil {
			return err
		}

		if err := tx.Create(item).Error; err != nil {
			if isUniqueConstraintError(err) {
				return bizchapter.ErrChapterNumberConflict
			}
			return fmt.Errorf("写入章节记录失败: %w", err)
		}
		return nil
	})
}

// NextChapterNumber 查询指定小说下一章建议使用的章节号。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
func (r *Repository) NextChapterNumber(ctx context.Context, novelID uint64) (int, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return 0, err
	}

	maxNumber, err := maxChapterNumber(db, novelID)
	if err != nil {
		return 0, err
	}
	return maxNumber + 1, nil
}

// WordCount 查询指定小说所有章节累计后的总字数。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
func (r *Repository) WordCount(ctx context.Context, novelID uint64) (int64, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return 0, err
	}

	var totalWordCount int64
	if err := db.
		Model(&bizchapter.Chapter{}).
		Select("COALESCE(SUM(word_count), 0)").
		Where("novel_id = ?", novelID).
		Scan(&totalWordCount).Error; err != nil {
		return 0, fmt.Errorf("统计小说总字数失败: %w", err)
	}
	return totalWordCount, nil
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

// QueryChapters 根据条件查询章节数据。
// 参数 ctx 表示请求上下文；参数 condition 表示章节查询条件。
func (r *Repository) QueryChapters(ctx context.Context, condition bizchapter.QueryChaptersCondition) ([]bizchapter.Chapter, error) {
	db := r.db.WithContext(ctx)
	if condition.NovelID == 0 {
		return nil, bizchapter.ErrNovelNotFound
	}
	if err := ensureNovelExists(db, condition.NovelID); err != nil {
		return nil, err
	}

	fields, err := normalizeChapterSelectFields(condition.Fields)
	if err != nil {
		return nil, err
	}

	query := db.Model(&bizchapter.Chapter{}).Where("novel_id = ?", condition.NovelID)
	if len(fields) > 0 {
		query = query.Select(fields)
	}

	switch {
	case condition.ChapterID > 0:
		query = query.Where("id = ?", condition.ChapterID)
	case condition.ChapterNumber > 0:
		query = query.Where("chapter_number = ?", condition.ChapterNumber)
	case condition.StartChapterNumber > 0 && condition.EndChapterNumber > 0:
		if condition.StartChapterNumber > condition.EndChapterNumber {
			return nil, fmt.Errorf("章节号范围无效")
		}
		query = query.Where("chapter_number BETWEEN ? AND ?", condition.StartChapterNumber, condition.EndChapterNumber)
	default:
		return nil, fmt.Errorf("章节查询条件不能为空")
	}

	var items []bizchapter.Chapter
	if err := query.Order("chapter_number ASC").Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询章节记录失败: %w", err)
	}
	return items, nil
}

// UpdateChapterSummary 只更新章节总结字段并返回更新后的章节。
// 参数 ctx 表示请求上下文；参数 condition 表示章节总结更新条件。
func (r *Repository) UpdateChapterSummary(ctx context.Context, condition bizchapter.UpdateChapterSummaryCondition) (*bizchapter.Chapter, error) {
	db := r.db.WithContext(ctx)
	if condition.NovelID == 0 {
		return nil, bizchapter.ErrNovelNotFound
	}
	if err := ensureNovelExists(db, condition.NovelID); err != nil {
		return nil, err
	}
	if (condition.ChapterID == 0 && condition.ChapterNumber <= 0) || (condition.ChapterID > 0 && condition.ChapterNumber > 0) {
		return nil, fmt.Errorf("章节总结更新条件无效")
	}

	query := db.Model(&bizchapter.Chapter{}).Where("novel_id = ?", condition.NovelID)
	if condition.ChapterID > 0 {
		query = query.Where("id = ?", condition.ChapterID)
	} else {
		query = query.Where("chapter_number = ?", condition.ChapterNumber)
	}

	var existing bizchapter.Chapter
	if err := query.First(&existing).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, bizchapter.ErrNotFound
		}
		return nil, fmt.Errorf("查询章节记录失败: %w", err)
	}

	if err := db.Model(&bizchapter.Chapter{}).
		Where("id = ? AND novel_id = ?", existing.ID, existing.NovelID).
		Update("summary", condition.Summary).Error; err != nil {
		return nil, fmt.Errorf("更新章节总结失败: %w", err)
	}

	return r.getChapterBySummaryCondition(ctx, condition)
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

// getChapterBySummaryCondition 根据章节总结更新条件重新读取章节。
// 参数 ctx 表示请求上下文；参数 condition 表示章节总结更新条件。
func (r *Repository) getChapterBySummaryCondition(ctx context.Context, condition bizchapter.UpdateChapterSummaryCondition) (*bizchapter.Chapter, error) {
	var item bizchapter.Chapter
	query := r.db.WithContext(ctx).Where("novel_id = ?", condition.NovelID)
	if condition.ChapterID > 0 {
		query = query.Where("id = ?", condition.ChapterID)
	} else {
		query = query.Where("chapter_number = ?", condition.ChapterNumber)
	}
	if err := query.First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, bizchapter.ErrNotFound
		}
		return nil, fmt.Errorf("刷新章节总结失败: %w", err)
	}
	return &item, nil
}

// normalizeChapterSelectFields 标准化章节查询字段并校验字段白名单。
// 参数 fields 表示调用方请求读取的字段列表。
func normalizeChapterSelectFields(fields []string) ([]string, error) {
	if len(fields) == 0 {
		return nil, nil
	}

	normalized := make([]string, 0, len(fields))
	seen := make(map[string]struct{}, len(fields))
	for _, rawField := range fields {
		field := strings.TrimSpace(rawField)
		if field == "" {
			return nil, fmt.Errorf("章节查询字段不能为空")
		}
		if _, ok := allowedChapterSelectFields[field]; !ok {
			return nil, fmt.Errorf("章节查询字段 %s 不支持", field)
		}
		if _, ok := seen[field]; ok {
			continue
		}
		seen[field] = struct{}{}
		normalized = append(normalized, field)
	}
	return normalized, nil
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
