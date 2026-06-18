package aiprovider

import (
	"context"
	"fmt"
	"strings"
)

const (
	defaultPage        = 1
	defaultPageSize    = 20
	maxPageSize        = 100
	providerTypeOpenAI = "openai"
	providerTypeClaude = "claude"
	providerTypeGemini = "gemini"
	apiTypeResponse    = "response"
	apiTypeCompletions = "completions"
	defaultAPIType     = apiTypeResponse
)

// Repository 表示 AI 提供商数据仓储接口。
type Repository interface {
	// Create 创建 AI 提供商记录。
	// 参数 ctx 表示请求上下文；参数 provider 表示需要创建的 AI 提供商模型。
	Create(ctx context.Context, provider *Provider) error
	// List 查询 AI 提供商分页列表。
	// 参数 ctx 表示请求上下文；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
	List(ctx context.Context, offset int, limit int) ([]Provider, int64, error)
	// GetByID 根据 ID 查询 AI 提供商。
	// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
	GetByID(ctx context.Context, id uint64) (*Provider, error)
	// Update 更新 AI 提供商记录。
	// 参数 ctx 表示请求上下文；参数 provider 表示需要保存的 AI 提供商模型。
	Update(ctx context.Context, provider *Provider) error
	// Delete 根据 ID 删除 AI 提供商记录。
	// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
	Delete(ctx context.Context, id uint64) error
}

// ModelFetcher 表示按 AI 提供商官方协议查询模型列表的依赖。
type ModelFetcher interface {
	// ListModels 查询 AI 提供商官方模型列表。
	// 参数 ctx 表示请求上下文；参数 req 表示模型列表查询请求参数。
	ListModels(ctx context.Context, req ModelListRequest) (ModelListResponse, error)
}

// Service 表示 AI 提供商业务服务。
type Service struct {
	// repo 表示 AI 提供商数据仓储。
	repo Repository
	// cipher 表示 API Key 加解密器。
	cipher *Cipher
	// modelFetcher 表示官方模型列表查询依赖。
	modelFetcher ModelFetcher
}

// NewService 创建 AI 提供商业务服务。
// 参数 repo 表示 AI 提供商数据仓储；参数 cipher 表示 API Key 加解密器；参数 modelFetcher 表示官方模型列表查询依赖。
func NewService(repo Repository, cipher *Cipher, modelFetcher ModelFetcher) *Service {
	return &Service{
		repo:         repo,
		cipher:       cipher,
		modelFetcher: modelFetcher,
	}
}

// Create 创建 AI 提供商。
// 参数 ctx 表示请求上下文；参数 req 表示创建 AI 提供商请求参数。
func (s *Service) Create(ctx context.Context, req CreateRequest) (ProviderResponse, error) {
	req = normalizeCreateRequest(req)
	if err := validateCreateRequest(req); err != nil {
		return ProviderResponse{}, err
	}

	ciphertext, err := s.cipher.Encrypt(req.APIKey)
	if err != nil {
		return ProviderResponse{}, fmt.Errorf("加密 AI 提供商 API Key 失败: %w", err)
	}

	item := &Provider{
		Name:             req.Name,
		ProviderType:     req.ProviderType,
		APIKeyCiphertext: ciphertext,
		APIKeyMask:       maskAPIKey(req.APIKey),
		BaseURL:          req.BaseURL,
		APIType:          apiTypeFromCreateRequest(req),
		Enabled:          enabledFromCreateRequest(req),
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return ProviderResponse{}, fmt.Errorf("创建 AI 提供商失败: %w", err)
	}

	return toResponse(*item), nil
}

// List 查询 AI 提供商分页列表。
// 参数 ctx 表示请求上下文；参数 req 表示 AI 提供商列表查询参数。
func (s *Service) List(ctx context.Context, req ListRequest) (ListResponse, error) {
	req = normalizeListRequest(req)
	offset := (req.Page - 1) * req.PageSize

	items, total, err := s.repo.List(ctx, offset, req.PageSize)
	if err != nil {
		return ListResponse{}, fmt.Errorf("查询 AI 提供商列表失败: %w", err)
	}

	return ListResponse{
		Items:    toResponses(items),
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetByID 根据 ID 查询 AI 提供商。
// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
func (s *Service) GetByID(ctx context.Context, id uint64) (ProviderResponse, error) {
	item, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ProviderResponse{}, fmt.Errorf("查询 AI 提供商失败: %w", err)
	}
	return toResponse(*item), nil
}

// Update 更新 AI 提供商。
// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID；参数 req 表示更新 AI 提供商请求参数。
func (s *Service) Update(ctx context.Context, id uint64, req UpdateRequest) (ProviderResponse, error) {
	req = normalizeUpdateRequest(req)
	if err := validateUpdateRequest(req); err != nil {
		return ProviderResponse{}, err
	}

	item, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ProviderResponse{}, fmt.Errorf("查询 AI 提供商失败: %w", err)
	}

	if err := applyUpdateRequest(s.cipher, item, req); err != nil {
		return ProviderResponse{}, err
	}

	if err := s.repo.Update(ctx, item); err != nil {
		return ProviderResponse{}, fmt.Errorf("更新 AI 提供商失败: %w", err)
	}

	return toResponse(*item), nil
}

