package relationship

import (
	"context"
	"errors"
	"fmt"

	bizcharacter "novels_ai_gen/internal/biz/character"
	biznovel "novels_ai_gen/internal/biz/novel"
	bizrelationship "novels_ai_gen/internal/biz/relationship"

	"gorm.io/gorm"
)

// Repository 表示基于 GORM 的角色关系图数据仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建角色关系图数据仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Get 查询指定小说的角色关系图快照。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
func (r *Repository) Get(ctx context.Context, novelID uint64) (bizrelationship.GraphResponse, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return bizrelationship.GraphResponse{}, err
	}

	return loadGraphResponse(db, novelID)
}

// Save 保存指定小说的完整角色关系图快照。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示已经校验和标准化的关系图保存请求。
func (r *Repository) Save(ctx context.Context, novelID uint64, req bizrelationship.SaveRequest) (bizrelationship.GraphResponse, error) {
	var savedGraph bizrelationship.GraphResponse

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, novelID); err != nil {
			return err
		}
		if err := ensureCharactersBelongToNovel(tx, novelID, req.Nodes); err != nil {
			return err
		}

		graph, err := findOrCreateGraph(tx, novelID)
		if err != nil {
			return err
		}

		if err := tx.Model(&bizrelationship.Graph{}).
			Where("id = ? AND novel_id = ?", graph.ID, novelID).
			Updates(map[string]any{
				"viewport_x":    req.Viewport.X,
				"viewport_y":    req.Viewport.Y,
				"viewport_zoom": req.Viewport.Zoom,
			}).Error; err != nil {
			return fmt.Errorf("保存关系图视口失败: %w", err)
		}

		if err := tx.Where("graph_id = ?", graph.ID).Delete(&bizrelationship.Edge{}).Error; err != nil {
			return fmt.Errorf("清空关系图关系线失败: %w", err)
		}
		if err := tx.Where("graph_id = ?", graph.ID).Delete(&bizrelationship.Node{}).Error; err != nil {
			return fmt.Errorf("清空关系图节点失败: %w", err)
		}

		nodes := toNodeModels(novelID, graph.ID, req.Nodes)
		if len(nodes) > 0 {
			if err := tx.Create(&nodes).Error; err != nil {
				return fmt.Errorf("写入关系图节点失败: %w", err)
			}
		}

		edges := toEdgeModels(novelID, graph.ID, req.Edges)
		if len(edges) > 0 {
			if err := tx.Create(&edges).Error; err != nil {
				return fmt.Errorf("写入关系图关系线失败: %w", err)
			}
		}

		data, err := loadGraphResponse(tx, novelID)
		if err != nil {
			return err
		}
		savedGraph = data
		return nil
	})
	if err != nil {
		return bizrelationship.GraphResponse{}, err
	}

	return savedGraph, nil
}

// ExistingCharacterIDs 查询指定小说下存在的角色卡 ID 集合。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 characterIDs 表示需要校验的角色卡 ID 列表。
func (r *Repository) ExistingCharacterIDs(ctx context.Context, novelID uint64, characterIDs []uint64) (map[uint64]bool, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, err
	}

	existingIDs := make(map[uint64]bool, len(characterIDs))
	if len(characterIDs) == 0 {
		return existingIDs, nil
	}

	var rows []struct {
		// ID 表示已存在的角色卡 ID。
		ID uint64
	}
	if err := db.
		Model(&bizcharacter.Character{}).
		Select("id").
		Where("novel_id = ? AND id IN ?", novelID, characterIDs).
		Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("查询角色卡 ID 失败: %w", err)
	}

	for _, row := range rows {
		existingIDs[row.ID] = true
	}
	return existingIDs, nil
}

// ensureNovelExists 确认关系图所属小说存在。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID。
func ensureNovelExists(db *gorm.DB, novelID uint64) error {
	var total int64
	if err := db.Model(&biznovel.Novel{}).Where("id = ?", novelID).Count(&total).Error; err != nil {
		return fmt.Errorf("查询小说记录失败: %w", err)
	}
	if total == 0 {
		return bizrelationship.ErrNovelNotFound
	}
	return nil
}

// ensureCharactersBelongToNovel 确认所有关系图节点引用的角色卡属于当前小说。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID；参数 nodes 表示需要保存的节点列表。
func ensureCharactersBelongToNovel(db *gorm.DB, novelID uint64, nodes []bizrelationship.NodeRequest) error {
	if len(nodes) == 0 {
		return nil
	}

	characterIDs := make([]uint64, 0, len(nodes))
	for _, node := range nodes {
		characterIDs = append(characterIDs, node.CharacterID)
	}

	var total int64
	if err := db.Model(&bizcharacter.Character{}).
		Where("novel_id = ? AND id IN ?", novelID, characterIDs).
		Count(&total).Error; err != nil {
		return fmt.Errorf("统计角色卡记录失败: %w", err)
	}
	if total != int64(len(characterIDs)) {
		return bizrelationship.ErrCharacterNotFound
	}
	return nil
}

