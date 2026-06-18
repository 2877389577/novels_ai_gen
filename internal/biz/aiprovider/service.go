package aiprovider

import (
	"context"
	"fmt"
	"strings"
)

const (
	defaultPage          = 1
	defaultPageSize      = 20
	maxPageSize          = 100
	providerTypeOpenAI   = "openai"
	providerTypeClaude   = "claude"
	providerTypeGemini   = "gemini"
	apiTypeResponse      = "response"
	apiTypeCompletions   = "completions"
	defaultAPIType       = apiTypeResponse
	defaultMaxTokens     = 1024
	defaultTemperature   = 0.5
	defaultTopP          = 0.5
	defaultThinkingLevel = 0
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

// Service 表示 AI 提供商业务服务。
type Service struct {
	// repo 表示 AI 提供商数据仓储。
	repo Repository
	// cipher 表示 API Key 加解密器。
	cipher *Cipher
}

// NewService 创建 AI 提供商业务服务。
// 参数 repo 表示 AI 提供商数据仓储；参数 cipher 表示 API Key 加解密器。
func NewService(repo Repository, cipher *Cipher) *Service {
	return &Service{
		repo:   repo,
		cipher: cipher,
	}
}

// Create 创建 AI 提供商。
// 参数 ctx 表示请求上下文；参数 req 表示创建 AI 提供商请求参数。
func (s *Service) Create(ctx context.Context, req CreateRequest) (ProviderResponse, error) {
	req = normalizeCreateRequest(req)
	if err := validateCreateRequest(req); err != nil {
		return ProviderResponse{}, err
	}

	values, err := createValuesFromRequest(req)
	if err != nil {
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
		Model:            req.Model,
		BaseURL:          req.BaseURL,
		APIType:          values.apiType,
		MaxTokens:        values.maxTokens,
		Temperature:      values.temperature,
		TopP:             values.topP,
		ThinkingLevel:    values.thinkingLevel,
		Enabled:          values.enabled,
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

// requestValues 表示从请求参数中解析出的 AI 提供商配置值。
type requestValues struct {
	// apiType 表示 AI 接口类型。
	apiType string
	// maxTokens 表示最大输出 token 数。
	maxTokens int
	// temperature 表示采样温度。
	temperature float64
	// topP 表示 nucleus sampling 参数。
	topP float64
	// thinkingLevel 表示思考等级。
	thinkingLevel int
	// enabled 表示是否启用该 AI 提供商。
	enabled bool
}

// createValuesFromRequest 从创建请求中解析默认值和显式传入值。
// 参数 req 表示已经标准化的创建 AI 提供商请求参数。
func createValuesFromRequest(req CreateRequest) (requestValues, error) {
	values := requestValues{
		apiType:       defaultAPIType,
		maxTokens:     defaultMaxTokens,
		temperature:   defaultTemperature,
		topP:          defaultTopP,
		thinkingLevel: defaultThinkingLevel,
		enabled:       true,
	}
	if req.APIType != "" {
		values.apiType = req.APIType
	}
	if req.MaxTokens != nil {
		values.maxTokens = *req.MaxTokens
	}
	if req.Temperature != nil {
		values.temperature = *req.Temperature
	}
	if req.TopP != nil {
		values.topP = *req.TopP
	}
	if req.ThinkingLevel != nil {
		values.thinkingLevel = *req.ThinkingLevel
	}
	if req.Enabled != nil {
		values.enabled = *req.Enabled
	}
	if err := validateValues(values); err != nil {
		return requestValues{}, err
	}
	return values, nil
}

// applyUpdateRequest 将更新请求应用到已有 AI 提供商模型。
// 参数 cipher 表示 API Key 加解密器；参数 item 表示已有 AI 提供商模型；参数 req 表示更新请求参数。
func applyUpdateRequest(cipher *Cipher, item *Provider, req UpdateRequest) error {
	item.Name = req.Name
	item.ProviderType = req.ProviderType
	item.Model = req.Model
	item.BaseURL = req.BaseURL
	if req.APIType != "" {
		item.APIType = req.APIType
	}
	if req.MaxTokens != nil {
		item.MaxTokens = *req.MaxTokens
	}
	if req.Temperature != nil {
		item.Temperature = *req.Temperature
	}
	if req.TopP != nil {
		item.TopP = *req.TopP
	}
	if req.ThinkingLevel != nil {
		item.ThinkingLevel = *req.ThinkingLevel
	}
	if req.Enabled != nil {
		item.Enabled = *req.Enabled
	}
	if err := validateProviderValues(*item); err != nil {
		return err
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

// normalizeCreateRequest 标准化创建 AI 提供商请求参数。
// 参数 req 表示创建 AI 提供商请求参数。
func normalizeCreateRequest(req CreateRequest) CreateRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.ProviderType = strings.ToLower(strings.TrimSpace(req.ProviderType))
	req.APIKey = strings.TrimSpace(req.APIKey)
	req.Model = strings.TrimSpace(req.Model)
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
	req.Model = strings.TrimSpace(req.Model)
	req.BaseURL = strings.TrimSpace(req.BaseURL)
	req.APIType = strings.ToLower(strings.TrimSpace(req.APIType))
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
	if req.Model == "" {
		return ErrModelRequired
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
	if req.Model == "" {
		return ErrModelRequired
	}
	return nil
}

// validateValues 校验请求解析出的 AI 提供商配置值。
// 参数 values 表示需要校验的 AI 提供商配置值。
func validateValues(values requestValues) error {
	if !isAllowedAPIType(values.apiType) {
		return ErrInvalidAPIType
	}
	if values.maxTokens <= 0 {
		return ErrInvalidMaxTokens
	}
	if values.temperature < 0 {
		return ErrInvalidTemperature
	}
	if values.topP < 0 || values.topP > 1 {
		return ErrInvalidTopP
	}
	if values.thinkingLevel < 0 {
		return ErrInvalidThinkingLevel
	}
	return nil
}

// validateProviderValues 校验 AI 提供商模型中的配置值。
// 参数 provider 表示需要校验的 AI 提供商模型。
func validateProviderValues(provider Provider) error {
	return validateValues(requestValues{
		apiType:       provider.APIType,
		maxTokens:     provider.MaxTokens,
		temperature:   provider.Temperature,
		topP:          provider.TopP,
		thinkingLevel: provider.ThinkingLevel,
		enabled:       provider.Enabled,
	})
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
		ID:            item.ID,
		Name:          item.Name,
		ProviderType:  item.ProviderType,
		MaskedAPIKey:  item.APIKeyMask,
		Model:         item.Model,
		BaseURL:       item.BaseURL,
		APIType:       item.APIType,
		MaxTokens:     item.MaxTokens,
		Temperature:   item.Temperature,
		TopP:          item.TopP,
		ThinkingLevel: item.ThinkingLevel,
		Enabled:       item.Enabled,
		CreatedAt:     item.CreatedAt,
		UpdatedAt:     item.UpdatedAt,
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
