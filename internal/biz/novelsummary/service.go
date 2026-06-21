package novelsummary

import (
	"context"
	"fmt"
)

// Repository 表示小说滚动总结数据仓储。
type Repository interface {
	// Create 创建小说滚动总结记录。
	// 参数 ctx 表示请求上下文；参数 item 表示需要创建的小说滚动总结模型。
	Create(ctx context.Context, item *NovelSummary) error
	// GetByNovelID 根据小说 ID 查询小说滚动总结。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	GetByNovelID(ctx context.Context, novelID uint64) (*NovelSummary, error)
	// UpdateContentAndRange 更新小说滚动总结内容和覆盖章节范围并返回更新后的记录。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示需要写入的总结内容和覆盖章节范围。
	UpdateContentAndRange(ctx context.Context, novelID uint64, req SaveRequest) (*NovelSummary, error)
	// UpsertContentAndRange 创建或覆盖小说滚动总结内容和覆盖章节范围并返回保存后的记录。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示需要写入的总结内容和覆盖章节范围。
	UpsertContentAndRange(ctx context.Context, novelID uint64, req SaveRequest) (*NovelSummary, error)
	// DeleteByNovelID 根据小说 ID 删除小说滚动总结。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	DeleteByNovelID(ctx context.Context, novelID uint64) error
}

// Service 表示小说滚动总结业务服务。
type Service struct {
	// repo 表示小说滚动总结数据仓储。
	repo Repository
}

// NewService 创建小说滚动总结业务服务。
// 参数 repo 表示小说滚动总结数据仓储。
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create 创建小说滚动总结。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示保存小说滚动总结请求。
func (s *Service) Create(ctx context.Context, novelID uint64, req SaveRequest) (NovelSummaryResponse, error) {
	if err := validateNovelID(novelID); err != nil {
		return NovelSummaryResponse{}, err
	}
	if err := ValidateSaveRequest(req); err != nil {
		return NovelSummaryResponse{}, err
	}

	item := &NovelSummary{
		NovelID:            novelID,
		Content:            req.Content,
		StartChapterNumber: req.StartChapterNumber,
		EndChapterNumber:   req.EndChapterNumber,
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return NovelSummaryResponse{}, fmt.Errorf("创建小说总结失败: %w", err)
	}
	return toResponse(*item), nil
}

// GetByNovelID 查询小说滚动总结。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) GetByNovelID(ctx context.Context, novelID uint64) (NovelSummaryResponse, error) {
	if err := validateNovelID(novelID); err != nil {
		return NovelSummaryResponse{}, err
	}

	item, err := s.repo.GetByNovelID(ctx, novelID)
	if err != nil {
		return NovelSummaryResponse{}, fmt.Errorf("查询小说总结失败: %w", err)
	}
	return toResponse(*item), nil
}

// Update 更新小说滚动总结内容和覆盖章节范围。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示保存小说滚动总结请求。
func (s *Service) Update(ctx context.Context, novelID uint64, req SaveRequest) (NovelSummaryResponse, error) {
	if err := validateNovelID(novelID); err != nil {
		return NovelSummaryResponse{}, err
	}
	if err := ValidateSaveRequest(req); err != nil {
		return NovelSummaryResponse{}, err
	}

	item, err := s.repo.UpdateContentAndRange(ctx, novelID, req)
	if err != nil {
		return NovelSummaryResponse{}, fmt.Errorf("更新小说总结失败: %w", err)
	}
	return toResponse(*item), nil
}

// Upsert 创建或覆盖小说滚动总结内容和覆盖章节范围。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示保存小说滚动总结请求。
func (s *Service) Upsert(ctx context.Context, novelID uint64, req SaveRequest) (NovelSummaryResponse, error) {
	if err := validateNovelID(novelID); err != nil {
		return NovelSummaryResponse{}, err
	}
	if err := ValidateSaveRequest(req); err != nil {
		return NovelSummaryResponse{}, err
	}

	item, err := s.repo.UpsertContentAndRange(ctx, novelID, req)
	if err != nil {
		return NovelSummaryResponse{}, fmt.Errorf("保存小说总结失败: %w", err)
	}
	return toResponse(*item), nil
}

// Delete 删除小说滚动总结。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) Delete(ctx context.Context, novelID uint64) (DeleteResponse, error) {
	if err := validateNovelID(novelID); err != nil {
		return DeleteResponse{}, err
	}

	if err := s.repo.DeleteByNovelID(ctx, novelID); err != nil {
		return DeleteResponse{}, fmt.Errorf("删除小说总结失败: %w", err)
	}
	return DeleteResponse{Deleted: true}, nil
}

// validateNovelID 校验小说 ID 是否有效。
// 参数 novelID 表示小说主键 ID。
func validateNovelID(novelID uint64) error {
	if novelID == 0 {
		return ErrNovelIDRequired
	}
	return nil
}

// ValidateSaveRequest 校验小说滚动总结保存参数。
// 参数 req 表示需要保存的小说滚动总结内容和覆盖章节范围。
func ValidateSaveRequest(req SaveRequest) error {
	if req.StartChapterNumber == 0 && req.EndChapterNumber == 0 {
		return nil
	}
	if req.StartChapterNumber <= 0 || req.EndChapterNumber <= 0 {
		return ErrInvalidChapterRange
	}
	if req.StartChapterNumber > req.EndChapterNumber {
		return ErrInvalidChapterRange
	}
	return nil
}

// toResponse 将小说滚动总结模型转换为响应数据。
// 参数 item 表示小说滚动总结数据库模型。
func toResponse(item NovelSummary) NovelSummaryResponse {
	return NovelSummaryResponse{
		ID:                 item.ID,
		NovelID:            item.NovelID,
		Content:            item.Content,
		StartChapterNumber: item.StartChapterNumber,
		EndChapterNumber:   item.EndChapterNumber,
		CreatedAt:          item.CreatedAt,
		UpdatedAt:          item.UpdatedAt,
	}
}
