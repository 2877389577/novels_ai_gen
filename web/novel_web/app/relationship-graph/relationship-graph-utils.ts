import type { Viewport } from "@xyflow/react";

import type {
  CharacterSummaryItem,
  RelationshipGraphData,
  RelationshipGraphEdgeItem,
  RelationshipGraphNodeItem,
  RelationshipGraphSaveParams,
} from "../api";
import { formatUpdatedText, normalizeText } from "../novel-utils";
import type {
  CharacterGraphNode,
  RelationshipGraphEdge,
  RelationshipSaveState,
} from "./types";

const relationshipHandleLeftId = "left";
const relationshipHandleRightId = "right";

// createFlowNodes 将后端节点快照转换成 React Flow 节点。
// 参数 graphNodes 表示后端返回的关系图节点；参数 characterMap 表示角色卡 ID 到摘要的映射；参数 portraitURLs 表示角色卡 ID 到肖像预览地址的映射；参数 onDelete 表示节点删除回调。
export function createFlowNodes(
  graphNodes: RelationshipGraphNodeItem[],
  characterMap: Map<number, CharacterSummaryItem>,
  portraitURLs: Record<number, string>,
  onDelete: (characterId: number) => void,
): CharacterGraphNode[] {
  return graphNodes.flatMap(function createFlowNodeFromGraphNode(graphNode) {
    const character = characterMap.get(graphNode.character_id);
    if (!character) {
      return [];
    }

    return [
      createFlowNode(
        character,
        portraitURLs[character.id] ?? "",
        graphNode.position_x,
        graphNode.position_y,
        onDelete,
      ),
    ];
  });
}

// createFlowNode 创建单个 React Flow 角色节点。
// 参数 character 表示节点引用的角色卡摘要；参数 portraitURL 表示肖像预览地址；参数 positionX 表示节点 X 坐标；参数 positionY 表示节点 Y 坐标；参数 onDelete 表示节点删除回调。
export function createFlowNode(
  character: CharacterSummaryItem,
  portraitURL: string,
  positionX: number,
  positionY: number,
  onDelete: (characterId: number) => void,
): CharacterGraphNode {
  return {
    id: nodeIDFromCharacterID(character.id),
    type: "character",
    position: {
      x: positionX,
      y: positionY,
    },
    data: {
      character,
      portraitURL,
      onDelete,
    },
  };
}

// createFlowEdges 将后端关系线快照转换成 React Flow 关系线。
// 参数 graphEdges 表示后端返回的关系线；参数 onEdit 表示编辑备注回调；参数 onDelete 表示删除关系线回调。
export function createFlowEdges(
  graphEdges: RelationshipGraphEdgeItem[],
  onEdit: (edgeId: string) => void,
  onDelete: (edgeId: string) => void,
): RelationshipGraphEdge[] {
  return graphEdges.map((edge) => createFlowEdge(edge, onEdit, onDelete));
}

// createFlowEdge 创建单条 React Flow 关系线。
// 参数 edge 表示后端关系线数据；参数 onEdit 表示编辑备注回调；参数 onDelete 表示删除关系线回调；参数 sourceNodeId 表示关系线起点节点 ID；参数 targetNodeId 表示关系线终点节点 ID；参数 sourceHandleId 表示关系线起点连接点 ID；参数 targetHandleId 表示关系线终点连接点 ID。
export function createFlowEdge(
  edge: RelationshipGraphEdgeItem,
  onEdit: (edgeId: string) => void,
  onDelete: (edgeId: string) => void,
  sourceNodeId = nodeIDFromCharacterID(edge.character_a_id),
  targetNodeId = nodeIDFromCharacterID(edge.character_b_id),
  sourceHandleId: string | null = edge.source_handle ??
    relationshipHandleRightId,
  targetHandleId: string | null = edge.target_handle ??
    relationshipHandleLeftId,
): RelationshipGraphEdge {
  const [characterAId, characterBId] = normalizeRelationshipPair(
    edge.character_a_id,
    edge.character_b_id,
  );
  return {
    id: relationshipEdgeID(characterAId, characterBId),
    source: sourceNodeId,
    sourceHandle: normalizeRelationshipHandleID(
      sourceHandleId,
      relationshipHandleRightId,
    ),
    target: targetNodeId,
    targetHandle: normalizeRelationshipHandleID(
      targetHandleId,
      relationshipHandleLeftId,
    ),
    type: "relationship",
    data: {
      characterAId,
      characterBId,
      note: normalizeText(edge.note),
      onEdit,
      onDelete,
    },
  };
}

// normalizeRelationshipHandleID 归一化关系图连接点 ID，避免 React Flow 找不到指定连接点。
// 参数 handleId 表示 React Flow 传入的连接点 ID；参数 fallback 表示缺省时使用的连接点 ID。
export function normalizeRelationshipHandleID(
  handleId: string | null,
  fallback: string,
): string {
  return handleId === relationshipHandleLeftId ||
    handleId === relationshipHandleRightId
    ? handleId
    : fallback;
}

// createDisplayRelationshipEdges 根据当前选中角色生成仅用于画布展示的关系线。
// 参数 edges 表示基础关系线列表；参数 selectedCharacterId 表示当前点选的角色卡 ID，未选中时为空。
export function createDisplayRelationshipEdges(
  edges: RelationshipGraphEdge[],
  selectedCharacterId: number | null,
): RelationshipGraphEdge[] {
  if (!selectedCharacterId) {
    return edges;
  }

  return edges.map(function markRelationshipEdge(edge) {
    if (!edge.data) {
      return edge;
    }

    const isHighlighted = relationshipEdgeIncludesCharacter(
      edge,
      selectedCharacterId,
    );
    return {
      ...edge,
      data: {
        ...edge.data,
        isHighlighted,
        isDimmed: !isHighlighted,
      },
    };
  });
}

