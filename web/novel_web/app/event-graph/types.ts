import type { Edge, Node } from "@xyflow/react";

import type { EventCreateParams, NovelEventItem, NovelItem } from "../api";

// EventNodeData 表示 React Flow 事件节点携带的数据。
export interface EventNodeData extends Record<string, unknown> {
  // event 表示该节点对应的小说事件。
  event: NovelEventItem;
  // onView 表示请求查看事件详情时执行的回调。
  onView: (eventId: number) => void;
  // onEdit 表示请求编辑事件时执行的回调。
  onEdit: (eventId: number) => void;
  // onDelete 表示请求删除事件时执行的回调。
  onDelete: (eventId: number) => void;
}

// EventEdgeData 表示 React Flow 事件关系线携带的数据。
export interface EventEdgeData extends Record<string, unknown> {
  // relationId 表示后端事件关系线主键 ID。
  relationId: number;
  // sourceEventId 表示前置事件 ID。
  sourceEventId: number;
  // targetEventId 表示后续事件 ID。
  targetEventId: number;
  // note 表示关系线备注。
  note: string;
  // onEdit 表示请求编辑关系线备注时执行的回调。
  onEdit: (edgeId: string) => void;
  // onDelete 表示请求删除关系线时执行的回调。
  onDelete: (edgeId: string) => void;
}

// EventGraphNode 表示 React Flow 中的事件节点类型。
export type EventGraphNode = Node<EventNodeData, "event">;

// EventGraphEdge 表示 React Flow 中的事件关系线类型。
export type EventGraphEdge = Edge<EventEdgeData, "eventRelation">;

// EventLoadState 表示事件图页面加载状态。
export type EventLoadState = "loading" | "ready" | "error";

// EventSaveState 表示事件图布局保存状态。
export type EventSaveState = "idle" | "pending" | "saving" | "saved" | "error";

// EventDrawerMode 表示右侧事件抽屉当前模式。
export type EventDrawerMode = "create" | "view" | "edit";

// EventFormValues 表示事件抽屉表单字段。
export interface EventFormValues {
  // name 表示事件名称。
  name: string;
  // location 表示事件地点。
  location: string;
  // cause 表示事件起因。
  cause: string;
  // process 表示事件经过。
  process: string;
  // result 表示事件结果。
  result: string;
  // impact 表示事件造成的影响。
  impact: string;
  // participant_ids 表示参与事件的角色卡 ID 列表。
  participant_ids: number[];
}

// EventDrawerState 表示右侧事件抽屉展示状态。
export interface EventDrawerState {
  // mode 表示抽屉当前模式。
  mode: EventDrawerMode;
  // eventId 表示正在查看或编辑的事件 ID。
  eventId: number | null;
}

// EventGraphPanelProps 表示事件图面板需要的外部数据。
export interface EventGraphPanelProps {
  // novel 表示当前事件图所属的小说。
  novel: NovelItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}
