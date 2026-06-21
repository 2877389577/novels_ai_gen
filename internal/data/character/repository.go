package character

import (
	"context"
	"errors"
	"fmt"

	bizcharacter "novels_ai_gen/internal/biz/character"
	biznovel "novels_ai_gen/internal/biz/novel"

	"gorm.io/gorm"
)

// Repository 表示基于 GORM 的角色卡数据仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建角色卡数据仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create 创建角色卡记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的角色卡模型。
func (r *Repository) Create(ctx context.Context, item *bizcharacter.Character) error {
	if item == nil {
		return fmt.Errorf("角色卡记录不能为空")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, item.NovelID); err != nil {
			return err
		}

		if err := tx.Create(item).Error; err != nil {
			return fmt.Errorf("写入角色卡记录失败: %w", err)
		}
		return nil
	})
}

// ListByNovelID 查询指定小说下的角色卡分页列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
func (r *Repository) ListByNovelID(ctx context.Context, novelID uint64, offset int, limit int) ([]bizcharacter.Character, int64, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, 0, err
	}

	var total int64
	if err := db.Model(&bizcharacter.Character{}).Where("novel_id = ?", novelID).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("统计角色卡记录失败: %w", err)
	}

	var items []bizcharacter.Character
	if err := db.
		Where("novel_id = ?", novelID).
		Order("id DESC").
		Offset(offset).
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("查询角色卡记录失败: %w", err)
	}

	return items, total, nil
}

// ListByNovelIDAsc 查询指定小说下按角色 ID 升序排列的角色卡分页列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
func (r *Repository) ListByNovelIDAsc(ctx context.Context, novelID uint64, offset int, limit int) ([]bizcharacter.Character, int64, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, 0, err
	}

	var total int64
	if err := db.Model(&bizcharacter.Character{}).Where("novel_id = ?", novelID).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("统计角色卡记录失败: %w", err)
	}

	var items []bizcharacter.Character
	if err := db.
		Where("novel_id = ?", novelID).
		Order("id ASC").
		Offset(offset).
		Limit(limit).
		Find(&items).Error; err != nil {
		return nil, 0, fmt.Errorf("查询角色卡记录失败: %w", err)
	}

	return items, total, nil
}

// SearchByName 根据小说 ID 和角色名精确查询角色卡列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 name 表示角色姓名。
func (r *Repository) SearchByName(ctx context.Context, novelID uint64, name string) ([]bizcharacter.Character, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, err
	}

	var items []bizcharacter.Character
	if err := db.
		Where("novel_id = ? AND name = ?", novelID, name).
		Order("id ASC").
		Find(&items).Error; err != nil {
		return nil, fmt.Errorf("查询角色卡记录失败: %w", err)
	}
	return items, nil
}

// GetByID 根据小说 ID 和角色卡 ID 查询角色卡。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 characterID 表示角色卡主键 ID。
func (r *Repository) GetByID(ctx context.Context, novelID uint64, characterID uint64) (*bizcharacter.Character, error) {
	var item bizcharacter.Character
	if err := r.db.WithContext(ctx).
		Where("novel_id = ? AND id = ?", novelID, characterID).
		First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, bizcharacter.ErrNotFound
		}
		return nil, fmt.Errorf("查询角色卡记录失败: %w", err)
	}
	return &item, nil
}

// Update 更新角色卡记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要保存的角色卡模型。
func (r *Repository) Update(ctx context.Context, item *bizcharacter.Character) error {
	if item == nil {
		return fmt.Errorf("角色卡记录不能为空")
	}

	result := r.db.WithContext(ctx).
		Model(&bizcharacter.Character{}).
		Where("id = ? AND novel_id = ?", item.ID, item.NovelID).
		Updates(map[string]any{
			"portrait_url": item.PortraitURL,
			"name":         item.Name,
			"gender":       item.Gender,
			"tags":         item.Tags,
			"background":   item.Background,
			"personality":  item.Personality,
			"ability":      item.Ability,
			"goal":         item.Goal,
		})
	if result.Error != nil {
		return fmt.Errorf("保存角色卡记录失败: %w", result.Error)
	}

	if err := r.db.WithContext(ctx).
		Where("id = ? AND novel_id = ?", item.ID, item.NovelID).
		First(item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return bizcharacter.ErrNotFound
		}
		return fmt.Errorf("刷新角色卡记录失败: %w", err)
	}
	return nil
}

// SaveCharacter 新增或更新角色卡核心设定字段。
// 参数 ctx 表示请求上下文；参数 item 表示需要新增或更新的角色卡模型。
func (r *Repository) SaveCharacter(ctx context.Context, item *bizcharacter.Character) error {
	if item == nil {
		return fmt.Errorf("角色卡记录不能为空")
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, item.NovelID); err != nil {
			return err
		}

		if item.ID == 0 {
			if err := tx.Create(item).Error; err != nil {
				return fmt.Errorf("写入角色卡记录失败: %w", err)
			}
			return nil
		}

		var existing bizcharacter.Character
		if err := tx.Where("novel_id = ? AND id = ?", item.NovelID, item.ID).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return bizcharacter.ErrNotFound
			}
			return fmt.Errorf("查询角色卡记录失败: %w", err)
		}

		if err := tx.Model(&bizcharacter.Character{}).
			Where("id = ? AND novel_id = ?", item.ID, item.NovelID).
			Updates(map[string]any{
				"name":        item.Name,
				"gender":      item.Gender,
				"tags":        item.Tags,
				"background":  item.Background,
				"personality": item.Personality,
				"ability":     item.Ability,
				"goal":        item.Goal,
			}).Error; err != nil {
			return fmt.Errorf("保存角色卡记录失败: %w", err)
		}

		if err := tx.Where("novel_id = ? AND id = ?", item.NovelID, item.ID).First(item).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return bizcharacter.ErrNotFound
			}
			return fmt.Errorf("刷新角色卡记录失败: %w", err)
		}
		return nil
	})
}

// Delete 根据小说 ID 和角色卡 ID 删除角色卡。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 characterID 表示角色卡主键 ID。
func (r *Repository) Delete(ctx context.Context, novelID uint64, characterID uint64) error {
	result := r.db.WithContext(ctx).
		Where("novel_id = ? AND id = ?", novelID, characterID).
		Delete(&bizcharacter.Character{})
	if result.Error != nil {
		return fmt.Errorf("删除角色卡记录失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return bizcharacter.ErrNotFound
	}
	return nil
}

// ensureNovelExists 确认角色卡所属小说存在。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID。
func ensureNovelExists(db *gorm.DB, novelID uint64) error {
	var total int64
	if err := db.Model(&biznovel.Novel{}).Where("id = ?", novelID).Count(&total).Error; err != nil {
		return fmt.Errorf("查询小说记录失败: %w", err)
	}
	if total == 0 {
		return bizcharacter.ErrNovelNotFound
	}
	return nil
}
