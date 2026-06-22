import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import {
  Background,
  ConnectionMode,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type EdgeChange,
  type NodeChange,
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
  type RelationshipGraphSaveParams,
} from "../api";
import {
  isPrivateObjectKey,
  normalizeText,
  splitNovelTags,
} from "../novel-utils";
import {
  buildGraphSnapshot,
  characterIDFromNodeID,
  createDisplayRelationshipEdges,
  createFlowEdge,
  createFlowEdges,
  createFlowNode,
  createFlowNodes,
  formatGraphUpdatedText,
  getErrorMessage,
  getSaveStatusText,
  nodeIDFromCharacterID,
  normalizeGraphViewport,
  normalizeRelationshipPair,
  relationshipEdgeID,
} from "./relationship-graph-utils";
import { relationshipEdgeTypes, relationshipNodeTypes } from "./flow-elements";
import {
  CharacterMiniAvatar,
  RelationshipGraphSkeleton,
} from "./relationship-graph-view";
import type {
  CharacterGraphNode,
  RelationshipGraphEdge,
  RelationshipGraphPanelProps,
  RelationshipLoadState,
  RelationshipSaveState,
} from "./types";

const characterDragMimeType = "application/reactflow-character-id";
const relationshipCharacterPageSize = 100;
const relationshipSaveDelayMs = 800;

// RelationshipGraphPanel 渲染角色关系图 Tab。
// 参数 props 表示角色关系图面板需要的外部数据。
export function RelationshipGraphPanel(props: RelationshipGraphPanelProps) {
  return (
    <ReactFlowProvider>
      <RelationshipGraphPanelInner {...props} />
    </ReactFlowProvider>
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
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    null,
  );

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
          setSaveMessage(
            getErrorMessage(error, "角色关系图保存失败，请稍后再试"),
          );
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
          const nextNodes = nodesRef.current.filter(
            (node) => node.id !== nodeId,
          );
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
          const nextEdges = edgesRef.current.filter(
            (edge) => edge.id !== edgeId,
          );
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

    const characterId = Number(
      event.dataTransfer.getData(characterDragMimeType),
    );
    const character = characters.find((item) => item.id === characterId);
    if (!character) {
      return;
    }

    const existingNode = nodesRef.current.find(
      (node) => node.data.character.id === characterId,
    );
    if (existingNode) {
      reactFlow.setCenter(
        existingNode.position.x + 90,
        existingNode.position.y + 40,
        {
          duration: 320,
        },
      );
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
    const filteredChanges = changes.filter(
      (change) => change.type !== "remove",
    );
    setNodes((currentNodes) => applyNodeChanges(filteredChanges, currentNodes));
  }, []);

  // handleEdgesChange 处理 React Flow 关系线变化。
  // 参数 changes 表示 React Flow 传入的关系线变化列表。
  const handleEdgesChange = useCallback(function handleEdgesChange(
    changes: EdgeChange<RelationshipGraphEdge>[],
  ) {
    const filteredChanges = changes.filter(
      (change) => change.type !== "remove",
    );
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
  function handleMoveEnd(
    event: MouseEvent | TouchEvent | null,
    viewport: Viewport,
  ) {
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
                      <span>
                        {splitNovelTags(character.tags, 2).join(" / ") ||
                          "未设标签"}
                      </span>
                    </span>
                    {canvasCharacterIds.has(character.id) ? (
                      <span className="relationship-character-used">
                        已入图
                      </span>
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
