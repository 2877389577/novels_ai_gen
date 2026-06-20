package prompt

import "errors"

var (
	// ErrNotFound 表示提示词不存在。
	ErrNotFound = errors.New("prompt not found")
	// ErrContentRequired 表示提示词正文不能为空。
	ErrContentRequired = errors.New("prompt content required")
	// ErrTypeRequired 表示提示词类型不能为空。
	ErrTypeRequired = errors.New("prompt type required")
	// ErrTypeNotFound 表示提示词类型不存在。
	ErrTypeNotFound = errors.New("prompt type not found")
	// ErrTypeNameRequired 表示提示词类型名称不能为空。
	ErrTypeNameRequired = errors.New("prompt type name required")
	// ErrTypeConflict 表示提示词类型已经存在。
	ErrTypeConflict = errors.New("prompt type conflict")
	// ErrTypeInUse 表示提示词类型仍被提示词引用。
	ErrTypeInUse = errors.New("prompt type in use")
)
