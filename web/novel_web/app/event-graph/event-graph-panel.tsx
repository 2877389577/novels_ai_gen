import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import {
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type EdgeChange,
  type NodeChange,
  type OnConnect,
  type Viewport,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  UnauthorizedError,
  createEvent,
  createEventRelation,
  deleteEvent,
  deleteEventRelation,
  fetchEventDetail,
  fetchEventGraph,
  saveEventGraphLayout,
  updateEvent,
  updateEventRelation,
  type CharacterSummaryItem,
  type EventLayoutParams,
  type NovelEventItem,
} from "../api";
import { normalizeText } from "../novel-utils";
import type {
  EventDrawerState,
  EventDrawerMode,
  EventFormValues,
  EventGraphEdge,
  EventGraphNode,
  EventGraphPanelProps,
  EventLoadState,
  EventSaveState,
} from "./types";
import {
  buildLayoutSnapshot,
  createEmptyEventFormValues,
  createFlowEdge,
  createFlowEdges,
  createFlowNode,
  createFlowNodes,
  edgeIDFromRelationID,
  eventIDFromNodeID,
  eventToFormValues,
  fetchAllEventCharacters,
  getErrorMessage,
  nodeIDFromEventID,
  normalizeEventFormValues,
  normalizeGraphViewport,
  resolveEventCharacterPortraitURLs,
  safeNumber,
} from "./event-graph-utils";
import { EventDrawer } from "./event-drawer";
import {
  EventGraphCanvas,
  EventGraphError,
  EventGraphSkeleton,
  EventRelationNoteModal,
} from "./event-graph-canvas";

const eventLayoutSaveDelayMs = 800;

// EventGraphPanel 渲染事件管理 Tab。
// 参数 props 表示事件图面板需要的外部数据。
export function EventGraphPanel(props: EventGraphPanelProps) {
  return (
    <ReactFlowProvider>
      <EventGraphPanelInner {...props} />
    </ReactFlowProvider>
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
  const [characterPortraitURLs, setCharacterPortraitURLs] = useState<
    Record<number, string>
  >({});
  const [nodes, setNodes] = useState<EventGraphNode[]>([]);
  const [edges, setEdges] = useState<EventGraphEdge[]>([]);
  const [saveState, setSaveState] = useState<EventSaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [graphUpdatedAt, setGraphUpdatedAt] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<EventDrawerState | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<NovelEventItem | null>(
    null,
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [formValues, setFormValues] = useState<EventFormValues>(
    createEmptyEventFormValues,
  );
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
          setSaveMessage(
            getErrorMessage(error, "事件图布局保存失败，请稍后再试"),
          );
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
  const handleViewEvent = useCallback(function handleViewEvent(
    eventId: number,
  ) {
    setDrawer({ mode: "view", eventId });
    void loadEventDetail(eventId);
  }, []);

  // handleEditEvent 打开事件编辑抽屉。
  // 参数 eventId 表示需要编辑的事件 ID。
  const handleEditEvent = useCallback(function handleEditEvent(
    eventId: number,
  ) {
    setDrawer({ mode: "edit", eventId });
    void loadEventDetail(eventId, "edit");
  }, []);

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
            const nextNodes = nodesRef.current.filter(
              (node) => node.id !== nodeId,
            );
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
            Toast.error(
              getErrorMessage(error, "事件关系线删除失败，请稍后再试"),
            );
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
          fetchAllEventCharacters(props.novel.id, signal),
          fetchEventGraph(props.novel.id, signal),
        ]);
        if (signal?.aborted) {
          return;
        }
        const portraitMap = await resolveEventCharacterPortraitURLs(
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
          reactFlowRef.current.setViewport(
            normalizeGraphViewport(graph.viewport),
            {
              duration: 0,
            },
          );
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
    const filteredChanges = changes.filter(
      (change) => change.type !== "remove",
    );
    setNodes((currentNodes) => applyNodeChanges(filteredChanges, currentNodes));
  }, []);

  // handleEdgesChange 处理 React Flow 关系线变化。
  // 参数 changes 表示 React Flow 传入的关系线变化列表。
  const handleEdgesChange = useCallback(function handleEdgesChange(
    changes: EdgeChange<EventGraphEdge>[],
  ) {
    const filteredChanges = changes.filter(
      (change) => change.type !== "remove",
    );
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
  function handleMoveEnd(
    event: MouseEvent | TouchEvent | null,
    viewport: Viewport,
  ) {
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
          createFlowEdge(
            relation,
            handleRequestEdgeEdit,
            handleRequestEdgeDelete,
          ),
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
      const relation = await updateEventRelation(
        props.novel.id,
        edge.data.relationId,
        {
          note: normalizeText(noteDraft),
        },
      );
      setEdges((currentEdges) =>
        currentEdges.map((item) =>
          item.id === editingEdgeId
            ? createFlowEdge(
                relation,
                handleRequestEdgeEdit,
                handleRequestEdgeDelete,
              )
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
            nodesRef.current.find(
              (node) => node.data.event.id === drawer.eventId,
            )?.position.x ??
            selectedEvent?.position_x ??
            0,
          position_y:
            nodesRef.current.find(
              (node) => node.data.event.id === drawer.eventId,
            )?.position.y ??
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
        <EventGraphError message={message} onRetry={handleRetry} />
      ) : null}
      {loadState === "ready" ? (
        <EventGraphCanvas
          edges={edges}
          eventCountText={eventCountText}
          graphUpdatedAt={graphUpdatedAt}
          nodes={nodes}
          saveMessage={saveMessage}
          saveState={saveState}
          onConnect={handleConnect}
          onEdgesChange={handleEdgesChange}
          onMoveEnd={handleMoveEnd}
          onNodeDragStop={handleNodeDragStop}
          onNodesChange={handleNodesChange}
          onOpenCreate={handleOpenCreateDrawer}
          onRetrySave={handleRetrySave}
        />
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
          onDelete={
            drawer.eventId
              ? () => handleRequestEventDelete(drawer.eventId as number)
              : undefined
          }
          onEdit={
            drawer.eventId
              ? () => setDrawer({ mode: "edit", eventId: drawer.eventId })
              : undefined
          }
          onSubmit={handleSubmitEvent}
          onToggleParticipant={handleToggleParticipant}
        />
      ) : null}

      <EventRelationNoteModal
        noteDraft={noteDraft}
        visible={editingEdgeId !== null}
        onCancel={handleCancelEdgeNote}
        onNoteDraftChange={setNoteDraft}
        onSave={handleSaveEdgeNote}
      />
    </section>
  );
}
