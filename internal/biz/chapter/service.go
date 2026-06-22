package chapter

import (
	"context"
	"fmt"
	"strings"
	"unicode"
)

const (
	defaultPage     = 1
	defaultPageSize = 20
	maxPageSize     = 100
)

// Repository 表示章节数据仓储接口。
type Repository interface {
	// Create 创建章节记录。
	// 参数 ctx 表示请求上下文；参数 item 表示需要创建的章节模型。
	Create(ctx context.Context, item *Chapter) error
	// NextChapterNumber 查询指定小说下一章建议使用的章节号。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
	NextChapterNumber(ctx context.Context, novelID uint64) (int, error)
	// WordCount 查询指定小说所有章节累计后的总字数。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
	WordCount(ctx context.Context, novelID uint64) (int64, error)
	// ListByNovelID 查询指定小说下的章节分页列表。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
	ListByNovelID(ctx context.Context, novelID uint64, offset int, limit int) ([]Chapter, int64, error)
	// GetByID 根据小说 ID 和章节 ID 查询章节。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 chapterID 表示章节主键 ID。
	GetByID(ctx context.Context, novelID uint64, chapterID uint64) (*Chapter, error)
	// QueryChapters 根据条件查询章节数据。
	// 参数 ctx 表示请求上下文；参数 condition 表示章节查询条件。
	QueryChapters(ctx context.Context, condition QueryChaptersCondition) ([]Chapter, error)
	// UpdateChapterSummary 只更新章节总结字段并返回更新后的章节。
	// 参数 ctx 表示请求上下文；参数 condition 表示章节总结更新条件。
	UpdateChapterSummary(ctx context.Context, condition UpdateChapterSummaryCondition) (*Chapter, error)
	// Update 更新章节记录。
	// 参数 ctx 表示请求上下文；参数 item 表示需要保存的章节模型。
	Update(ctx context.Context, item *Chapter) error
	// Delete 根据小说 ID 和章节 ID 删除章节。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 chapterID 表示章节主键 ID。
	Delete(ctx context.Context, novelID uint64, chapterID uint64) error
}

// Service 表示章节业务服务。
type Service struct {
	// repo 表示章节数据仓储。
	repo Repository
}

// NewService 创建章节业务服务。
// 参数 repo 表示章节数据仓储。
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create 创建章节。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示创建章节请求参数。
func (s *Service) Create(ctx context.Context, novelID uint64, req CreateRequest) (ChapterResponse, error) {
	if novelID == 0 {
		return ChapterResponse{}, ErrNovelNotFound
	}

	req = normalizeCreateRequest(req)
	if req.ChapterNumber <= 0 {
		return ChapterResponse{}, ErrChapterNumberRequired
	}
	if req.Title == "" {
		return ChapterResponse{}, ErrTitleRequired
	}

	item := &Chapter{
		NovelID:       novelID,
		ChapterNumber: req.ChapterNumber,
		Title:         req.Title,
		Content:       req.Content,
		WordCount:     countNonWhitespaceRunes(req.Content),
	}
	if err := s.repo.Create(ctx, item); err != nil {
		return ChapterResponse{}, fmt.Errorf("创建章节失败: %w", err)
	}

	return toResponse(*item), nil
}

// NextChapterNumber 查询指定小说下一章建议使用的章节号。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
func (s *Service) NextChapterNumber(ctx context.Context, novelID uint64) (NextChapterNumberResponse, error) {
	if novelID == 0 {
		return NextChapterNumberResponse{}, ErrNovelNotFound
	}

	nextNumber, err := s.repo.NextChapterNumber(ctx, novelID)
	if err != nil {
		return NextChapterNumberResponse{}, fmt.Errorf("查询下一章节号失败: %w", err)
	}

	return NextChapterNumberResponse{
		NovelID:           novelID,
		NextChapterNumber: nextNumber,
	}, nil
}

// WordCount 查询指定小说所有章节累计后的总字数。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
func (s *Service) WordCount(ctx context.Context, novelID uint64) (WordCountResponse, error) {
	if novelID == 0 {
		return WordCountResponse{}, ErrNovelNotFound
	}

	totalWordCount, err := s.repo.WordCount(ctx, novelID)
	if err != nil {
		return WordCountResponse{}, fmt.Errorf("查询小说总字数失败: %w", err)
	}

	return WordCountResponse{
		NovelID:   novelID,
		WordCount: totalWordCount,
	}, nil
}

// List 查询指定小说下的章节分页列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示章节列表查询参数。
func (s *Service) List(ctx context.Context, novelID uint64, req ListRequest) (ListResponse, error) {
	if novelID == 0 {
		return ListResponse{}, ErrNovelNotFound
	}

	req = normalizeListRequest(req)
	offset := (req.Page - 1) * req.PageSize

	items, total, err := s.repo.ListByNovelID(ctx, novelID, offset, req.PageSize)
	if err != nil {
		return ListResponse{}, fmt.Errorf("查询章节列表失败: %w", err)
	}

	return ListResponse{
		Items:    toSummaryResponses(items),
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
	}, nil
}

