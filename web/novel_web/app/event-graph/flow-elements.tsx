import {
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  Position,
  getSmoothStepPath,
  type EdgeProps,
  type NodeProps,
} from "@xyflow/react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { normalizeText } from "../novel-utils";
import type { EventGraphEdge, EventGraphNode } from "./types";

export const eventNodeTypes = {
  event: EventNode,
};

export const eventEdgeTypes = {
  eventRelation: EventRelationEdge,
};

// EventNode 渲染画布中的单个事件节点。
// 参数 props 表示 React Flow 注入的节点属性。
function EventNode(props: NodeProps<EventGraphNode>) {
  const event = props.data.event;

  // handleEdit 处理事件节点编辑按钮点击。
  // 参数 clickEvent 表示按钮点击事件。
  function handleEdit(clickEvent: ReactMouseEvent<HTMLButtonElement>) {
    clickEvent.stopPropagation();
    props.data.onEdit(event.id);
  }

  // handleDelete 处理事件节点删除按钮点击。
  // 参数 clickEvent 表示按钮点击事件。
  function handleDelete(clickEvent: ReactMouseEvent<HTMLButtonElement>) {
    clickEvent.stopPropagation();
    props.data.onDelete(event.id);
  }

  return (
    <div className="event-node">
      <Handle
        className="event-node-handle"
        position={Position.Left}
        type="target"
      />
      <div className="event-node-main">
        <strong>{event.name}</strong>
      </div>
      <div className="event-node-actions nodrag">
        <button type="button" title="编辑事件" onClick={handleEdit}>
          编辑
        </button>
      </div>
      <button
        type="button"
        className="event-node-delete nodrag"
        title="删除事件"
        onClick={handleDelete}
      >
        ×
      </button>
      <Handle
        className="event-node-handle"
        position={Position.Right}
        type="source"
      />
    </div>
  );
}

// EventRelationEdge 渲染事件关系线和备注标签。
// 参数 props 表示 React Flow 注入的关系线属性。
function EventRelationEdge(props: EdgeProps<EventGraphEdge>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });
  const note = normalizeText(props.data?.note) || "添加备注";

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
        id={props.id}
        markerEnd={props.markerEnd}
        path={edgePath}
        style={props.style}
      />
      <EdgeLabelRenderer>
        <div
          className="event-edge-label nodrag nopan"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          <button type="button" onClick={handleEdit}>
            {note}
          </button>
          <button
            type="button"
            className="event-edge-delete"
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
