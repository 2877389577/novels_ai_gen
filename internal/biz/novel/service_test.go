package novel

import (
	"context"
	"errors"
	"sort"
	"testing"
)

// fakeRepository 表示测试用小说仓储。
type fakeRepository struct {
	// items 表示内存中的小说记录。
	items map[uint64]Novel
	// nextID 表示下一条创建记录使用的 ID。
	nextID uint64
	// lastOffset 表示最近一次列表查询的偏移量。
	lastOffset int
	// lastLimit 表示最近一次列表查询的数量。
	lastLimit int
}

// newFakeRepository 创建测试用小说仓储。
func newFakeRepository() *fakeRepository {
	return &fakeRepository{
		items:  make(map[uint64]Novel),
		nextID: 1,
	}
}

// Create 创建测试用小说记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的小说模型。
func (r *fakeRepository) Create(ctx context.Context, item *Novel) error {
	item.ID = r.nextID
	r.nextID++
	r.items[item.ID] = *item
	return nil
}

// List 查询测试用小说分页列表。
// 参数 ctx 表示请求上下文；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
func (r *fakeRepository) List(ctx context.Context, offset int, limit int) ([]Novel, int64, error) {
	r.lastOffset = offset
	r.lastLimit = limit

	ids := make([]uint64, 0, len(r.items))
	for id := range r.items {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i int, j int) bool {
		return ids[i] > ids[j]
	})

	items := make([]Novel, 0, len(ids))
	for _, id := range ids {
		items = append(items, r.items[id])
	}

	if offset >= len(items) {
		return []Novel{}, int64(len(items)), nil
	}

	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end], int64(len(items)), nil
}

// GetByID 根据 ID 查询测试用小说。
// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
func (r *fakeRepository) GetByID(ctx context.Context, id uint64) (*Novel, error) {
	item, ok := r.items[id]
	if !ok {
		return nil, ErrNotFound
	}
	return &item, nil
}

// Update 更新测试用小说记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要保存的小说模型。
func (r *fakeRepository) Update(ctx context.Context, item *Novel) error {
	if _, ok := r.items[item.ID]; !ok {
		return ErrNotFound
	}
	r.items[item.ID] = *item
	return nil
}

// Delete 删除测试用小说记录。
// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
func (r *fakeRepository) Delete(ctx context.Context, id uint64) error {
	if _, ok := r.items[id]; !ok {
		return ErrNotFound
	}
	delete(r.items, id)
	return nil
}

// TestCreateRequiresName 验证创建小说时小说名不能为空。
// 参数 t 表示测试上下文。
func TestCreateRequiresName(t *testing.T) {
	service := NewService(newFakeRepository())

	_, err := service.Create(context.Background(), CreateRequest{Name: " "})
	if !errors.Is(err, ErrNameRequired) {
		t.Fatalf("错误类型不符合预期: %v", err)
	}
}

// TestCreateAndUpdateNovel 验证创建和更新小说成功。
// 参数 t 表示测试上下文。
func TestCreateAndUpdateNovel(t *testing.T) {
	repo := newFakeRepository()
	service := NewService(repo)

	created, err := service.Create(context.Background(), CreateRequest{Name: "旧标题", AuthorName: "作者"})
	if err != nil {
		t.Fatalf("创建小说失败: %v", err)
	}

	updated, err := service.Update(context.Background(), created.ID, UpdateRequest{Name: "新标题", Tags: "玄幻,冒险"})
	if err != nil {
		t.Fatalf("更新小说失败: %v", err)
	}
	if updated.Name != "新标题" || updated.Tags != "玄幻,冒险" {
		t.Fatalf("更新结果不符合预期: %+v", updated)
	}
}

// TestDeleteReturnsNotFound 验证删除不存在小说时返回 ErrNotFound。
// 参数 t 表示测试上下文。
func TestDeleteReturnsNotFound(t *testing.T) {
	service := NewService(newFakeRepository())

	err := service.Delete(context.Background(), 100)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("错误类型不符合预期: %v", err)
	}
}

// TestListUsesDefaultAndMaxPageSize 验证列表分页默认值和最大值。
// 参数 t 表示测试上下文。
func TestListUsesDefaultAndMaxPageSize(t *testing.T) {
	repo := newFakeRepository()
	service := NewService(repo)

	for i := 0; i < 3; i++ {
		if _, err := service.Create(context.Background(), CreateRequest{Name: "小说"}); err != nil {
			t.Fatalf("创建小说失败: %v", err)
		}
	}

	resp, err := service.List(context.Background(), ListRequest{Page: 0, PageSize: 200})
	if err != nil {
		t.Fatalf("查询小说列表失败: %v", err)
	}
	if resp.Page != defaultPage || resp.PageSize != maxPageSize {
		t.Fatalf("分页参数不符合预期: %+v", resp)
	}
	if resp.Total != 3 {
		t.Fatalf("总数不符合预期: %d", resp.Total)
	}
	if repo.lastOffset != 0 || repo.lastLimit != maxPageSize {
		t.Fatalf("仓储分页参数不符合预期: offset=%d limit=%d", repo.lastOffset, repo.lastLimit)
	}
}
