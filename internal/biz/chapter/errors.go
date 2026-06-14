package chapter

import "errors"

var (
	// ErrNotFound 表示章节不存在。
	ErrNotFound = errors.New("chapter not found")
	// ErrNovelNotFound 表示章节所属小说不存在。
	ErrNovelNotFound = errors.New("chapter novel not found")
	// ErrTitleRequired 表示章节名不能为空。
	ErrTitleRequired = errors.New("chapter title required")
	// ErrChapterNumberConflict 表示同一本小说下章节号发生唯一冲突。
	ErrChapterNumberConflict = errors.New("chapter number conflict")
)
