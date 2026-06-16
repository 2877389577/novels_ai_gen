package event

import (
	"context"
	"errors"
	"fmt"

	bizcharacter "novels_ai_gen/internal/biz/character"
	bizevent "novels_ai_gen/internal/biz/event"
	biznovel "novels_ai_gen/internal/biz/novel"

	"gorm.io/gorm"
)

// Repository 表示基于 GORM 的小说事件数据仓储。
type Repository struct {
	// db 表示 GORM 数据库连接。
	db *gorm.DB
}

// NewRepository 创建小说事件数据仓储。
// 参数 db 表示 GORM 数据库连接。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create 创建小说事件并写入参与者关联。
// 参数 ctx 表示请求上下文；参数 item 表示需要创建的事件模型；参数 participantIDs 表示参与者角色卡 ID 列表。
func (r *Repository) Create(ctx context.Context, item *bizevent.Event, participantIDs []uint64) (bizevent.EventResponse, error) {
	var createdEvent bizevent.EventResponse

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, item.NovelID); err != nil {
			return err
		}
		if err := ensureCharactersBelongToNovel(tx, item.NovelID, participantIDs); err != nil {
			return err
		}
		if err := tx.Create(item).Error; err != nil {
			return fmt.Errorf("创建事件记录失败: %w", err)
		}
		if err := createParticipants(tx, item.NovelID, item.ID, participantIDs); err != nil {
			return err
		}

		data, err := loadEventResponse(tx, item.NovelID, item.ID)
		if err != nil {
			return err
		}
		createdEvent = data
		return nil
	})
	if err != nil {
		return bizevent.EventResponse{}, err
	}

	return createdEvent, nil
}

// ListByNovelID 查询指定小说下的事件分页列表。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 offset 表示查询偏移量；参数 limit 表示查询数量。
func (r *Repository) ListByNovelID(ctx context.Context, novelID uint64, offset int, limit int) ([]bizevent.EventResponse, int64, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return nil, 0, err
	}

	var total int64
	if err := db.Model(&bizevent.Event{}).Where("novel_id = ?", novelID).Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("统计事件记录失败: %w", err)
	}

	var events []bizevent.Event
	if err := db.
		Where("novel_id = ?", novelID).
		Order("updated_at DESC, id DESC").
		Offset(offset).
		Limit(limit).
		Find(&events).Error; err != nil {
		return nil, 0, fmt.Errorf("查询事件列表失败: %w", err)
	}

	responses, err := toEventResponses(db, events)
	if err != nil {
		return nil, 0, err
	}
	return responses, total, nil
}

// GetByID 根据小说 ID 和事件 ID 查询事件详情。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 eventID 表示事件主键 ID。
func (r *Repository) GetByID(ctx context.Context, novelID uint64, eventID uint64) (bizevent.EventResponse, error) {
	return loadEventResponse(r.db.WithContext(ctx), novelID, eventID)
}

// Update 更新小说事件并重写参与者关联。
// 参数 ctx 表示请求上下文；参数 item 表示需要保存的事件模型；参数 participantIDs 表示参与者角色卡 ID 列表。
func (r *Repository) Update(ctx context.Context, item *bizevent.Event, participantIDs []uint64) (bizevent.EventResponse, error) {
	var updatedEvent bizevent.EventResponse

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureEventExists(tx, item.NovelID, item.ID); err != nil {
			return err
		}
		if err := ensureCharactersBelongToNovel(tx, item.NovelID, participantIDs); err != nil {
			return err
		}

		result := tx.Model(&bizevent.Event{}).
			Where("id = ? AND novel_id = ?", item.ID, item.NovelID).
			Updates(map[string]any{
				"name":       item.Name,
				"cause":      item.Cause,
				"process":    item.Process,
				"result":     item.Result,
				"impact":     item.Impact,
				"location":   item.Location,
				"position_x": item.PositionX,
				"position_y": item.PositionY,
			})
		if result.Error != nil {
			return fmt.Errorf("更新事件记录失败: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return bizevent.ErrNotFound
		}

		if err := tx.Where("event_id = ? AND novel_id = ?", item.ID, item.NovelID).Delete(&bizevent.Participant{}).Error; err != nil {
			return fmt.Errorf("清空事件参与者失败: %w", err)
		}
		if err := createParticipants(tx, item.NovelID, item.ID, participantIDs); err != nil {
			return err
		}

		data, err := loadEventResponse(tx, item.NovelID, item.ID)
		if err != nil {
			return err
		}
		updatedEvent = data
		return nil
	})
	if err != nil {
		return bizevent.EventResponse{}, err
	}

	return updatedEvent, nil
}

