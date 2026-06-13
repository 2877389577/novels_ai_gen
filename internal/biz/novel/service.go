package novel

import (
	"context"
	"fmt"
	"strings"
)

const (
	defaultPage     = 1
	defaultPageSize = 20
	maxPageSize     = 100
)

// Repository 表示小说数据仓储接口。
type Repository interface {
	// Create 创建小说记录。
	// 参数 ctx 表示请求上下文；参数 novel 表示需要创建的小说模型。
	Create(ctx context.Context, novel *Novel) error
	// List 查询小说分页列表。
	// 参数 ctx 表示请求上下文；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
	List(ctx context.Context, offset int, limit int) ([]Novel, int64, error)
	// GetByID 根据 ID 查询小说。
	// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
	GetByID(ctx context.Context, id uint64) (*Novel, error)
	// Update 更新小说记录。
	// 参数 ctx 表示请求上下文；参数 novel 表示需要保存的小说模型。
	Update(ctx context.Context, novel *Novel) error
	// Delete 根据 ID 删除小说记录。
	// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
	Delete(ctx context.Context, id uint64) error
}

// Service 表示小说业务服务。
type Service struct {
	// repo 表示小说数据仓储。
	repo Repository
}

// NewService 创建小说业务服务。
// 参数 repo 表示小说数据仓储。
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create 创建小说。
// 参数 ctx 表示请求上下文；参数 req 表示创建小说请求参数。
func (s *Service) Create(ctx context.Context, req CreateRequest) (NovelResponse, error) {
	req = normalizeCreateRequest(req)
	if req.Name == "" {
		return NovelResponse{}, ErrNameRequired
	}

	item := &Novel{
		Name:        req.Name,
		AuthorName:  req.AuthorName,
		Description: req.Description,
		Tags:        req.Tags,
		CoverURL:    req.CoverURL,
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return NovelResponse{}, fmt.Errorf("创建小说失败: %w", err)
	}

	return toResponse(*item), nil
}

// List 查询小说分页列表。
// 参数 ctx 表示请求上下文；参数 req 表示小说列表查询参数。
func (s *Service) List(ctx context.Context, req ListRequest) (ListResponse, error) {
	req = normalizeListRequest(req)
	offset := (req.Page - 1) * req.PageSize

	items, total, err := s.repo.List(ctx, offset, req.PageSize)
	if err != nil {
		return ListResponse{}, fmt.Errorf("查询小说列表失败: %w", err)
	}

	return ListResponse{
		Items:    toResponses(items),
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetByID 根据 ID 查询小说。
// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
func (s *Service) GetByID(ctx context.Context, id uint64) (NovelResponse, error) {
	item, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return NovelResponse{}, fmt.Errorf("查询小说失败: %w", err)
	}
	return toResponse(*item), nil
}

// Update 更新小说。
// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID；参数 req 表示更新小说请求参数。
func (s *Service) Update(ctx context.Context, id uint64, req UpdateRequest) (NovelResponse, error) {
	req = normalizeUpdateRequest(req)
	if req.Name == "" {
		return NovelResponse{}, ErrNameRequired
	}

	item, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return NovelResponse{}, fmt.Errorf("查询小说失败: %w", err)
	}

	item.Name = req.Name
	item.AuthorName = req.AuthorName
	item.Description = req.Description
	item.Tags = req.Tags
	item.CoverURL = req.CoverURL

	if err := s.repo.Update(ctx, item); err != nil {
		return NovelResponse{}, fmt.Errorf("更新小说失败: %w", err)
	}

	return toResponse(*item), nil
}

// Delete 删除小说。
// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
func (s *Service) Delete(ctx context.Context, id uint64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("删除小说失败: %w", err)
	}
	return nil
}

// normalizeCreateRequest 标准化创建小说请求参数。
// 参数 req 表示创建小说请求参数。
func normalizeCreateRequest(req CreateRequest) CreateRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.AuthorName = strings.TrimSpace(req.AuthorName)
	req.Description = strings.TrimSpace(req.Description)
	req.Tags = strings.TrimSpace(req.Tags)
	req.CoverURL = strings.TrimSpace(req.CoverURL)
	return req
}

// normalizeUpdateRequest 标准化更新小说请求参数。
// 参数 req 表示更新小说请求参数。
func normalizeUpdateRequest(req UpdateRequest) UpdateRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.AuthorName = strings.TrimSpace(req.AuthorName)
	req.Description = strings.TrimSpace(req.Description)
	req.Tags = strings.TrimSpace(req.Tags)
	req.CoverURL = strings.TrimSpace(req.CoverURL)
	return req
}

// normalizeListRequest 标准化小说列表查询参数。
// 参数 req 表示小说列表查询参数。
func normalizeListRequest(req ListRequest) ListRequest {
	if req.Page <= 0 {
		req.Page = defaultPage
	}
	if req.PageSize <= 0 {
		req.PageSize = defaultPageSize
	}
	if req.PageSize > maxPageSize {
		req.PageSize = maxPageSize
	}
	return req
}

// toResponse 将小说模型转换为响应数据。
// 参数 item 表示小说数据库模型。
func toResponse(item Novel) NovelResponse {
	return NovelResponse{
		ID:          item.ID,
		Name:        item.Name,
		AuthorName:  item.AuthorName,
		Description: item.Description,
		Tags:        item.Tags,
		CoverURL:    item.CoverURL,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}
}

// toResponses 将小说模型列表转换为响应数据列表。
// 参数 items 表示小说数据库模型列表。
func toResponses(items []Novel) []NovelResponse {
	responses := make([]NovelResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, toResponse(item))
	}
	return responses
}
