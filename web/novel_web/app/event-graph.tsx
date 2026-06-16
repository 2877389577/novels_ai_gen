import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  getSmoothStepPath,
  useReactFlow,
  type Edge,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnConnect,
  type Viewport,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  UnauthorizedError,
  createEvent,
  createEventRelation,
  deleteEvent,
  deleteEventRelation,
  fetchCharacterList,
  fetchEventDetail,
  fetchEventGraph,
  refreshImagePreview,
  saveEventGraphLayout,
  updateEvent,
  updateEventRelation,
  type CharacterSummaryItem,
  type EventCreateParams,
  type EventLayoutParams,
  type EventParticipantItem,
  type EventRelationItem,
  type NovelEventItem,
  type NovelItem,
} from "./api";
import {
  formatUpdatedText,
  getCoverInitial,
  isPrivateObjectKey,
  normalizeText,
  splitNovelTags,
} from "./novel-utils";

const eventCharacterPageSize = 100;
const eventLayoutSaveDelayMs = 800;

// EventNodeData 表示 React Flow 事件节点携带的数据。
interface EventNodeData extends Record<string, unknown> {
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
interface EventEdgeData extends Record<string, unknown> {
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
type EventGraphNode = Node<EventNodeData, "event">;

// EventGraphEdge 表示 React Flow 中的事件关系线类型。
type EventGraphEdge = Edge<EventEdgeData, "eventRelation">;

// EventLoadState 表示事件图页面加载状态。
type EventLoadState = "loading" | "ready" | "error";

// EventSaveState 表示事件图布局保存状态。
type EventSaveState = "idle" | "pending" | "saving" | "saved" | "error";

// EventDrawerMode 表示右侧事件抽屉当前模式。
type EventDrawerMode = "create" | "view" | "edit";

// EventFormValues 表示事件抽屉表单字段。
interface EventFormValues {
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
interface EventDrawerState {
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

const eventNodeTypes = {
  event: EventNode,
};

const eventEdgeTypes = {
  eventRelation: EventRelationEdge,
};

// EventGraphPanel 渲染事件管理 Tab。
// 参数 props 表示事件图面板需要的外部数据。
export function EventGraphPanel(props: EventGraphPanelProps) {
  return (
    <ReactFlowProvider>
      <EventGraphPanelInner {...props} />
    </ReactFlowProvider>
  );
}

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
			<Handle className="event-node-handle" position={Position.Left} type="target" />
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
      <Handle className="event-node-handle" position={Position.Right} type="source" />
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

// EventGraphPanelInner 渲染受 React Flow Provider 包裹的事件图内容。
// 参数 props 表示事件图面板需要的外部数据。
function EventGraphPanelInner(props: EventGraphPanelProps) {
  const reactFlow = useReactFlow<EventGraphNode, EventGraphEdge>();
  const reactFlowRef = useRef(reactFlow);
  const saveTimerRef = useRef<number | null>(null);
  const saveVersionRef = useRef(0);
  const latestLayoutRef = useRef<EventLayoutParams | null>(null);
  const nodesRef = useRef<EventGraphNode[]>([]);
  const edgesRef = useRef<EventGraphEdge[]>([]);
  const eventsRef = useRef<NovelEventItem[]>([]);

  const [loadState, setLoadState] = useState<EventLoadState>("loading");
  const [message, setMessage] = useState("");
  const [characters, setCharacters] = useState<CharacterSummaryItem[]>([]);
  const [characterPortraitURLs, setCharacterPortraitURLs] = useState<Record<number, string>>({});
  const [nodes, setNodes] = useState<EventGraphNode[]>([]);
  const [edges, setEdges] = useState<EventGraphEdge[]>([]);
  const [saveState, setSaveState] = useState<EventSaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [graphUpdatedAt, setGraphUpdatedAt] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<EventDrawerState | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<NovelEventItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [formValues, setFormValues] = useState<EventFormValues>(createEmptyEventFormValues);
  const [submitting, setSubmitting] = useState(false);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const eventCountText = useMemo(
    function createEventCountText() {
      return `${nodes.length.toLocaleString("zh-CN")} 个事件`;
    },
    [nodes.length],
  );

  // syncReactFlowRef 同步 React Flow 实例到 ref。
  useEffect(
    function syncReactFlowRef() {
      reactFlowRef.current = reactFlow;
    },
    [reactFlow],
  );

  // syncNodeRef 同步最新节点列表到 ref。
  useEffect(
    function syncNodeRef() {
      nodesRef.current = nodes;
      eventsRef.current = nodes.map((node) => node.data.event);
    },
    [nodes],
  );

  // syncEdgeRef 同步最新关系线列表到 ref。
  useEffect(
    function syncEdgeRef() {
      edgesRef.current = edges;
    },
    [edges],
  );

  // cleanupSaveTimer 在组件卸载时清理待执行的保存任务。
  useEffect(function cleanupSaveTimer() {
    return function clearPendingSaveTimer() {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // flushLayoutSave 立即保存最近一次事件图布局。
  const flushLayoutSave = useCallback(
    async function flushLayoutSave() {
      const snapshot = latestLayoutRef.current;
      if (!snapshot) {
        return;
      }

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const version = saveVersionRef.current;
      setSaveState("saving");
      setSaveMessage("");

      try {
        const data = await saveEventGraphLayout(props.novel.id, snapshot);
        if (version !== saveVersionRef.current) {
          return;
        }
        setGraphUpdatedAt(data.updated_at ?? null);
        setSaveState("saved");
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        if (version === saveVersionRef.current) {
          setSaveState("error");
          setSaveMessage(getErrorMessage(error, "事件图布局保存失败，请稍后再试"));
        }
      }
    },
    [props.novel.id, props.onUnauthorized],
  );

  // queueLayoutSave 防抖保存事件图视口和节点坐标。
  // 参数 nextNodes 表示需要保存的节点列表；参数 viewport 表示需要保存的视口状态。
  const queueLayoutSave = useCallback(
    function queueLayoutSave(
      nextNodes = nodesRef.current,
      viewport?: Viewport,
    ) {
      latestLayoutRef.current = buildLayoutSnapshot(
        nextNodes,
        viewport ?? reactFlowRef.current.getViewport(),
      );
      saveVersionRef.current += 1;
      setSaveState("pending");
      setSaveMessage("");

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(function runDebouncedSave() {
        void flushLayoutSave();
      }, eventLayoutSaveDelayMs);
    },
    [flushLayoutSave],
  );

  // handleOpenCreateDrawer 打开新增事件抽屉。
  function handleOpenCreateDrawer() {
    setSelectedEvent(null);
    setFormValues(createEmptyEventFormValues());
    setDrawer({ mode: "create", eventId: null });
  }

  // handleCloseDrawer 关闭事件抽屉。
  function handleCloseDrawer() {
    if (submitting) {
      return;
    }
    setDrawer(null);
    setSelectedEvent(null);
    setDetailLoading(false);
  }

  // handleViewEvent 打开事件详情抽屉。
  // 参数 eventId 表示需要查看的事件 ID。
  const handleViewEvent = useCallback(
    function handleViewEvent(eventId: number) {
      setDrawer({ mode: "view", eventId });
      void loadEventDetail(eventId);
    },
    [],
  );

  // handleEditEvent 打开事件编辑抽屉。
  // 参数 eventId 表示需要编辑的事件 ID。
  const handleEditEvent = useCallback(
    function handleEditEvent(eventId: number) {
      setDrawer({ mode: "edit", eventId });
      void loadEventDetail(eventId, "edit");
    },
    [],
  );

  // loadEventDetail 查询事件详情并同步到抽屉。
  // 参数 eventId 表示需要查询的事件 ID；参数 nextMode 表示加载后需要切换到的抽屉模式。
  async function loadEventDetail(eventId: number, nextMode?: EventDrawerMode) {
    setDetailLoading(true);
    try {
      const data = await fetchEventDetail(props.novel.id, eventId);
      setSelectedEvent(data);
      setFormValues(eventToFormValues(data));
      if (nextMode) {
        setDrawer({ mode: nextMode, eventId });
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "事件详情加载失败，请稍后再试"));
    } finally {
      setDetailLoading(false);
    }
  }

  // handleRequestEventDelete 请求删除事件节点。
  // 参数 eventId 表示需要删除的事件 ID。
  const handleRequestEventDelete = useCallback(
    function handleRequestEventDelete(eventId: number) {
      const event = eventsRef.current.find((item) => item.id === eventId);
      const nodeId = nodeIDFromEventID(eventId);
      const relationCount = edgesRef.current.filter(
        (edge) => edge.source === nodeId || edge.target === nodeId,
      ).length;
      Modal.confirm({
        title: "删除事件",
        content:
          relationCount > 0
            ? `将删除「${event?.name || "该事件"}」，并一并删除 ${relationCount} 条相关关系线。`
            : `确认删除「${event?.name || "该事件"}」？`,
        okText: "确认删除",
        cancelText: "取消",
        onOk: async function confirmDeleteEvent() {
          try {
            const data = await deleteEvent(props.novel.id, eventId);
            const nextNodes = nodesRef.current.filter((node) => node.id !== nodeId);
            const nextEdges = edgesRef.current.filter(
              (edge) => edge.source !== nodeId && edge.target !== nodeId,
            );
            setNodes(nextNodes);
            setEdges(nextEdges);
            setSelectedEvent(null);
            setDrawer(null);
            Toast.success(
              data.deleted_relation_count > 0
                ? `事件已删除，并删除 ${data.deleted_relation_count} 条关系线`
                : "事件已删除",
            );
          } catch (error) {
            if (error instanceof UnauthorizedError) {
              props.onUnauthorized();
              return;
            }
            Toast.error(getErrorMessage(error, "事件删除失败，请稍后再试"));
          }
        },
      });
    },
    [props.novel.id, props.onUnauthorized],
  );

  // handleRequestEdgeEdit 请求编辑关系线备注。
  // 参数 edgeId 表示需要编辑的关系线 ID。
  const handleRequestEdgeEdit = useCallback(function handleRequestEdgeEdit(
    edgeId: string,
  ) {
    const edge = edgesRef.current.find((item) => item.id === edgeId);
    setEditingEdgeId(edgeId);
    setNoteDraft(normalizeText(edge?.data?.note));
  }, []);

  // handleRequestEdgeDelete 请求删除事件关系线。
  // 参数 edgeId 表示需要删除的关系线 ID。
  const handleRequestEdgeDelete = useCallback(
    function handleRequestEdgeDelete(edgeId: string) {
      const edge = edgesRef.current.find((item) => item.id === edgeId);
      if (!edge?.data) {
        return;
      }
      const relationId = edge.data.relationId;
      Modal.confirm({
        title: "删除事件关系线",
        content: "确认删除这条事件关系线？",
        okText: "确认删除",
        cancelText: "取消",
        onOk: async function confirmDeleteEdge() {
          try {
            await deleteEventRelation(props.novel.id, relationId);
            setEdges(edgesRef.current.filter((item) => item.id !== edgeId));
            Toast.success("事件关系线已删除");
          } catch (error) {
            if (error instanceof UnauthorizedError) {
              props.onUnauthorized();
              return;
            }
            Toast.error(getErrorMessage(error, "事件关系线删除失败，请稍后再试"));
          }
        },
      });
    },
    [props.novel.id, props.onUnauthorized],
  );

  // loadGraphData 加载事件图和角色卡列表。
  // 参数 signal 表示请求取消信号。
  const loadGraphData = useCallback(
    async function loadGraphData(signal?: AbortSignal) {
      setLoadState("loading");
      setMessage("");
      setSaveState("idle");
      setSaveMessage("");

      try {
        const [characterItems, graph] = await Promise.all([
          fetchAllCharacters(props.novel.id, signal),
          fetchEventGraph(props.novel.id, signal),
        ]);
        if (signal?.aborted) {
          return;
        }
        const portraitMap = await resolveCharacterPortraitURLs(
          characterItems,
          signal,
        );
        if (signal?.aborted) {
          return;
        }

        const nextNodes = createFlowNodes(
          graph.nodes,
          handleViewEvent,
          handleEditEvent,
          handleRequestEventDelete,
        );
        const nextEdges = createFlowEdges(
          graph.edges,
          handleRequestEdgeEdit,
          handleRequestEdgeDelete,
        );

        setCharacters(characterItems);
        setCharacterPortraitURLs(portraitMap);
        setNodes(nextNodes);
        setEdges(nextEdges);
        setGraphUpdatedAt(graph.updated_at ?? null);
        setLoadState("ready");
        setSaveState("saved");

        window.requestAnimationFrame(function restoreGraphViewport() {
          reactFlowRef.current.setViewport(normalizeGraphViewport(graph.viewport), {
            duration: 0,
          });
        });
      } catch (error) {
        if (signal?.aborted) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        setNodes([]);
        setEdges([]);
        setCharacters([]);
        setCharacterPortraitURLs({});
        setLoadState("error");
        setMessage(getErrorMessage(error, "事件图加载失败，请稍后再试"));
      }
    },
    [
      handleEditEvent,
      handleRequestEdgeDelete,
      handleRequestEdgeEdit,
      handleRequestEventDelete,
      handleViewEvent,
      props.novel.id,
      props.onUnauthorized,
    ],
  );

  // loadEventGraphOnNovelChange 在小说变化时加载事件图。
  useEffect(
    function loadEventGraphOnNovelChange() {
      const controller = new AbortController();
      void loadGraphData(controller.signal);

      return function cancelEventGraphLoad() {
        controller.abort();
      };
    },
    [loadGraphData],
  );

  // handleRetry 处理事件图加载失败后的重试。
  function handleRetry() {
    void loadGraphData();
  }

  // handleRetrySave 处理布局保存失败后的重试。
  function handleRetrySave() {
    void flushLayoutSave();
  }

  // handleNodesChange 处理 React Flow 节点变化。
  // 参数 changes 表示 React Flow 传入的节点变化列表。
  const handleNodesChange = useCallback(function handleNodesChange(
    changes: NodeChange<EventGraphNode>[],
  ) {
    const filteredChanges = changes.filter((change) => change.type !== "remove");
    setNodes((currentNodes) => applyNodeChanges(filteredChanges, currentNodes));
  }, []);

  // handleEdgesChange 处理 React Flow 关系线变化。
  // 参数 changes 表示 React Flow 传入的关系线变化列表。
  const handleEdgesChange = useCallback(function handleEdgesChange(
    changes: EdgeChange<EventGraphEdge>[],
  ) {
    const filteredChanges = changes.filter((change) => change.type !== "remove");
    setEdges((currentEdges) => applyEdgeChanges(filteredChanges, currentEdges));
  }, []);

  // handleNodeDragStop 在事件节点拖动结束后保存布局。
  // 参数 event 表示鼠标或触控事件；参数 node 表示被拖动的节点；参数 currentNodes 表示拖动结束后的节点列表。
  function handleNodeDragStop(
    event: MouseEvent | TouchEvent,
    node: EventGraphNode,
    currentNodes: EventGraphNode[],
  ) {
    void event;
    void node;
    queueLayoutSave(currentNodes);
  }

  // handleMoveEnd 在画布移动或缩放结束后保存视口。
  // 参数 event 表示鼠标或触控事件；参数 viewport 表示移动结束后的视口。
  function handleMoveEnd(event: MouseEvent | TouchEvent | null, viewport: Viewport) {
    void event;
    queueLayoutSave(nodesRef.current, viewport);
  }

  // handleConnect 处理两个事件节点之间的新连线。
  const handleConnect = useCallback<OnConnect>(
    async function handleConnect(connection) {
      const sourceEventId = eventIDFromNodeID(connection.source);
      const targetEventId = eventIDFromNodeID(connection.target);
      if (!sourceEventId || !targetEventId) {
        return;
      }
      if (sourceEventId === targetEventId) {
        Toast.warning("事件不能连接到自身");
        return;
      }
      if (
        edgesRef.current.some(
          (edge) =>
            edge.data?.sourceEventId === sourceEventId &&
            edge.data?.targetEventId === targetEventId,
        )
      ) {
        Toast.info("这两个事件已经存在同向关系线");
        return;
      }

      try {
        const relation = await createEventRelation(props.novel.id, {
          source_event_id: sourceEventId,
          target_event_id: targetEventId,
          note: "",
        });
        setEdges((currentEdges) => [
          ...currentEdges,
          createFlowEdge(relation, handleRequestEdgeEdit, handleRequestEdgeDelete),
        ]);
        Toast.success("事件关系线已创建");
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        Toast.error(getErrorMessage(error, "事件关系线创建失败，请稍后再试"));
      }
    },
    [
      handleRequestEdgeDelete,
      handleRequestEdgeEdit,
      props.novel.id,
      props.onUnauthorized,
    ],
  );

  // handleSaveEdgeNote 保存关系线备注。
  async function handleSaveEdgeNote() {
    if (!editingEdgeId) {
      return;
    }
    const edge = edgesRef.current.find((item) => item.id === editingEdgeId);
    if (!edge?.data) {
      return;
    }

    try {
      const relation = await updateEventRelation(props.novel.id, edge.data.relationId, {
        note: normalizeText(noteDraft),
      });
      setEdges((currentEdges) =>
        currentEdges.map((item) =>
          item.id === editingEdgeId
            ? createFlowEdge(relation, handleRequestEdgeEdit, handleRequestEdgeDelete)
            : item,
        ),
      );
      setEditingEdgeId(null);
      setNoteDraft("");
      Toast.success("备注已保存");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "备注保存失败，请稍后再试"));
    }
  }

  // handleCancelEdgeNote 取消编辑关系线备注。
  function handleCancelEdgeNote() {
    setEditingEdgeId(null);
    setNoteDraft("");
  }

  // handleFormFieldChange 更新事件表单中的文本字段。
  // 参数 field 表示字段名；参数 value 表示输入框当前值。
  function handleFormFieldChange(
    field: Exclude<keyof EventFormValues, "participant_ids">,
    value: string,
  ) {
    setFormValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  }

  // handleToggleParticipant 切换事件表单中的参与者选中状态。
  // 参数 characterId 表示需要切换的角色卡 ID。
  function handleToggleParticipant(characterId: number) {
    setFormValues((currentValues) => ({
      ...currentValues,
      participant_ids: currentValues.participant_ids.includes(characterId)
        ? currentValues.participant_ids.filter((id) => id !== characterId)
        : [...currentValues.participant_ids, characterId],
    }));
  }

  // handleSubmitEvent 提交新增或编辑事件。
  async function handleSubmitEvent() {
    const payload = normalizeEventFormValues(formValues);
    if (!payload.name) {
      Toast.warning("请输入事件名称");
      return;
    }

    setSubmitting(true);
    try {
      if (drawer?.mode === "edit" && drawer.eventId) {
        const updated = await updateEvent(props.novel.id, drawer.eventId, {
          ...payload,
          position_x:
            nodesRef.current.find((node) => node.data.event.id === drawer.eventId)?.position.x ??
            selectedEvent?.position_x ??
            0,
          position_y:
            nodesRef.current.find((node) => node.data.event.id === drawer.eventId)?.position.y ??
            selectedEvent?.position_y ??
            0,
        });
        setNodes((currentNodes) =>
          currentNodes.map((node) =>
            node.data.event.id === updated.id
              ? createFlowNode(
                  updated,
                  node.position.x,
                  node.position.y,
                  handleViewEvent,
                  handleEditEvent,
                  handleRequestEventDelete,
                )
              : node,
          ),
        );
        setSelectedEvent(updated);
        setDrawer({ mode: "view", eventId: updated.id });
        Toast.success("事件已更新");
        return;
      }

      const viewport = reactFlowRef.current.getViewport();
      const created = await createEvent(props.novel.id, {
        ...payload,
        position_x: safeNumber((120 - viewport.x) / (viewport.zoom || 1)),
        position_y: safeNumber((120 - viewport.y) / (viewport.zoom || 1)),
      });
      const nextNode = createFlowNode(
        created,
        created.position_x,
        created.position_y,
        handleViewEvent,
        handleEditEvent,
        handleRequestEventDelete,
      );
      setNodes((currentNodes) => [...currentNodes, nextNode]);
      setSelectedEvent(created);
      setDrawer({ mode: "view", eventId: created.id });
      Toast.success("事件已创建");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "事件保存失败，请稍后再试"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="event-graph-panel"
      id="event-graph-panel"
      role="tabpanel"
      aria-label={`${props.novel.name}事件管理`}
    >
      {loadState === "loading" ? <EventGraphSkeleton /> : null}
      {loadState === "error" ? (
        <div className="character-card-error" role="alert">
          <p>{message}</p>
          <button type="button" onClick={handleRetry}>
            重新加载
          </button>
        </div>
      ) : null}
      {loadState === "ready" ? (
        <div className="event-graph-workspace">
          <div className="event-canvas-shell">
            <div className="event-canvas-toolbar">
              <div>
                <strong>{getSaveStatusText(saveState)}</strong>
                <span>
                  {saveState === "error"
                    ? saveMessage
                    : `${eventCountText} · ${formatGraphUpdatedText(graphUpdatedAt)}`}
                </span>
              </div>
              <div className="event-canvas-actions">
                {saveState === "error" ? (
                  <button type="button" onClick={handleRetrySave}>
                    重试保存
                  </button>
                ) : null}
                <button type="button" onClick={handleOpenCreateDrawer}>
                  ＋ 新增事件
                </button>
              </div>
            </div>

            <div className="event-flow-wrap">
              <ReactFlow<EventGraphNode, EventGraphEdge>
                className="event-flow"
                deleteKeyCode={null}
                edges={edges}
                edgeTypes={eventEdgeTypes}
                fitView={nodes.length > 0}
                maxZoom={1.8}
                minZoom={0.25}
                nodes={nodes}
                nodeTypes={eventNodeTypes}
                onConnect={handleConnect}
                onEdgesChange={handleEdgesChange}
                onMoveEnd={handleMoveEnd}
                onNodeDragStop={handleNodeDragStop}
                onNodesChange={handleNodesChange}
                panOnScroll
                proOptions={{ hideAttribution: true }}
              >
                <Background color="rgba(91, 78, 68, 0.22)" gap={28} />
                <Controls position="bottom-right" showInteractive={false} />
              </ReactFlow>
            </div>
          </div>
        </div>
      ) : null}

      {drawer ? (
        <EventDrawer
          characters={characters}
          characterPortraitURLs={characterPortraitURLs}
          detailLoading={detailLoading}
          event={selectedEvent}
          formValues={formValues}
          mode={drawer.mode}
          submitting={submitting}
          onCancel={handleCloseDrawer}
          onChangeField={handleFormFieldChange}
          onDelete={drawer.eventId ? () => handleRequestEventDelete(drawer.eventId as number) : undefined}
          onEdit={drawer.eventId ? () => setDrawer({ mode: "edit", eventId: drawer.eventId }) : undefined}
          onSubmit={handleSubmitEvent}
          onToggleParticipant={handleToggleParticipant}
        />
      ) : null}

      <Modal
        className="relationship-note-modal"
        title="事件关系备注"
        visible={editingEdgeId !== null}
        width={460}
        okText="保存备注"
        cancelText="取消"
        onCancel={handleCancelEdgeNote}
        onOk={handleSaveEdgeNote}
      >
        <label className="relationship-note-field">
          <span>备注</span>
          <textarea
            value={noteDraft}
            rows={5}
            placeholder="例如：直接导致、伏笔回收、后续影响"
            onChange={(event) => setNoteDraft(event.target.value)}
          />
        </label>
      </Modal>
    </section>
  );
}

// EventDrawerProps 表示事件右侧抽屉需要的数据。
interface EventDrawerProps {
  // mode 表示抽屉当前模式。
  mode: EventDrawerMode;
  // event 表示当前查看或编辑的事件数据。
  event: NovelEventItem | null;
  // characters 表示当前小说的角色卡列表。
  characters: CharacterSummaryItem[];
  // characterPortraitURLs 表示角色卡 ID 到肖像预览地址的映射。
  characterPortraitURLs: Record<number, string>;
  // formValues 表示事件表单值。
  formValues: EventFormValues;
  // detailLoading 表示事件详情是否正在加载。
  detailLoading: boolean;
  // submitting 表示事件表单是否正在提交。
  submitting: boolean;
  // onCancel 表示关闭抽屉时执行的回调。
  onCancel: () => void;
  // onEdit 表示切换到编辑模式时执行的回调。
  onEdit?: () => void;
  // onDelete 表示删除当前事件时执行的回调。
  onDelete?: () => void;
  // onSubmit 表示提交事件表单时执行的回调。
  onSubmit: () => void;
  // onChangeField 表示事件文本字段变化时执行的回调。
  onChangeField: (
    field: Exclude<keyof EventFormValues, "participant_ids">,
    value: string,
  ) => void;
  // onToggleParticipant 表示切换事件参与者选中状态时执行的回调。
  onToggleParticipant: (characterId: number) => void;
}

// EventDrawer 渲染事件新增、详情和编辑抽屉。
// 参数 props 表示事件右侧抽屉需要的数据。
function EventDrawer(props: EventDrawerProps) {
  const isFormMode = props.mode === "create" || props.mode === "edit";
  const title =
    props.mode === "create" ? "新增事件" : props.mode === "edit" ? "编辑事件" : "事件详情";

  return (
    <div className="event-drawer-mask" role="presentation" onClick={props.onCancel}>
      <aside
        className="event-drawer"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="event-drawer-header">
          <div>
            <span>{props.mode === "create" ? "Event Draft" : "Event Detail"}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={props.onCancel}>
            ×
          </button>
        </div>

        {props.detailLoading ? (
          <div className="event-drawer-loading">加载中...</div>
        ) : isFormMode ? (
          <EventForm
            characters={props.characters}
            characterPortraitURLs={props.characterPortraitURLs}
            formValues={props.formValues}
            submitting={props.submitting}
            onChangeField={props.onChangeField}
            onToggleParticipant={props.onToggleParticipant}
          />
        ) : props.event ? (
          <EventDetail event={props.event} />
        ) : (
          <div className="event-drawer-loading">暂无事件数据</div>
        )}

        <div className="event-drawer-footer">
          {props.mode === "view" ? (
            <>
              <button type="button" onClick={props.onCancel}>
                关闭
              </button>
              <button type="button" onClick={props.onDelete}>
                删除事件
              </button>
              <button type="button" onClick={props.onEdit}>
                编辑事件
              </button>
            </>
          ) : (
            <>
              <button type="button" disabled={props.submitting} onClick={props.onCancel}>
                取消
              </button>
              <button type="button" disabled={props.submitting} onClick={props.onSubmit}>
                {props.submitting ? "保存中..." : "保存事件"}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// EventFormProps 表示事件表单需要的数据。
interface EventFormProps {
  // characters 表示当前小说角色卡列表。
  characters: CharacterSummaryItem[];
  // characterPortraitURLs 表示角色卡 ID 到肖像预览地址的映射。
  characterPortraitURLs: Record<number, string>;
  // formValues 表示事件表单值。
  formValues: EventFormValues;
  // submitting 表示表单是否正在提交。
  submitting: boolean;
  // onChangeField 表示事件文本字段变化时执行的回调。
  onChangeField: (
    field: Exclude<keyof EventFormValues, "participant_ids">,
    value: string,
  ) => void;
  // onToggleParticipant 表示切换事件参与者选中状态时执行的回调。
  onToggleParticipant: (characterId: number) => void;
}

// EventForm 渲染事件新增和编辑表单。
// 参数 props 表示事件表单需要的数据。
function EventForm(props: EventFormProps) {
  return (
    <div className="event-form event-form-template">
      <header className="event-detail-hero event-form-hero">
        <div className="event-detail-title-wrap event-form-title-wrap">
          <input
            className="event-form-title-input"
            value={props.formValues.name}
            disabled={props.submitting}
            placeholder="填写事件名称"
            aria-label="事件名称"
            onChange={(event) => props.onChangeField("name", event.target.value)}
          />
          <span className="event-detail-seal" aria-hidden="true">
            事件
          </span>
        </div>
        <label className="event-detail-meta event-form-location" aria-label="事件地点">
          <input
            value={props.formValues.location}
            disabled={props.submitting}
            placeholder="填写事件地点"
            aria-label="地点"
            onChange={(event) => props.onChangeField("location", event.target.value)}
          />
        </label>
        <div className="event-detail-divider" />
      </header>
      <div className="event-detail-layout event-form-layout">
        <article>
          <EventTextArea
            field="cause"
            label="起因"
            value={props.formValues.cause}
            disabled={props.submitting}
            onChange={props.onChangeField}
          />
          <EventTextArea
            field="process"
            label="经过"
            value={props.formValues.process}
            disabled={props.submitting}
            onChange={props.onChangeField}
          />
          <EventTextArea
            field="result"
            label="结果"
            value={props.formValues.result}
            disabled={props.submitting}
            onChange={props.onChangeField}
          />
          <EventTextArea
            field="impact"
            label="造成的影响"
            value={props.formValues.impact}
            disabled={props.submitting}
            onChange={props.onChangeField}
          />
        </article>
        <aside>
          <h2 className="event-detail-sidebar-title">参与者</h2>
          <div className="event-participant-picker" aria-label="选择事件参与者">
            {props.characters.length > 0 ? (
              props.characters.map((character) => (
                <button
                  type="button"
                  className={
                    props.formValues.participant_ids.includes(character.id)
                      ? "event-participant-option event-participant-option-selected"
                      : "event-participant-option"
                  }
                  disabled={props.submitting}
                  key={character.id}
                  onClick={() => props.onToggleParticipant(character.id)}
                >
                  <span className="event-participant-option-strip" aria-hidden="true" />
                  <span className="event-participant-option-avatar">
                    {props.characterPortraitURLs[character.id] ? (
                      <img
                        src={props.characterPortraitURLs[character.id]}
                        alt={`${character.name}肖像`}
                      />
                    ) : (
                      <span>{getCoverInitial(character.name)}</span>
                    )}
                  </span>
                  <strong>{character.name}</strong>
                </button>
              ))
            ) : (
              <p className="event-participant-picker-empty">暂无角色卡</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// EventTextAreaProps 表示事件多行文本输入框需要的数据。
interface EventTextAreaProps {
  // field 表示事件表单字段名。
  field: Exclude<keyof EventFormValues, "name" | "location" | "participant_ids">;
  // label 表示输入框标签。
  label: string;
  // value 表示输入框当前值。
  value: string;
  // disabled 表示输入框是否禁用。
  disabled: boolean;
  // onChange 表示输入框内容变化时执行的回调。
  onChange: (
    field: Exclude<keyof EventFormValues, "participant_ids">,
    value: string,
  ) => void;
}

// EventTextArea 渲染事件正文多行输入框。
// 参数 props 表示事件多行文本输入框需要的数据。
function EventTextArea(props: EventTextAreaProps) {
  return (
    <label className="event-form-section">
      <span>
        <span className="event-detail-section-marker" aria-hidden="true" />
        {props.label}
      </span>
      <textarea
        value={props.value}
        rows={5}
        disabled={props.disabled}
        placeholder={`填写事件${props.label}`}
        onChange={(event) => props.onChange(props.field, event.target.value)}
      />
    </label>
  );
}

// EventDetailProps 表示事件详情展示需要的数据。
interface EventDetailProps {
  // event 表示需要展示的事件详情。
  event: NovelEventItem;
}

// EventDetail 渲染参考模板结构的事件详情。
// 参数 props 表示事件详情展示需要的数据。
function EventDetail(props: EventDetailProps) {
  return (
    <div className="event-detail-template">
      <header className="event-detail-hero">
        <div className="event-detail-title-wrap">
          <h1>{props.event.name}</h1>
          <span className="event-detail-seal" aria-hidden="true">
            事件
          </span>
        </div>
        <div className="event-detail-meta" aria-label="事件地点">
          <span>{props.event.location ? `地点：${props.event.location}` : "地点未定"}</span>
        </div>
        <div className="event-detail-divider" />
      </header>
      <div className="event-detail-layout">
        <article>
          <EventDetailSection title="起因" content={props.event.cause} />
          <EventDetailSection title="经过" content={props.event.process} />
          <EventDetailSection title="结果" content={props.event.result} />
          <EventDetailSection title="造成的影响" content={props.event.impact} />
        </article>
        <aside>
          <h2 className="event-detail-sidebar-title">参与者</h2>
          <div className="event-participant-list">
            {props.event.participants.length > 0 ? (
              props.event.participants.map((participant) => (
                <EventParticipantCard participant={participant} key={participant.id} />
              ))
            ) : (
              <p>暂无参与者</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// EventDetailSectionProps 表示事件详情分区需要的数据。
interface EventDetailSectionProps {
  // title 表示分区标题。
  title: string;
  // content 表示分区正文。
  content: string;
}

// EventDetailSection 渲染事件详情正文分区。
// 参数 props 表示事件详情分区需要的数据。
function EventDetailSection(props: EventDetailSectionProps) {
  return (
    <section>
      <h3>
        <span className="event-detail-section-marker" aria-hidden="true" />
        {props.title}
      </h3>
      <p>{normalizeText(props.content) || "尚未记录。"}</p>
    </section>
  );
}

// EventParticipantCardProps 表示事件参与者卡片需要的数据。
interface EventParticipantCardProps {
  // participant 表示事件参与者摘要。
  participant: EventParticipantItem;
}

// EventParticipantCard 渲染只包含姓名、性别、标签的参与者卡片。
// 参数 props 表示事件参与者卡片需要的数据。
function EventParticipantCard(props: EventParticipantCardProps) {
  return (
    <div className="event-participant-card">
      <span className="event-participant-card-strip" aria-hidden="true" />
      <div className="event-participant-card-body">
        <strong>{props.participant.name}</strong>
        <span>{props.participant.gender || "性别未定"}</span>
        <div className="event-participant-card-tags">
          {splitNovelTags(props.participant.tags, 3).map((tag) => (
            <small key={tag}>{tag}</small>
          ))}
        </div>
      </div>
    </div>
  );
}

// EventGraphSkeleton 渲染事件图加载态。
function EventGraphSkeleton() {
  return (
    <div className="event-graph-skeleton" aria-label="事件图加载中">
      <div />
    </div>
  );
}

// fetchAllCharacters 分页拉取指定小说的全部角色卡摘要。
// 参数 novelId 表示小说主键 ID；参数 signal 表示请求取消信号。
async function fetchAllCharacters(
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

// resolveCharacterPortraitURLs 解析角色肖像的实际可预览地址。
// 参数 characters 表示需要解析肖像的角色卡列表；参数 signal 表示请求取消信号。
async function resolveCharacterPortraitURLs(
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

// createFlowNodes 将后端事件节点转换成 React Flow 节点。
// 参数 graphNodes 表示后端返回的事件节点；参数 onView 表示查看事件回调；参数 onEdit 表示编辑事件回调；参数 onDelete 表示删除事件回调。
function createFlowNodes(
  graphNodes: NovelEventItem[],
  onView: (eventId: number) => void,
  onEdit: (eventId: number) => void,
  onDelete: (eventId: number) => void,
): EventGraphNode[] {
  return graphNodes.map((event) =>
    createFlowNode(event, event.position_x, event.position_y, onView, onEdit, onDelete),
  );
}

// createFlowNode 创建单个 React Flow 事件节点。
// 参数 event 表示节点对应的事件；参数 positionX 表示节点 X 坐标；参数 positionY 表示节点 Y 坐标；参数 onView 表示查看事件回调；参数 onEdit 表示编辑事件回调；参数 onDelete 表示删除事件回调。
function createFlowNode(
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
function createFlowEdges(
  relations: EventRelationItem[],
  onEdit: (edgeId: string) => void,
  onDelete: (edgeId: string) => void,
): EventGraphEdge[] {
  return relations.map((relation) => createFlowEdge(relation, onEdit, onDelete));
}

// createFlowEdge 创建单条 React Flow 事件关系线。
// 参数 relation 表示后端事件关系线数据；参数 onEdit 表示编辑备注回调；参数 onDelete 表示删除关系线回调。
function createFlowEdge(
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
function buildLayoutSnapshot(
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
function normalizeGraphViewport(viewport: {
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
function createEmptyEventFormValues(): EventFormValues {
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
function eventToFormValues(event: NovelEventItem): EventFormValues {
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
function normalizeEventFormValues(values: EventFormValues): EventCreateParams {
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
function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// nodeIDFromEventID 根据事件 ID 生成 React Flow 节点 ID。
// 参数 eventId 表示事件 ID。
function nodeIDFromEventID(eventId: number): string {
  return `event-${eventId}`;
}

// eventIDFromNodeID 从 React Flow 节点 ID 中解析事件 ID。
// 参数 nodeId 表示 React Flow 节点 ID。
function eventIDFromNodeID(nodeId: string | null | undefined): number | null {
  if (!nodeId?.startsWith("event-")) {
    return null;
  }

  const value = Number(nodeId.slice("event-".length));
  return Number.isInteger(value) && value > 0 ? value : null;
}

// edgeIDFromRelationID 根据关系线 ID 生成 React Flow 边 ID。
// 参数 relationId 表示后端事件关系线主键 ID。
function edgeIDFromRelationID(relationId: number): string {
  return `event-relation-${relationId}`;
}

// getSaveStatusText 获取事件图布局保存状态展示文案。
// 参数 state 表示当前保存状态。
function getSaveStatusText(state: EventSaveState): string {
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
function formatGraphUpdatedText(updatedAt: string | null): string {
  return updatedAt ? formatUpdatedText(updatedAt) : "暂无保存记录";
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
