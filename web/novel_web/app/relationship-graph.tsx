import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import {
  Background,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  getBezierPath,
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
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import {
  UnauthorizedError,
  fetchCharacterList,
  fetchRelationshipGraph,
  refreshImagePreview,
  saveRelationshipGraph,
  type CharacterSummaryItem,
  type NovelItem,
  type RelationshipGraphData,
  type RelationshipGraphEdgeItem,
  type RelationshipGraphNodeItem,
  type RelationshipGraphSaveParams,
} from "./api";
import {
  formatUpdatedText,
  getCoverInitial,
  isPrivateObjectKey,
  normalizeText,
  splitNovelTags,
} from "./novel-utils";

const characterDragMimeType = "application/reactflow-character-id";
const relationshipHandleLeftId = "left";
const relationshipHandleRightId = "right";
const relationshipCharacterPageSize = 100;
const relationshipSaveDelayMs = 800;

// CharacterNodeData 表示 React Flow 角色节点携带的数据。
interface CharacterNodeData extends Record<string, unknown> {
  // character 表示该画布节点引用的角色卡摘要。
  character: CharacterSummaryItem;
  // portraitURL 表示角色肖像可预览地址，可能是普通 URL 或私有图片预签名 URL。
  portraitURL: string;
  // onDelete 表示请求删除画布节点时执行的回调。
  onDelete: (characterId: number) => void;
}

// RelationshipEdgeData 表示 React Flow 关系线携带的数据。
interface RelationshipEdgeData extends Record<string, unknown> {
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
type CharacterGraphNode = Node<CharacterNodeData, "character">;

// RelationshipGraphEdge 表示 React Flow 中的关系线类型。
type RelationshipGraphEdge = Edge<RelationshipEdgeData, "relationship">;

// RelationshipLoadState 表示角色关系图页面加载状态。
type RelationshipLoadState = "loading" | "ready" | "error";

// RelationshipSaveState 表示角色关系图实时保存状态。
type RelationshipSaveState = "idle" | "pending" | "saving" | "saved" | "error";

// RelationshipGraphPanelProps 表示角色关系图面板需要的外部数据。
export interface RelationshipGraphPanelProps {
  // novel 表示当前关系图所属的小说。
  novel: NovelItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

const relationshipNodeTypes = {
  character: CharacterRelationshipNode,
};

const relationshipEdgeTypes = {
  relationship: RelationshipNoteEdge,
};

// RelationshipGraphPanel 渲染角色关系图 Tab。
// 参数 props 表示角色关系图面板需要的外部数据。
export function RelationshipGraphPanel(props: RelationshipGraphPanelProps) {
  return (
    <ReactFlowProvider>
      <RelationshipGraphPanelInner {...props} />
    </ReactFlowProvider>
  );
}

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

// RelationshipGraphPanelInner 渲染受 React Flow Provider 包裹的关系图内容。
// 参数 props 表示角色关系图面板需要的外部数据。
function RelationshipGraphPanelInner(props: RelationshipGraphPanelProps) {
  const reactFlow = useReactFlow<CharacterGraphNode, RelationshipGraphEdge>();
  const reactFlowRef = useRef(reactFlow);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const saveVersionRef = useRef(0);
  const latestSnapshotRef = useRef<RelationshipGraphSaveParams | null>(null);
  const nodesRef = useRef<CharacterGraphNode[]>([]);
  const edgesRef = useRef<RelationshipGraphEdge[]>([]);
  const charactersRef = useRef<CharacterSummaryItem[]>([]);

  const [loadState, setLoadState] = useState<RelationshipLoadState>("loading");
  const [message, setMessage] = useState("");
  const [characters, setCharacters] = useState<CharacterSummaryItem[]>([]);
  const [portraitURLs, setPortraitURLs] = useState<Record<number, string>>({});
  const [nodes, setNodes] = useState<CharacterGraphNode[]>([]);
  const [edges, setEdges] = useState<RelationshipGraphEdge[]>([]);
  const [saveState, setSaveState] = useState<RelationshipSaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [graphUpdatedAt, setGraphUpdatedAt] = useState<string | null>(null);
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(null);

  const canvasCharacterIds = useMemo(
    function createCanvasCharacterIdSet() {
      return new Set(nodes.map((node) => node.data.character.id));
    },
    [nodes],
  );
  const displayEdges = useMemo(
    function createDisplayedRelationshipEdges() {
      return createDisplayRelationshipEdges(edges, selectedCharacterId);
    },
    [edges, selectedCharacterId],
  );

  // syncReactFlowRef 同步 React Flow 实例到 ref，避免加载 effect 因实例对象变化反复触发。
  useEffect(
    function syncReactFlowRef() {
      reactFlowRef.current = reactFlow;
    },
    [reactFlow],
  );

  // syncNodeRef 同步最新节点列表到 ref，供防抖保存读取。
  useEffect(
    function syncNodeRef() {
      nodesRef.current = nodes;
    },
    [nodes],
  );

  // syncEdgeRef 同步最新关系线列表到 ref，供防抖保存读取。
  useEffect(
    function syncEdgeRef() {
      edgesRef.current = edges;
    },
    [edges],
  );

  // syncCharactersRef 同步最新角色卡列表到 ref，供确认弹窗读取角色名。
  useEffect(
    function syncCharactersRef() {
      charactersRef.current = characters;
    },
    [characters],
  );

  // cleanupSaveTimer 在组件卸载时清理待执行的保存任务。
  useEffect(function cleanupSaveTimer() {
    return function clearPendingSaveTimer() {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // syncFullscreenState 监听浏览器全屏状态变化。
  useEffect(function syncFullscreenState() {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === canvasShellRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return function removeFullscreenListener() {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // flushSave 立即提交最近一次关系图快照。
  const flushSave = useCallback(
    async function flushSave() {
      const snapshot = latestSnapshotRef.current;
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
        const data = await saveRelationshipGraph(props.novel.id, snapshot);
        if (version !== saveVersionRef.current) {
          return;
        }

        setGraphUpdatedAt(data.updated_at ?? null);
        setSaveState("saved");
        setSaveMessage("");
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }

        if (version === saveVersionRef.current) {
          setSaveState("error");
          setSaveMessage(getErrorMessage(error, "角色关系图保存失败，请稍后再试"));
        }
      }
    },
    [props.novel.id, props.onUnauthorized],
  );

  // queueSave 防抖保存当前关系图快照。
  // 参数 nextNodes 表示需要保存的节点列表；参数 nextEdges 表示需要保存的关系线列表；参数 viewport 表示需要保存的视口状态。
  const queueSave = useCallback(
    function queueSave(
      nextNodes = nodesRef.current,
      nextEdges = edgesRef.current,
      viewport?: Viewport,
    ) {
      latestSnapshotRef.current = buildGraphSnapshot(
        nextNodes,
        nextEdges,
        viewport ?? reactFlowRef.current.getViewport(),
      );
      saveVersionRef.current += 1;
      setSaveState("pending");
      setSaveMessage("");

      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(function runDebouncedSave() {
        void flushSave();
      }, relationshipSaveDelayMs);
    },
    [flushSave],
  );

  // handleRequestNodeDelete 请求删除画布中的角色节点。
  // 参数 characterId 表示需要删除的角色卡 ID。
  const handleRequestNodeDelete = useCallback(
    function handleRequestNodeDelete(characterId: number) {
      const character = charactersRef.current.find(
        (item) => item.id === characterId,
      );
      Modal.confirm({
        title: "删除画布角色",
        content: `将从关系图中移除「${character?.name || "该角色"}」，相关关系线也会一并删除。`,
        okText: "确认删除",
        cancelText: "取消",
        onOk: function confirmDeleteNode() {
          const nodeId = nodeIDFromCharacterID(characterId);
          const nextNodes = nodesRef.current.filter((node) => node.id !== nodeId);
          const nextEdges = edgesRef.current.filter(
            (edge) => edge.source !== nodeId && edge.target !== nodeId,
          );
          setNodes(nextNodes);
          setEdges(nextEdges);
          setSelectedCharacterId((currentValue) =>
            currentValue === characterId ? null : currentValue,
          );
          queueSave(nextNodes, nextEdges);
        },
      });
    },
    [queueSave],
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

  // handleRequestEdgeDelete 请求删除关系线。
  // 参数 edgeId 表示需要删除的关系线 ID。
  const handleRequestEdgeDelete = useCallback(
    function handleRequestEdgeDelete(edgeId: string) {
      Modal.confirm({
        title: "删除关系线",
        content: "确认删除这条角色关系线？",
        okText: "确认删除",
        cancelText: "取消",
        onOk: function confirmDeleteEdge() {
          const nextEdges = edgesRef.current.filter((edge) => edge.id !== edgeId);
          setEdges(nextEdges);
          queueSave(nodesRef.current, nextEdges);
        },
      });
    },
    [queueSave],
  );

  // loadGraphData 加载角色列表、肖像预览和关系图快照。
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
          fetchRelationshipGraph(props.novel.id, signal),
        ]);
        const portraitMap = await resolveCharacterPortraitURLs(
          characterItems,
          signal,
        );

        if (signal?.aborted) {
          return;
        }

        const characterMap = new Map(
          characterItems.map((character) => [character.id, character]),
        );
        const nextNodes = createFlowNodes(
          graph.nodes,
          characterMap,
          portraitMap,
          handleRequestNodeDelete,
        );
        const nextEdges = createFlowEdges(
          graph.edges,
          handleRequestEdgeEdit,
          handleRequestEdgeDelete,
        );

        setCharacters(characterItems);
        setPortraitURLs(portraitMap);
        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedCharacterId(null);
        setGraphUpdatedAt(graph.updated_at ?? null);
        setLoadState("ready");
        setSaveState("saved");

        window.requestAnimationFrame(function restoreGraphViewport() {
          reactFlowRef.current.setViewport(normalizeGraphViewport(graph), {
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

        setCharacters([]);
        setNodes([]);
        setEdges([]);
        setSelectedCharacterId(null);
        setLoadState("error");
        setMessage(getErrorMessage(error, "角色关系图加载失败，请稍后再试"));
      }
    },
    [
      handleRequestEdgeDelete,
      handleRequestEdgeEdit,
      handleRequestNodeDelete,
      props.novel.id,
      props.onUnauthorized,
    ],
  );

  // loadRelationshipGraphOnMount 在小说变化时加载关系图。
  useEffect(
    function loadRelationshipGraphOnMount() {
      const controller = new AbortController();
      void loadGraphData(controller.signal);

      return function cancelRelationshipGraphLoad() {
        controller.abort();
      };
    },
    [loadGraphData],
  );

  // handleRetry 处理关系图加载失败后的重试。
  function handleRetry() {
    void loadGraphData();
  }

  // handleRetrySave 处理保存失败后的重试。
  function handleRetrySave() {
    void flushSave();
  }

  // handleDragStart 处理左侧角色卡拖拽开始。
  // 参数 event 表示拖拽事件；参数 character 表示被拖动的角色卡。
  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    character: CharacterSummaryItem,
  ) {
    event.dataTransfer.setData(characterDragMimeType, String(character.id));
    event.dataTransfer.effectAllowed = "move";
  }

  // handleDragOver 允许外部角色卡拖放到画布。
  // 参数 event 表示拖拽经过事件。
  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  // handleDrop 将左侧角色卡加入关系图画布。
  // 参数 event 表示拖放事件。
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const characterId = Number(event.dataTransfer.getData(characterDragMimeType));
    const character = characters.find((item) => item.id === characterId);
    if (!character) {
      return;
    }

    const existingNode = nodesRef.current.find(
      (node) => node.data.character.id === characterId,
    );
    if (existingNode) {
      reactFlow.setCenter(existingNode.position.x + 90, existingNode.position.y + 40, {
        duration: 320,
      });
      Toast.info("角色已经在画布中");
      return;
    }

    const position = reactFlow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const nextNode = createFlowNode(
      character,
      portraitURLs[character.id] ?? "",
      position.x,
      position.y,
      handleRequestNodeDelete,
    );
    const nextNodes = [...nodesRef.current, nextNode];
    setNodes(nextNodes);
    queueSave(nextNodes, edgesRef.current);
  }

  // handleNodesChange 处理 React Flow 节点变化。
  // 参数 changes 表示 React Flow 传入的节点变化列表。
  const handleNodesChange = useCallback(function handleNodesChange(
    changes: NodeChange<CharacterGraphNode>[],
  ) {
    const filteredChanges = changes.filter((change) => change.type !== "remove");
    setNodes((currentNodes) => applyNodeChanges(filteredChanges, currentNodes));
  }, []);

  // handleEdgesChange 处理 React Flow 关系线变化。
  // 参数 changes 表示 React Flow 传入的关系线变化列表。
  const handleEdgesChange = useCallback(function handleEdgesChange(
    changes: EdgeChange<RelationshipGraphEdge>[],
  ) {
    const filteredChanges = changes.filter((change) => change.type !== "remove");
    setEdges((currentEdges) => applyEdgeChanges(filteredChanges, currentEdges));
  }, []);

  // handleNodeDragStop 在节点拖动结束后触发保存。
  // 参数 event 表示鼠标或触控事件；参数 node 表示被拖动的节点；参数 currentNodes 表示拖动结束后的节点列表。
  function handleNodeDragStop(
    event: MouseEvent | TouchEvent,
    node: CharacterGraphNode,
    currentNodes: CharacterGraphNode[],
  ) {
    void event;
    void node;
    queueSave(currentNodes, edgesRef.current);
  }

  // handleMoveEnd 在画布移动或缩放结束后保存视口。
  // 参数 event 表示鼠标或触控事件；参数 viewport 表示移动结束后的视口。
  function handleMoveEnd(event: MouseEvent | TouchEvent | null, viewport: Viewport) {
    void event;
    queueSave(nodesRef.current, edgesRef.current, viewport);
  }

  // handleNodeClick 记录当前点选的角色卡，用于点亮相关关系线。
  // 参数 event 表示 React Flow 节点点击事件；参数 node 表示被点选的角色节点。
  function handleNodeClick(
    event: ReactMouseEvent<Element>,
    node: CharacterGraphNode,
  ) {
    void event;
    setSelectedCharacterId(node.data.character.id);
  }

  // handlePaneClick 清除当前点选的角色卡，让关系线恢复默认显示。
  // 参数 event 表示 React Flow 画布点击事件。
  function handlePaneClick(event: ReactMouseEvent<Element>) {
    void event;
    setSelectedCharacterId(null);
  }

  // handleConnect 处理两个角色节点之间的新连线。
  const handleConnect = useCallback<OnConnect>(
    function handleConnect(connection) {
      const sourceCharacterId = characterIDFromNodeID(connection.source);
      const targetCharacterId = characterIDFromNodeID(connection.target);
      if (!sourceCharacterId || !targetCharacterId) {
        return;
      }
      if (sourceCharacterId === targetCharacterId) {
        Toast.warning("角色不能与自己建立关系");
        return;
      }

      const [characterAId, characterBId] = normalizeRelationshipPair(
        sourceCharacterId,
        targetCharacterId,
      );
      const characterAHandleId =
        sourceCharacterId === characterAId
          ? connection.sourceHandle
          : connection.targetHandle;
      const characterBHandleId =
        sourceCharacterId === characterBId
          ? connection.sourceHandle
          : connection.targetHandle;
      const edgeId = relationshipEdgeID(characterAId, characterBId);
      if (edgesRef.current.some((edge) => edge.id === edgeId)) {
        Toast.info("这两个角色已经存在关系线");
        return;
      }

      const nextEdge = createFlowEdge(
        {
          id: edgeId,
          character_a_id: characterAId,
          character_b_id: characterBId,
          note: "",
        },
        handleRequestEdgeEdit,
        handleRequestEdgeDelete,
        nodeIDFromCharacterID(characterAId),
        nodeIDFromCharacterID(characterBId),
        characterAHandleId,
        characterBHandleId,
      );
      const nextEdges = [...edgesRef.current, nextEdge];
      setEdges(nextEdges);
      queueSave(nodesRef.current, nextEdges);
    },
    [handleRequestEdgeDelete, handleRequestEdgeEdit, queueSave],
  );

  // handleSaveEdgeNote 保存关系线备注。
  function handleSaveEdgeNote() {
    if (!editingEdgeId) {
      return;
    }

    const nextEdges = edgesRef.current.map((edge) => {
      if (edge.id !== editingEdgeId) {
        return edge;
      }
      if (!edge.data) {
        return edge;
      }
      return {
        ...edge,
        data: {
          characterAId: edge.data.characterAId,
          characterBId: edge.data.characterBId,
          note: normalizeText(noteDraft),
          onEdit: edge.data.onEdit,
          onDelete: edge.data.onDelete,
        },
      };
    });
    setEdges(nextEdges);
    setEditingEdgeId(null);
    setNoteDraft("");
    queueSave(nodesRef.current, nextEdges);
  }

  // handleCancelEdgeNote 取消编辑关系线备注。
  function handleCancelEdgeNote() {
    setEditingEdgeId(null);
    setNoteDraft("");
  }

  // handleToggleFullscreen 切换关系图画布全屏状态。
  function handleToggleFullscreen() {
    const element = canvasShellRef.current;
    if (!element) {
      return;
    }

    if (document.fullscreenElement === element) {
      void document.exitFullscreen();
      return;
    }

    if (element.requestFullscreen) {
      void element.requestFullscreen();
      return;
    }

    setIsFullscreen((currentValue) => !currentValue);
  }

  return (
    <section
      className="relationship-graph-panel"
      id="relationship-graph-panel"
      role="tabpanel"
      aria-label={`${props.novel.name}角色关系图`}
    >
      {loadState === "loading" ? <RelationshipGraphSkeleton /> : null}
      {loadState === "error" ? (
        <div className="character-card-error" role="alert">
          <p>{message}</p>
          <button type="button" onClick={handleRetry}>
            重新加载
          </button>
        </div>
      ) : null}
      {loadState === "ready" ? (
        <div className="relationship-graph-workspace">
          <aside className="relationship-character-sidebar" aria-label="角色卡">
            <div className="relationship-sidebar-title">
              <strong>角色卡</strong>
              <span>{characters.length.toLocaleString("zh-CN")}</span>
            </div>
            <div className="relationship-character-list">
              {characters.length > 0 ? (
                characters.map((character) => (
                  <button
                    type="button"
                    className={
                      canvasCharacterIds.has(character.id)
                        ? "relationship-character-item relationship-character-item-used"
                        : "relationship-character-item"
                    }
                    draggable
                    key={character.id}
                    onDragStart={(event) => handleDragStart(event, character)}
                  >
                    <CharacterMiniAvatar
                      character={character}
                      portraitURL={portraitURLs[character.id] ?? ""}
                    />
                    <span className="relationship-character-text">
                      <strong>{character.name}</strong>
                      <span>{splitNovelTags(character.tags, 2).join(" / ") || "未设标签"}</span>
                    </span>
                    {canvasCharacterIds.has(character.id) ? (
                      <span className="relationship-character-used">已入图</span>
                    ) : null}
                  </button>
                ))
              ) : (
                <div className="relationship-character-empty">
                  <strong>暂无角色卡</strong>
                  <span>先在角色卡页收录人物。</span>
                </div>
              )}
            </div>
          </aside>

          <div
            className={
              isFullscreen
                ? "relationship-canvas-shell relationship-canvas-shell-fullscreen"
                : "relationship-canvas-shell"
            }
            ref={canvasShellRef}
          >
            <div className="relationship-canvas-toolbar">
              <div>
                <strong>{getSaveStatusText(saveState)}</strong>
                <span>
                  {saveState === "error"
                    ? saveMessage
                    : formatGraphUpdatedText(graphUpdatedAt)}
                </span>
              </div>
              <div className="relationship-canvas-actions">
                {saveState === "error" ? (
                  <button type="button" onClick={handleRetrySave}>
                    重试保存
                  </button>
                ) : null}
                <button type="button" onClick={handleToggleFullscreen}>
                  {isFullscreen ? "退出全屏" : "全屏"}
                </button>
              </div>
            </div>

            <div className="relationship-flow-wrap">
              <ReactFlow<CharacterGraphNode, RelationshipGraphEdge>
                className="relationship-flow"
                connectionMode={ConnectionMode.Loose}
                deleteKeyCode={null}
                edges={displayEdges}
                edgeTypes={relationshipEdgeTypes}
                fitView={nodes.length > 0}
                maxZoom={1.8}
                minZoom={0.25}
                nodes={nodes}
                nodeTypes={relationshipNodeTypes}
                onConnect={handleConnect}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onEdgesChange={handleEdgesChange}
                onMoveEnd={handleMoveEnd}
                onNodeClick={handleNodeClick}
                onNodeDragStop={handleNodeDragStop}
                onNodesChange={handleNodesChange}
                onPaneClick={handlePaneClick}
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

      <Modal
        className="relationship-note-modal"
        title="关系备注"
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
            placeholder="例如：旧友、师徒、宿敌"
            onChange={(event) => setNoteDraft(event.target.value)}
          />
        </label>
      </Modal>
    </section>
  );
}

// CharacterMiniAvatar 渲染左侧角色卡小头像。
// 参数 props 表示需要展示的角色摘要和肖像地址。
function CharacterMiniAvatar(props: {
  // character 表示需要展示头像的角色卡摘要。
  character: CharacterSummaryItem;
  // portraitURL 表示角色肖像可预览地址。
  portraitURL: string;
}) {
  return (
    <span className="relationship-character-avatar">
      {props.portraitURL ? (
        <img src={props.portraitURL} alt={`${props.character.name}肖像`} />
      ) : (
        <span>{getCoverInitial(props.character.name)}</span>
      )}
    </span>
  );
}

// RelationshipGraphSkeleton 渲染角色关系图加载态。
function RelationshipGraphSkeleton() {
  return (
    <div className="relationship-graph-skeleton" aria-label="角色关系图加载中">
      <div />
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
      pageSize: relationshipCharacterPageSize,
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

// createFlowNodes 将后端节点快照转换成 React Flow 节点。
// 参数 graphNodes 表示后端返回的关系图节点；参数 characterMap 表示角色卡 ID 到摘要的映射；参数 portraitURLs 表示角色卡 ID 到肖像预览地址的映射；参数 onDelete 表示节点删除回调。
function createFlowNodes(
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
function createFlowNode(
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
function createFlowEdges(
  graphEdges: RelationshipGraphEdgeItem[],
  onEdit: (edgeId: string) => void,
  onDelete: (edgeId: string) => void,
): RelationshipGraphEdge[] {
  return graphEdges.map((edge) => createFlowEdge(edge, onEdit, onDelete));
}

// createFlowEdge 创建单条 React Flow 关系线。
// 参数 edge 表示后端关系线数据；参数 onEdit 表示编辑备注回调；参数 onDelete 表示删除关系线回调；参数 sourceNodeId 表示关系线起点节点 ID；参数 targetNodeId 表示关系线终点节点 ID；参数 sourceHandleId 表示关系线起点连接点 ID；参数 targetHandleId 表示关系线终点连接点 ID。
function createFlowEdge(
  edge: RelationshipGraphEdgeItem,
  onEdit: (edgeId: string) => void,
  onDelete: (edgeId: string) => void,
  sourceNodeId = nodeIDFromCharacterID(edge.character_a_id),
  targetNodeId = nodeIDFromCharacterID(edge.character_b_id),
  sourceHandleId: string | null = edge.source_handle ?? relationshipHandleRightId,
  targetHandleId: string | null = edge.target_handle ?? relationshipHandleLeftId,
): RelationshipGraphEdge {
  const [characterAId, characterBId] = normalizeRelationshipPair(
    edge.character_a_id,
    edge.character_b_id,
  );
  return {
    id: relationshipEdgeID(characterAId, characterBId),
    source: sourceNodeId,
    sourceHandle: normalizeRelationshipHandleID(sourceHandleId, relationshipHandleRightId),
    target: targetNodeId,
    targetHandle: normalizeRelationshipHandleID(targetHandleId, relationshipHandleLeftId),
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
function normalizeRelationshipHandleID(
  handleId: string | null,
  fallback: string,
): string {
  return handleId === relationshipHandleLeftId || handleId === relationshipHandleRightId
    ? handleId
    : fallback;
}

// createDisplayRelationshipEdges 根据当前选中角色生成仅用于画布展示的关系线。
// 参数 edges 表示基础关系线列表；参数 selectedCharacterId 表示当前点选的角色卡 ID，未选中时为空。
function createDisplayRelationshipEdges(
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

    const isHighlighted = relationshipEdgeIncludesCharacter(edge, selectedCharacterId);
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
function relationshipEdgeIncludesCharacter(
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
function buildGraphSnapshot(
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
        sourceCharacterId === characterAId ? edge.sourceHandle : edge.targetHandle;
      const characterBHandleId =
        sourceCharacterId === characterBId ? edge.sourceHandle : edge.targetHandle;
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
function normalizeGraphViewport(graph: RelationshipGraphData): Viewport {
  return {
    x: safeNumber(graph.viewport?.x),
    y: safeNumber(graph.viewport?.y),
    zoom: safeNumber(graph.viewport?.zoom) || 1,
  };
}

// safeNumber 将未知数值标准化为有限数字。
// 参数 value 表示需要标准化的数值。
function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

// nodeIDFromCharacterID 根据角色卡 ID 生成 React Flow 节点 ID。
// 参数 characterId 表示角色卡 ID。
function nodeIDFromCharacterID(characterId: number): string {
  return `character-${characterId}`;
}

// characterIDFromNodeID 从 React Flow 节点 ID 中解析角色卡 ID。
// 参数 nodeId 表示 React Flow 节点 ID。
function characterIDFromNodeID(nodeId: string | null | undefined): number | null {
  if (!nodeId?.startsWith("character-")) {
    return null;
  }

  const value = Number(nodeId.slice("character-".length));
  return Number.isInteger(value) && value > 0 ? value : null;
}

// normalizeRelationshipPair 将无方向关系线两端角色 ID 归一为从小到大。
// 参数 characterAId 表示关系线一端角色卡 ID；参数 characterBId 表示关系线另一端角色卡 ID。
function normalizeRelationshipPair(
  characterAId: number,
  characterBId: number,
): [number, number] {
  return characterAId <= characterBId
    ? [characterAId, characterBId]
    : [characterBId, characterAId];
}

// relationshipEdgeID 根据无方向角色对生成稳定关系线 ID。
// 参数 characterAId 表示关系线一端角色卡 ID；参数 characterBId 表示关系线另一端角色卡 ID。
function relationshipEdgeID(characterAId: number, characterBId: number): string {
  const [a, b] = normalizeRelationshipPair(characterAId, characterBId);
  return `rel-${a}-${b}`;
}

// getSaveStatusText 获取关系图保存状态展示文案。
// 参数 state 表示当前实时保存状态。
function getSaveStatusText(state: RelationshipSaveState): string {
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
function formatGraphUpdatedText(updatedAt: string | null): string {
  return updatedAt ? formatUpdatedText(updatedAt) : "暂无保存记录";
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