// Delete 删除 AI 提供商。
// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
func (s *Service) Delete(ctx context.Context, id uint64) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("删除 AI 提供商失败: %w", err)
	}
	return nil
}

// applyUpdateRequest 将更新请求应用到已有 AI 提供商模型。
// 参数 cipher 表示 API Key 加解密器；参数 item 表示已有 AI 提供商模型；参数 req 表示更新请求参数。
func applyUpdateRequest(cipher *Cipher, item *Provider, req UpdateRequest) error {
	item.Name = req.Name
	item.ProviderType = req.ProviderType
	item.BaseURL = req.BaseURL
	if req.APIType != "" {
		item.APIType = req.APIType
	}
	if req.Enabled != nil {
		item.Enabled = *req.Enabled
	}
	if !isAllowedAPIType(item.APIType) {
		return ErrInvalidAPIType
	}
	if req.APIKey == "" {
		return nil
	}

	ciphertext, err := cipher.Encrypt(req.APIKey)
	if err != nil {
		return fmt.Errorf("加密 AI 提供商 API Key 失败: %w", err)
	}
	item.APIKeyCiphertext = ciphertext
	item.APIKeyMask = maskAPIKey(req.APIKey)
	return nil
}

// ListModels 按 AI 提供商官方协议查询模型列表。
// 参数 ctx 表示请求上下文；参数 req 表示模型列表查询请求参数。
func (s *Service) ListModels(ctx context.Context, req ModelListRequest) (ModelListResponse, error) {
	req = normalizeModelListRequest(req)
	if err := validateModelListRequest(req); err != nil {
		return ModelListResponse{}, err
	}
	if s.modelFetcher == nil {
		return ModelListResponse{}, ErrModelListUnavailable
	}
	return s.modelFetcher.ListModels(ctx, req)
}

// ListModelsByProviderID 使用已保存 AI 提供商配置查询官方模型列表。
// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
func (s *Service) ListModelsByProviderID(ctx context.Context, id uint64) (ModelListResponse, error) {
	item, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return ModelListResponse{}, fmt.Errorf("查询 AI 提供商失败: %w", err)
	}

	apiKey, err := s.cipher.Decrypt(item.APIKeyCiphertext)
	if err != nil {
		return ModelListResponse{}, fmt.Errorf("解密 AI 提供商 API Key 失败: %w", err)
	}

	return s.ListModels(ctx, ModelListRequest{
		ProviderType: item.ProviderType,
		APIKey:       apiKey,
		BaseURL:      item.BaseURL,
	})
}

// apiTypeFromCreateRequest 返回创建请求中的 AI 接口类型默认值。
// 参数 req 表示已经标准化的创建 AI 提供商请求参数。
func apiTypeFromCreateRequest(req CreateRequest) string {
	if req.APIType == "" {
		return defaultAPIType
	}
	return req.APIType
}

// enabledFromCreateRequest 返回创建请求中的启用状态默认值。
// 参数 req 表示已经标准化的创建 AI 提供商请求参数。
func enabledFromCreateRequest(req CreateRequest) bool {
	if req.Enabled == nil {
		return true
	}
	return *req.Enabled
}

// normalizeCreateRequest 标准化创建 AI 提供商请求参数。
// 参数 req 表示创建 AI 提供商请求参数。
func normalizeCreateRequest(req CreateRequest) CreateRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.ProviderType = strings.ToLower(strings.TrimSpace(req.ProviderType))
	req.APIKey = strings.TrimSpace(req.APIKey)
	req.BaseURL = strings.TrimSpace(req.BaseURL)
	req.APIType = strings.ToLower(strings.TrimSpace(req.APIType))
	return req
}

