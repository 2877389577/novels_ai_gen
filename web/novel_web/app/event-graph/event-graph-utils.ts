import { MarkerType, type Viewport } from "@xyflow/react";

import type {
  CharacterSummaryItem,
  EventCreateParams,
  EventLayoutParams,
  EventRelationItem,
  NovelEventItem,
} from "../api";
import {
  UnauthorizedError,
  fetchCharacterList,
  refreshImagePreview,
} from "../api";
import {
  formatUpdatedText,
  isPrivateObjectKey,
  normalizeText,
} from "../novel-utils";
import type {
  EventFormValues,
  EventGraphEdge,
  EventGraphNode,
  EventSaveState,
} from "./types";

const eventCharacterPageSize = 100;

// createFlowNodes 将后端事件节点转换成 React Flow 节点。
// 参数 graphNodes 表示后端返回的事件节点；参数 onView 表示查看事件回调；参数 onEdit 表示编辑事件回调；参数 onDelete 表示删除事件回调。
export function createFlowNodes(
  graphNodes: NovelEventItem[],
  onView: (eventId: number) => void,
  onEdit: (eventId: number) => void,
  onDelete: (eventId: number) => void,
): EventGraphNode[] {
  return graphNodes.map((event) =>
    createFlowNode(
      event,
      event.position_x,
      event.position_y,
      onView,
      onEdit,
      onDelete,
    ),
  );
}

// fetchAllEventCharacters 分页拉取指定小说的全部角色卡摘要。
// 参数 novelId 表示小说主键 ID；参数 signal 表示请求取消信号。
export async function fetchAllEventCharacters(
  novelId: number,
  signal?: AbortSignal,
): Promise<CharacterSummaryItem[]> {
  const items: CharacterSummaryItem[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (items.length < total) {
    const data = await fetchCharacterList(novelId, {
      page,
      pageSize: eventCharacterPageSize,
      signal,
    });
    items.push(...data.items);
    total = data.total;
    if (data.items.length === 0) {
      break;
    }
    page += 1;
  }

  return items;
}

// resolveEventCharacterPortraitURLs 解析角色肖像的实际可预览地址。
// 参数 characters 表示需要解析肖像的角色卡列表；参数 signal 表示请求取消信号。
export async function resolveEventCharacterPortraitURLs(
  characters: CharacterSummaryItem[],
  signal?: AbortSignal,
): Promise<Record<number, string>> {
  const entries = await Promise.all(
    characters.map(async function resolveCharacterPortrait(character) {
      const portraitValue = normalizeText(character.portrait_url);
      if (!portraitValue) {
        return [character.id, ""] as const;
      }
      if (!isPrivateObjectKey(portraitValue)) {
        return [character.id, portraitValue] as const;
      }

      try {
        const preview = await refreshImagePreview(portraitValue, signal);
        return [character.id, preview.preview_url] as const;
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          throw error;
        }
        return [character.id, ""] as const;
      }
    }),
  );

  return Object.fromEntries(entries);
}

// createFlowNode 创建单个 React Flow 事件节点。
// 参数 event 表示节点对应的事件；参数 positionX 表示节点 X 坐标；参数 positionY 表示节点 Y 坐标；参数 onView 表示查看事件回调；参数 onEdit 表示编辑事件回调；参数 onDelete 表示删除事件回调。
export function createFlowNode(
  event: NovelEventItem,
  positionX: number,
  positionY: number,
  onView: (eventId: number) => void,
  onEdit: (eventId: number) => void,
  onDelete: (eventId: number) => void,
): EventGraphNode {
  return {
    id: nodeIDFromEventID(event.id),
    type: "event",
    position: {
      x: safeNumber(positionX),
      y: safeNumber(positionY),
    },
    data: {
      event,
      onView,
      onEdit,
      onDelete,
    },
  };
}

// createFlowEdges 将后端事件关系线转换成 React Flow 关系线。
// 参数 relations 表示后端返回的事件关系线；参数 onEdit 表示编辑备注回调；参数 onDelete 表示删除关系线回调。
export function createFlowEdges(
  relations: EventRelationItem[],
  onEdit: (edgeId: string) => void,
  onDelete: (edgeId: string) => void,
): EventGraphEdge[] {
  return relations.map((relation) =>
    createFlowEdge(relation, onEdit, onDelete),
  );
}