// Delete 根据小说 ID 和事件 ID 删除事件，并返回随事件删除的关系线数量。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 eventID 表示事件主键 ID。
func (r *Repository) Delete(ctx context.Context, novelID uint64, eventID uint64) (int64, error) {
	var deletedRelationCount int64

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureEventExists(tx, novelID, eventID); err != nil {
			return err
		}

		if err := tx.Model(&bizevent.Relation{}).
			Where("novel_id = ? AND (source_event_id = ? OR target_event_id = ?)", novelID, eventID, eventID).
			Count(&deletedRelationCount).Error; err != nil {
			return fmt.Errorf("统计事件关系线失败: %w", err)
		}
		if err := tx.
			Where("novel_id = ? AND (source_event_id = ? OR target_event_id = ?)", novelID, eventID, eventID).
			Delete(&bizevent.Relation{}).Error; err != nil {
			return fmt.Errorf("删除事件关系线失败: %w", err)
		}
		if err := tx.Where("event_id = ? AND novel_id = ?", eventID, novelID).Delete(&bizevent.Participant{}).Error; err != nil {
			return fmt.Errorf("删除事件参与者失败: %w", err)
		}

		result := tx.Where("id = ? AND novel_id = ?", eventID, novelID).Delete(&bizevent.Event{})
		if result.Error != nil {
			return fmt.Errorf("删除事件记录失败: %w", result.Error)
		}
		if result.RowsAffected == 0 {
			return bizevent.ErrNotFound
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	return deletedRelationCount, nil
}

// GetGraph 查询指定小说的事件图。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID。
func (r *Repository) GetGraph(ctx context.Context, novelID uint64) (bizevent.GraphResponse, error) {
	db := r.db.WithContext(ctx)
	if err := ensureNovelExists(db, novelID); err != nil {
		return bizevent.GraphResponse{}, err
	}
	return loadGraphResponse(db, novelID)
}

// SaveLayout 保存指定小说的事件图布局。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示布局保存请求。
func (r *Repository) SaveLayout(ctx context.Context, novelID uint64, req bizevent.LayoutRequest) (bizevent.GraphResponse, error) {
	var savedGraph bizevent.GraphResponse

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, novelID); err != nil {
			return err
		}
		eventIDs := layoutEventIDs(req.Nodes)
		if err := ensureEventsBelongToNovel(tx, novelID, eventIDs); err != nil {
			return err
		}

		graph, err := findOrCreateGraph(tx, novelID)
		if err != nil {
			return err
		}
		if err := tx.Model(&bizevent.EventGraph{}).
			Where("id = ? AND novel_id = ?", graph.ID, novelID).
			Updates(map[string]any{
				"viewport_x":    req.Viewport.X,
				"viewport_y":    req.Viewport.Y,
				"viewport_zoom": req.Viewport.Zoom,
			}).Error; err != nil {
			return fmt.Errorf("保存事件图视口失败: %w", err)
		}

		for _, node := range req.Nodes {
			if err := tx.Model(&bizevent.Event{}).
				Where("id = ? AND novel_id = ?", node.EventID, novelID).
				Updates(map[string]any{
					"position_x": node.PositionX,
					"position_y": node.PositionY,
				}).Error; err != nil {
				return fmt.Errorf("保存事件节点坐标失败: %w", err)
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
		return bizevent.GraphResponse{}, err
	}

	return savedGraph, nil
}

// CreateRelation 创建事件有向关系线。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 req 表示关系线创建请求。
func (r *Repository) CreateRelation(ctx context.Context, novelID uint64, req bizevent.RelationCreateRequest) (bizevent.RelationResponse, error) {
	var createdRelation bizevent.RelationResponse

	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := ensureNovelExists(tx, novelID); err != nil {
			return err
		}
		if err := ensureEventsBelongToNovel(tx, novelID, []uint64{req.SourceEventID, req.TargetEventID}); err != nil {
			return err
		}
		if err := ensureRelationNotExists(tx, novelID, req.SourceEventID, req.TargetEventID); err != nil {
			return err
		}

		relation := &bizevent.Relation{
			NovelID:       novelID,
			SourceEventID: req.SourceEventID,
			TargetEventID: req.TargetEventID,
			Note:          req.Note,
		}
		if err := tx.Create(relation).Error; err != nil {
			return fmt.Errorf("创建事件关系线失败: %w", err)
		}
		createdRelation = toRelationResponse(*relation)
		return nil
	})
	if err != nil {
		return bizevent.RelationResponse{}, err
	}

	return createdRelation, nil
}

