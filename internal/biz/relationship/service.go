package relationship

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"
)

// Repository 表示角色关系图数据仓储接口。
type Repository interface {
	// Get 查询指定小说的角色关系图快照。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
	Get(ctx context.Context, novelID uint64) (GraphResponse, error)
	// Save 保存指定小说的完整角色关系图快照。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示已经校验和标准化的关系图保存请求。
	Save(ctx context.Context, novelID uint64, req SaveRequest) (GraphResponse, error)
	// ExistingCharacterIDs 查询指定小说下存在的角色卡 ID 集合。
	// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 characterIDs 表示需要校验的角色卡 ID 列表。
	ExistingCharacterIDs(ctx context.Context, novelID uint64, characterIDs []uint64) (map[uint64]bool, error)
}

// Service 表示角色关系图业务服务。
type Service struct {
	// repo 表示角色关系图数据仓储。
	repo Repository
}

// NewService 创建角色关系图业务服务。
// 参数 repo 表示角色关系图数据仓储。
func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Get 查询指定小说的角色关系图。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
func (s *Service) Get(ctx context.Context, novelID uint64) (GraphResponse, error) {
	if novelID == 0 {
		return GraphResponse{}, ErrNovelNotFound
	}

	data, err := s.repo.Get(ctx, novelID)
	if err != nil {
		return GraphResponse{}, fmt.Errorf("查询角色关系图失败: %w", err)
	}
	return data, nil
}

// Save 保存指定小说的完整角色关系图快照。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示前端提交的关系图快照。
func (s *Service) Save(ctx context.Context, novelID uint64, req SaveRequest) (GraphResponse, error) {
	if novelID == 0 {
		return GraphResponse{}, ErrNovelNotFound
	}

	normalizedReq, characterIDs, err := normalizeAndValidateSaveRequest(req)
	if err != nil {
		return GraphResponse{}, err
	}

	if len(characterIDs) > 0 {
		existingIDs, err := s.repo.ExistingCharacterIDs(ctx, novelID, characterIDs)
		if err != nil {
			return GraphResponse{}, fmt.Errorf("校验角色卡失败: %w", err)
		}
		for _, characterID := range characterIDs {
			if !existingIDs[characterID] {
				return GraphResponse{}, ErrCharacterNotFound
			}
		}
	}

	data, err := s.repo.Save(ctx, novelID, normalizedReq)
	if err != nil {
		return GraphResponse{}, fmt.Errorf("保存角色关系图失败: %w", err)
	}
	return data, nil
}

// normalizeAndValidateSaveRequest 标准化并校验保存关系图请求。
// 参数 req 表示前端提交的关系图快照。
func normalizeAndValidateSaveRequest(req SaveRequest) (SaveRequest, []uint64, error) {
	if !isFiniteFloat(req.Viewport.X) || !isFiniteFloat(req.Viewport.Y) || !isFiniteFloat(req.Viewport.Zoom) {
		return SaveRequest{}, nil, ErrInvalidViewport
	}
	if req.Viewport.Zoom <= 0 {
		req.Viewport.Zoom = 1
	}

	nodeSet := make(map[uint64]bool, len(req.Nodes))
	characterIDs := make([]uint64, 0, len(req.Nodes))
	for index := range req.Nodes {
		node := &req.Nodes[index]
		if node.CharacterID == 0 || !isFiniteFloat(node.PositionX) || !isFiniteFloat(node.PositionY) {
			return SaveRequest{}, nil, ErrInvalidNode
		}
		if nodeSet[node.CharacterID] {
			return SaveRequest{}, nil, ErrDuplicateNode
		}
		nodeSet[node.CharacterID] = true
		characterIDs = append(characterIDs, node.CharacterID)
	}

	relationSet := make(map[string]bool, len(req.Edges))
	for index := range req.Edges {
		edge := &req.Edges[index]
		if edge.CharacterAID == 0 || edge.CharacterBID == 0 {
			return SaveRequest{}, nil, ErrRelationEndpointMissing
		}
		if edge.CharacterAID == edge.CharacterBID {
			return SaveRequest{}, nil, ErrSelfRelation
		}

		edge.CharacterAID, edge.CharacterBID = normalizePair(edge.CharacterAID, edge.CharacterBID)
		if !nodeSet[edge.CharacterAID] || !nodeSet[edge.CharacterBID] {
			return SaveRequest{}, nil, ErrRelationEndpointMissing
		}

		edge.ID = EdgeID(edge.CharacterAID, edge.CharacterBID)
		edge.Note = strings.TrimSpace(edge.Note)
		if relationSet[edge.ID] {
			return SaveRequest{}, nil, ErrDuplicateRelation
		}
		relationSet[edge.ID] = true
	}

	sort.Slice(req.Nodes, func(i int, j int) bool {
		return req.Nodes[i].CharacterID < req.Nodes[j].CharacterID
	})
	sort.Slice(req.Edges, func(i int, j int) bool {
		if req.Edges[i].CharacterAID == req.Edges[j].CharacterAID {
			return req.Edges[i].CharacterBID < req.Edges[j].CharacterBID
		}
		return req.Edges[i].CharacterAID < req.Edges[j].CharacterAID
	})
	sort.Slice(characterIDs, func(i int, j int) bool {
		return characterIDs[i] < characterIDs[j]
	})

	return req, characterIDs, nil
}

// isFiniteFloat 判断浮点数是否是可保存的有限值。
// 参数 value 表示需要判断的浮点数。
func isFiniteFloat(value float64) bool {
	return !math.IsNaN(value) && !math.IsInf(value, 0)
}

// normalizePair 将无方向关系线两端角色 ID 归一为从小到大。
// 参数 characterAID 表示关系线一端角色卡 ID；参数 characterBID 表示关系线另一端角色卡 ID。
func normalizePair(characterAID uint64, characterBID uint64) (uint64, uint64) {
	if characterAID <= characterBID {
		return characterAID, characterBID
	}
	return characterBID, characterAID
}