// createFlowEdge 创建单条 React Flow 事件关系线。
// 参数 relation 表示后端事件关系线数据；参数 onEdit 表示编辑备注回调；参数 onDelete 表示删除关系线回调。
export function createFlowEdge(
  relation: EventRelationItem,
  onEdit: (edgeId: string) => void,
  onDelete: (edgeId: string) => void,
): EventGraphEdge {
  return {
    id: edgeIDFromRelationID(relation.id),
    source: nodeIDFromEventID(relation.source_event_id),
    target: nodeIDFromEventID(relation.target_event_id),
    type: "eventRelation",
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
    data: {
      relationId: relation.id,
      sourceEventId: relation.source_event_id,
      targetEventId: relation.target_event_id,
      note: normalizeText(relation.note),
      onEdit,
      onDelete,
    },
  };
}

// buildLayoutSnapshot 将 React Flow 状态转换成布局保存参数。
// 参数 nodes 表示当前画布事件节点；参数 viewport 表示当前画布视口。
export function buildLayoutSnapshot(
  nodes: EventGraphNode[],
  viewport: Viewport,
): EventLayoutParams {
  return {
    viewport: {
      x: safeNumber(viewport.x),
      y: safeNumber(viewport.y),
      zoom: safeNumber(viewport.zoom) || 1,
    },
    nodes: nodes.map((node) => ({
      event_id: node.data.event.id,
      position_x: safeNumber(node.position.x),
      position_y: safeNumber(node.position.y),
    })),
  };
}

// normalizeGraphViewport 标准化后端返回的事件图视口。
// 参数 viewport 表示后端返回的视口数据。
export function normalizeGraphViewport(viewport: {
  // x 表示画布视口 X 坐标。
  x?: number;
  // y 表示画布视口 Y 坐标。
  y?: number;
  // zoom 表示画布视口缩放比例。
  zoom?: number;
}): Viewport {
  return {
    x: safeNumber(viewport?.x),
    y: safeNumber(viewport?.y),
    zoom: safeNumber(viewport?.zoom) || 1,
  };
}

// createEmptyEventFormValues 创建空白事件表单值。
export function createEmptyEventFormValues(): EventFormValues {
  return {
    name: "",
    location: "",
    cause: "",
    process: "",
    result: "",
    impact: "",
    participant_ids: [],
  };
}

// eventToFormValues 将事件详情转换成表单值。
// 参数 event 表示需要编辑的事件详情。
export function eventToFormValues(event: NovelEventItem): EventFormValues {
  return {
    name: normalizeText(event.name),
    location: normalizeText(event.location),
    cause: normalizeText(event.cause),
    process: normalizeText(event.process),
    result: normalizeText(event.result),
    impact: normalizeText(event.impact),
    participant_ids: event.participants.map((participant) => participant.id),
  };
}

// normalizeEventFormValues 清理事件表单值。
// 参数 values 表示事件表单原始值。
export function normalizeEventFormValues(
  values: EventFormValues,
): EventCreateParams {
  return {
    name: normalizeText(values.name),
    location: normalizeText(values.location),
    cause: normalizeText(values.cause),
    process: normalizeText(values.process),
    result: normalizeText(values.result),
    impact: normalizeText(values.impact),
    participant_ids: values.participant_ids,
    position_x: 0,
    position_y: 0,
  };
}

// safeNumber 将未知数值标准化为有限数字。
// 参数 value 表示需要标准化的数值。
export function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// nodeIDFromEventID 根据事件 ID 生成 React Flow 节点 ID。
// 参数 eventId 表示事件 ID。
export function nodeIDFromEventID(eventId: number): string {
  return `event-${eventId}`;
}

// eventIDFromNodeID 从 React Flow 节点 ID 中解析事件 ID。
// 参数 nodeId 表示 React Flow 节点 ID。
export function eventIDFromNodeID(
  nodeId: string | null | undefined,
): number | null {
  if (!nodeId?.startsWith("event-")) {
    return null;
  }

  const value = Number(nodeId.slice("event-".length));
  return Number.isInteger(value) && value > 0 ? value : null;
}

// edgeIDFromRelationID 根据关系线 ID 生成 React Flow 边 ID。
// 参数 relationId 表示后端事件关系线主键 ID。
export function edgeIDFromRelationID(relationId: number): string {
  return `event-relation-${relationId}`;
}

// getSaveStatusText 获取事件图布局保存状态展示文案。
// 参数 state 表示当前保存状态。
export function getSaveStatusText(state: EventSaveState): string {
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

// formatGraphUpdatedText 格式化事件图更新时间。
// 参数 updatedAt 表示后端返回的事件图更新时间。
export function formatGraphUpdatedText(updatedAt: string | null): string {
  return updatedAt ? formatUpdatedText(updatedAt) : "暂无保存记录";
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