// UpdateRelation 更新事件关系线备注。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 relationID 表示关系线主键 ID；参数 req 表示关系线更新请求。
func (r *Repository) UpdateRelation(ctx context.Context, novelID uint64, relationID uint64, req bizevent.RelationUpdateRequest) (bizevent.RelationResponse, error) {
	db := r.db.WithContext(ctx)
	var relation bizevent.Relation
	if err := db.Where("id = ? AND novel_id = ?", relationID, novelID).First(&relation).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return bizevent.RelationResponse{}, bizevent.ErrRelationNotFound
		}
		return bizevent.RelationResponse{}, fmt.Errorf("查询事件关系线失败: %w", err)
	}

	if err := db.Model(&relation).Update("note", req.Note).Error; err != nil {
		return bizevent.RelationResponse{}, fmt.Errorf("更新事件关系线失败: %w", err)
	}
	relation.Note = req.Note
	return toRelationResponse(relation), nil
}

// DeleteRelation 删除事件关系线。
// 参数 ctx 表示请求上下文；参数 novelID 表示所属小说 ID；参数 relationID 表示关系线主键 ID。
func (r *Repository) DeleteRelation(ctx context.Context, novelID uint64, relationID uint64) error {
	result := r.db.WithContext(ctx).Where("id = ? AND novel_id = ?", relationID, novelID).Delete(&bizevent.Relation{})
	if result.Error != nil {
		return fmt.Errorf("删除事件关系线失败: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return bizevent.ErrRelationNotFound
	}
	return nil
}

// ensureNovelExists 确认事件所属小说存在。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID。
func ensureNovelExists(db *gorm.DB, novelID uint64) error {
	var total int64
	if err := db.Model(&biznovel.Novel{}).Where("id = ?", novelID).Count(&total).Error; err != nil {
		return fmt.Errorf("查询小说记录失败: %w", err)
	}
	if total == 0 {
		return bizevent.ErrNovelNotFound
	}
	return nil
}

// ensureEventExists 确认事件存在并属于指定小说。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID；参数 eventID 表示事件主键 ID。
func ensureEventExists(db *gorm.DB, novelID uint64, eventID uint64) error {
	var total int64
	if err := db.Model(&bizevent.Event{}).Where("id = ? AND novel_id = ?", eventID, novelID).Count(&total).Error; err != nil {
		return fmt.Errorf("查询事件记录失败: %w", err)
	}
	if total == 0 {
		return bizevent.ErrNotFound
	}
	return nil
}

// ensureCharactersBelongToNovel 确认参与者角色卡全部属于指定小说。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID；参数 characterIDs 表示需要校验的角色卡 ID 列表。
func ensureCharactersBelongToNovel(db *gorm.DB, novelID uint64, characterIDs []uint64) error {
	if len(characterIDs) == 0 {
		return nil
	}

	var total int64
	if err := db.Model(&bizcharacter.Character{}).
		Where("novel_id = ? AND id IN ?", novelID, characterIDs).
		Count(&total).Error; err != nil {
		return fmt.Errorf("统计角色卡记录失败: %w", err)
	}
	if total != int64(len(characterIDs)) {
		return bizevent.ErrCharacterNotFound
	}
	return nil
}

// ensureEventsBelongToNovel 确认事件 ID 全部属于指定小说。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID；参数 eventIDs 表示需要校验的事件 ID 列表。
func ensureEventsBelongToNovel(db *gorm.DB, novelID uint64, eventIDs []uint64) error {
	eventIDs = dedupePositiveIDs(eventIDs)
	if len(eventIDs) == 0 {
		return nil
	}

	var total int64
	if err := db.Model(&bizevent.Event{}).
		Where("novel_id = ? AND id IN ?", novelID, eventIDs).
		Count(&total).Error; err != nil {
		return fmt.Errorf("统计事件记录失败: %w", err)
	}
	if total != int64(len(eventIDs)) {
		return bizevent.ErrRelationEndpointMissing
	}
	return nil
}

// ensureRelationNotExists 确认同向事件关系线尚不存在。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID；参数 sourceEventID 表示起点事件 ID；参数 targetEventID 表示终点事件 ID。
func ensureRelationNotExists(db *gorm.DB, novelID uint64, sourceEventID uint64, targetEventID uint64) error {
	var total int64
	if err := db.Model(&bizevent.Relation{}).
		Where("novel_id = ? AND source_event_id = ? AND target_event_id = ?", novelID, sourceEventID, targetEventID).
		Count(&total).Error; err != nil {
		return fmt.Errorf("统计事件关系线失败: %w", err)
	}
	if total > 0 {
		return bizevent.ErrDuplicateRelation
	}
	return nil
}

// findOrCreateGraph 查询或创建指定小说的事件图视口记录。
// 参数 tx 表示当前事务；参数 novelID 表示所属小说 ID。
func findOrCreateGraph(tx *gorm.DB, novelID uint64) (*bizevent.EventGraph, error) {
	var graph bizevent.EventGraph
	err := tx.Where("novel_id = ?", novelID).First(&graph).Error
	if err == nil {
		return &graph, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("查询事件图视口失败: %w", err)
	}

	graph = bizevent.EventGraph{
		NovelID:      novelID,
		ViewportZoom: 1,
	}
	if err := tx.Create(&graph).Error; err != nil {
		return nil, fmt.Errorf("创建事件图视口失败: %w", err)
	}
	return &graph, nil
}

// createParticipants 批量创建事件参与者关联。
// 参数 tx 表示当前事务；参数 novelID 表示所属小说 ID；参数 eventID 表示所属事件 ID；参数 participantIDs 表示参与者角色卡 ID 列表。
func createParticipants(tx *gorm.DB, novelID uint64, eventID uint64, participantIDs []uint64) error {
	if len(participantIDs) == 0 {
		return nil
	}

	participants := make([]bizevent.Participant, 0, len(participantIDs))
	for _, characterID := range participantIDs {
		participants = append(participants, bizevent.Participant{
			NovelID:     novelID,
			EventID:     eventID,
			CharacterID: characterID,
		})
	}
	if err := tx.Create(&participants).Error; err != nil {
		return fmt.Errorf("写入事件参与者失败: %w", err)
	}
	return nil
}

// loadEventResponse 查询单个事件并转换为响应数据。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID；参数 eventID 表示事件主键 ID。
func loadEventResponse(db *gorm.DB, novelID uint64, eventID uint64) (bizevent.EventResponse, error) {
	var item bizevent.Event
	if err := db.Where("id = ? AND novel_id = ?", eventID, novelID).First(&item).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return bizevent.EventResponse{}, bizevent.ErrNotFound
		}
		return bizevent.EventResponse{}, fmt.Errorf("查询事件记录失败: %w", err)
	}

	responses, err := toEventResponses(db, []bizevent.Event{item})
	if err != nil {
		return bizevent.EventResponse{}, err
	}
	if len(responses) == 0 {
		return bizevent.EventResponse{}, bizevent.ErrNotFound
	}
	return responses[0], nil
}

