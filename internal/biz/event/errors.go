package event

import "errors"

var (
	// ErrNovelNotFound 表示事件所属小说不存在。
	ErrNovelNotFound = errors.New("event novel not found")
	// ErrNotFound 表示事件不存在。
	ErrNotFound = errors.New("event not found")
	// ErrNameRequired 表示事件名称不能为空。
	ErrNameRequired = errors.New("event name required")
	// ErrCharacterNotFound 表示事件参与者引用了不存在或不属于该小说的角色卡。
	ErrCharacterNotFound = errors.New("event character not found")
	// ErrRelationNotFound 表示事件关系线不存在。
	ErrRelationNotFound = errors.New("event relation not found")
	// ErrInvalidViewport 表示事件图视口参数非法。
	ErrInvalidViewport = errors.New("event graph invalid viewport")
	// ErrInvalidNode 表示事件图节点参数非法。
	ErrInvalidNode = errors.New("event graph invalid node")
	// ErrSelfRelation 表示事件不能连接到自身。
	ErrSelfRelation = errors.New("event graph self relation")
	// ErrDuplicateRelation 表示同一方向的事件关系线已经存在。
	ErrDuplicateRelation = errors.New("event graph duplicate relation")
	// ErrRelationEndpointMissing 表示事件关系线端点不存在或不属于该小说。
	ErrRelationEndpointMissing = errors.New("event graph relation endpoint missing")
)
