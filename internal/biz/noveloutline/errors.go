package noveloutline

import "errors"

var (
	// ErrNovelIDRequired 表示小说大纲操作缺少小说 ID。
	ErrNovelIDRequired = errors.New("novel id required")
	// ErrNovelNotFound 表示小说大纲所属小说不存在。
	ErrNovelNotFound = errors.New("novel not found")
	// ErrNotFound 表示小说大纲记录不存在。
	ErrNotFound = errors.New("novel outline not found")
	// ErrConflict 表示同一小说已经存在大纲记录。
	ErrConflict = errors.New("novel outline conflict")
)
