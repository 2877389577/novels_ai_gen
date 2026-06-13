package router

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"testing"

	authhandler "novels_ai_gen/internal/api/handler/auth"
	novelhandler "novels_ai_gen/internal/api/handler/novel"
	bizauth "novels_ai_gen/internal/biz/auth"
	biznovel "novels_ai_gen/internal/biz/novel"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// fakeNovelRepository 表示路由测试用小说仓储。
type fakeNovelRepository struct {
	// items 表示内存中的小说记录。
	items map[uint64]biznovel.Novel
	// nextID 表示下一条创建记录使用的 ID。
	nextID uint64
}

// loginBody 表示测试中解析登录响应的结构。
type loginBody struct {
	// Code 表示业务响应码。
	Code int `json:"code"`
	// Message 表示响应提示信息。
	Message string `json:"message"`
	// Data 表示登录成功后的令牌数据。
	Data bizauth.LoginResponse `json:"data"`
}

// novelBody 表示测试中解析小说响应的结构。
type novelBody struct {
	// Code 表示业务响应码。
	Code int `json:"code"`
	// Message 表示响应提示信息。
	Message string `json:"message"`
	// Data 表示小说响应数据。
	Data biznovel.NovelResponse `json:"data"`
}

// listBody 表示测试中解析小说列表响应的结构。
type listBody struct {
	// Code 表示业务响应码。
	Code int `json:"code"`
	// Message 表示响应提示信息。
	Message string `json:"message"`
	// Data 表示小说分页列表响应数据。
	Data biznovel.ListResponse `json:"data"`
}

// newFakeNovelRepository 创建路由测试用小说仓储。
func newFakeNovelRepository() *fakeNovelRepository {
	return &fakeNovelRepository{
		items:  make(map[uint64]biznovel.Novel),
		nextID: 1,
	}
}

// Create 创建路由测试用小说记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的小说模型。
func (r *fakeNovelRepository) Create(ctx context.Context, item *biznovel.Novel) error {
	item.ID = r.nextID
	r.nextID++
	r.items[item.ID] = *item
	return nil
}

// List 查询路由测试用小说分页列表。
// 参数 ctx 表示请求上下文；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
func (r *fakeNovelRepository) List(ctx context.Context, offset int, limit int) ([]biznovel.Novel, int64, error) {
	ids := make([]uint64, 0, len(r.items))
	for id := range r.items {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i int, j int) bool {
		return ids[i] > ids[j]
	})

	items := make([]biznovel.Novel, 0, len(ids))
	for _, id := range ids {
		items = append(items, r.items[id])
	}

	if offset >= len(items) {
		return []biznovel.Novel{}, int64(len(items)), nil
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end], int64(len(items)), nil
}

// GetByID 根据 ID 查询路由测试用小说。
// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
func (r *fakeNovelRepository) GetByID(ctx context.Context, id uint64) (*biznovel.Novel, error) {
	item, ok := r.items[id]
	if !ok {
		return nil, biznovel.ErrNotFound
	}
	return &item, nil
}

// Update 更新路由测试用小说记录。
// 参数 ctx 表示请求上下文；参数 item 表示需要保存的小说模型。
func (r *fakeNovelRepository) Update(ctx context.Context, item *biznovel.Novel) error {
	if _, ok := r.items[item.ID]; !ok {
		return biznovel.ErrNotFound
	}
	r.items[item.ID] = *item
	return nil
}

// Delete 真删路由测试用小说记录。
// 参数 ctx 表示请求上下文；参数 id 表示小说主键 ID。
func (r *fakeNovelRepository) Delete(ctx context.Context, id uint64) error {
	if _, ok := r.items[id]; !ok {
		return biznovel.ErrNotFound
	}
	delete(r.items, id)
	return nil
}

// newTestRouter 创建测试用 Gin 路由。
func newTestRouter() http.Handler {
	authService := bizauth.NewService(&appconfig.AppConfig{
		Auth: appconfig.AuthConfig{Password: "admin123"},
	})
	novelService := biznovel.NewService(newFakeNovelRepository())
	return NewRouter(
		authhandler.NewHandler(authService),
		novelhandler.NewHandler(novelService),
		authService,
	)
}

// TestProtectedRoutesRequireToken 验证受保护接口未登录时返回 401。
// 参数 t 表示测试上下文。
func TestProtectedRoutesRequireToken(t *testing.T) {
	router := newTestRouter()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/novels", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("状态码不符合预期: %d", rec.Code)
	}
}

// TestNovelCRUDWithToken 验证登录后可以访问小说创建、列表和删除接口。
// 参数 t 表示测试上下文。
func TestNovelCRUDWithToken(t *testing.T) {
	router := newTestRouter()
	token := loginForTest(t, router)

	created := createNovelForTest(t, router, token)
	list := listNovelsForTest(t, router, token)
	if list.Data.Total != 1 {
		t.Fatalf("小说总数不符合预期: %d", list.Data.Total)
	}

	deleteNovelForTest(t, router, token, created.Data.ID)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/novels/"+strconvID(created.Data.ID), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("删除后查询状态码不符合预期: %d", rec.Code)
	}
}

// loginForTest 执行测试登录并返回访问令牌。
// 参数 t 表示测试上下文；参数 router 表示测试用 HTTP 路由。
func loginForTest(t *testing.T, router http.Handler) string {
	t.Helper()

	body := []byte(`{"password":"admin123"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("登录状态码不符合预期: %d", rec.Code)
	}

	var resp loginBody
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("解析登录响应失败: %v", err)
	}
	if resp.Data.Token == "" {
		t.Fatal("登录响应应该包含访问令牌")
	}
	return resp.Data.Token
}

// createNovelForTest 执行测试创建小说请求。
// 参数 t 表示测试上下文；参数 router 表示测试用 HTTP 路由；参数 token 表示访问令牌。
func createNovelForTest(t *testing.T, router http.Handler, token string) novelBody {
	t.Helper()

	body := []byte(`{"name":"测试小说","author_name":"作者","tags":"玄幻,冒险"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/novels", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("创建小说状态码不符合预期: %d", rec.Code)
	}

	var resp novelBody
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("解析创建小说响应失败: %v", err)
	}
	if resp.Data.ID == 0 {
		t.Fatal("创建小说响应应该包含 ID")
	}
	return resp
}

// listNovelsForTest 执行测试查询小说列表请求。
// 参数 t 表示测试上下文；参数 router 表示测试用 HTTP 路由；参数 token 表示访问令牌。
func listNovelsForTest(t *testing.T, router http.Handler, token string) listBody {
	t.Helper()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/novels?page=1&page_size=20", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("查询小说列表状态码不符合预期: %d", rec.Code)
	}

	var resp listBody
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("解析小说列表响应失败: %v", err)
	}
	return resp
}

// deleteNovelForTest 执行测试删除小说请求。
// 参数 t 表示测试上下文；参数 router 表示测试用 HTTP 路由；参数 token 表示访问令牌；参数 id 表示小说主键 ID。
func deleteNovelForTest(t *testing.T, router http.Handler, token string, id uint64) {
	t.Helper()

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/novels/"+strconvID(id), nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("删除小说状态码不符合预期: %d", rec.Code)
	}
}

// strconvID 将小说 ID 转换为路径字符串。
// 参数 id 表示小说主键 ID。
func strconvID(id uint64) string {
	return strconv.FormatUint(id, 10)
}
