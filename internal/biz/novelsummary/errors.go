package novelsummary

import "errors"

var (
	// ErrNovelIDRequired 表示小说总结操作缺少小说 ID。
	ErrNovelIDRequired = errors.New("novel id required")
	// ErrNovelNotFound 表示小说总结所属小说不存在。
	ErrNovelNotFound = errors.New("novel not found")
	// ErrNotFound 表示小说总结记录不存在。
	ErrNotFound = errors.New("novel summary not found")
	// ErrConflict 表示同一小说已经存在总结记录。
	ErrConflict = errors.New("novel summary conflict")
	// ErrInvalidChapterRange 表示小说总结覆盖章节范围无效。
	ErrInvalidChapterRange = errors.New("novel summary chapter range invalid")
)
