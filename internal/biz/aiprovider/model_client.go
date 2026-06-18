package aiprovider

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultModelListTimeout = 15 * time.Second
	defaultOpenAIBaseURL    = "https://api.openai.com/v1"
	defaultClaudeBaseURL    = "https://api.anthropic.com/v1"
	defaultGeminiBaseURL    = "https://generativelanguage.googleapis.com/v1beta"
	anthropicVersion        = "2023-06-01"
	maxModelListBodyBytes   = 4 << 20
)

// ModelClient 表示基于标准库 HTTP 客户端的官方模型列表查询器。
type ModelClient struct {
	// client 表示执行外部 HTTP 请求的客户端。
	client *http.Client
}

// NewModelClient 创建官方模型列表查询器。
func NewModelClient() *ModelClient {
	return &ModelClient{
		client: &http.Client{Timeout: defaultModelListTimeout},
	}
}

// ListModels 查询 AI 提供商官方模型列表。
// 参数 ctx 表示请求上下文；参数 req 表示模型列表查询请求参数。
func (c *ModelClient) ListModels(ctx context.Context, req ModelListRequest) (ModelListResponse, error) {
	switch req.ProviderType {
	case providerTypeOpenAI:
		return c.listOpenAIModels(ctx, req)
	case providerTypeClaude:
		return c.listClaudeModels(ctx, req)
	case providerTypeGemini:
		return c.listGeminiModels(ctx, req)
	default:
		return ModelListResponse{}, ErrInvalidProviderType
	}
}

// listOpenAIModels 按 OpenAI 官方协议查询模型列表。
// 参数 ctx 表示请求上下文；参数 req 表示模型列表查询请求参数。
func (c *ModelClient) listOpenAIModels(ctx context.Context, req ModelListRequest) (ModelListResponse, error) {
	endpoint, err := modelEndpointURL(req.BaseURL, defaultOpenAIBaseURL, "models")
	if err != nil {
		return ModelListResponse{}, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ModelListResponse{}, fmt.Errorf("%w: 创建 OpenAI 模型列表请求失败", ErrModelListUnavailable)
	}
	httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)

	var payload openAIModelListResponse
	if err := c.doJSON(httpReq, &payload); err != nil {
		return ModelListResponse{}, err
	}

	items := make([]ModelInfo, 0, len(payload.Data))
	for _, model := range payload.Data {
		id := strings.TrimSpace(model.ID)
		if id == "" {
			continue
		}
		items = append(items, ModelInfo{
			ID:          id,
			DisplayName: id,
			OwnedBy:     model.OwnedBy,
			CreatedAt:   unixSecondsToTime(model.Created),
		})
	}
	return ModelListResponse{Items: items}, nil
}

// listClaudeModels 按 Anthropic Claude 官方协议查询模型列表。
// 参数 ctx 表示请求上下文；参数 req 表示模型列表查询请求参数。
func (c *ModelClient) listClaudeModels(ctx context.Context, req ModelListRequest) (ModelListResponse, error) {
	endpoint, err := modelEndpointURL(req.BaseURL, defaultClaudeBaseURL, "models")
	if err != nil {
		return ModelListResponse{}, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ModelListResponse{}, fmt.Errorf("%w: 创建 Claude 模型列表请求失败", ErrModelListUnavailable)
	}
	httpReq.Header.Set("x-api-key", req.APIKey)
	httpReq.Header.Set("anthropic-version", anthropicVersion)

	var payload claudeModelListResponse
	if err := c.doJSON(httpReq, &payload); err != nil {
		return ModelListResponse{}, err
	}

	items := make([]ModelInfo, 0, len(payload.Data))
	for _, model := range payload.Data {
		id := strings.TrimSpace(model.ID)
		if id == "" {
			continue
		}
		displayName := strings.TrimSpace(model.DisplayName)
		if displayName == "" {
			displayName = id
		}
		items = append(items, ModelInfo{
			ID:          id,
			DisplayName: displayName,
			CreatedAt:   model.CreatedAt,
		})
	}
	return ModelListResponse{Items: items}, nil
}