// findOrCreateGraph 查询或创建指定小说的角色关系图主记录。
// 参数 tx 表示当前事务；参数 novelID 表示所属小说 ID。
func findOrCreateGraph(tx *gorm.DB, novelID uint64) (*bizrelationship.Graph, error) {
	var graph bizrelationship.Graph
	err := tx.Where("novel_id = ?", novelID).First(&graph).Error
	if err == nil {
		return &graph, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询关系图主记录失败: %w", err)
	}

	graph = bizrelationship.Graph{
		NovelID:      novelID,
		ViewportZoom: 1,
	}
	if err := tx.Create(&graph).Error; err != nil {
		return nil, fmt.Errorf("创建关系图主记录失败: %w", err)
	}
	return &graph, nil
}

// loadGraphResponse 查询指定小说关系图并转换为响应数据。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID。
func loadGraphResponse(db *gorm.DB, novelID uint64) (bizrelationship.GraphResponse, error) {
	var graph bizrelationship.Graph
	if err := db.Where("novel_id = ?", novelID).First(&graph).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return defaultGraphResponse(novelID), nil
		}
		return bizrelationship.GraphResponse{}, fmt.Errorf("查询关系图主记录失败: %w", err)
	}

	var nodes []bizrelationship.Node
	if err := db.
		Where("graph_id = ? AND novel_id = ?", graph.ID, novelID).
		Order("character_id ASC").
		Find(&nodes).Error; err != nil {
		return bizrelationship.GraphResponse{}, fmt.Errorf("查询关系图节点失败: %w", err)
	}

	var edges []bizrelationship.Edge
	if err := db.
		Where("graph_id = ? AND novel_id = ?", graph.ID, novelID).
		Order("character_a_id ASC, character_b_id ASC").
		Find(&edges).Error; err != nil {
		return bizrelationship.GraphResponse{}, fmt.Errorf("查询关系图关系线失败: %w", err)
	}

	updatedAt := graph.UpdatedAt
	return bizrelationship.GraphResponse{
		NovelID: novelID,
		Viewport: bizrelationship.Viewport{
			X:    graph.ViewportX,
			Y:    graph.ViewportY,
			Zoom: graph.ViewportZoom,
		},
		Nodes:     toNodeResponses(nodes),
		Edges:     toEdgeResponses(edges),
		UpdatedAt: &updatedAt,
	}, nil
}

// defaultGraphResponse 返回未保存过关系图时的默认响应。
// 参数 novelID 表示所属小说 ID。
func defaultGraphResponse(novelID uint64) bizrelationship.GraphResponse {
	return bizrelationship.GraphResponse{
		NovelID: novelID,
		Viewport: bizrelationship.Viewport{
			Zoom: 1,
		},
		Nodes: []bizrelationship.NodeResponse{},
		Edges: []bizrelationship.EdgeResponse{},
	}
}

// toNodeModels 将节点请求转换为数据库模型列表。
// 参数 novelID 表示所属小说 ID；参数 graphID 表示所属关系图 ID；参数 nodes 表示节点请求列表。
func toNodeModels(novelID uint64, graphID uint64, nodes []bizrelationship.NodeRequest) []bizrelationship.Node {
	items := make([]bizrelationship.Node, 0, len(nodes))
	for _, node := range nodes {
		items = append(items, bizrelationship.Node{
			GraphID:     graphID,
			NovelID:     novelID,
			CharacterID: node.CharacterID,
			PositionX:   node.PositionX,
			PositionY:   node.PositionY,
		})
	}
	return items
}

// toEdgeModels 将关系线请求转换为数据库模型列表。
// 参数 novelID 表示所属小说 ID；参数 graphID 表示所属关系图 ID；参数 edges 表示关系线请求列表。
func toEdgeModels(novelID uint64, graphID uint64, edges []bizrelationship.EdgeRequest) []bizrelationship.Edge {
	items := make([]bizrelationship.Edge, 0, len(edges))
	for _, edge := range edges {
		items = append(items, bizrelationship.Edge{
			GraphID:      graphID,
			NovelID:      novelID,
			CharacterAID: edge.CharacterAID,
			CharacterBID: edge.CharacterBID,
			Note:         edge.Note,
		})
	}
	return items
}

// toNodeResponses 将节点数据库模型转换为响应列表。
// 参数 nodes 表示节点数据库模型列表。
func toNodeResponses(nodes []bizrelationship.Node) []bizrelationship.NodeResponse {
	items := make([]bizrelationship.NodeResponse, 0, len(nodes))
	for _, node := range nodes {
		items = append(items, bizrelationship.NodeResponse{
			CharacterID: node.CharacterID,
			PositionX:   node.PositionX,
			PositionY:   node.PositionY,
		})
	}
	return items
}

// toEdgeResponses 将关系线数据库模型转换为响应列表。
// 参数 edges 表示关系线数据库模型列表。
func toEdgeResponses(edges []bizrelationship.Edge) []bizrelationship.EdgeResponse {
	items := make([]bizrelationship.EdgeResponse, 0, len(edges))
	for _, edge := range edges {
		items = append(items, bizrelationship.EdgeResponse{
			ID:           bizrelationship.EdgeID(edge.CharacterAID, edge.CharacterBID),
			CharacterAID: edge.CharacterAID,
			CharacterBID: edge.CharacterBID,
			Note:         edge.Note,
		})
	}
	return items
}
