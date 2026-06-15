package character

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

// Repository 表示角色卡数据仓储接口。
type Repository interface {
	// Create 创建角色卡记录。
	// 参数 ctx 表示请求上下文；参数 item 表示需要创建的角色卡模型。
	Create(ctx context.Context, item *Character) error
	// ListByNovelID 查询指定小说下的角色卡分页列表。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
	ListByNovelID(ctx context.Context, novelID uint64, offset int, limit int) ([]Character, int64, error)
	// GetByID 根据小说 ID 和角色卡 ID 查询角色卡。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 characterID 表示角色卡主键 ID。
	GetByID(ctx context.Context, novelID uint64, characterID uint64) (*Character, error)
	// Update 更新角色卡记录。
	// 参数 ctx 表示请求上下文；参数 item 表示需要保存的角色卡模型。
	Update(ctx context.Context, item *Character) error
	// Delete 根据小说 ID 和角色卡 ID 删除角色卡。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 characterID 表示角色卡主键 ID。
	Delete(ctx context.Context, novelID uint64, characterID uint64) error
}

// Service 表示角色卡业务服务。
type Service struct {
	// repo 表示角色卡数据仓储。
	repo Repository
}

// NewService 创建角色卡业务服务。
// 参数 repo 表示角色卡数据仓储。
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create 创建角色卡。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示创建角色卡请求参数。
func (s *Service) Create(ctx context.Context, novelID uint64, req CreateRequest) (CharacterResponse, error) {
	if novelID == 0 {
		return CharacterResponse{}, ErrNovelNotFound
	}

	req = normalizeCreateRequest(req)
	if req.Name == "" {
		return CharacterResponse{}, ErrNameRequired
	}

	item := &Character{
		NovelID:     novelID,
		PortraitURL: req.PortraitURL,
		Name:        req.Name,
		Gender:      req.Gender,
		Tags:        req.Tags,
		Background:  req.Background,
		Personality: req.Personality,
		Ability:     req.Ability,
		Goal:        req.Goal,
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return CharacterResponse{}, fmt.Errorf("创建角色卡失败: %w", err)
	}

	return toResponse(*item), nil
}

