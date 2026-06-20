package prompt

import (
	"context"
	"errors"
	"fmt"

	bizprompt "novels_ai_gen/internal/biz/prompt"

	"gorm.io/gorm"
)

// Repository 表示基于 GORM 的提示词数据仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建提示词数据仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create 创建提示词记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的提示词模型。
func (r *Repository) Create(ctx context.Context, item *bizprompt.Prompt) error {
	if item == nil {
		return fmt.Errorf("提示词记录不能为空")
	}
	if err := r.db.WithContext(ctx).Create(item).Error; err != nil {
		return fmt.Errorf("写入提示词记录失败: %w", err)
	}
	return nil
}

// List 查询提示词分页列表。
// 参数 ctx 表示请求上下文；参数 promptType 表示筛选提示词类型；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
func (r *Repository) List(ctx context.Context, promptType string, offset int, limit int) ([]bizprompt.Prompt, int64, error) {
	base := r.db.WithContext(ctx).Model(&bizprompt.Prompt{})
	if promptType != "" {
		base = base.Where("prompt_type = ?", promptType)
	}

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("统计提示词记录失败: %w", err)
	}

	query := r.db.WithContext(ctx).Model(&bizprompt.Prompt{})
	if promptType != "" {
		query = query.Where("prompt_type = ?", promptType)
	}

	var items []bizprompt.Prompt
	if err := query.
		Order("updated_at DESC").
		Order("id DESC").
		Offset(offset).
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("查询提示词记录失败: %w", err)
	}

	return items, total, nil
}

// GetByID 根据 ID 查询提示词。
// 参数 ctx 表示请求上下文；参数 id 表示提示词主键 ID。
func (r *Repository) GetByID(ctx context.Context, id uint64) (*bizprompt.Prompt, error) {
	var item bizprompt.Prompt
	if err := r.db.WithContext(ctx).First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, bizprompt.ErrNotFound
		}
		return nil, fmt.Errorf("查询提示词记录失败: %w", err)
	}
	return &item, nil
}

// Update 更新提示词记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要保存的提示词模型。
func (r *Repository) Update(ctx context.Context, item *bizprompt.Prompt) error {
	if item == nil {
		return fmt.Errorf("提示词记录不能为空")
	}

	result := r.db.WithContext(ctx).
		Model(&bizprompt.Prompt{}).
		Where("id = ?", item.ID).
		Updates(map[string]any{
			"prompt_type": item.PromptType,
			"description": item.Description,
			"content":     item.Content,
		})
	if result.Error != nil {
		return fmt.Errorf("保存提示词记录失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return bizprompt.ErrNotFound
	}

	if err := r.db.WithContext(ctx).First(item, item.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return bizprompt.ErrNotFound
		}
		return fmt.Errorf("刷新提示词记录失败: %w", err)
	}
	return nil
}

// Delete 根据 ID 删除提示词记录。
// 参数 ctx 表示请求上下文；参数 id 表示提示词主键 ID。
func (r *Repository) Delete(ctx context.Context, id uint64) error {
	result := r.db.WithContext(ctx).Delete(&bizprompt.Prompt{}, id)
	if result.Error != nil {
		return fmt.Errorf("删除提示词记录失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return bizprompt.ErrNotFound
	}
	return nil
}

// CountByType 统计指定类型下的提示词数量。
// 参数 ctx 表示请求上下文；参数 name 表示提示词类型名称。
func (r *Repository) CountByType(ctx context.Context, name string) (int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).
		Model(&bizprompt.Prompt{}).
		Where("prompt_type = ?", name).
		Count(&total).Error; err != nil {
		return 0, fmt.Errorf("统计提示词类型引用失败: %w", err)
	}
	return total, nil
}

// RenameType 批量重命名提示词记录中的类型值。
// 参数 ctx 表示请求上下文；参数 oldName 表示旧类型名称；参数 newName 表示新类型名称。
func (r *Repository) RenameType(ctx context.Context, oldName string, newName string) error {
	if err := r.db.WithContext(ctx).
		Model(&bizprompt.Prompt{}).
		Where("prompt_type = ?", oldName).
		Update("prompt_type", newName).Error; err != nil {
		return fmt.Errorf("批量更新提示词类型失败: %w", err)
	}
	return nil
}