// normalizeUpdateRequest 标准化更新 AI 提供商请求参数。
// 参数 req 表示更新 AI 提供商请求参数。
func normalizeUpdateRequest(req UpdateRequest) UpdateRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.ProviderType = strings.ToLower(strings.TrimSpace(req.ProviderType))
	req.APIKey = strings.TrimSpace(req.APIKey)
	req.BaseURL = strings.TrimSpace(req.BaseURL)
	req.APIType = strings.ToLower(strings.TrimSpace(req.APIType))
	return req
}

// normalizeModelListRequest 标准化模型列表查询请求参数。
// 参数 req 表示模型列表查询请求参数。
func normalizeModelListRequest(req ModelListRequest) ModelListRequest {
	req.ProviderType = strings.ToLower(strings.TrimSpace(req.ProviderType))
	req.APIKey = strings.TrimSpace(req.APIKey)
	req.BaseURL = strings.TrimSpace(req.BaseURL)
	return req
}

// normalizeListRequest 标准化 AI 提供商列表查询参数。
// 参数 req 表示 AI 提供商列表查询参数。
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

// validateCreateRequest 校验创建 AI 提供商请求参数。
// 参数 req 表示已经标准化的创建 AI 提供商请求参数。
func validateCreateRequest(req CreateRequest) error {
	if req.Name == "" {
		return ErrNameRequired
	}
	if req.ProviderType == "" {
		return ErrProviderTypeRequired
	}
	if !isAllowedProviderType(req.ProviderType) {
		return ErrInvalidProviderType
	}
	if req.APIKey == "" {
		return ErrAPIKeyRequired
	}
	if !isAllowedAPIType(apiTypeFromCreateRequest(req)) {
		return ErrInvalidAPIType
	}
	return nil
}

// validateUpdateRequest 校验更新 AI 提供商请求参数。
// 参数 req 表示已经标准化的更新 AI 提供商请求参数。
func validateUpdateRequest(req UpdateRequest) error {
	if req.Name == "" {
		return ErrNameRequired
	}
	if req.ProviderType == "" {
		return ErrProviderTypeRequired
	}
	if !isAllowedProviderType(req.ProviderType) {
		return ErrInvalidProviderType
	}
	if req.APIType != "" && !isAllowedAPIType(req.APIType) {
		return ErrInvalidAPIType
	}
	return nil
}

// validateModelListRequest 校验模型列表查询请求参数。
// 参数 req 表示已经标准化的模型列表查询请求参数。
func validateModelListRequest(req ModelListRequest) error {
	if req.ProviderType == "" {
		return ErrProviderTypeRequired
	}
	if !isAllowedProviderType(req.ProviderType) {
		return ErrInvalidProviderType
	}
	if req.APIKey == "" {
		return ErrAPIKeyRequired
	}
	return nil
}

// isAllowedProviderType 判断 AI 提供商类型是否在系统允许范围内。
// 参数 value 表示需要校验的 AI 提供商类型。
func isAllowedProviderType(value string) bool {
	switch value {
	case providerTypeOpenAI, providerTypeClaude, providerTypeGemini:
		return true
	default:
		return false
	}
}

// isAllowedAPIType 判断 AI 接口类型是否在系统允许范围内。
// 参数 value 表示需要校验的 AI 接口类型。
func isAllowedAPIType(value string) bool {
	switch value {
	case apiTypeResponse, apiTypeCompletions:
		return true
	default:
		return false
	}
}

// maskAPIKey 生成 API Key 掩码。
// 参数 value 表示需要遮蔽的 API Key 明文。
func maskAPIKey(value string) string {
	runes := []rune(strings.TrimSpace(value))
	if len(runes) <= 8 {
		return "****"
	}
	return string(runes[:4]) + "..." + string(runes[len(runes)-4:])
}

// toResponse 将 AI 提供商模型转换为响应数据。
// 参数 item 表示 AI 提供商模型。
func toResponse(item Provider) ProviderResponse {
	return ProviderResponse{
		ID:           item.ID,
		Name:         item.Name,
		ProviderType: item.ProviderType,
		MaskedAPIKey: item.APIKeyMask,
		BaseURL:      item.BaseURL,
		APIType:      item.APIType,
		Enabled:      item.Enabled,
		CreatedAt:    item.CreatedAt,
		UpdatedAt:    item.UpdatedAt,
	}
}

// toResponses 将 AI 提供商模型列表转换为响应数据列表。
// 参数 items 表示 AI 提供商模型列表。
func toResponses(items []Provider) []ProviderResponse {
	responses := make([]ProviderResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, toResponse(item))
	}
	return responses
}
