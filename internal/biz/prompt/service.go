package prompt

import (
	"context"
	"errors"
	"fmt"
	"strings"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

const (
	defaultPage     = 1
	defaultPageSize = 20
	maxPageSize     = 100
)

// Repository 表示提示词数据库仓储。
type Repository interface {
	// Create 创建提示词记录。
	Create(ctx context.Context, item *Prompt) error
	// List 查询提示词分页列表。
	List(ctx context.Context, promptType string, offset int, limit int) ([]Prompt, int64, error)
	// GetByID 根据 ID 查询提示词记录。
	GetByID(ctx context.Context, id uint64) (*Prompt, error)
	// Update 更新提示词记录。
	Update(ctx context.Context, item *Prompt) error
	// Delete 根据 ID 删除提示词记录。
	Delete(ctx context.Context, id uint64) error
	// CountByType 统计指定类型下的提示词数量。
	CountByType(ctx context.Context, name string) (int64, error)
	// RenameType 批量重命名提示词记录中的类型值。
	RenameType(ctx context.Context, oldName string, newName string) error
}

// PromptTypesProvider 表示提示词类型配置读写依赖。
type PromptTypesProvider interface {
	// ReadPromptTypes 读取当前提示词类型配置快照。
	ReadPromptTypes() (appconfig.PromptTypesSnapshot, error)
	// CreatePromptType 创建提示词类型并热加载配置。
	CreatePromptType(name string) (appconfig.PromptTypesSnapshot, error)
	// RenamePromptType 重命名提示词类型并热加载配置。
	RenamePromptType(oldName string, newName string) (appconfig.PromptTypesSnapshot, error)
	// DeletePromptType 删除提示词类型并热加载配置。
	DeletePromptType(name string) (appconfig.PromptTypesSnapshot, error)
}

// Service 表示提示词类型库与提示词库业务服务。
type Service struct {
	// repo 表示提示词数据库仓储。
	repo Repository
	// types 表示提示词类型配置读写依赖。
	types PromptTypesProvider
}

// NewService 创建提示词业务服务。
// 参数 repo 表示提示词数据库仓储；参数 types 表示提示词类型配置读写依赖。
func NewService(repo Repository, types PromptTypesProvider) *Service {
	return &Service{
		repo:  repo,
		types: types,
	}
}

// ListPromptTypes 查询提示词类型配置列表。
// 参数 ctx 表示请求上下文。
func (s *Service) ListPromptTypes(ctx context.Context) (appconfig.PromptTypesSnapshot, error) {
	_ = ctx
	return s.types.ReadPromptTypes()
}

// CreatePromptType 新增提示词类型。
// 参数 ctx 表示请求上下文；参数 req 表示提示词类型请求参数。
func (s *Service) CreatePromptType(ctx context.Context, req TypeRequest) (appconfig.PromptTypesSnapshot, error) {
	_ = ctx
	name := normalizeTypeName(req.Name)
	if name == "" {
		return appconfig.PromptTypesSnapshot{}, ErrTypeNameRequired
	}
	if err := s.ensureTypeAbsent(name); err != nil {
		return appconfig.PromptTypesSnapshot{}, err
	}
	snapshot, err := s.types.CreatePromptType(name)
	if err != nil {
		return appconfig.PromptTypesSnapshot{}, translateConfigTypeError(err)
	}
	return snapshot, nil
}

// RenamePromptType 重命名提示词类型并同步数据库提示词。
// 参数 ctx 表示请求上下文；参数 oldName 表示旧提示词类型名称；参数 req 表示新提示词类型请求参数。
func (s *Service) RenamePromptType(ctx context.Context, oldName string, req TypeRequest) (appconfig.PromptTypesSnapshot, error) {
	oldName = normalizeTypeName(oldName)
	newName := normalizeTypeName(req.Name)
	if oldName == "" || newName == "" {
		return appconfig.PromptTypesSnapshot{}, ErrTypeNameRequired
	}
	if oldName == newName {
		return s.types.ReadPromptTypes()
	}
	if err := s.ensureTypeExists(oldName); err != nil {
		return appconfig.PromptTypesSnapshot{}, err
	}
	if err := s.ensureTypeAbsent(newName); err != nil {
		return appconfig.PromptTypesSnapshot{}, err
	}

	snapshot, err := s.types.RenamePromptType(oldName, newName)
	if err != nil {
		return appconfig.PromptTypesSnapshot{}, translateConfigTypeError(err)
	}
	if err := s.repo.RenameType(ctx, oldName, newName); err != nil {
		_, rollbackErr := s.types.RenamePromptType(newName, oldName)
		if rollbackErr != nil {
			return appconfig.PromptTypesSnapshot{}, fmt.Errorf("同步更新提示词类型失败且回滚配置失败: %w", errors.Join(err, rollbackErr))
		}
		return appconfig.PromptTypesSnapshot{}, fmt.Errorf("同步更新提示词类型失败: %w", err)
	}
	return snapshot, nil
}

// DeletePromptType 删除提示词类型。
// 参数 ctx 表示请求上下文；参数 name 表示提示词类型名称。
func (s *Service) DeletePromptType(ctx context.Context, name string) (appconfig.PromptTypesSnapshot, error) {
	name = normalizeTypeName(name)
	if name == "" {
		return appconfig.PromptTypesSnapshot{}, ErrTypeNameRequired
	}
	if err := s.ensureTypeExists(name); err != nil {
		return appconfig.PromptTypesSnapshot{}, err
	}

	count, err := s.repo.CountByType(ctx, name)
	if err != nil {
		return appconfig.PromptTypesSnapshot{}, fmt.Errorf("统计提示词类型引用失败: %w", err)
	}
	if count > 0 {
		return appconfig.PromptTypesSnapshot{}, ErrTypeInUse
	}

	snapshot, err := s.types.DeletePromptType(name)
	if err != nil {
		return appconfig.PromptTypesSnapshot{}, translateConfigTypeError(err)
	}
	return snapshot, nil
}

// Create 创建提示词。
// 参数 ctx 表示请求上下文；参数 req 表示创建提示词请求参数。
func (s *Service) Create(ctx context.Context, req CreateRequest) (PromptResponse, error) {
	req = normalizeCreateRequest(req)
	if err := s.validatePromptPayload(req.Content, req.PromptType); err != nil {
		return PromptResponse{}, err
	}

	item := &Prompt{
		PromptType:  req.PromptType,
		Description: req.Description,
		Content:     req.Content,
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return PromptResponse{}, fmt.Errorf("创建提示词失败: %w", err)
	}
	return toResponse(*item), nil
}

// List 查询提示词分页列表。
// 参数 ctx 表示请求上下文；参数 req 表示提示词列表查询参数。
func (s *Service) List(ctx context.Context, req ListRequest) (ListResponse, error) {
	req = normalizeListRequest(req)
	if req.PromptType != "" {
		if err := s.ensureTypeExists(req.PromptType); err != nil {
			return ListResponse{}, err
		}
	}

	offset := (req.Page - 1) * req.PageSize
	items, total, err := s.repo.List(ctx, req.PromptType, offset, req.PageSize)
	if err != nil {
		return ListResponse{}, fmt.Errorf("查询提示词列表失败: %w", err)
	}

	return ListResponse{
		Items:    toSummaryResponses(items),
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetByID 查询提示词详情。
// 参数 ctx 表示请求上下文；参数 id 表示提示词主键 ID。
func (s *Service) GetByID(ctx context.Context, id uint64) (PromptResponse, error) {
	if id == 0 {
		return PromptResponse{}, ErrNotFound
	}
	item, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return PromptResponse{}, fmt.Errorf("查询提示词失败: %w", err)
	}
	return toResponse(*item), nil
}

// Update 更新提示词。
// 参数 ctx 表示请求上下文；参数 id 表示提示词主键 ID；参数 req 表示更新提示词请求参数。
func (s *Service) Update(ctx context.Context, id uint64, req UpdateRequest) (PromptResponse, error) {
	if id == 0 {
		return PromptResponse{}, ErrNotFound
	}
	req = normalizeUpdateRequest(req)
	if err := s.validatePromptPayload(req.Content, req.PromptType); err != nil {
		return PromptResponse{}, err
	}

	item, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return PromptResponse{}, fmt.Errorf("查询提示词失败: %w", err)
	}
	item.PromptType = req.PromptType
	item.Description = req.Description
	item.Content = req.Content
	if err := s.repo.Update(ctx, item); err != nil {
		return PromptResponse{}, fmt.Errorf("更新提示词失败: %w", err)
	}
	return toResponse(*item), nil
}

// Delete 删除提示词。
// 参数 ctx 表示请求上下文；参数 id 表示提示词主键 ID。
func (s *Service) Delete(ctx context.Context, id uint64) (DeleteResponse, error) {
	if id == 0 {
		return DeleteResponse{}, ErrNotFound
	}
	if err := s.repo.Delete(ctx, id); err != nil {
		return DeleteResponse{}, fmt.Errorf("删除提示词失败: %w", err)
	}
	return DeleteResponse{Deleted: true}, nil
}

// validatePromptPayload 校验提示词正文和类型。
// 参数 content 表示提示词正文；参数 promptType 表示提示词类型。
func (s *Service) validatePromptPayload(content string, promptType string) error {
	if strings.TrimSpace(content) == "" {
		return ErrContentRequired
	}
	if strings.TrimSpace(promptType) == "" {
		return ErrTypeRequired
	}
	return s.ensureTypeExists(promptType)
}

// ensureTypeExists 校验提示词类型已存在。
// 参数 name 表示提示词类型名称。
func (s *Service) ensureTypeExists(name string) error {
	snapshot, err := s.types.ReadPromptTypes()
	if err != nil {
		return fmt.Errorf("读取提示词类型失败: %w", err)
	}
	if !containsType(snapshot.Items, name) {
		return ErrTypeNotFound
	}
	return nil
}

// ensureTypeAbsent 校验提示词类型尚不存在。
// 参数 name 表示提示词类型名称。
func (s *Service) ensureTypeAbsent(name string) error {
	snapshot, err := s.types.ReadPromptTypes()
	if err != nil {
		return fmt.Errorf("读取提示词类型失败: %w", err)
	}
	if containsType(snapshot.Items, name) {
		return ErrTypeConflict
	}
	return nil
}

// translateConfigTypeError 将配置模块提示词类型错误转换为业务错误。
// 参数 err 表示配置模块返回的错误。
func translateConfigTypeError(err error) error {
	switch {
	case errors.Is(err, appconfig.ErrPromptTypeNameRequired):
		return ErrTypeNameRequired
	case errors.Is(err, appconfig.ErrPromptTypeConflict):
		return ErrTypeConflict
	case errors.Is(err, appconfig.ErrPromptTypeNotFound):
		return ErrTypeNotFound
	default:
		return err
	}
}

// normalizeCreateRequest 标准化创建提示词请求参数。
// 参数 req 表示创建提示词请求参数。
func normalizeCreateRequest(req CreateRequest) CreateRequest {
	req.Content = strings.TrimSpace(req.Content)
	req.PromptType = normalizeTypeName(req.PromptType)
	req.Description = strings.TrimSpace(req.Description)
	return req
}

// normalizeUpdateRequest 标准化更新提示词请求参数。
// 参数 req 表示更新提示词请求参数。
func normalizeUpdateRequest(req UpdateRequest) UpdateRequest {
	req.Content = strings.TrimSpace(req.Content)
	req.PromptType = normalizeTypeName(req.PromptType)
	req.Description = strings.TrimSpace(req.Description)
	return req
}

// normalizeListRequest 标准化提示词列表查询参数。
// 参数 req 表示提示词列表查询参数。
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
	req.PromptType = normalizeTypeName(req.PromptType)
	return req
}

