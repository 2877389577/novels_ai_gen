package novel

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"
	biznovel "novels_ai_gen/internal/biz/novel"
)

// Repository 表示基于 GORM 的小说数据仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建小说数据仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create 创建小说记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的小说模型。
func (r *Repository) Create(ctx context.Context, item *biznovel.Novel) error {
	if err := r.db.WithContext(ctx).Create(item).Error; err != nil {
		return fmt.Errorf("写入小说记录失败: %w", err)
	}
	return nil
}

// List 查询小说分页列表。
// 参数 ctx 表示请求上下文；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
func (r *Repository) List(ctx context.Context, offset int, limit int) ([]biznovel.Novel, int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&biznovel.Novel{}).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("统计小说记录失败: %w", err)
	}

	var items []biznovel.Novel
	if err := r.db.WithContext(ctx).
		Order("id DESC").
		Offset(offset).
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("查询小说记录失败: %w", err)
	}

	return items, total, nil
}

// GetByID 根据 ID 查询小说。
// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
func (r *Repository) GetByID(ctx context.Context, id uint64) (*biznovel.Novel, error) {
	var item biznovel.Novel
	if err := r.db.WithContext(ctx).First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, biznovel.ErrNotFound
		}
		return nil, fmt.Errorf("查询小说记录失败: %w", err)
	}
	return &item, nil
}

// Update 更新小说记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要保存的小说模型。
func (r *Repository) Update(ctx context.Context, item *biznovel.Novel) error {
	if err := r.db.WithContext(ctx).Save(item).Error; err != nil {
		return fmt.Errorf("保存小说记录失败: %w", err)
	}
	return nil
}

// Delete 根据 ID 真删小说记录。
// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
func (r *Repository) Delete(ctx context.Context, id uint64) error {
	result := r.db.WithContext(ctx).Delete(&biznovel.Novel{}, id)
	if result.Error != nil {
		return fmt.Errorf("删除小说记录失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return biznovel.ErrNotFound
	}
	return nil
}
