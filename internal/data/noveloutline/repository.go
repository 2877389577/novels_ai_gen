package noveloutline

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	biznovel "novels_ai_gen/internal/biz/novel"
	biznoveloutline "novels_ai_gen/internal/biz/noveloutline"
)

// Repository 表示基于 GORM 的小说大纲数据仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建小说大纲数据仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create 创建小说大纲记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的小说大纲模型。
func (r *Repository) Create(ctx context.Context, item *biznoveloutline.NovelOutline) error {
	if item == nil {
		return fmt.Errorf("小说大纲记录不能为空")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, item.NovelID); err != nil {
			return err
		}
		if err := tx.Create(item).Error; err != nil {
			if isUniqueConstraintError(err) {
				return biznoveloutline.ErrConflict
			}
			return fmt.Errorf("写入小说大纲记录失败: %w", err)
		}
		return nil
	})
}

// GetByNovelID 根据小说 ID 查询小说大纲。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) GetByNovelID(ctx context.Context, novelID uint64) (*biznoveloutline.NovelOutline, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, err
	}

	var item biznoveloutline.NovelOutline
	if err := db.Where("novel_id = ?", novelID).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biznoveloutline.ErrNotFound
		}
		return nil, fmt.Errorf("查询小说大纲记录失败: %w", err)
	}
	return &item, nil
}

// UpdateContent 更新小说大纲内容并返回更新后的记录。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 content 表示需要写入的大纲正文。
func (r *Repository) UpdateContent(ctx context.Context, novelID uint64, content string) (*biznoveloutline.NovelOutline, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, err
	}

	var item biznoveloutline.NovelOutline
	if err := db.Where("novel_id = ?", novelID).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biznoveloutline.ErrNotFound
		}
		return nil, fmt.Errorf("查询小说大纲记录失败: %w", err)
	}
	if err := db.Model(&item).Update("content", content).Error; err != nil {
		return nil, fmt.Errorf("更新小说大纲记录失败: %w", err)
	}
	return r.GetByNovelID(ctx, novelID)
}

// DeleteByNovelID 根据小说 ID 删除小说大纲。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (r *Repository) DeleteByNovelID(ctx context.Context, novelID uint64) error {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return err
	}

	result := db.Where("novel_id = ?", novelID).Delete(&biznoveloutline.NovelOutline{})
	if result.Error != nil {
		return fmt.Errorf("删除小说大纲记录失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return biznoveloutline.ErrNotFound
	}
	return nil
}

// ensureNovelExists 确认小说大纲所属小说存在。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示小说主键 ID。
func ensureNovelExists(db *gorm.DB, novelID uint64) error {
	if novelID == 0 {
		return biznoveloutline.ErrNovelIDRequired
	}

	var total int64
	if err := db.Model(&biznovel.Novel{}).Where("id = ?", novelID).Count(&total).Error; err != nil {
		return fmt.Errorf("查询小说记录失败: %w", err)
	}
	if total == 0 {
		return biznoveloutline.ErrNovelNotFound
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
