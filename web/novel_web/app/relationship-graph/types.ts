import type { Edge, Node } from "@xyflow/react";

import type { CharacterSummaryItem, NovelItem } from "../api";

// CharacterNodeData 表示 React Flow 角色节点携带的数据。
export interface CharacterNodeData extends Record<string, unknown> {
  // character 表示该画布节点引用的角色卡摘要。
  character: CharacterSummaryItem;
  // portraitURL 表示角色肖像可预览地址，可能是普通 URL 或私有图片预签名 URL。
  portraitURL: string;
  // onDelete 表示请求删除画布节点时执行的回调。
  onDelete: (characterId: number) => void;
}

// RelationshipEdgeData 表示 React Flow 关系线携带的数据。
export interface RelationshipEdgeData extends Record<string, unknown> {
  // characterAId 表示无方向关系线中较小的角色卡 ID。
  characterAId: number;
  // characterBId 表示无方向关系线中较大的角色卡 ID。
  characterBId: number;
  // note 表示关系线备注。
  note: string;
  // isHighlighted 表示关系线是否连接当前选中的角色卡。
  isHighlighted?: boolean;
  // isDimmed 表示已有角色选中时，关系线是否需要弱化显示。
  isDimmed?: boolean;
  // onEdit 表示请求编辑关系线备注时执行的回调。
  onEdit: (edgeId: string) => void;
  // onDelete 表示请求删除关系线时执行的回调。
  onDelete: (edgeId: string) => void;
}

// CharacterGraphNode 表示 React Flow 中的角色节点类型。
export type CharacterGraphNode = Node<CharacterNodeData, "character">;

// RelationshipGraphEdge 表示 React Flow 中的关系线类型。
export type RelationshipGraphEdge = Edge<RelationshipEdgeData, "relationship">;

// RelationshipLoadState 表示角色关系图页面加载状态。
export type RelationshipLoadState = "loading" | "ready" | "error";

// RelationshipSaveState 表示角色关系图实时保存状态。
export type RelationshipSaveState =
  | "idle"
  | "pending"
  | "saving"
  | "saved"
  | "error";

// RelationshipGraphPanelProps 表示角色关系图面板需要的外部数据。
export interface RelationshipGraphPanelProps {
  // novel 表示当前关系图所属的小说。
  novel: NovelItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}
