package novel

import "errors"

var (
	// ErrNotFound 表示小说不存在。
	ErrNotFound = errors.New("novel not found")
	// ErrNameRequired 表示小说名不能为空。
	ErrNameRequired = errors.New("novel name required")
	// ErrInvalidStatus 表示小说状态不在允许范围内。
	ErrInvalidStatus = errors.New("novel status invalid")
)