// GetByID 查询章节详情。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 chapterID 表示章节主键 ID。
func (s *Service) GetByID(ctx context.Context, novelID uint64, chapterID uint64) (ChapterResponse, error) {
	if novelID == 0 {
		return ChapterResponse{}, ErrNovelNotFound
	}
	if chapterID == 0 {
		return ChapterResponse{}, ErrNotFound
	}

	item, err := s.repo.GetByID(ctx, novelID, chapterID)
	if err != nil {
		return ChapterResponse{}, fmt.Errorf("查询章节失败: %w", err)
	}
	return toResponse(*item), nil
}

// Update 更新章节。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 chapterID 表示章节主键 ID；参数 req 表示更新章节请求参数。
func (s *Service) Update(ctx context.Context, novelID uint64, chapterID uint64, req UpdateRequest) (ChapterResponse, error) {
	if novelID == 0 {
		return ChapterResponse{}, ErrNovelNotFound
	}
	if chapterID == 0 {
		return ChapterResponse{}, ErrNotFound
	}

	req = normalizeUpdateRequest(req)
	if req.Title == "" {
		return ChapterResponse{}, ErrTitleRequired
	}

	item, err := s.repo.GetByID(ctx, novelID, chapterID)
	if err != nil {
		return ChapterResponse{}, fmt.Errorf("查询章节失败: %w", err)
	}

	item.Title = req.Title
	item.Content = req.Content
	item.WordCount = countNonWhitespaceRunes(req.Content)

	if err := s.repo.Update(ctx, item); err != nil {
		return ChapterResponse{}, fmt.Errorf("更新章节失败: %w", err)
	}

	return toResponse(*item), nil
}

// Delete 删除章节。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 chapterID 表示章节主键 ID。
func (s *Service) Delete(ctx context.Context, novelID uint64, chapterID uint64) error {
	if novelID == 0 {
		return ErrNovelNotFound
	}
	if chapterID == 0 {
		return ErrNotFound
	}

	if err := s.repo.Delete(ctx, novelID, chapterID); err != nil {
		return fmt.Errorf("删除章节失败: %w", err)
	}
	return nil
}

// normalizeCreateRequest 标准化创建章节请求参数。
// 参数 req 表示创建章节请求参数。
func normalizeCreateRequest(req CreateRequest) CreateRequest {
	req.Title = strings.TrimSpace(req.Title)
	return req
}

// normalizeUpdateRequest 标准化更新章节请求参数。
// 参数 req 表示更新章节请求参数。
func normalizeUpdateRequest(req UpdateRequest) UpdateRequest {
	req.Title = strings.TrimSpace(req.Title)
	return req
}

// normalizeListRequest 标准化章节列表查询参数。
// 参数 req 表示章节列表查询参数。
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

// countNonWhitespaceRunes 统计正文中非空白 Unicode 字符数量。
// 参数 content 表示需要统计的章节正文。
func countNonWhitespaceRunes(content string) int {
	count := 0
	for _, r := range content {
		if !unicode.IsSpace(r) {
			count++
		}
	}
	return count
}

// toResponse 将章节模型转换为详情响应数据。
// 参数 item 表示章节数据库模型。
func toResponse(item Chapter) ChapterResponse {
	return ChapterResponse{
		ID:            item.ID,
		NovelID:       item.NovelID,
		ChapterNumber: item.ChapterNumber,
		Title:         item.Title,
		Content:       item.Content,
		Summary:       item.Summary,
		WordCount:     item.WordCount,
		CreatedAt:     item.CreatedAt,
		UpdatedAt:     item.UpdatedAt,
	}
}

// toSummaryResponse 将章节模型转换为列表摘要响应数据。
// 参数 item 表示章节数据库模型。
func toSummaryResponse(item Chapter) ChapterSummaryResponse {
	return ChapterSummaryResponse{
		ID:            item.ID,
		NovelID:       item.NovelID,
		ChapterNumber: item.ChapterNumber,
		Title:         item.Title,
		WordCount:     item.WordCount,
		CreatedAt:     item.CreatedAt,
		UpdatedAt:     item.UpdatedAt,
	}
}

// toSummaryResponses 将章节模型列表转换为列表摘要响应数据列表。
// 参数 items 表示章节数据库模型列表。
func toSummaryResponses(items []Chapter) []ChapterSummaryResponse {
	responses := make([]ChapterSummaryResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, toSummaryResponse(item))
	}
	return responses
}