// loadGraphResponse 查询指定小说事件图并转换为响应数据。
// 参数 db 表示当前 GORM 查询上下文；参数 novelID 表示所属小说 ID。
func loadGraphResponse(db *gorm.DB, novelID uint64) (bizevent.GraphResponse, error) {
	var graph bizevent.EventGraph
	updatedAt := (*bizevent.EventGraph)(nil)
	viewport := bizevent.Viewport{Zoom: 1}
	err := db.Where("novel_id = ?", novelID).First(&graph).Error
	if err == nil {
		updatedAt = &graph
		viewport = bizevent.Viewport{
			X:    graph.ViewportX,
			Y:    graph.ViewportY,
			Zoom: graph.ViewportZoom,
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return bizevent.GraphResponse{}, fmt.Errorf("查询事件图视口失败: %w", err)
	}

	var events []bizevent.Event
	if err := db.Where("novel_id = ?", novelID).Order("id ASC").Find(&events).Error; err != nil {
		return bizevent.GraphResponse{}, fmt.Errorf("查询事件节点失败: %w", err)
	}
	nodes, err := toEventResponses(db, events)
	if err != nil {
		return bizevent.GraphResponse{}, err
	}

	var relations []bizevent.Relation
	if err := db.Where("novel_id = ?", novelID).Order("source_event_id ASC, target_event_id ASC").Find(&relations).Error; err != nil {
		return bizevent.GraphResponse{}, fmt.Errorf("查询事件关系线失败: %w", err)
	}

	response := bizevent.GraphResponse{
		NovelID:  novelID,
		Viewport: viewport,
		Nodes:    nodes,
		Edges:    toRelationResponses(relations),
	}
	if updatedAt != nil {
		response.UpdatedAt = &updatedAt.UpdatedAt
	}
	return response, nil
}

// toEventResponses 将事件模型列表转换为响应列表。
// 参数 db 表示当前 GORM 查询上下文；参数 events 表示事件模型列表。
func toEventResponses(db *gorm.DB, events []bizevent.Event) ([]bizevent.EventResponse, error) {
	if len(events) == 0 {
		return []bizevent.EventResponse{}, nil
	}

	eventIDs := make([]uint64, 0, len(events))
	for _, item := range events {
		eventIDs = append(eventIDs, item.ID)
	}
	participantMap, err := loadParticipantsByEventIDs(db, eventIDs)
	if err != nil {
		return nil, err
	}

	responses := make([]bizevent.EventResponse, 0, len(events))
	for _, item := range events {
		responses = append(responses, toEventResponse(item, participantMap[item.ID]))
	}
	return responses, nil
}

// loadParticipantsByEventIDs 批量查询事件参与者摘要。
// 参数 db 表示当前 GORM 查询上下文；参数 eventIDs 表示事件 ID 列表。
func loadParticipantsByEventIDs(db *gorm.DB, eventIDs []uint64) (map[uint64][]bizevent.ParticipantResponse, error) {
	participantMap := make(map[uint64][]bizevent.ParticipantResponse, len(eventIDs))
	var participants []bizevent.Participant
	if err := db.
		Preload("Character").
		Where("event_id IN ?", eventIDs).
		Order("event_id ASC, id ASC").
		Find(&participants).Error; err != nil {
		return nil, fmt.Errorf("查询事件参与者失败: %w", err)
	}

	for _, participant := range participants {
		participantMap[participant.EventID] = append(participantMap[participant.EventID], bizevent.ParticipantResponse{
			ID:      participant.Character.ID,
			NovelID: participant.Character.NovelID,
			Name:    participant.Character.Name,
			Gender:  participant.Character.Gender,
			Tags:    participant.Character.Tags,
		})
	}
	return participantMap, nil
}

// toEventResponse 将事件模型转换为响应数据。
// 参数 item 表示事件数据库模型；参数 participants 表示事件参与者摘要列表。
func toEventResponse(item bizevent.Event, participants []bizevent.ParticipantResponse) bizevent.EventResponse {
	if participants == nil {
		participants = []bizevent.ParticipantResponse{}
	}
	return bizevent.EventResponse{
		ID:           item.ID,
		NovelID:      item.NovelID,
		Name:         item.Name,
		Cause:        item.Cause,
		Process:      item.Process,
		Result:       item.Result,
		Impact:       item.Impact,
		Location:     item.Location,
		PositionX:    item.PositionX,
		PositionY:    item.PositionY,
		Participants: participants,
		CreatedAt:    item.CreatedAt,
		UpdatedAt:    item.UpdatedAt,
	}
}

// toRelationResponses 将事件关系线模型列表转换为响应列表。
// 参数 relations 表示事件关系线模型列表。
func toRelationResponses(relations []bizevent.Relation) []bizevent.RelationResponse {
	items := make([]bizevent.RelationResponse, 0, len(relations))
	for _, relation := range relations {
		items = append(items, toRelationResponse(relation))
	}
	return items
}

// toRelationResponse 将事件关系线模型转换为响应数据。
// 参数 relation 表示事件关系线模型。
func toRelationResponse(relation bizevent.Relation) bizevent.RelationResponse {
	return bizevent.RelationResponse{
		ID:            relation.ID,
		SourceEventID: relation.SourceEventID,
		TargetEventID: relation.TargetEventID,
		Note:          relation.Note,
		CreatedAt:     relation.CreatedAt,
		UpdatedAt:     relation.UpdatedAt,
	}
}

// layoutEventIDs 提取布局请求中的事件 ID 列表。
// 参数 nodes 表示需要保存坐标的事件节点列表。
func layoutEventIDs(nodes []bizevent.LayoutNodeRequest) []uint64 {
	eventIDs := make([]uint64, 0, len(nodes))
	for _, node := range nodes {
		eventIDs = append(eventIDs, node.EventID)
	}
	return eventIDs
}

// dedupePositiveIDs 去重正整数 ID 列表并保持首次出现顺序。
// 参数 ids 表示待去重的 ID 列表。
func dedupePositiveIDs(ids []uint64) []uint64 {
	seen := make(map[uint64]bool, len(ids))
	items := make([]uint64, 0, len(ids))
	for _, id := range ids {
		if id == 0 || seen[id] {
			continue
		}
		seen[id] = true
		items = append(items, id)
	}
	return items
}
