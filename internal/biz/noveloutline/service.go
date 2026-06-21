package noveloutline

import (
	"context"
	"fmt"
)

// Repository 表示小说大纲数据仓储。
type Repository interface {
	// Create 创建小说大纲记录。
	// 参数 ctx 表示请求上下文；参数 item 表示需要创建的小说大纲模型。
	Create(ctx context.Context, item *NovelOutline) error
	// GetByNovelID 根据小说 ID 查询小说大纲。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	GetByNovelID(ctx context.Context, novelID uint64) (*NovelOutline, error)
	// UpdateContent 更新小说大纲内容并返回更新后的记录。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 content 表示需要写入的大纲正文。
	UpdateContent(ctx context.Context, novelID uint64, content string) (*NovelOutline, error)
	// DeleteByNovelID 根据小说 ID 删除小说大纲。
	// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
	DeleteByNovelID(ctx context.Context, novelID uint64) error
}

// Service 表示小说大纲业务服务。
type Service struct {
	// repo 表示小说大纲数据仓储。
	repo Repository
}

// NewService 创建小说大纲业务服务。
// 参数 repo 表示小说大纲数据仓储。
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create 创建小说大纲。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示保存小说大纲请求。
func (s *Service) Create(ctx context.Context, novelID uint64, req SaveRequest) (NovelOutlineResponse, error) {
	if err := validateNovelID(novelID); err != nil {
		return NovelOutlineResponse{}, err
	}

	item := &NovelOutline{
		NovelID: novelID,
		Content: req.Content,
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return NovelOutlineResponse{}, fmt.Errorf("创建小说大纲失败: %w", err)
	}
	return toResponse(*item), nil
}

// GetByNovelID 查询小说大纲。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) GetByNovelID(ctx context.Context, novelID uint64) (NovelOutlineResponse, error) {
	if err := validateNovelID(novelID); err != nil {
		return NovelOutlineResponse{}, err
	}

	item, err := s.repo.GetByNovelID(ctx, novelID)
	if err != nil {
		return NovelOutlineResponse{}, fmt.Errorf("查询小说大纲失败: %w", err)
	}
	return toResponse(*item), nil
}

// Update 更新小说大纲内容。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID；参数 req 表示保存小说大纲请求。
func (s *Service) Update(ctx context.Context, novelID uint64, req SaveRequest) (NovelOutlineResponse, error) {
	if err := validateNovelID(novelID); err != nil {
		return NovelOutlineResponse{}, err
	}

	item, err := s.repo.UpdateContent(ctx, novelID, req.Content)
	if err != nil {
		return NovelOutlineResponse{}, fmt.Errorf("更新小说大纲失败: %w", err)
	}
	return toResponse(*item), nil
}

// Delete 删除小说大纲。
// 参数 ctx 表示请求上下文；参数 novelID 表示小说主键 ID。
func (s *Service) Delete(ctx context.Context, novelID uint64) (DeleteResponse, error) {
	if err := validateNovelID(novelID); err != nil {
		return DeleteResponse{}, err
	}

	if err := s.repo.DeleteByNovelID(ctx, novelID); err != nil {
		return DeleteResponse{}, fmt.Errorf("删除小说大纲失败: %w", err)
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

// toResponse 将小说大纲模型转换为响应数据。
// 参数 item 表示小说大纲数据库模型。
func toResponse(item NovelOutline) NovelOutlineResponse {
	return NovelOutlineResponse{
		ID:        item.ID,
		NovelID:   item.NovelID,
		Content:   item.Content,
		CreatedAt: item.CreatedAt,
		UpdatedAt: item.UpdatedAt,
	}
}
