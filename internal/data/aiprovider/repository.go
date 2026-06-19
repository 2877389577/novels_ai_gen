package aiprovider

import (
	"context"
	"errors"
	"fmt"
	"strings"

	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"

	"gorm.io/gorm"
)

// Repository 表示基于 GORM 的 AI 提供商数据仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建 AI 提供商数据仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create 创建 AI 提供商记录。
// 参数 ctx 表示请求上下文；参数 provider 表示需要创建的 AI 提供商模型。
func (r *Repository) Create(ctx context.Context, provider *bizaiprovider.Provider) error {
	if provider == nil {
		return fmt.Errorf("AI 提供商记录不能为空")
	}

	if err := r.db.WithContext(ctx).Create(provider).Error; err != nil {
		if isUniqueConstraintError(err) {
			return bizaiprovider.ErrNameConflict
		}
		return fmt.Errorf("写入 AI 提供商记录失败: %w", err)
	}
	return nil
}

// List 查询 AI 提供商分页列表。
// 参数 ctx 表示请求上下文；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
func (r *Repository) List(ctx context.Context, offset int, limit int) ([]bizaiprovider.Provider, int64, error) {
	var total int64
	if err := r.db.WithContext(ctx).Model(&bizaiprovider.Provider{}).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("统计 AI 提供商记录失败: %w", err)
	}

	var items []bizaiprovider.Provider
	if err := r.db.WithContext(ctx).
		Order("id DESC").
		Offset(offset).
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("查询 AI 提供商记录失败: %w", err)
	}

	return items, total, nil
}

// GetByID 根据 ID 查询 AI 提供商。
// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
func (r *Repository) GetByID(ctx context.Context, id uint64) (*bizaiprovider.Provider, error) {
	var item bizaiprovider.Provider
	if err := r.db.WithContext(ctx).First(&item, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, bizaiprovider.ErrNotFound
		}
		return nil, fmt.Errorf("查询 AI 提供商记录失败: %w", err)
	}
	return &item, nil
}

// Update 更新 AI 提供商记录。
// 参数 ctx 表示请求上下文；参数 provider 表示需要保存的 AI 提供商模型。
func (r *Repository) Update(ctx context.Context, provider *bizaiprovider.Provider) error {
	if provider == nil {
		return fmt.Errorf("AI 提供商记录不能为空")
	}

	result := r.db.WithContext(ctx).
		Model(&bizaiprovider.Provider{}).
		Where("id = ?", provider.ID).
		Updates(map[string]any{
			"name":               provider.Name,
			"provider_type":      provider.ProviderType,
			"api_key_ciphertext": provider.APIKeyCiphertext,
			"api_key_mask":       provider.APIKeyMask,
			"base_url":           provider.BaseURL,
			"api_type":           provider.APIType,
			"enabled":            provider.Enabled,
		})
	if result.Error != nil {
		if isUniqueConstraintError(result.Error) {
			return bizaiprovider.ErrNameConflict
		}
		return fmt.Errorf("保存 AI 提供商记录失败: %w", result.Error)
	}

	if err := r.db.WithContext(ctx).First(provider, provider.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return bizaiprovider.ErrNotFound
		}
		return fmt.Errorf("刷新 AI 提供商记录失败: %w", err)
	}
	return nil
}

// Delete 根据 ID 删除 AI 提供商记录。
// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
func (r *Repository) Delete(ctx context.Context, id uint64) error {
	result := r.db.WithContext(ctx).Delete(&bizaiprovider.Provider{}, id)
	if result.Error != nil {
		return fmt.Errorf("删除 AI 提供商记录失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return bizaiprovider.ErrNotFound
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