// normalizeTypeName 标准化提示词类型名称。
// 参数 name 表示提示词类型名称。
func normalizeTypeName(name string) string {
	return strings.TrimSpace(name)
}

// containsType 判断提示词类型列表中是否包含指定名称。
// 参数 items 表示提示词类型列表；参数 name 表示需要查找的类型名称。
func containsType(items []string, name string) bool {
	for _, item := range items {
		if item == name {
			return true
		}
	}
	return false
}

// toResponses 将数据库提示词模型列表转换为完整响应列表。
// 参数 items 表示数据库提示词模型列表。
func toResponses(items []Prompt) []PromptResponse {
	if len(items) == 0 {
		return []PromptResponse{}
	}
	responses := make([]PromptResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, toResponse(item))
	}
	return responses
}

// toResponse 将提示词模型转换为详情响应数据。
// 参数 item 表示提示词数据库模型。
func toResponse(item Prompt) PromptResponse {
	return PromptResponse{
		ID:          item.ID,
		PromptType:  item.PromptType,
		Description: item.Description,
		Content:     item.Content,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}
}

// toSummaryResponse 将提示词模型转换为列表摘要响应数据。
// 参数 item 表示提示词数据库模型。
func toSummaryResponse(item Prompt) PromptSummaryResponse {
	return PromptSummaryResponse{
		ID:          item.ID,
		PromptType:  item.PromptType,
		Description: item.Description,
		CreatedAt:   item.CreatedAt,
		UpdatedAt:   item.UpdatedAt,
	}
}

// toSummaryResponses 将提示词模型列表转换为列表摘要响应数据。
// 参数 items 表示提示词数据库模型列表。
func toSummaryResponses(items []Prompt) []PromptSummaryResponse {
	responses := make([]PromptSummaryResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, toSummaryResponse(item))
	}
	return responses
}
