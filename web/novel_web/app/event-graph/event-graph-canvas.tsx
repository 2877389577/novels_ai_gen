import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import {
  Background,
  Controls,
  ReactFlow,
  type EdgeChange,
  type NodeChange,
  type OnConnect,
  type Viewport,
} from "@xyflow/react";
import type { ChangeEvent } from "react";

import type {
  EventGraphEdge,
  EventGraphNode,
  EventSaveState,
} from "./types";
import { formatGraphUpdatedText, getSaveStatusText } from "./event-graph-utils";
import { eventEdgeTypes, eventNodeTypes } from "./flow-elements";

// EventGraphCanvasProps 表示事件图画布框架需要的状态和动作。
interface EventGraphCanvasProps {
  // nodes 表示 React Flow 当前渲染的事件节点列表。
  nodes: EventGraphNode[];
  // edges 表示 React Flow 当前渲染的事件关系线列表。
  edges: EventGraphEdge[];
  // saveState 表示事件图布局保存状态。
  saveState: EventSaveState;
  // saveMessage 表示布局保存失败时展示的错误说明。
  saveMessage: string;
  // eventCountText 表示当前事件数量展示文本。
  eventCountText: string;
  // graphUpdatedAt 表示事件图最近更新时间。
  graphUpdatedAt: string | null;
  // onRetrySave 表示用户点击重试保存时执行的动作。
  onRetrySave: () => void;
  // onOpenCreate 表示用户点击新增事件时执行的动作。
  onOpenCreate: () => void;
  // onConnect 表示用户在画布中连接两个事件节点时执行的动作。
  onConnect: OnConnect;
  // onEdgesChange 表示 React Flow 关系线变化时执行的动作。
  onEdgesChange: (changes: EdgeChange<EventGraphEdge>[]) => void;
  // onMoveEnd 表示画布视口移动或缩放结束时执行的动作。
  onMoveEnd: (event: MouseEvent | TouchEvent | null, viewport: Viewport) => void;
  // onNodeDragStop 表示事件节点拖动结束时执行的动作。
  onNodeDragStop: (
    event: MouseEvent | TouchEvent,
    node: EventGraphNode,
    nodes: EventGraphNode[],
  ) => void;
  // onNodesChange 表示 React Flow 节点变化时执行的动作。
  onNodesChange: (changes: NodeChange<EventGraphNode>[]) => void;
}

// EventGraphErrorProps 表示事件图错误态需要的展示内容和动作。
interface EventGraphErrorProps {
  // message 表示错误态展示的说明文本。
  message: string;
  // onRetry 表示用户点击重新加载时执行的动作。
  onRetry: () => void;
}

// EventRelationNoteModalProps 表示事件关系备注弹窗需要的状态和动作。
interface EventRelationNoteModalProps {
  // visible 表示备注弹窗是否展示。
  visible: boolean;
  // noteDraft 表示当前编辑中的关系备注草稿。
  noteDraft: string;
  // onNoteDraftChange 表示备注草稿变化时执行的动作。
  onNoteDraftChange: (value: string) => void;
  // onCancel 表示用户取消编辑备注时执行的动作。
  onCancel: () => void;
  // onSave 表示用户保存备注时执行的动作。
  onSave: () => void;
}

// EventGraphCanvas 渲染事件图画布、工具条和 React Flow 视图。
// 参数 props 表示画布需要的状态和动作。
export function EventGraphCanvas(props: EventGraphCanvasProps) {
  return (
    <div className="event-graph-workspace">
      <div className="event-canvas-shell">
        <EventGraphCanvasToolbar
          eventCountText={props.eventCountText}
          graphUpdatedAt={props.graphUpdatedAt}
          saveMessage={props.saveMessage}
          saveState={props.saveState}
          onOpenCreate={props.onOpenCreate}
          onRetrySave={props.onRetrySave}
        />

        <div className="event-flow-wrap">
          <ReactFlow<EventGraphNode, EventGraphEdge>
            className="event-flow"
            deleteKeyCode={null}
            edges={props.edges}
            edgeTypes={eventEdgeTypes}
            fitView={props.nodes.length > 0}
            maxZoom={1.8}
            minZoom={0.25}
            nodes={props.nodes}
            nodeTypes={eventNodeTypes}
            onConnect={props.onConnect}
            onEdgesChange={props.onEdgesChange}
            onMoveEnd={props.onMoveEnd}
            onNodeDragStop={props.onNodeDragStop}
            onNodesChange={props.onNodesChange}
            panOnScroll
            proOptions={{ hideAttribution: true }}
          >
            <Background color="rgba(91, 78, 68, 0.22)" gap={28} />
            <Controls position="bottom-right" showInteractive={false} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

// EventGraphSkeleton 渲染事件图加载态。
export function EventGraphSkeleton() {
  return (
    <div className="event-graph-skeleton" aria-label="事件图加载中">
      <div />
    </div>
  );
}

// EventGraphError 渲染事件图加载失败状态。
// 参数 props 表示错误态展示内容和重试动作。
export function EventGraphError(props: EventGraphErrorProps) {
  return (
    <div className="character-card-error" role="alert">
      <p>{props.message}</p>
      <button type="button" onClick={props.onRetry}>
        重新加载
      </button>
    </div>
  );
}

// EventRelationNoteModal 渲染事件关系备注编辑弹窗。
// 参数 props 表示备注弹窗需要的状态和动作。
export function EventRelationNoteModal(props: EventRelationNoteModalProps) {
  // handleNoteDraftChange 同步备注输入框内容。
  // 参数 event 表示备注输入框变化事件。
  function handleNoteDraftChange(event: ChangeEvent<HTMLTextAreaElement>) {
    props.onNoteDraftChange(event.target.value);
  }

  return (
    <Modal
      className="relationship-note-modal"
      title="事件关系备注"
      visible={props.visible}
      width={460}
      okText="保存备注"
      cancelText="取消"
      onCancel={props.onCancel}
      onOk={props.onSave}
    >
      <label className="relationship-note-field">
        <span>备注</span>
        <textarea
          value={props.noteDraft}
          rows={5}
          placeholder="例如：直接导致、伏笔回收、后续影响"
          onChange={handleNoteDraftChange}
        />
      </label>
    </Modal>
  );
}

// EventGraphCanvasToolbar 渲染事件图保存状态和主操作按钮。
// 参数 props 表示工具条需要的状态和动作。
function EventGraphCanvasToolbar(
  props: Pick<
    EventGraphCanvasProps,
    | "eventCountText"
    | "graphUpdatedAt"
    | "onOpenCreate"
    | "onRetrySave"
    | "saveMessage"
    | "saveState"
  >,
) {
  return (
    <div className="event-canvas-toolbar">
      <div>
        <strong>{getSaveStatusText(props.saveState)}</strong>
        <span>
          {props.saveState === "error"
            ? props.saveMessage
            : `${props.eventCountText} · ${formatGraphUpdatedText(props.graphUpdatedAt)}`}
        </span>
      </div>
      <div className="event-canvas-actions">
        {props.saveState === "error" ? (
          <button type="button" onClick={props.onRetrySave}>
            重试保存
          </button>
        ) : null}
        <button type="button" onClick={props.onOpenCreate}>
          ＋ 新增事件
        </button>
      </div>
    </div>
  );
}
