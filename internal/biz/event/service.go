package event

import (
	"context"
	"fmt"
	"math"
	"strings"
)

const (
	defaultPage     = 1
	defaultPageSize = 20
	maxPageSize     = 100
)

// Repository 表示小说事件数据仓储接口。
type Repository interface {
	// Create 创建小说事件。
	// 参数 ctx 表示请求上下文；参数 item 表示需要创建的事件模型；参数 participantIDs 表示参与者角色卡 ID 列表。
	Create(ctx context.Context, item *Event, participantIDs []uint64) (EventResponse, error)
	// ListByNovelID 查询指定小说下的事件分页列表。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
	ListByNovelID(ctx context.Context, novelID uint64, offset int, limit int) ([]EventResponse, int64, error)
	// GetByID 根据小说 ID 和事件 ID 查询事件详情。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 eventID 表示事件主键 ID。
	GetByID(ctx context.Context, novelID uint64, eventID uint64) (EventResponse, error)
	// Update 更新小说事件。
	// 参数 ctx 表示请求上下文；参数 item 表示需要保存的事件模型；参数 participantIDs 表示参与者角色卡 ID 列表。
	Update(ctx context.Context, item *Event, participantIDs []uint64) (EventResponse, error)
	// Delete 根据小说 ID 和事件 ID 删除事件，并返回随事件删除的关系线数量。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 eventID 表示事件主键 ID。
	Delete(ctx context.Context, novelID uint64, eventID uint64) (int64, error)
	// GetGraph 查询指定小说的事件图。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
	GetGraph(ctx context.Context, novelID uint64) (GraphResponse, error)
	// SaveLayout 保存指定小说的事件图布局。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示布局保存请求。
	SaveLayout(ctx context.Context, novelID uint64, req LayoutRequest) (GraphResponse, error)
	// CreateRelation 创建事件有向关系线。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示关系线创建请求。
	CreateRelation(ctx context.Context, novelID uint64, req RelationCreateRequest) (RelationResponse, error)
	// UpdateRelation 更新事件关系线备注。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 relationID 表示关系线主键 ID；参数 req 表示关系线更新请求。
	UpdateRelation(ctx context.Context, novelID uint64, relationID uint64, req RelationUpdateRequest) (RelationResponse, error)
	// DeleteRelation 删除事件关系线。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 relationID 表示关系线主键 ID。
	DeleteRelation(ctx context.Context, novelID uint64, relationID uint64) error
}

// Service 表示小说事件业务服务。
type Service struct {
	// repo 表示小说事件数据仓储。
	repo Repository
}

// NewService 创建小说事件业务服务。
// 参数 repo 表示小说事件数据仓储。
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create 创建小说事件。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示创建事件请求参数。
func (s *Service) Create(ctx context.Context, novelID uint64, req CreateRequest) (EventResponse, error) {
	if novelID == 0 {
		return EventResponse{}, ErrNovelNotFound
	}

	req = normalizeCreateRequest(req)
	if req.Name == "" {
		return EventResponse{}, ErrNameRequired
	}

	item := &Event{
		NovelID:   novelID,
		Name:      req.Name,
		Cause:     req.Cause,
		Process:   req.Process,
		Result:    req.Result,
		Impact:    req.Impact,
		Location:  req.Location,
		PositionX: req.PositionX,
		PositionY: req.PositionY,
	}
	data, err := s.repo.Create(ctx, item, dedupeIDs(req.ParticipantIDs))
	if err != nil {
		return EventResponse{}, fmt.Errorf("创建事件失败: %w", err)
	}
	return data, nil
}

