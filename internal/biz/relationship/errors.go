package relationship

import "errors"

var (
	// ErrNovelNotFound 表示关系图所属小说不存在。
	ErrNovelNotFound = errors.New("relationship graph novel not found")
	// ErrCharacterNotFound 表示关系图引用的角色卡不存在或不属于该小说。
	ErrCharacterNotFound = errors.New("relationship graph character not found")
	// ErrDuplicateNode 表示同一个角色被重复放入关系图画布。
	ErrDuplicateNode = errors.New("relationship graph duplicate node")
	// ErrInvalidNode 表示关系图节点参数非法。
	ErrInvalidNode = errors.New("relationship graph invalid node")
	// ErrInvalidViewport 表示关系图视口参数非法。
	ErrInvalidViewport = errors.New("relationship graph invalid viewport")
	// ErrSelfRelation 表示角色关系线两端不能是同一个角色。
	ErrSelfRelation = errors.New("relationship graph self relation")
	// ErrDuplicateRelation 表示同一对角色之间存在重复关系线。
	ErrDuplicateRelation = errors.New("relationship graph duplicate relation")
	// ErrRelationEndpointMissing 表示关系线端点没有对应画布节点。
	ErrRelationEndpointMissing = errors.New("relationship graph relation endpoint missing")
)