// listGeminiModels 按 Google Gemini 官方协议查询模型列表。
// 参数 ctx 表示请求上下文；参数 req 表示模型列表查询请求参数。
func (c *ModelClient) listGeminiModels(ctx context.Context, req ModelListRequest) (ModelListResponse, error) {
	endpoint, err := modelEndpointURL(req.BaseURL, defaultGeminiBaseURL, "models")
	if err != nil {
		return ModelListResponse{}, err
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return ModelListResponse{}, ErrInvalidBaseURL
	}
	query := parsed.Query()
	query.Set("key", req.APIKey)
	parsed.RawQuery = query.Encode()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return ModelListResponse{}, fmt.Errorf("%w: 创建 Gemini 模型列表请求失败", ErrModelListUnavailable)
	}

	var payload geminiModelListResponse
	if err := c.doJSON(httpReq, &payload); err != nil {
		return ModelListResponse{}, err
	}

	items := make([]ModelInfo, 0, len(payload.Models))
	for _, model := range payload.Models {
		id := strings.TrimPrefix(strings.TrimSpace(model.Name), "models/")
		if id == "" {
			continue
		}
		displayName := strings.TrimSpace(model.DisplayName)
		if displayName == "" {
			displayName = id
		}
		items = append(items, ModelInfo{
			ID:                         id,
			DisplayName:                displayName,
			SupportedGenerationMethods: model.SupportedGenerationMethods,
		})
	}
	return ModelListResponse{Items: items}, nil
}

// doJSON 执行 HTTP 请求并解析 JSON 响应。
// 参数 req 表示已经构造好的 HTTP 请求；参数 target 表示 JSON 解析目标。
func (c *ModelClient) doJSON(req *http.Request, target any) error {
	client := c.client
	if client == nil {
		client = http.DefaultClient
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: 请求官方模型列表接口失败", ErrModelListUnavailable)
	}
	defer resp.Body.Close()

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, maxModelListBodyBytes))
		return fmt.Errorf("%w: 官方模型列表接口返回状态 %d", ErrModelListUnavailable, resp.StatusCode)
	}

	decoder := json.NewDecoder(io.LimitReader(resp.Body, maxModelListBodyBytes))
	if err := decoder.Decode(target); err != nil {
		return fmt.Errorf("%w: 解析官方模型列表响应失败", ErrModelListInvalid)
	}
	return nil
}

// modelEndpointURL 拼接模型列表接口地址。
// 参数 baseURL 表示用户填写的基础地址；参数 defaultBaseURL 表示协议默认基础地址；参数 pathElem 表示模型列表路径片段。
func modelEndpointURL(baseURL string, defaultBaseURL string, pathElem string) (string, error) {
	base := strings.TrimSpace(baseURL)
	if base == "" {
		base = defaultBaseURL
	}

	parsed, err := url.Parse(base)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", ErrInvalidBaseURL
	}
	joined, err := url.JoinPath(strings.TrimRight(parsed.String(), "/"), pathElem)
	if err != nil {
		return "", ErrInvalidBaseURL
	}
	return joined, nil
}

// unixSecondsToTime 将 Unix 秒时间戳转换为 RFC3339 文本。
// 参数 value 表示官方返回的 Unix 秒时间戳。
func unixSecondsToTime(value int64) string {
	if value <= 0 {
		return ""
	}
	return time.Unix(value, 0).UTC().Format(time.RFC3339)
}

// openAIModelListResponse 表示 OpenAI 模型列表响应。
type openAIModelListResponse struct {
	// Data 表示 OpenAI 返回的模型数组。
	Data []openAIModel `json:"data"`
}

// openAIModel 表示 OpenAI 模型列表中的单个模型。
type openAIModel struct {
	// ID 表示模型标识。
	ID string `json:"id"`
	// Created 表示模型创建 Unix 秒时间戳。
	Created int64 `json:"created"`
	// OwnedBy 表示模型归属方。
	OwnedBy string `json:"owned_by"`
}

// claudeModelListResponse 表示 Claude 模型列表响应。
type claudeModelListResponse struct {
	// Data 表示 Claude 返回的模型数组。
	Data []claudeModel `json:"data"`
}

// claudeModel 表示 Claude 模型列表中的单个模型。
type claudeModel struct {
	// ID 表示模型标识。
	ID string `json:"id"`
	// DisplayName 表示模型展示名称。
	DisplayName string `json:"display_name"`
	// CreatedAt 表示模型创建时间。
	CreatedAt string `json:"created_at"`
}

// geminiModelListResponse 表示 Gemini 模型列表响应。
type geminiModelListResponse struct {
	// Models 表示 Gemini 返回的模型数组。
	Models []geminiModel `json:"models"`
}

// geminiModel 表示 Gemini 模型列表中的单个模型。
type geminiModel struct {
	// Name 表示模型资源名称，通常以 models/ 开头。
	Name string `json:"name"`
	// DisplayName 表示模型展示名称。
	DisplayName string `json:"displayName"`
	// SupportedGenerationMethods 表示模型支持的生成能力。
	SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
}