// List 查询指定小说下的事件分页列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示事件列表查询参数。
func (s *Service) List(ctx context.Context, novelID uint64, req ListRequest) (ListResponse, error) {
	if novelID == 0 {
		return ListResponse{}, ErrNovelNotFound
	}

	req = normalizeListRequest(req)
	offset := (req.Page - 1) * req.PageSize
	items, total, err := s.repo.ListByNovelID(ctx, novelID, offset, req.PageSize)
	if err != nil {
		return ListResponse{}, fmt.Errorf("查询事件列表失败: %w", err)
	}

	return ListResponse{
		Items:    items,
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetByID 查询小说事件详情。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 eventID 表示事件主键 ID。
func (s *Service) GetByID(ctx context.Context, novelID uint64, eventID uint64) (EventResponse, error) {
	if novelID == 0 {
		return EventResponse{}, ErrNovelNotFound
	}
	if eventID == 0 {
		return EventResponse{}, ErrNotFound
	}

	data, err := s.repo.GetByID(ctx, novelID, eventID)
	if err != nil {
		return EventResponse{}, fmt.Errorf("查询事件失败: %w", err)
	}
	return data, nil
}

// Update 更新小说事件。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 eventID 表示事件主键 ID；参数 req 表示更新事件请求参数。
func (s *Service) Update(ctx context.Context, novelID uint64, eventID uint64, req UpdateRequest) (EventResponse, error) {
	if novelID == 0 {
		return EventResponse{}, ErrNovelNotFound
	}
	if eventID == 0 {
		return EventResponse{}, ErrNotFound
	}

	req = normalizeUpdateRequest(req)
	if req.Name == "" {
		return EventResponse{}, ErrNameRequired
	}

	item := &Event{
		ID:        eventID,
		NovelID:   novelID,
		Name:      req.Name,
		Cause:     req.Cause,
		Process:   req.Process,
		Result:    req.Result,
		Impact:    req.Impact,
		Location:  req.Location,
		PositionX: req.PositionX,
		PositionY: req.PositionY,
	}
	data, err := s.repo.Update(ctx, item, dedupeIDs(req.ParticipantIDs))
	if err != nil {
		return EventResponse{}, fmt.Errorf("更新事件失败: %w", err)
	}
	return data, nil
}

// Delete 删除小说事件。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 eventID 表示事件主键 ID。
func (s *Service) Delete(ctx context.Context, novelID uint64, eventID uint64) (DeleteResponse, error) {
	if novelID == 0 {
		return DeleteResponse{}, ErrNovelNotFound
	}
	if eventID == 0 {
		return DeleteResponse{}, ErrNotFound
	}

	deletedRelationCount, err := s.repo.Delete(ctx, novelID, eventID)
	if err != nil {
		return DeleteResponse{}, fmt.Errorf("删除事件失败: %w", err)
	}
	return DeleteResponse{Deleted: true, DeletedRelationCount: deletedRelationCount}, nil
}

// GetGraph 查询指定小说的事件图。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
func (s *Service) GetGraph(ctx context.Context, novelID uint64) (GraphResponse, error) {
	if novelID == 0 {
		return GraphResponse{}, ErrNovelNotFound
	}
	data, err := s.repo.GetGraph(ctx, novelID)
	if err != nil {
		return GraphResponse{}, fmt.Errorf("查询事件图失败: %w", err)
	}
	return data, nil
}

// SaveLayout 保存指定小说的事件图布局。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示布局保存请求。
func (s *Service) SaveLayout(ctx context.Context, novelID uint64, req LayoutRequest) (GraphResponse, error) {
	if novelID == 0 {
		return GraphResponse{}, ErrNovelNotFound
	}
	if !isValidViewport(req.Viewport) {
		return GraphResponse{}, ErrInvalidViewport
	}
	for _, node := range req.Nodes {
		if node.EventID == 0 || !isFinite(node.PositionX) || !isFinite(node.PositionY) {
			return GraphResponse{}, ErrInvalidNode
		}
	}

	data, err := s.repo.SaveLayout(ctx, novelID, req)
	if err != nil {
		return GraphResponse{}, fmt.Errorf("保存事件图布局失败: %w", err)
	}
	return data, nil
}

// CreateRelation 创建事件有向关系线。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示关系线创建请求。
func (s *Service) CreateRelation(ctx context.Context, novelID uint64, req RelationCreateRequest) (RelationResponse, error) {
	if novelID == 0 {
		return RelationResponse{}, ErrNovelNotFound
	}

	req = normalizeRelationCreateRequest(req)
	if req.SourceEventID == 0 || req.TargetEventID == 0 {
		return RelationResponse{}, ErrRelationEndpointMissing
	}
	if req.SourceEventID == req.TargetEventID {
		return RelationResponse{}, ErrSelfRelation
	}

	data, err := s.repo.CreateRelation(ctx, novelID, req)
	if err != nil {
		return RelationResponse{}, fmt.Errorf("创建事件关系线失败: %w", err)
	}
	return data, nil
}

// UpdateRelation 更新事件关系线备注。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 relationID 表示关系线主键 ID；参数 req 表示关系线更新请求。
func (s *Service) UpdateRelation(ctx context.Context, novelID uint64, relationID uint64, req RelationUpdateRequest) (RelationResponse, error) {
	if novelID == 0 {
		return RelationResponse{}, ErrNovelNotFound
	}
	if relationID == 0 {
		return RelationResponse{}, ErrRelationNotFound
	}

	req.Note = strings.TrimSpace(req.Note)
	data, err := s.repo.UpdateRelation(ctx, novelID, relationID, req)
	if err != nil {
		return RelationResponse{}, fmt.Errorf("更新事件关系线失败: %w", err)
	}
	return data, nil
}

// DeleteRelation 删除事件关系线。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 relationID 表示关系线主键 ID。
func (s *Service) DeleteRelation(ctx context.Context, novelID uint64, relationID uint64) error {
	if novelID == 0 {
		return ErrNovelNotFound
	}
	if relationID == 0 {
		return ErrRelationNotFound
	}

	if err := s.repo.DeleteRelation(ctx, novelID, relationID); err != nil {
		return fmt.Errorf("删除事件关系线失败: %w", err)
	}
	return nil
}

// normalizeCreateRequest 标准化创建事件请求参数。
// 参数 req 表示创建事件请求参数。
func normalizeCreateRequest(req CreateRequest) CreateRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.Cause = strings.TrimSpace(req.Cause)
	req.Process = strings.TrimSpace(req.Process)
	req.Result = strings.TrimSpace(req.Result)
	req.Impact = strings.TrimSpace(req.Impact)
	req.Location = strings.TrimSpace(req.Location)
	return req
}

// normalizeUpdateRequest 标准化更新事件请求参数。
// 参数 req 表示更新事件请求参数。
func normalizeUpdateRequest(req UpdateRequest) UpdateRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.Cause = strings.TrimSpace(req.Cause)
	req.Process = strings.TrimSpace(req.Process)
	req.Result = strings.TrimSpace(req.Result)
	req.Impact = strings.TrimSpace(req.Impact)
	req.Location = strings.TrimSpace(req.Location)
	return req
}

// normalizeListRequest 标准化事件列表查询参数。
// 参数 req 表示事件列表查询参数。
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

// normalizeRelationCreateRequest 标准化创建关系线请求参数。
// 参数 req 表示创建关系线请求参数。
func normalizeRelationCreateRequest(req RelationCreateRequest) RelationCreateRequest {
	req.Note = strings.TrimSpace(req.Note)
	return req
}

// dedupeIDs 去重正整数 ID 列表并保持首次出现顺序。
// 参数 ids 表示待去重的 ID 列表。
func dedupeIDs(ids []uint64) []uint64 {
	seen := make(map[uint64]bool, len(ids))
	items := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id == 0 || seen[id] {
			continue
		}
		seen[id] = true
		items = append(items, id)
	}
	return items
}

// isValidViewport 判断事件图视口参数是否合法。
// 参数 viewport 表示需要校验的事件图视口。
func isValidViewport(viewport Viewport) bool {
	return isFinite(viewport.X) && isFinite(viewport.Y) && isFinite(viewport.Zoom) && viewport.Zoom > 0
}

// isFinite 判断浮点数是否是有限值。
// 参数 value 表示需要判断的浮点数。
func isFinite(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}
