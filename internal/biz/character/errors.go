package character

import "errors"

var (
	// ErrNotFound 表示角色卡不存在。
	ErrNotFound = errors.New("character not found")
	// ErrNovelNotFound 表示角色卡所属小说不存在。
	ErrNovelNotFound = errors.New("character novel not found")
	// ErrNameRequired 表示角色姓名不能为空。
	ErrNameRequired = errors.New("character name required")
)