// relationshipEdgeIncludesCharacter 判断关系线是否连接指定角色卡。
// 参数 edge 表示需要判断的关系线；参数 characterId 表示当前点选的角色卡 ID。
export function relationshipEdgeIncludesCharacter(
  edge: RelationshipGraphEdge,
  characterId: number,
): boolean {
  return (
    edge.data?.characterAId === characterId ||
    edge.data?.characterBId === characterId ||
    characterIDFromNodeID(edge.source) === characterId ||
    characterIDFromNodeID(edge.target) === characterId
  );
}

// buildGraphSnapshot 将 React Flow 状态转换成后端保存快照。
// 参数 nodes 表示当前画布节点；参数 edges 表示当前关系线；参数 viewport 表示当前画布视口。
export function buildGraphSnapshot(
  nodes: CharacterGraphNode[],
  edges: RelationshipGraphEdge[],
  viewport: Viewport,
): RelationshipGraphSaveParams {
  return {
    viewport: {
      x: safeNumber(viewport.x),
      y: safeNumber(viewport.y),
      zoom: safeNumber(viewport.zoom) || 1,
    },
    nodes: nodes.map(function toGraphNode(node) {
      return {
        character_id: node.data.character.id,
        position_x: safeNumber(node.position.x),
        position_y: safeNumber(node.position.y),
      };
    }),
    edges: edges.map(function toGraphEdge(edge) {
      const sourceCharacterId = characterIDFromNodeID(edge.source) ?? 0;
      const targetCharacterId = characterIDFromNodeID(edge.target) ?? 0;
      const [characterAId, characterBId] = normalizeRelationshipPair(
        edge.data?.characterAId ?? sourceCharacterId,
        edge.data?.characterBId ?? targetCharacterId,
      );
      const characterAHandleId =
        sourceCharacterId === characterAId
          ? edge.sourceHandle
          : edge.targetHandle;
      const characterBHandleId =
        sourceCharacterId === characterBId
          ? edge.sourceHandle
          : edge.targetHandle;
      return {
        id: relationshipEdgeID(characterAId, characterBId),
        character_a_id: characterAId,
        character_b_id: characterBId,
        source_handle: normalizeRelationshipHandleID(
          characterAHandleId ?? null,
          relationshipHandleRightId,
        ),
        target_handle: normalizeRelationshipHandleID(
          characterBHandleId ?? null,
          relationshipHandleLeftId,
        ),
        note: normalizeText(edge.data?.note),
      };
    }),
  };
}

// normalizeGraphViewport 标准化后端返回的画布视口。
// 参数 graph 表示后端返回的关系图快照。
export function normalizeGraphViewport(graph: RelationshipGraphData): Viewport {
  return {
    x: safeNumber(graph.viewport?.x),
    y: safeNumber(graph.viewport?.y),
    zoom: safeNumber(graph.viewport?.zoom) || 1,
  };
}

// safeNumber 将未知数值标准化为有限数字。
// 参数 value 表示需要标准化的数值。
export function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// nodeIDFromCharacterID 根据角色卡 ID 生成 React Flow 节点 ID。
// 参数 characterId 表示角色卡 ID。
export function nodeIDFromCharacterID(characterId: number): string {
  return `character-${characterId}`;
}

// characterIDFromNodeID 从 React Flow 节点 ID 中解析角色卡 ID。
// 参数 nodeId 表示 React Flow 节点 ID。
export function characterIDFromNodeID(
  nodeId: string | null | undefined,
): number | null {
  if (!nodeId?.startsWith("character-")) {
    return null;
  }

  const value = Number(nodeId.slice("character-".length));
  return Number.isInteger(value) && value > 0 ? value : null;
}

// normalizeRelationshipPair 将无方向关系线两端角色 ID 归一为从小到大。
// 参数 characterAId 表示关系线一端角色卡 ID；参数 characterBId 表示关系线另一端角色卡 ID。
export function normalizeRelationshipPair(
  characterAId: number,
  characterBId: number,
): [number, number] {
  return characterAId <= characterBId
    ? [characterAId, characterBId]
    : [characterBId, characterAId];
}

// relationshipEdgeID 根据无方向角色对生成稳定关系线 ID。
// 参数 characterAId 表示关系线一端角色卡 ID；参数 characterBId 表示关系线另一端角色卡 ID。
export function relationshipEdgeID(
  characterAId: number,
  characterBId: number,
): string {
  const [a, b] = normalizeRelationshipPair(characterAId, characterBId);
  return `rel-${a}-${b}`;
}

// getSaveStatusText 获取关系图保存状态展示文案。
// 参数 state 表示当前实时保存状态。
export function getSaveStatusText(state: RelationshipSaveState): string {
  switch (state) {
    case "pending":
      return "等待保存";
    case "saving":
      return "保存中...";
    case "saved":
      return "已保存";
    case "error":
      return "保存失败";
    default:
      return "尚未保存";
  }
}

// formatGraphUpdatedText 格式化关系图更新时间。
// 参数 updatedAt 表示后端返回的关系图更新时间。
export function formatGraphUpdatedText(updatedAt: string | null): string {
  return updatedAt ? formatUpdatedText(updatedAt) : "暂无保存记录";
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