// List 查询指定小说下的角色卡分页列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示角色卡列表查询参数。
func (s *Service) List(ctx context.Context, novelID uint64, req ListRequest) (ListResponse, error) {
	if novelID == 0 {
		return ListResponse{}, ErrNovelNotFound
	}

	req = normalizeListRequest(req)
	offset := (req.Page - 1) * req.PageSize

	items, total, err := s.repo.ListByNovelID(ctx, novelID, offset, req.PageSize)
	if err != nil {
		return ListResponse{}, fmt.Errorf("查询角色卡列表失败: %w", err)
	}

	return ListResponse{
		Items:    toSummaryResponses(items),
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetByID 查询角色卡详情。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 characterID 表示角色卡主键 ID。
func (s *Service) GetByID(ctx context.Context, novelID uint64, characterID uint64) (CharacterResponse, error) {
	if novelID == 0 {
		return CharacterResponse{}, ErrNovelNotFound
	}
	if characterID == 0 {
		return CharacterResponse{}, ErrNotFound
	}

	item, err := s.repo.GetByID(ctx, novelID, characterID)
	if err != nil {
		return CharacterResponse{}, fmt.Errorf("查询角色卡失败: %w", err)
	}
	return toResponse(*item), nil
}

// Update 更新角色卡。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 characterID 表示角色卡主键 ID；参数 req 表示更新角色卡请求参数。
func (s *Service) Update(ctx context.Context, novelID uint64, characterID uint64, req UpdateRequest) (CharacterResponse, error) {
	if novelID == 0 {
		return CharacterResponse{}, ErrNovelNotFound
	}
	if characterID == 0 {
		return CharacterResponse{}, ErrNotFound
	}

	req = normalizeUpdateRequest(req)
	if req.Name == "" {
		return CharacterResponse{}, ErrNameRequired
	}

	item, err := s.repo.GetByID(ctx, novelID, characterID)
	if err != nil {
		return CharacterResponse{}, fmt.Errorf("查询角色卡失败: %w", err)
	}

	item.PortraitURL = req.PortraitURL
	item.Name = req.Name
	item.Gender = req.Gender
	item.Tags = req.Tags
	item.Background = req.Background
	item.Personality = req.Personality
	item.Ability = req.Ability
	item.Goal = req.Goal

	if err := s.repo.Update(ctx, item); err != nil {
		return CharacterResponse{}, fmt.Errorf("更新角色卡失败: %w", err)
	}

	return toResponse(*item), nil
}

// Delete 删除角色卡。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 characterID 表示角色卡主键 ID。
func (s *Service) Delete(ctx context.Context, novelID uint64, characterID uint64) error {
	if novelID == 0 {
		return ErrNovelNotFound
	}
	if characterID == 0 {
		return ErrNotFound
	}

	if err := s.repo.Delete(ctx, novelID, characterID); err != nil {
		return fmt.Errorf("删除角色卡失败: %w", err)
	}
	return nil
}

// normalizeCreateRequest 标准化创建角色卡请求参数。
// 参数 req 表示创建角色卡请求参数。
func normalizeCreateRequest(req CreateRequest) CreateRequest {
	req.PortraitURL = strings.TrimSpace(req.PortraitURL)
	req.Name = strings.TrimSpace(req.Name)
	req.Gender = strings.TrimSpace(req.Gender)
	req.Tags = strings.TrimSpace(req.Tags)
	req.Background = strings.TrimSpace(req.Background)
	req.Personality = strings.TrimSpace(req.Personality)
	req.Ability = strings.TrimSpace(req.Ability)
	req.Goal = strings.TrimSpace(req.Goal)
	return req
}

// normalizeUpdateRequest 标准化更新角色卡请求参数。
// 参数 req 表示更新角色卡请求参数。
func normalizeUpdateRequest(req UpdateRequest) UpdateRequest {
	req.PortraitURL = strings.TrimSpace(req.PortraitURL)
	req.Name = strings.TrimSpace(req.Name)
	req.Gender = strings.TrimSpace(req.Gender)
	req.Tags = strings.TrimSpace(req.Tags)
	req.Background = strings.TrimSpace(req.Background)
	req.Personality = strings.TrimSpace(req.Personality)
	req.Ability = strings.TrimSpace(req.Ability)
	req.Goal = strings.TrimSpace(req.Goal)
	return req
}

// normalizeListRequest 标准化角色卡列表查询参数。
// 参数 req 表示角色卡列表查询参数。
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

// toResponse 将角色卡模型转换为详情响应数据。
// 参数 item 表示角色卡数据库模型。
func toResponse(item Character) CharacterResponse {
	return CharacterResponse{
		ID:          item.ID,
		NovelID:     item.NovelID,
		PortraitURL: item.PortraitURL,
		Name:        item.Name,
		Gender:      item.Gender,
		Tags:        item.Tags,
		Background:  item.Background,
		Personality: item.Personality,
		Ability:     item.Ability,
		Goal:        item.Goal,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}
}

// toSummaryResponse 将角色卡模型转换为列表摘要响应数据。
// 参数 item 表示角色卡数据库模型。
func toSummaryResponse(item Character) CharacterSummaryResponse {
	return CharacterSummaryResponse{
		ID:          item.ID,
		NovelID:     item.NovelID,
		PortraitURL: item.PortraitURL,
		Name:        item.Name,
		Gender:      item.Gender,
		Tags:        item.Tags,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}
}

// toSummaryResponses 将角色卡模型列表转换为列表摘要响应数据列表。
// 参数 items 表示角色卡数据库模型列表。
func toSummaryResponses(items []Character) []CharacterSummaryResponse {
	responses := make([]CharacterSummaryResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, toSummaryResponse(item))
	}
	return responses
}
