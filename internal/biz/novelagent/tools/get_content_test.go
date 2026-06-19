package tools

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	bizchapter "novels_ai_gen/internal/biz/chapter"
)

// fakeChapterReader 表示 get_content 单测使用的章节读取替身。
type fakeChapterReader struct {
	// chapter 表示读取成功时返回的章节。
	chapter *bizchapter.Chapter
	// err 表示读取章节时返回的错误。
	err error
	// gotNovelID 表示实际收到的小说 ID。
	gotNovelID uint64
	// gotChapterID 表示实际收到的章节 ID。
	gotChapterID uint64
}

// GetByID 根据小说 ID 和章节 ID 查询测试章节。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 chapterID 表示章节主键 ID。
func (r *fakeChapterReader) GetByID(ctx context.Context, novelID uint64, chapterID uint64) (*bizchapter.Chapter, error) {
	r.gotNovelID = novelID
	r.gotChapterID = chapterID
	return r.chapter, r.err
}

// TestGetContentToolReadsChapter 验证 get_content 工具能读取当前请求关联章节正文。
// 参数 t 表示测试上下文。
func TestGetContentToolReadsChapter(t *testing.T) {
	updatedAt := time.Date(2026, 6, 19, 10, 30, 0, 0, time.UTC)
	reader := &fakeChapterReader{
		chapter: &bizchapter.Chapter{
			Title:     "雨夜",
			Content:   "门外的脚步声渐近。",
			WordCount: 9,
			UpdatedAt: updatedAt,
		},
	}
	getContentTool, err := NewGetContentTool(reader, 11, 22)
	if err != nil {
		t.Fatalf("NewGetContentTool failed: %v", err)
	}

	rawOutput, err := getContentTool.InvokableRun(context.Background(), "{}")
	if err != nil {
		t.Fatalf("InvokableRun failed: %v", err)
	}

	var output GetContentOutput
	if err := json.Unmarshal([]byte(rawOutput), &output); err != nil {
		t.Fatalf("unmarshal output failed: %v", err)
	}
	if reader.gotNovelID != 11 || reader.gotChapterID != 22 {
		t.Fatalf("reader got novel/chapter = %d/%d, want 11/22", reader.gotNovelID, reader.gotChapterID)
	}
	if output.Title != "雨夜" || output.Content != "门外的脚步声渐近。" || output.WordCount != 9 || !output.UpdatedAt.Equal(updatedAt) {
		t.Fatalf("output = %+v, want chapter content", output)
	}
}

// TestGetContentToolRejectsMissingContext 验证缺少章节上下文时 get_content 返回明确错误。
// 参数 t 表示测试上下文。
func TestGetContentToolRejectsMissingContext(t *testing.T) {
	getContentTool, err := NewGetContentTool(&fakeChapterReader{}, 0, 22)
	if err != nil {
		t.Fatalf("NewGetContentTool failed: %v", err)
	}

	_, err = getContentTool.InvokableRun(context.Background(), "{}")
	if !errors.Is(err, ErrChapterContextRequired) {
		t.Fatalf("InvokableRun error = %v, want %v", err, ErrChapterContextRequired)
	}
}

// TestGetContentToolReturnsReaderErrors 验证章节不存在和仓储错误会原样进入错误链。
// 参数 t 表示测试上下文。
func TestGetContentToolReturnsReaderErrors(t *testing.T) {
	repositoryErr := errors.New("repository unavailable")
	tests := []struct {
		// name 表示测试场景名称。
		name string
		// readerErr 表示章节读取器返回的错误。
		readerErr error
		// wantErr 表示期望匹配的错误。
		wantErr error
	}{
		{name: "chapter not found", readerErr: bizchapter.ErrNotFound, wantErr: bizchapter.ErrNotFound},
		{name: "repository error", readerErr: repositoryErr, wantErr: repositoryErr},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			getContentTool, err := NewGetContentTool(&fakeChapterReader{err: tt.readerErr}, 11, 22)
			if err != nil {
				t.Fatalf("NewGetContentTool failed: %v", err)
			}

			_, err = getContentTool.InvokableRun(context.Background(), "{}")
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("InvokableRun error = %v, want %v", err, tt.wantErr)
			}
		})
	}
}
