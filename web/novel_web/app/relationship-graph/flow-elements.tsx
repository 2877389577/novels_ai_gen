import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getBezierPath,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { getCoverInitial, normalizeText, splitNovelTags } from "../novel-utils";
import type { CharacterGraphNode, RelationshipGraphEdge } from "./types";

const relationshipHandleLeftId = "left";
const relationshipHandleRightId = "right";

export const relationshipNodeTypes = {
  character: CharacterRelationshipNode,
};

export const relationshipEdgeTypes = {
  relationship: RelationshipNoteEdge,
};

// CharacterRelationshipNode 渲染画布中的单个角色节点。
// 参数 props 表示 React Flow 注入的节点属性。
function CharacterRelationshipNode(props: NodeProps<CharacterGraphNode>) {
  const character = props.data.character;
  const tags = splitNovelTags(character.tags, 2);

  // handleDelete 处理节点删除按钮点击。
  // 参数 event 表示按钮点击事件。
  function handleDelete(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    props.data.onDelete(character.id);
  }

  return (
    <div className="relationship-node">
      <Handle
        className="relationship-node-handle relationship-node-handle-left"
        id={relationshipHandleLeftId}
        position={Position.Left}
        type="source"
      />
      <div className="relationship-node-avatar">
        {props.data.portraitURL ? (
          <img src={props.data.portraitURL} alt={`${character.name}肖像`} />
        ) : (
          <span>{getCoverInitial(character.name)}</span>
        )}
      </div>
      <div className="relationship-node-body">
        <strong>{character.name}</strong>
        <div className="relationship-node-tags" aria-label="角色标签">
          {tags.length > 0 ? (
            tags.map((tag) => <span key={tag}>{tag}</span>)
          ) : (
            <span>未设标签</span>
          )}
        </div>
      </div>
      <button
        type="button"
        className="relationship-node-delete nodrag"
        title="删除画布角色"
        onClick={handleDelete}
      >
        ×
      </button>
      <Handle
        className="relationship-node-handle relationship-node-handle-right"
        id={relationshipHandleRightId}
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

// RelationshipNoteEdge 渲染画布中的关系线和备注标签。
// 参数 props 表示 React Flow 注入的关系线属性。
function RelationshipNoteEdge(props: EdgeProps<RelationshipGraphEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
    curvature: 0.38,
  });
  const note = normalizeText(props.data?.note) || "添加关系备注";
  const isHighlighted = props.data?.isHighlighted === true;
  const isDimmed = props.data?.isDimmed === true;
  const edgeClassName = isHighlighted
    ? "relationship-edge-path relationship-edge-path-highlighted"
    : isDimmed
      ? "relationship-edge-path relationship-edge-path-dimmed"
      : "relationship-edge-path";
  const labelClassName = isHighlighted
    ? "relationship-edge-label relationship-edge-label-highlighted nodrag nopan"
    : isDimmed
      ? "relationship-edge-label relationship-edge-label-dimmed nodrag nopan"
      : "relationship-edge-label nodrag nopan";

  // handleEdit 处理关系线备注标签点击。
  // 参数 event 表示按钮点击事件。
  function handleEdit(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    props.data?.onEdit(props.id);
  }

  // handleDelete 处理关系线删除按钮点击。
  // 参数 event 表示按钮点击事件。
  function handleDelete(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    props.data?.onDelete(props.id);
  }

  return (
    <>
      <BaseEdge
        className={edgeClassName}
        id={props.id}
        markerEnd={props.markerEnd}
        path={edgePath}
        style={props.style}
      />
      <EdgeLabelRenderer>
        <div
          className={labelClassName}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <button type="button" onClick={handleEdit}>
            {note}
          </button>
          <button
            type="button"
            className="relationship-edge-delete"
            title="删除关系线"
            onClick={handleDelete}
          >
            ×
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
