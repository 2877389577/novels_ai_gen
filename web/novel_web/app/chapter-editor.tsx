import {
  IconAIEditLevel1,
  IconArrowUp,
  IconClose,
  IconDelete,
  IconDeleteStroked,
  IconEditStroked,
  IconRedoStroked,
} from "@douyinfe/semi-icons";
import { AIChatDialogue, Button, FloatButton, Toast } from "@douyinfe/semi-ui-19";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import type {
  DialogueRenderConfig,
  Message,
  RenderActionProps,
  RoleConfig,
} from "@douyinfe/semi-ui-19/lib/es/aiChatDialogue/interface";

import {
  UnauthorizedError,
  clearNovelAgentMessages,
  createChapter,
  fetchChapterDetail,
  fetchAIProviderModelsByProviderID,
  fetchNovelAgentMessages,
  fetchAIProviders,
  fetchRecommendedPrompts,
  fetchNextChapterNumber,
  recommendPromptType,
  streamNovelAgentChat,
  updateChapter,
  type AIProviderItem,
  type AIProviderModelItem,
  type ChapterCreateParams,
  type ChapterDetailItem,
  type ChapterUpdateParams,
  type NovelAgentMessageItem,
  type RecommendedPromptItem,
} from "./api";
import { normalizeText } from "./novel-utils";

const chapterEditorScrollbarHiddenClass = "chapter-editor-scrollbar-hidden";
const chapterAiProviderPageSize = 100;
const chapterAiPromptRecommendationDelayMs = 600;
const chapterAiPromptRecommendationPageSize = 10;
// chapterAiInputMaxHeight 表示 AI 输入框自动增高上限，约等于 6 行正文。
const chapterAiInputMaxHeight = 22 * 6;
const chapterAutoSaveIntervalMs = 5000;
const chapterSelectionAIActionWidth = 112;
const chapterSelectionAIActionHeight = 36;
const chapterSelectionAIActionOffset = 10;
const chapterSelectionAIActionViewportPadding = 8;

const emptyChapterFormValues: ChapterFormValues = {
  title: "",
  content: "",
};

const chapterAiAssistantMessages: ChapterAiMessage[] = [
  {
    id: "chapter-ai-assistant-welcome",
    role: "assistant",
    content:
      "你好，我是章节写作助手。你可以选择提供商和模型，把润色需求发给我，我会在需要时读取当前章节正文。",
  },
  {
    id: "chapter-ai-assistant-suggestion",
    role: "assistant",
    content:
      "当前首版会优先处理润色任务。你可以描述想要的语气、节奏或氛围，我会尽量让文字更贴近你的目标。",
  },
];

const chapterAiAssistantRoleConfig: RoleConfig = {
  assistant: {
    name: "写作助手",
    color: "var(--semi-color-primary)",
  },
  system: {
    name: "系统",
  },
  user: {
    name: "你",
  },
};

// handleChapterAiPendingMessageAction 处理暂未接入真实逻辑的章节 AI 消息操作按钮。
// 参数 event 表示按钮点击事件，用于阻止占位操作触发外层交互。
function handleChapterAiPendingMessageAction(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

// ChapterFormValues 表示章节编辑页中可由用户编辑的字段。
interface ChapterFormValues {
  // title 表示章节名，不能为空。
  title: string;
  // content 表示章节正文，可以为空。
  content: string;
}

// ChapterAiRetryPayload 表示章节 AI 用户消息失败后可复用的原始发送参数。
interface ChapterAiRetryPayload {
  // providerId 表示原始请求使用的 AI 提供商 ID。
  providerId: number;
  // modelId 表示原始请求使用的模型标识。
  modelId: string;
  // message 表示原始请求发送给 AI 的用户原文。
  message: string;
  // providerName 表示原始请求使用的 AI 提供商展示名。
  providerName: string;
  // modelName 表示原始请求使用的模型展示名。
  modelName: string;
}

// ChapterAiMessage 表示章节 AI 对话在前端本地增强后的消息。
interface ChapterAiMessage extends Message {
  // chapterAiPairID 表示同一轮用户消息与助手消息的配对 ID。
  chapterAiPairID?: string;
  // chapterAiSourceID 表示助手消息流式更新时使用的基础消息 ID。
  chapterAiSourceID?: string;
  // chapterAiRetryable 表示该用户消息是否允许展示重试按钮。
  chapterAiRetryable?: boolean;
  // chapterAiRetryPayload 表示该用户消息重试时复用的原始发送参数。
  chapterAiRetryPayload?: ChapterAiRetryPayload;
}

// ChapterAiStreamRequest 表示一次章节 AI 流式请求所需的本地上下文。
interface ChapterAiStreamRequest {
  // pairID 表示当前用户消息和助手消息共用的配对 ID。
  pairID: string;
  // assistantMessageID 表示当前助手消息的基础 ID。
  assistantMessageID: string;
  // savedChapterID 表示发送请求前已保存到后端的章节 ID。
  savedChapterID: number;
  // retryPayload 表示本次请求使用的原始 AI 调用参数。
  retryPayload: ChapterAiRetryPayload;
}

// ChapterAiPromptRecommendationCache 表示章节 AI 输入推荐结果的本地缓存。
interface ChapterAiPromptRecommendationCache {
  // promptType 表示本次输入匹配到的提示词类型，未匹配时为空。
  promptType: string;
  // items 表示已查询到的推荐提示词列表。
  items: RecommendedPromptItem[];
}

// ChapterAiPrefillMessage 表示一次从正文选区填入 AI 输入框的请求。
interface ChapterAiPrefillMessage {
  // id 表示预填请求的唯一标识，用于避免重复消费。
  id: number;
  // content 表示需要填入 AI 输入框的正文选中文本。
  content: string;
}

// ChapterSelectionAIAction 表示正文选区 AI 操作按钮的展示状态。
interface ChapterSelectionAIAction {
  // content 表示当前正文选中的纯文本内容。
  content: string;
  // top 表示按钮相对视口顶部的定位。
  top: number;
  // left 表示按钮相对视口左侧的定位。
  left: number;
}

// ChapterSaveSnapshot 表示最近一次成功保存到后端的章节内容快照。
interface ChapterSaveSnapshot {
  // chapterId 表示最近一次成功保存的章节主键 ID，新增章节未落库时为空。
  chapterId: number | null;
  // title 表示最近一次成功保存的章节名。
  title: string;
  // content 表示最近一次成功保存的章节正文。
  content: string;
}

// ChapterSaveOptions 表示执行章节保存时的行为选项。
interface ChapterSaveOptions {
  // force 表示是否即使当前存在保存请求也等待并确保本次保存完成。
  force: boolean;
  // showTitleError 表示标题为空时是否展示表单错误和提示。
  showTitleError?: boolean;
}

// ChapterEditorPageProps 表示章节编辑页需要的外部参数和回调。
interface ChapterEditorPageProps {
  // novelId 表示当前章节所属小说主键 ID。
  novelId: number;
  // chapterId 表示当前需要编辑的章节主键 ID，创建章节时为空。
  chapterId: number | null;
  // onBackToNovelDetail 表示返回小说详情页时执行的回调。
  onBackToNovelDetail: (novelId: number) => void;
  // onChapterPersisted 表示新增章节首次保存成功后执行的路由替换回调。
  onChapterPersisted: (novelId: number, chapterId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ChapterEditorState 表示章节编辑页的数据加载状态。
type ChapterEditorState = "loading" | "ready" | "error";

// ChapterAiAssistantPanelProps 表示章节 AI 助手侧栏需要的回调。
interface ChapterAiAssistantPanelProps {
  // novelId 表示当前章节所属小说主键 ID。
  novelId: number;
  // ensureChapterSavedForAgent 表示发送 AI 前确保章节已保存并返回章节 ID 的方法。
  ensureChapterSavedForAgent: () => Promise<number | null>;
  // prefillMessage 表示需要填入 AI 输入框的一次性正文选中文本。
  prefillMessage: ChapterAiPrefillMessage | null;
  // onClose 表示关闭章节 AI 助手侧栏时执行的回调。
  onClose: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ChapterEditorPage 渲染章节创建和编辑共用页面。
// 参数 props 表示章节编辑页需要的外部参数和回调。
export function ChapterEditorPage(props: ChapterEditorPageProps) {
  const [state, setState] = useState<ChapterEditorState>("loading");
  const [message, setMessage] = useState("");
  const [chapter, setChapter] = useState<ChapterDetailItem | null>(null);
  const [chapterNumber, setChapterNumber] = useState<number | null>(null);
  const [persistedChapterID, setPersistedChapterID] = useState<number | null>(
    props.chapterId,
  );
  const isEditMode = persistedChapterID !== null;
  const [titleValue, setTitleValue] = useState(emptyChapterFormValues.title);
  const [contentValue, setContentValue] = useState(
    emptyChapterFormValues.content,
  );
  const [titleError, setTitleError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [contentSnapshotId, setContentSnapshotId] = useState(0);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [selectionAIAction, setSelectionAIAction] =
    useState<ChapterSelectionAIAction | null>(null);
  const [aiPrefillMessage, setAiPrefillMessage] =
    useState<ChapterAiPrefillMessage | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const contentEditorRef = useRef<HTMLDivElement | null>(null);
  const aiPrefillMessageIDRef = useRef(0);
  const persistedChapterIDRef = useRef<number | null>(props.chapterId);
  const chapterNumberRef = useRef<number | null>(null);
  const titleValueRef = useRef(emptyChapterFormValues.title);
  const contentValueRef = useRef(emptyChapterFormValues.content);
  const stateRef = useRef<ChapterEditorState>("loading");
  const savingPromiseRef = useRef<Promise<ChapterDetailItem | null> | null>(
    null,
  );
  const skipRouteLoadChapterIDRef = useRef<number | null>(null);
  const lastSavedSnapshotRef = useRef<ChapterSaveSnapshot>({
    chapterId: props.chapterId,
    title: emptyChapterFormValues.title,
    content: emptyChapterFormValues.content,
  });
  const onUnauthorized = props.onUnauthorized;
  const liveWordCount = useMemo(
    function calculateLiveWordCount() {
      return countNonWhitespaceCharacters(contentValue);
    },
    [contentValue],
  );

  // syncChapterEditorRefs 将频繁变化的编辑状态同步到自动保存使用的 ref。
  useEffect(
    function syncChapterEditorRefs() {
      stateRef.current = state;
      chapterNumberRef.current = chapterNumber;
      titleValueRef.current = titleValue;
      contentValueRef.current = contentValue;
    },
    [chapterNumber, contentValue, state, titleValue],
  );

  // installScrollbarHiding 在章节编辑页隐藏全页滚动条视觉但保留滚动能力。
  useEffect(function installScrollbarHiding() {
    document.documentElement.classList.add(chapterEditorScrollbarHiddenClass);
    document.body.classList.add(chapterEditorScrollbarHiddenClass);

    return function removeScrollbarHiding() {
      document.documentElement.classList.remove(
        chapterEditorScrollbarHiddenClass,
      );
      document.body.classList.remove(chapterEditorScrollbarHiddenClass);
    };
  }, []);

  // syncContentEditorSnapshot 将后端正文或路由切换后的正文同步到段落编辑器。
  useEffect(
    function syncContentEditorSnapshot() {
      if (state !== "ready") {
        return;
      }

      renderContentEditorText(contentEditorRef.current, contentValue);
    },
    [contentSnapshotId, state],
  );

  // hideSelectionAIActionWhenNotReady 在章节离开可编辑状态时隐藏正文选区 AI 修改按钮。
  useEffect(
    function hideSelectionAIActionWhenNotReady() {
      if (state !== "ready") {
        setSelectionAIAction(null);
      }
    },
    [state],
  );

  // syncPersistedChapterID 同步当前已经落库的章节 ID。
  // 参数 chapterID 表示已经落库的章节主键 ID，新增章节未保存时为空。
  const syncPersistedChapterID = useCallback(function syncPersistedChapterID(
    chapterID: number | null,
  ) {
    persistedChapterIDRef.current = chapterID;
    setPersistedChapterID(chapterID);
  }, []);

  // resetLastSavedSnapshot 重置最近一次成功保存的章节内容快照。
  // 参数 chapterID 表示最近一次成功保存的章节 ID；参数 values 表示最近一次成功保存的标题和正文。
  const resetLastSavedSnapshot = useCallback(function resetLastSavedSnapshot(
    chapterID: number | null,
    values: ChapterFormValues,
  ) {
    lastSavedSnapshotRef.current = {
      chapterId: chapterID,
      title: normalizeText(values.title),
      content: normalizeText(values.content),
    };
  }, []);

  // readCurrentChapterValues 读取当前编辑器中的章节标题和正文。
  const readCurrentChapterValues = useCallback(function readCurrentChapterValues() {
    return normalizeChapterFormValues({
      title: titleValueRef.current,
      content: contentEditorRef.current
        ? readContentEditorText(contentEditorRef.current)
        : contentValueRef.current,
    });
  }, []);

  // hasUnsavedChapterChanges 判断当前章节内容是否相对最近保存快照发生变化。
  // 参数 values 表示当前编辑器中的章节标题和正文。
  const hasUnsavedChapterChanges = useCallback(
    function hasUnsavedChapterChanges(values: ChapterUpdateParams) {
      const snapshot = lastSavedSnapshotRef.current;
      return (
        snapshot.chapterId !== persistedChapterIDRef.current ||
        snapshot.title !== values.title ||
        snapshot.content !== values.content
      );
    },
    [],
  );

  // persistChapterValues 将指定章节内容保存到后端。
  // 参数 values 表示已经清理过的章节标题和正文。
  const persistChapterValues = useCallback(
    async function persistChapterValues(
      values: ChapterUpdateParams,
    ): Promise<ChapterDetailItem> {
      const currentChapterID = persistedChapterIDRef.current;
      let savedChapter: ChapterDetailItem;

      if (currentChapterID === null) {
        const currentChapterNumber = chapterNumberRef.current;
        if (currentChapterNumber === null) {
          throw new Error("章节号尚未加载，请稍后再试");
        }

        savedChapter = await createChapter(
          props.novelId,
          normalizeChapterCreateValues(values, currentChapterNumber),
        );
        syncPersistedChapterID(savedChapter.id);
        skipRouteLoadChapterIDRef.current = savedChapter.id;
        props.onChapterPersisted(props.novelId, savedChapter.id);
      } else {
        savedChapter = await updateChapter(
          props.novelId,
          currentChapterID,
          values,
        );
      }

      setChapter({
        ...savedChapter,
        title: values.title,
        content: values.content,
      });
      setChapterNumber(savedChapter.chapter_number);
      chapterNumberRef.current = savedChapter.chapter_number;
      resetLastSavedSnapshot(savedChapter.id, values);
      return savedChapter;
    },
    [
      props.novelId,
      props.onChapterPersisted,
      resetLastSavedSnapshot,
      syncPersistedChapterID,
    ],
  );

  // saveCurrentChapter 保存当前编辑器中的章节内容。
  // 参数 options 表示本次保存的行为选项。
  const saveCurrentChapter = useCallback(
    async function saveCurrentChapter(
      options: ChapterSaveOptions,
    ): Promise<ChapterDetailItem | null> {
      for (;;) {
        const savingPromise = savingPromiseRef.current;
        if (savingPromise) {
          if (!options.force) {
            return null;
          }
          await savingPromise;
          continue;
        }

        const values = readCurrentChapterValues();
        if (!values.title) {
          if (options.showTitleError) {
            setTitleError("请输入章节名");
            titleInputRef.current?.focus();
            Toast.warning("请先输入章节名");
          }
          return null;
        }
        if (!hasUnsavedChapterChanges(values)) {
          return null;
        }

        setTitleError("");
        const nextSavingPromise = persistChapterValues(values);
        savingPromiseRef.current = nextSavingPromise;
        try {
          return await nextSavingPromise;
        } finally {
          if (savingPromiseRef.current === nextSavingPromise) {
            savingPromiseRef.current = null;
          }
        }
      }
    },
    [hasUnsavedChapterChanges, persistChapterValues, readCurrentChapterValues],
  );

  // ensureChapterSavedForAgent 在发送 AI 请求前确保当前章节已经保存到后端。
  const ensureChapterSavedForAgent = useCallback(
    async function ensureChapterSavedForAgent(): Promise<number | null> {
      if (stateRef.current !== "ready") {
        Toast.info("章节仍在加载，请稍后再试");
        return null;
      }

      await saveCurrentChapter({ force: true, showTitleError: true });
      if (!readCurrentChapterValues().title) {
        return null;
      }
      return persistedChapterIDRef.current;
    },
    [readCurrentChapterValues, saveCurrentChapter],
  );

  // startChapterAutoSave 定时自动保存已经发生变化的章节内容。
  useEffect(
    function startChapterAutoSave() {
      const timer = window.setInterval(function autoSaveChangedChapter() {
        if (stateRef.current !== "ready") {
          return;
        }

        void saveCurrentChapter({ force: false }).catch(function handleAutoSaveError(
          error,
        ) {
          if (error instanceof UnauthorizedError) {
            onUnauthorized();
            return;
          }
          Toast.error(getErrorMessage(error, "章节自动保存失败，请稍后再试"));
        });
      }, chapterAutoSaveIntervalMs);

      return function stopChapterAutoSave() {
        window.clearInterval(timer);
      };
    },
    [onUnauthorized, saveCurrentChapter],
  );

  // hideSelectionAIAction 隐藏正文选区 AI 修改按钮。
  const hideSelectionAIAction = useCallback(function hideSelectionAIAction() {
    setSelectionAIAction(null);
  }, []);

  // refreshSelectionAIAction 根据当前正文选区刷新 AI 修改按钮位置。
  const refreshSelectionAIAction = useCallback(function refreshSelectionAIAction() {
    setSelectionAIAction(
      getChapterSelectionAIAction(contentEditorRef.current),
    );
  }, []);

  // refreshSelectionAIActionAfterSelection 延迟刷新正文选区按钮，等待浏览器完成选区更新。
  const refreshSelectionAIActionAfterSelection = useCallback(
    function refreshSelectionAIActionAfterSelection() {
      window.setTimeout(refreshSelectionAIAction, 0);
    },
    [refreshSelectionAIAction],
  );

  // syncSelectionAIActionOnViewportChange 在滚动或窗口变化时同步正文选区 AI 修改按钮。
  useEffect(
    function syncSelectionAIActionOnViewportChange() {
      if (!selectionAIAction) {
        return;
      }

      window.addEventListener("scroll", refreshSelectionAIAction, true);
      window.addEventListener("resize", refreshSelectionAIAction);
      return function removeSelectionAIActionViewportListeners() {
        window.removeEventListener("scroll", refreshSelectionAIAction, true);
        window.removeEventListener("resize", refreshSelectionAIAction);
      };
    },
    [refreshSelectionAIAction, selectionAIAction],
  );

  // syncSelectionAIActionOnDocumentSelectionChange 在页面选区变化时同步正文选区 AI 修改按钮。
  useEffect(
    function syncSelectionAIActionOnDocumentSelectionChange() {
      if (state !== "ready") {
        return;
      }

      document.addEventListener("selectionchange", refreshSelectionAIAction);
      return function removeSelectionAIActionSelectionListener() {
        document.removeEventListener("selectionchange", refreshSelectionAIAction);
      };
    },
    [refreshSelectionAIAction, state],
  );

  // loadNextChapterNumber 加载创建模式下后端建议的下一章节号。
  // 参数 signal 表示可选的请求取消信号；参数 preserveEditor 表示是否保留当前编辑内容。
  const loadNextChapterNumber = useCallback(
    async function loadNextChapterNumber(
      signal?: AbortSignal,
      preserveEditor = false,
    ) {
      if (!preserveEditor) {
        setState("loading");
      }
      setMessage("");

      try {
        const data = await fetchNextChapterNumber(props.novelId, signal);
        setChapter(null);
        setChapterNumber(data.next_chapter_number);
        chapterNumberRef.current = data.next_chapter_number;
        syncPersistedChapterID(null);
        resetLastSavedSnapshot(null, emptyChapterFormValues);
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        setState("error");
        setMessage(
          getErrorMessage(error, "下一章节号加载失败，请稍后再试"),
        );
      }
    },
    [
      onUnauthorized,
      props.novelId,
      resetLastSavedSnapshot,
      syncPersistedChapterID,
    ],
  );

  // loadChapterDetail 在编辑模式下加载章节详情。
  // 参数 signal 表示可选的请求取消信号。
  const loadChapterDetail = useCallback(
    async function loadChapterDetail(signal?: AbortSignal) {
      if (props.chapterId === null) {
        return;
      }

      setState("loading");
      setMessage("");

      try {
        const data = await fetchChapterDetail(
          props.novelId,
          props.chapterId,
          signal,
        );
        const values = chapterToFormValues(data);
        setChapter(data);
        setChapterNumber(data.chapter_number);
        chapterNumberRef.current = data.chapter_number;
        syncPersistedChapterID(data.id);
        resetLastSavedSnapshot(data.id, values);
        titleValueRef.current = values.title;
        setTitleValue(values.title);
        replaceEditorContent(values.content);
        setTitleError("");
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        setState("error");
        setMessage(
          getErrorMessage(error, "章节详情加载失败，请稍后再试"),
        );
      }
    },
    [
      onUnauthorized,
      props.chapterId,
      props.novelId,
      resetLastSavedSnapshot,
      syncPersistedChapterID,
    ],
  );

  // loadChapterWhenRouteChanges 在路由参数变化时同步章节数据。
  useEffect(
    function loadChapterWhenRouteChanges() {
      const controller = new AbortController();
      setTitleError("");
      setSubmitting(false);

      if (
        props.chapterId !== null &&
        skipRouteLoadChapterIDRef.current === props.chapterId
      ) {
        skipRouteLoadChapterIDRef.current = null;
        syncPersistedChapterID(props.chapterId);
        return function cancelSkippedChapterLoad() {
          controller.abort();
        };
      }

      if (props.chapterId === null) {
        setChapter(null);
        setChapterNumber(null);
        chapterNumberRef.current = null;
        syncPersistedChapterID(null);
        resetLastSavedSnapshot(null, emptyChapterFormValues);
        titleValueRef.current = emptyChapterFormValues.title;
        setTitleValue(emptyChapterFormValues.title);
        replaceEditorContent(emptyChapterFormValues.content);
        void loadNextChapterNumber(controller.signal);
      } else {
        void loadChapterDetail(controller.signal);
      }

      return function cancelChapterLoad() {
        controller.abort();
      };
    },
    [
      loadChapterDetail,
      loadNextChapterNumber,
      props.chapterId,
      resetLastSavedSnapshot,
      syncPersistedChapterID,
    ],
  );

  // handleBack 处理返回小说详情页。
  function handleBack() {
    if (submitting) {
      return;
    }

    props.onBackToNovelDetail(props.novelId);
  }

  // handleRetry 处理章节详情或下一章节号加载失败后的重试。
  function handleRetry() {
    if (props.chapterId === null) {
      void loadNextChapterNumber();
      return;
    }

    void loadChapterDetail();
  }

  // handleAiAssistantToggle 切换章节 AI 助手侧栏的展开状态。
  function handleAiAssistantToggle() {
    setAiPanelOpen(!aiPanelOpen);
  }

  // handleAiAssistantClose 关闭章节 AI 助手侧栏。
  function handleAiAssistantClose() {
    setAiPanelOpen(false);
  }

  // handleAiAssistantTriggerKeyDown 处理悬浮按钮键盘触发。
  // 参数 event 表示悬浮按钮外层容器接收到的键盘事件。
  function handleAiAssistantTriggerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleAiAssistantToggle();
  }

  // handleTitleChange 同步章节标题输入。
  // 参数 event 表示标题输入框变更事件。
  function handleTitleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextValue = event.target.value;
    titleValueRef.current = nextValue;
    setTitleValue(nextValue);
    if (titleError && normalizeText(nextValue)) {
      setTitleError("");
    }
  }

  // handleContentChange 同步章节正文输入。
  // 参数 event 表示正文段落编辑器输入事件。
  function handleContentChange(event: FormEvent<HTMLDivElement>) {
    hideSelectionAIAction();
    const nextContent = readContentEditorText(event.currentTarget);
    contentValueRef.current = nextContent;
    setContentValue(nextContent);
  }

  // handleContentFocus 在空正文获得焦点时创建可输入段落。
  // 参数 event 表示正文段落编辑器聚焦事件。
  function handleContentFocus(event: FocusEvent<HTMLDivElement>) {
    ensureContentEditorHasParagraph(event.currentTarget);
  }

  // handleContentBlur 在空正文失焦时恢复 placeholder 显示。
  // 参数 event 表示正文段落编辑器失焦事件。
  function handleContentBlur(event: FocusEvent<HTMLDivElement>) {
    hideSelectionAIAction();
    const nextContent = readContentEditorText(event.currentTarget);
    if (normalizeText(nextContent)) {
      contentValueRef.current = nextContent;
      setContentValue(nextContent);
      renderContentEditorText(event.currentTarget, nextContent);
      return;
    }

    event.currentTarget.innerHTML = "";
    contentValueRef.current = "";
    setContentValue("");
  }

  // handleContentPaste 将粘贴内容限制为纯文本，避免外部富文本污染段落样式。
  // 参数 event 表示正文段落编辑器粘贴事件。
  function handleContentPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    hideSelectionAIAction();
    const text = event.clipboardData.getData("text/plain");
    insertPlainTextAtSelection(text);

    const target = event.currentTarget;
    window.setTimeout(function syncContentAfterPaste() {
      const nextContent = readContentEditorText(target);
      contentValueRef.current = nextContent;
      setContentValue(nextContent);
      renderContentEditorText(target, nextContent);
      moveCaretToEnd(target);
    }, 0);
  }

  // handleContentKeyDown 处理正文编辑器内需要覆盖浏览器默认行为的按键。
  // 参数 event 表示正文段落编辑器键盘事件。
  function handleContentKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();
    hideSelectionAIAction();
    insertPlainTextAtSelection("　　");
    const nextContent = readContentEditorText(event.currentTarget);
    contentValueRef.current = nextContent;
    setContentValue(nextContent);
  }

  // handleContentKeyUp 在键盘调整正文选区后刷新 AI 修改按钮。
  function handleContentKeyUp() {
    refreshSelectionAIActionAfterSelection();
  }

  // handleContentMouseDown 将编辑器空白区域点击固定为移动到正文末尾。
  // 参数 event 表示正文段落编辑器鼠标按下事件。
  function handleContentMouseDown(event: MouseEvent<HTMLDivElement>) {
    hideSelectionAIAction();
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    event.currentTarget.focus();
    ensureContentEditorHasParagraph(event.currentTarget);
    moveCaretToEnd(getContentEditorTailNode(event.currentTarget));
  }

  // handleContentMouseUp 在鼠标完成正文选区后刷新 AI 修改按钮。
  function handleContentMouseUp() {
    refreshSelectionAIActionAfterSelection();
  }

  // handleSelectionAIActionMouseDown 保持正文选区不被 AI 修改按钮抢走焦点。
  // 参数 event 表示 AI 修改按钮鼠标按下事件。
  function handleSelectionAIActionMouseDown(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
  }

  // handleSelectionAIActionClick 将当前正文选中文本填入 AI 输入框。
  function handleSelectionAIActionClick() {
    if (!selectionAIAction) {
      return;
    }
    aiPrefillMessageIDRef.current += 1;
    setAiPanelOpen(true);
    setAiPrefillMessage({
      id: aiPrefillMessageIDRef.current,
      content: selectionAIAction.content,
    });
    hideSelectionAIAction();
  }

  // handleSubmit 校验章节表单并提交创建或更新请求。
  // 参数 event 表示表单提交事件。
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || state !== "ready") {
      return;
    }

    setSubmitting(true);

    try {
      await saveCurrentChapter({ force: true, showTitleError: true });
      if (
        !readCurrentChapterValues().title ||
        persistedChapterIDRef.current === null
      ) {
        return;
      }

      Toast.success("章节已保存");
      props.onBackToNovelDetail(props.novelId);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "章节保存失败，请稍后再试"));
      if (
        persistedChapterIDRef.current === null &&
        isChapterNumberConflictError(error)
      ) {
        void loadNextChapterNumber(undefined, true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // replaceEditorContent 使用指定正文替换编辑器内容快照。
  // 参数 value 表示需要写入编辑器的纯文本正文。
  function replaceEditorContent(value: string) {
    contentValueRef.current = value;
    setContentValue(value);
    setContentSnapshotId(function nextContentSnapshotId(currentValue) {
      return currentValue + 1;
    });
  }

  const displayedChapterNumber = formatChapterNumber(chapterNumber);

  return (
    <main
      className={`chapter-editor-page${
        aiPanelOpen ? " chapter-editor-page-ai-open" : ""
      }`}
    >
      <header className="chapter-editor-nav">
        <button type="button" className="chapter-editor-back" onClick={handleBack}>
          <span aria-hidden="true">←</span>
          <span>返回作品详情</span>
        </button>
        <div className="chapter-editor-title">
          <p>{isEditMode ? "Edit Chapter" : "New Chapter"}</p>
          <h1>{isEditMode ? "修改章节" : "新增章节"}</h1>
        </div>
      </header>

      <div
        className={`chapter-editor-workbench${
          aiPanelOpen ? " chapter-editor-workbench-ai-open" : ""
        }`}
      >
        <section className="chapter-editor-shell" aria-labelledby="chapter-editor-title">
          {state === "loading" ? <ChapterEditorSkeleton /> : null}
          {state === "error" ? (
            <ChapterEditorError
              message={message}
              onBack={handleBack}
              onRetry={handleRetry}
            />
          ) : null}
          {state === "ready" ? (
            <form className="chapter-editor-paper" onSubmit={handleSubmit}>
              <span className="chapter-editor-corner chapter-editor-corner-top-left" />
              <span className="chapter-editor-corner chapter-editor-corner-top-right" />
              <span className="chapter-editor-corner chapter-editor-corner-bottom-left" />
              <span className="chapter-editor-corner chapter-editor-corner-bottom-right" />

              <header className="chapter-editor-paper-header">
                <p className="chapter-editor-kicker" aria-label="章节号">
                  {displayedChapterNumber}
                </p>
                <input
                  ref={titleInputRef}
                  className="chapter-title-input"
                  id="chapter-editor-title"
                  value={titleValue}
                  placeholder={chapter?.title || "寒蝉凄切"}
                  aria-invalid={titleError ? "true" : "false"}
                  aria-describedby={titleError ? "chapter-title-error" : undefined}
                  aria-label="章节名"
                  onChange={handleTitleChange}
                />
                <span className="chapter-title-divider" aria-hidden="true" />
                {titleError ? (
                  <p className="chapter-title-error" id="chapter-title-error">
                    {titleError}
                  </p>
                ) : null}
              </header>

              <div className="chapter-editor-writing-area">
                <div className="chapter-editor-binding" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div
                  ref={contentEditorRef}
                  className="chapter-content-editor"
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="章节正文"
                  data-placeholder="在这里落下第一笔..."
                  onBlur={handleContentBlur}
                  onFocus={handleContentFocus}
                  onInput={handleContentChange}
                  onKeyDown={handleContentKeyDown}
                  onKeyUp={handleContentKeyUp}
                  onMouseDown={handleContentMouseDown}
                  onMouseUp={handleContentMouseUp}
                  onPaste={handleContentPaste}
                />
              </div>

              <footer className="chapter-editor-footer">
                <span className="chapter-word-count" aria-live="polite">
                  字数: {liveWordCount.toLocaleString("zh-CN")}
                </span>
                <button
                  type="submit"
                  className="chapter-editor-save"
                  disabled={submitting}
                >
                  {submitting ? "保存中..." : "保存"}
                </button>
              </footer>
            </form>
          ) : null}
        </section>

        {aiPanelOpen ? (
          <ChapterAiAssistantPanel
            novelId={props.novelId}
            ensureChapterSavedForAgent={ensureChapterSavedForAgent}
            prefillMessage={aiPrefillMessage}
            onClose={handleAiAssistantClose}
            onUnauthorized={props.onUnauthorized}
          />
        ) : null}
      </div>

      {selectionAIAction ? (
        <Button
          aria-label="用 AI 修改选中的正文"
          className="chapter-selection-ai-action"
          colorful
          htmlType="button"
          icon={<IconAIEditLevel1 aria-hidden="true" />}
          onClick={handleSelectionAIActionClick}
          onMouseDown={handleSelectionAIActionMouseDown}
          size="small"
          style={{
            left: selectionAIAction.left,
            top: selectionAIAction.top,
          }}
          theme="solid"
          type="primary"
        >
          AI修改
        </Button>
      ) : null}

      <div
        aria-controls="chapter-ai-assistant-panel"
        aria-expanded={aiPanelOpen}
        aria-label={aiPanelOpen ? "收起 AI 写作助手" : "打开 AI 写作助手"}
        className="chapter-ai-float-trigger"
        onClick={handleAiAssistantToggle}
        onKeyDown={handleAiAssistantTriggerKeyDown}
        role="button"
        tabIndex={0}
        title={aiPanelOpen ? "收起 AI 写作助手" : "打开 AI 写作助手"}
      >
        <FloatButton
          colorful
          icon={<IconAIEditLevel1 />}
          size="large"
          style={{ position: "static" }}
        />
      </div>
    </main>
  );
}

// ChapterAiAssistantPanel 渲染章节编辑页右侧 AI 对话侧栏。
// 参数 props 表示章节 AI 助手侧栏需要的回调。
function ChapterAiAssistantPanel(props: ChapterAiAssistantPanelProps) {
  const [chats, setChats] = useState<ChapterAiMessage[]>(chapterAiAssistantMessages);
  const [providers, setProviders] = useState<AIProviderItem[]>([]);
  const [models, setModels] = useState<AIProviderModelItem[]>([]);
  const [selectedProviderID, setSelectedProviderID] = useState("");
  const [selectedModelID, setSelectedModelID] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [providerLoading, setProviderLoading] = useState(true);
  const [modelLoading, setModelLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyClearing, setHistoryClearing] = useState(false);
  const [assistantSending, setAssistantSending] = useState(false);
  const [promptRecommendationLoading, setPromptRecommendationLoading] =
    useState(false);
  const [promptRecommendationType, setPromptRecommendationType] = useState("");
  const [promptRecommendations, setPromptRecommendations] = useState<
    RecommendedPromptItem[]
  >([]);
  const assistantInputRef = useRef<HTMLTextAreaElement | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);
  const promptRecommendationControllerRef = useRef<AbortController | null>(null);
  const promptRecommendationCacheRef = useRef<
    Map<string, ChapterAiPromptRecommendationCache>
  >(new Map());
  // promptRecommendationSuppressedInputRef 记录由推荐提示词插入产生、无需再次推荐的输入内容。
  const promptRecommendationSuppressedInputRef = useRef<string | null>(null);
  const consumedPrefillMessageIDRef = useRef<number | null>(null);
  const onUnauthorized = props.onUnauthorized;

  const selectedProvider = useMemo(
    function findSelectedProvider() {
      return providers.find(function matchProvider(provider) {
        return String(provider.id) === selectedProviderID;
      });
    },
    [providers, selectedProviderID],
  );
  const selectedModel = useMemo(
    function findSelectedModel() {
      return models.find(function matchModel(model) {
        return model.id === selectedModelID;
      });
    },
    [models, selectedModelID],
  );
  const providerSelectPlaceholder = providerLoading
    ? "加载中..."
    : providers.length === 0
      ? "暂无提供商"
      : "选择提供商";
  const modelSelectPlaceholder = modelLoading
    ? "加载中..."
    : models.length === 0
      ? "暂无模型"
      : "选择模型";

  useLayoutEffect(
    function syncAssistantInputHeight() {
      syncChapterAiInputHeight(assistantInputRef.current);
    },
    [inputValue],
  );

  useEffect(
    function loadAgentHistory() {
      const controller = new AbortController();
      setHistoryLoading(true);

      async function loadHistory() {
        try {
          const data = await fetchNovelAgentMessages(props.novelId, controller.signal);
          if (controller.signal.aborted) {
            return;
          }

          if (data.items.length === 0) {
            setChats(chapterAiAssistantMessages);
            return;
          }
          setChats(data.items.map(chapterAiMessageFromHistory));
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            onUnauthorized();
            return;
          }
          setChats(chapterAiAssistantMessages);
          Toast.error(getErrorMessage(error, "AI 历史消息加载失败，请稍后再试"));
        } finally {
          if (!controller.signal.aborted) {
            setHistoryLoading(false);
          }
        }
      }

      void loadHistory();
      return function cancelHistoryLoad() {
        controller.abort();
      };
    },
    [onUnauthorized, props.novelId],
  );

  useEffect(
    function loadEnabledProviders() {
      const controller = new AbortController();
      setProviderLoading(true);

      async function loadProviders() {
        try {
          const data = await fetchAIProviders({
            page: 1,
            pageSize: chapterAiProviderPageSize,
            signal: controller.signal,
          });
          if (controller.signal.aborted) {
            return;
          }

          const enabledProviders = data.items.filter(function onlyEnabled(provider) {
            return provider.enabled;
          });
          setProviders(enabledProviders);
          setSelectedProviderID(function keepExistingProvider(currentValue) {
            if (
              currentValue &&
              enabledProviders.some(function matchProvider(provider) {
                return String(provider.id) === currentValue;
              })
            ) {
              return currentValue;
            }
            return enabledProviders[0] ? String(enabledProviders[0].id) : "";
          });
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            onUnauthorized();
            return;
          }
          Toast.error(getErrorMessage(error, "AI 提供商加载失败，请稍后再试"));
        } finally {
          if (!controller.signal.aborted) {
            setProviderLoading(false);
          }
        }
      }

      void loadProviders();
      return function cancelProviderLoad() {
        controller.abort();
      };
    },
    [onUnauthorized],
  );

  useEffect(
    function cancelAssistantStreamOnUnmount() {
      return function cancelAssistantStream() {
        streamControllerRef.current?.abort();
        promptRecommendationControllerRef.current?.abort();
      };
    },
    [],
  );

  useEffect(
    function consumePrefillMessage() {
      const prefillMessage = props.prefillMessage;
      if (!prefillMessage || consumedPrefillMessageIDRef.current === prefillMessage.id) {
        return;
      }

      consumedPrefillMessageIDRef.current = prefillMessage.id;
      if (inputValue.trim()) {
        Toast.warning("AI 输入框已有内容，请先发送或清空后再使用 AI 修改");
        return;
      }
      setInputValue(prefillMessage.content);
    },
    [inputValue, props.prefillMessage],
  );

  useEffect(
    function loadProviderModels() {
      if (!selectedProviderID) {
        setModels([]);
        setSelectedModelID("");
        return;
      }

      const controller = new AbortController();
      const defaultModel = selectedProvider?.default_model?.trim() ?? "";
      setModelLoading(true);
      setModels([]);
      setSelectedModelID("");

      async function loadModels() {
        try {
          const data = await fetchAIProviderModelsByProviderID(
            Number(selectedProviderID),
            controller.signal,
          );
          if (controller.signal.aborted) {
            return;
          }

          const nextModels = modelsWithDefaultModel(data.items, defaultModel);
          setModels(nextModels);
          setSelectedModelID(preferredModelID(nextModels, defaultModel));
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            onUnauthorized();
            return;
          }
          if (defaultModel) {
            const fallbackModels = [defaultAIProviderModel(defaultModel)];
            setModels(fallbackModels);
            setSelectedModelID(defaultModel);
            Toast.warning("AI 模型列表获取失败，已使用默认模型");
            return;
          }
          Toast.error(getErrorMessage(error, "AI 模型列表获取失败，请稍后再试"));
        } finally {
          if (!controller.signal.aborted) {
            setModelLoading(false);
          }
        }
      }

      void loadModels();
      return function cancelModelLoad() {
        controller.abort();
      };
    },
    [onUnauthorized, selectedProvider?.default_model, selectedProviderID],
  );

  useEffect(
    function recommendPromptsForAssistantInput() {
      const rawInput = inputValue;
      const normalizedInput = rawInput.trim();
      if (
        !normalizedInput ||
        !selectedProviderID ||
        !selectedModelID ||
        assistantSending ||
        modelLoading
      ) {
        promptRecommendationControllerRef.current?.abort();
        setPromptRecommendationLoading(false);
        setPromptRecommendationType("");
        setPromptRecommendations([]);
        if (!normalizedInput) {
          promptRecommendationSuppressedInputRef.current = null;
        }
        return;
      }

      if (promptRecommendationSuppressedInputRef.current === normalizedInput) {
        promptRecommendationControllerRef.current?.abort();
        setPromptRecommendationLoading(false);
        setPromptRecommendationType("");
        setPromptRecommendations([]);
        return;
      }

      const providerId = Number(selectedProviderID);
      if (!Number.isFinite(providerId) || providerId <= 0) {
        setPromptRecommendationLoading(false);
        setPromptRecommendationType("");
        setPromptRecommendations([]);
        return;
      }

      const cacheKey = createPromptRecommendationCacheKey(
        providerId,
        selectedModelID,
        normalizedInput,
      );
      const cachedRecommendation = promptRecommendationCacheRef.current.get(cacheKey);
      if (cachedRecommendation) {
        setPromptRecommendationLoading(false);
        setPromptRecommendationType(cachedRecommendation.promptType);
        setPromptRecommendations(cachedRecommendation.items);
        return;
      }

      const controller = new AbortController();
      promptRecommendationControllerRef.current?.abort();
      promptRecommendationControllerRef.current = controller;
      setPromptRecommendationLoading(true);

      const timer = window.setTimeout(function requestPromptRecommendation() {
        async function loadPromptRecommendation() {
          try {
            const recommendation = await recommendPromptType({
              providerId,
              model: selectedModelID,
              message: rawInput,
              signal: controller.signal,
            });
            if (controller.signal.aborted) {
              return;
            }
            if (
              recommendation.action !== "prompt_search" ||
              !recommendation.matched ||
              !recommendation.prompt_type
            ) {
              const emptyRecommendation = { promptType: "", items: [] };
              promptRecommendationCacheRef.current.set(cacheKey, emptyRecommendation);
              setPromptRecommendationType("");
              setPromptRecommendations([]);
              return;
            }

            const list = await fetchRecommendedPrompts({
              promptType: recommendation.prompt_type,
              pageSize: chapterAiPromptRecommendationPageSize,
              signal: controller.signal,
            });
            if (controller.signal.aborted) {
              return;
            }

            const nextRecommendation = {
              promptType: recommendation.prompt_type,
              items: list.items,
            };
            promptRecommendationCacheRef.current.set(cacheKey, nextRecommendation);
            setPromptRecommendationType(nextRecommendation.promptType);
            setPromptRecommendations(nextRecommendation.items);
          } catch (error) {
            if (controller.signal.aborted) {
              return;
            }
            if (error instanceof UnauthorizedError) {
              onUnauthorized();
              return;
            }
            setPromptRecommendationType("");
            setPromptRecommendations([]);
          } finally {
            if (promptRecommendationControllerRef.current === controller) {
              promptRecommendationControllerRef.current = null;
            }
            if (!controller.signal.aborted) {
              setPromptRecommendationLoading(false);
            }
          }
        }

        void loadPromptRecommendation();
      }, chapterAiPromptRecommendationDelayMs);

      return function cancelPromptRecommendation() {
        window.clearTimeout(timer);
        controller.abort();
      };
    },
    [
      assistantSending,
      inputValue,
      modelLoading,
      onUnauthorized,
      selectedModelID,
      selectedProviderID,
    ],
  );

  // handleProviderChange 切换当前用于查询模型的 AI 提供商。
  // 参数 event 表示提供商选择框变更事件。
  function handleProviderChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedProviderID(event.target.value);
  }

  // handleModelChange 切换当前对话选择的 AI 模型。
  // 参数 event 表示模型选择框变更事件。
  function handleModelChange(event: ChangeEvent<HTMLSelectElement>) {
    setSelectedModelID(event.target.value);
  }

  // handleAssistantInputChange 同步 AI 对话输入框内容。
  // 参数 event 表示输入框变更事件。
  function handleAssistantInputChange(event: ChangeEvent<HTMLTextAreaElement>) {
    promptRecommendationSuppressedInputRef.current = null;
    setInputValue(event.target.value);
  }

  // handleApplyRecommendedPrompt 将推荐提示词正文追加到当前 AI 输入框。
  // 参数 item 表示用户点击的推荐提示词。
  function handleApplyRecommendedPrompt(item: RecommendedPromptItem) {
    const separator = inputValue.trim()
      ? inputValue.endsWith("\n")
        ? "\n"
        : "\n\n"
      : "";
    const nextInputValue = `${inputValue}${separator}${item.content}`;
    promptRecommendationSuppressedInputRef.current = nextInputValue.trim();
    promptRecommendationControllerRef.current?.abort();
    promptRecommendationControllerRef.current = null;
    setPromptRecommendationLoading(false);
    setInputValue(nextInputValue);
    setPromptRecommendationType("");
    setPromptRecommendations([]);
  }

  // handleAssistantInputKeyDown 处理 AI 对话输入框键盘提交。
  // 参数 event 表示输入框键盘事件。
  function handleAssistantInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      void submitAssistantMessage();
    }
  }

  // handleAssistantSubmit 处理 AI 对话输入区提交。
  // 参数 event 表示输入区表单提交事件。
  function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAssistantMessage();
  }

  // handleAssistantClose 关闭 AI 侧栏并取消仍在进行的流式请求。
  function handleAssistantClose() {
    streamControllerRef.current?.abort();
    props.onClose();
  }

  // handleClearAssistantHistory 清空当前小说的 AI 历史消息。
  async function handleClearAssistantHistory() {
    if (assistantSending) {
      Toast.info("AI 正在回复，稍后再清空历史");
      return;
    }
    if (historyClearing) {
      return;
    }

    setHistoryClearing(true);
    try {
      await clearNovelAgentMessages(props.novelId);
      setChats(chapterAiAssistantMessages);
      Toast.success("AI 历史消息已清空");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "AI 历史消息清空失败，请稍后再试"));
    } finally {
      setHistoryClearing(false);
    }
  }

  // submitAssistantMessage 将用户输入发送给后端小说写作 Agent。
  async function submitAssistantMessage() {
    const normalizedInput = inputValue.trim();
    if (assistantSending) {
      Toast.info("AI 正在回复，请稍后再发送");
      return;
    }
    if (providers.length === 0) {
      Toast.warning("请先在设置中启用 AI 提供商");
      return;
    }
    if (!selectedProviderID) {
      Toast.warning("请选择 AI 提供商");
      return;
    }
    if (modelLoading) {
      Toast.info("模型列表正在加载");
      return;
    }
    if (!selectedModelID) {
      Toast.warning("请选择 AI 模型");
      return;
    }
    if (!normalizedInput) {
      Toast.warning("请输入要发送给 AI 的内容");
      return;
    }

    setAssistantSending(true);
    let savedChapterID: number | null;
    try {
      savedChapterID = await props.ensureChapterSavedForAgent();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        setAssistantSending(false);
        onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "章节保存失败，请稍后再试"));
      setAssistantSending(false);
      return;
    }
    if (savedChapterID === null) {
      setAssistantSending(false);
      return;
    }

    const providerName = selectedProvider?.name ?? "当前提供商";
    const modelName = formatAIModelName(selectedModel);
    const createdAt = Date.now();
    const pairID = createChapterAiPairID(createdAt);
    const userMessageID = createChapterAiMessageID("user", createdAt);
    const assistantMessageID = createChapterAiMessageID("assistant", createdAt);
    const retryPayload: ChapterAiRetryPayload = {
      providerId: Number(selectedProviderID),
      modelId: selectedModelID,
      message: normalizedInput,
      providerName,
      modelName,
    };
    setChats(function appendAssistantMessages(currentChats) {
      return [
        ...currentChats,
        {
          id: userMessageID,
          chapterAiPairID: pairID,
          chapterAiRetryable: false,
          chapterAiRetryPayload: retryPayload,
          role: "user",
          content: normalizedInput,
        },
        {
          id: assistantMessageID,
          chapterAiPairID: pairID,
          chapterAiSourceID: assistantMessageID,
          role: "assistant",
          content: "",
          status: "in_progress",
        },
      ];
    });
    setInputValue("");
    setPromptRecommendationType("");
    setPromptRecommendations([]);

    await runChapterAiStream({
      pairID,
      assistantMessageID,
      savedChapterID,
      retryPayload,
    });
  }

  // handleRetryAssistantMessage 重新发送指定用户消息对应的 AI 请求。
  // 参数 message 表示触发重试的用户消息。
  async function handleRetryAssistantMessage(message: ChapterAiMessage) {
    if (assistantSending) {
      Toast.info("AI 正在回复，请稍后再重试");
      return;
    }

    const pairID = message.chapterAiPairID;
    const retryPayload = message.chapterAiRetryPayload;
    if (!pairID || !retryPayload) {
      Toast.warning("当前消息缺少重试信息");
      return;
    }

    const assistantMessage = chats.find(function findPairAssistantMessage(chat) {
      return chat.role === "assistant" && chat.chapterAiPairID === pairID;
    });
    const assistantMessageID = assistantMessage?.chapterAiSourceID ?? assistantMessage?.id;
    if (!assistantMessageID || typeof assistantMessageID !== "string") {
      Toast.warning("未找到可重试的 AI 回复");
      return;
    }

    setAssistantSending(true);
    let savedChapterID: number | null;
    try {
      savedChapterID = await props.ensureChapterSavedForAgent();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        setAssistantSending(false);
        onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "章节保存失败，请稍后再试"));
      setAssistantSending(false);
      return;
    }
    if (savedChapterID === null) {
      setAssistantSending(false);
      return;
    }

    resetChapterAiRequestForRetry(pairID, assistantMessageID);
    await runChapterAiStream({
      pairID,
      assistantMessageID,
      savedChapterID,
      retryPayload,
    });
  }

  // runChapterAiStream 执行章节 AI 流式请求并更新对应助手消息。
  // 参数 request 表示本次流式请求所需的消息配对、章节和模型上下文。
  async function runChapterAiStream(request: ChapterAiStreamRequest) {
    const controller = new AbortController();
    streamControllerRef.current?.abort();
    streamControllerRef.current = controller;

    let assistantContent = "";
    let handledFailure = false;

    // handleChapterAiStreamFailure 将当前 AI 请求标记为失败并开启用户消息重试入口。
    // 参数 errorMessage 表示展示给用户的失败原因。
    function handleChapterAiStreamFailure(errorMessage: string) {
      if (handledFailure) {
        return;
      }
      handledFailure = true;
      markChapterAiRequestFailed(
        request.pairID,
        request.assistantMessageID,
        errorMessage,
      );
      Toast.error(errorMessage);
    }

    try {
      await streamNovelAgentChat(
        {
          providerId: request.retryPayload.providerId,
          model: request.retryPayload.modelId,
          message: request.retryPayload.message,
          novelId: props.novelId,
          chapterId: request.savedChapterID,
          signal: controller.signal,
        },
        {
          onEvent(event) {
            if (handledFailure) {
              return;
            }
            if (event.type === "delta") {
              assistantContent += event.content ?? "";
              updateAssistantMessage(
                request.assistantMessageID,
                assistantContent,
                "in_progress",
              );
              return;
            }
            if (event.type === "done") {
              assistantContent = event.content || assistantContent;
              updateAssistantMessage(
                request.assistantMessageID,
                assistantContent,
                "completed",
              );
              updateChapterAiPairRetryable(request.pairID, false);
              return;
            }
            if (event.type === "error") {
              const baseErrorMessage =
                event.message ||
                `${request.retryPayload.providerName} / ${request.retryPayload.modelName} 生成失败，请稍后再试`;
              const requestID = event.request_id?.trim();
              const errorMessage = requestID
                ? `${baseErrorMessage}（请求ID：${requestID}）`
                : baseErrorMessage;
              handleChapterAiStreamFailure(errorMessage);
            }
          },
        },
      );
    } catch (error) {
      if (handledFailure) {
        return;
      }
      if (controller.signal.aborted) {
        updateChapterAiPairRetryable(request.pairID, false);
        updateAssistantMessage(
          request.assistantMessageID,
          "本次 AI 回复已取消。",
          "cancelled",
        );
        return;
      }
      if (error instanceof UnauthorizedError) {
        handleChapterAiStreamFailure(getErrorMessage(error, "登录已过期，请重新登录"));
        onUnauthorized();
        return;
      }
      const errorMessage = getErrorMessage(error, "AI 写作助手生成失败，请稍后再试");
      handleChapterAiStreamFailure(errorMessage);
    } finally {
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null;
      }
      setAssistantSending(false);
    }
  }

  // markChapterAiRequestFailed 标记指定 AI 请求失败并允许用户消息重试。
  // 参数 pairID 表示失败请求的消息配对 ID；参数 assistantMessageID 表示助手消息基础 ID；参数 errorMessage 表示失败说明。
  function markChapterAiRequestFailed(
    pairID: string,
    assistantMessageID: string,
    errorMessage: string,
  ) {
    updateChapterAiPairRetryable(pairID, true);
    updateAssistantMessage(assistantMessageID, errorMessage, "failed");
  }

  // updateChapterAiPairRetryable 更新指定配对中用户消息的可重试状态。
  // 参数 pairID 表示需要更新的消息配对 ID；参数 retryable 表示是否允许展示重试按钮。
  function updateChapterAiPairRetryable(pairID: string, retryable: boolean) {
    setChats(function updateMessageRetryable(currentChats) {
      return currentChats.map(function updateChatRetryable(chat) {
        if (chat.role !== "user" || chat.chapterAiPairID !== pairID) {
          return chat;
        }
        return {
          ...chat,
          chapterAiRetryable: retryable,
        };
      });
    });
  }

  // resetChapterAiRequestForRetry 重置指定配对的助手消息，使重试复用原对话位置。
  // 参数 pairID 表示需要重试的消息配对 ID；参数 assistantMessageID 表示助手消息基础 ID。
  function resetChapterAiRequestForRetry(pairID: string, assistantMessageID: string) {
    setChats(function resetRetryMessages(currentChats) {
      return currentChats.map(function resetRetryMessage(chat) {
        if (chat.chapterAiPairID !== pairID) {
          return chat;
        }
        if (chat.role === "user") {
          return {
            ...chat,
            chapterAiRetryable: false,
          };
        }
        if (chat.role === "assistant") {
          return {
            ...chat,
            id: assistantMessageID,
            chapterAiSourceID: assistantMessageID,
            content: "",
            status: "in_progress",
          };
        }
        return chat;
      });
    });
  }

  // updateAssistantMessage 更新指定 AI 助手消息内容。
  // 参数 messageID 表示需要更新的基础消息 ID；参数 content 表示新的消息内容；参数 status 表示消息当前生成状态。
  function updateAssistantMessage(messageID: string, content: string, status: string) {
    setChats(function updateMessage(currentChats) {
      return currentChats.map(function updateChat(chat) {
        if (chat.id !== messageID && chat.chapterAiSourceID !== messageID) {
          return chat;
        }
        return {
          ...chat,
          id:
            status === "in_progress"
              ? chat.id
              : createChapterAiRenderMessageID(messageID, status, content.length),
          chapterAiSourceID: messageID,
          content,
          status,
        };
      });
    });
  }

  // renderChapterAiDialogueAction 渲染章节 AI 对话消息操作区，按消息角色保留允许的操作按钮。
  // 参数 actionProps 表示 Semi AIChatDialogue 传入的默认操作节点和样式类名。
  function renderChapterAiDialogueAction(actionProps: RenderActionProps) {
    const copyNode = actionProps.defaultActionsObj?.copyNode ?? null;
    const message = actionProps.message as ChapterAiMessage | undefined;
    if (message?.role !== "user") {
      return <div className={actionProps.className}>{copyNode}</div>;
    }

    return (
      <div className={actionProps.className}>
        {copyNode}
        {message.chapterAiRetryable === true ? (
          <Button
            aria-label="重试用户消息"
            className="semi-ai-chat-dialogue-action-btn"
            htmlType="button"
            icon={<IconRedoStroked aria-hidden="true" />}
            onClick={function retryChapterAiMessage(event) {
              event.preventDefault();
              event.stopPropagation();
              void handleRetryAssistantMessage(message);
            }}
            theme="borderless"
            title="重试"
            type="tertiary"
          />
        ) : null}
        <Button
          aria-label="修改用户消息"
          className="semi-ai-chat-dialogue-action-btn"
          htmlType="button"
          icon={<IconEditStroked aria-hidden="true" />}
          onClick={handleChapterAiPendingMessageAction}
          theme="borderless"
          title="修改"
          type="tertiary"
        />
        <Button
          aria-label="删除用户消息"
          className="semi-ai-chat-dialogue-action-btn"
          htmlType="button"
          icon={<IconDeleteStroked aria-hidden="true" />}
          onClick={handleChapterAiPendingMessageAction}
          theme="borderless"
          title="删除"
          type="tertiary"
        />
      </div>
    );
  }

  const chapterAiDialogueRenderConfig: DialogueRenderConfig = {
    renderDialogueAction: renderChapterAiDialogueAction,
  };

  return (
    <aside
      aria-label="AI 写作助手"
      className="chapter-ai-assistant-panel"
      id="chapter-ai-assistant-panel"
    >
      <div className="chapter-ai-assistant-card">
        <header className="chapter-ai-assistant-header">
          <div>
            <p>AI Assistant</p>
            <h2>写作助手</h2>
          </div>
          <div className="chapter-ai-assistant-actions">
            <button
              aria-label="清空 AI 历史消息"
              className="chapter-ai-assistant-clear"
              disabled={historyLoading || historyClearing || assistantSending}
              onClick={handleClearAssistantHistory}
              title="清空历史"
              type="button"
            >
              <IconDelete aria-hidden="true" />
            </button>
            <button
              aria-label="关闭 AI 写作助手"
              className="chapter-ai-assistant-close"
              onClick={handleAssistantClose}
              type="button"
            >
              <IconClose aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="chapter-ai-dialogue-wrap">
          <AIChatDialogue
            align="leftRight"
            chats={chats}
            className="chapter-ai-dialogue"
            dialogueRenderConfig={chapterAiDialogueRenderConfig}
            mode="bubble"
            roleConfig={chapterAiAssistantRoleConfig}
            style={{ height: "100%" }}
          />
        </div>
        <form className="chapter-ai-composer" onSubmit={handleAssistantSubmit}>
          <div className="chapter-ai-model-picker">
            <label className="chapter-ai-select-field">
              <span>提供商</span>
              <select
                aria-label="AI 提供商"
                disabled={providerLoading || providers.length === 0}
                onChange={handleProviderChange}
                value={selectedProviderID}
              >
                <option value="">{providerSelectPlaceholder}</option>
                {providers.map(function renderProviderOption(provider) {
                  return (
                    <option key={provider.id} value={String(provider.id)}>
                      {provider.name}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="chapter-ai-select-field">
              <span>模型</span>
              <select
                aria-label="AI 模型"
                disabled={!selectedProviderID || modelLoading || models.length === 0}
                onChange={handleModelChange}
                value={selectedModelID}
              >
                <option value="">{modelSelectPlaceholder}</option>
                {models.map(function renderModelOption(model) {
                  return (
                    <option key={model.id} value={model.id}>
                      {formatAIModelOption(model)}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
          {promptRecommendationLoading || promptRecommendations.length > 0 ? (
            <div className="chapter-ai-prompt-recommendations" aria-live="polite">
              <div className="chapter-ai-prompt-recommendation-header">
                <span>推荐提示词</span>
                {promptRecommendationType ? <strong>{promptRecommendationType}</strong> : null}
                {promptRecommendationLoading ? <em>匹配中...</em> : null}
              </div>
              {promptRecommendations.length > 0 ? (
                <div className="chapter-ai-prompt-recommendation-list">
                  {promptRecommendations.map(function renderPromptRecommendation(item) {
                    return (
                      <button
                        className="chapter-ai-prompt-recommendation-item"
                        key={item.id}
                        onClick={function applyPromptRecommendation() {
                          handleApplyRecommendedPrompt(item);
                        }}
                        type="button"
                      >
                        <span className="chapter-ai-prompt-recommendation-meta">
                          {item.prompt_type}
                        </span>
                        <strong>{item.description || "未填写简介"}</strong>
                        <span className="chapter-ai-prompt-recommendation-preview">
                          {item.content}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="chapter-ai-input-shell">
            <textarea
              ref={assistantInputRef}
              aria-label="AI 对话输入"
              className="chapter-ai-input"
              disabled={assistantSending}
              onChange={handleAssistantInputChange}
              onKeyDown={handleAssistantInputKeyDown}
              placeholder="输入你的问题或写作目标..."
              rows={1}
              value={inputValue}
            />
            <div className="chapter-ai-input-actions">
              <button
                aria-label="发送给 AI 写作助手"
                className="chapter-ai-send"
                disabled={modelLoading || assistantSending}
                title="发送"
                type="submit"
              >
                <IconArrowUp aria-hidden="true" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </aside>
  );
}

// createChapterAiMessageID 创建章节 AI 对话本地消息 ID。
// 参数 role 表示消息角色；参数 createdAt 表示消息创建时间戳。
function createChapterAiMessageID(role: string, createdAt: number): string {
  return `chapter-ai-${role}-${createdAt}`;
}

// createChapterAiPairID 创建同一轮章节 AI 用户消息和助手消息共用的配对 ID。
// 参数 createdAt 表示消息创建时间戳。
function createChapterAiPairID(createdAt: number): string {
  return `chapter-ai-pair-${createdAt}`;
}

// chapterAiMessageFromHistory 将后端历史消息转换为 AIChatDialogue 消息。
// 参数 item 表示后端返回的单条 Agent 历史消息。
function chapterAiMessageFromHistory(item: NovelAgentMessageItem): ChapterAiMessage {
  return {
    id: `chapter-ai-history-${item.id}`,
    role: item.role,
    content: item.content,
    status: "completed",
  };
}

// createChapterAiRenderMessageID 创建章节 AI 消息最终渲染 ID，避免流式 Markdown 旧解析结果覆盖最终内容。
// 参数 messageID 表示消息的基础 ID；参数 status 表示消息最终状态；参数 contentLength 表示最终内容长度。
function createChapterAiRenderMessageID(
  messageID: string,
  status: string,
  contentLength: number,
): string {
  return `${messageID}-${status}-${contentLength}`;
}

// createPromptRecommendationCacheKey 创建提示词推荐本地缓存键。
// 参数 providerId 表示 AI 提供商 ID；参数 modelId 表示模型标识；参数 input 表示用户输入框文本。
function createPromptRecommendationCacheKey(
  providerId: number,
  modelId: string,
  input: string,
): string {
  return `${providerId}::${modelId}::${input}`;
}

// syncChapterAiInputHeight 根据输入内容同步 AI 输入框高度。
// 参数 textarea 表示需要调整高度的 AI 输入框元素。
function syncChapterAiInputHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return;
  }

  textarea.style.height = "auto";
  const scrollHeight = textarea.scrollHeight;
  const nextHeight = Math.min(scrollHeight, chapterAiInputMaxHeight);
  textarea.style.height = `${nextHeight}px`;
  textarea.style.overflowY =
    scrollHeight > chapterAiInputMaxHeight ? "auto" : "hidden";
}

// getChapterSelectionAIAction 根据正文编辑器选区生成 AI 修改按钮状态。
// 参数 editor 表示章节正文段落编辑器。
function getChapterSelectionAIAction(
  editor: HTMLDivElement | null,
): ChapterSelectionAIAction | null {
  if (!editor || typeof window === "undefined") {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  if (!selectionBelongsToEditor(selection, editor)) {
    return null;
  }

  const content = selection.toString();
  if (!content.trim()) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = firstVisibleSelectionRect(range);
  if (!rect) {
    return null;
  }

  const topCandidate =
    rect.top - chapterSelectionAIActionHeight - chapterSelectionAIActionOffset;
  const top =
    topCandidate >= chapterSelectionAIActionViewportPadding
      ? topCandidate
      : rect.bottom + chapterSelectionAIActionOffset;
  const centeredLeft = rect.left + rect.width / 2 - chapterSelectionAIActionWidth / 2;
  return {
    content,
    top: clampToViewport(
      top,
      chapterSelectionAIActionViewportPadding,
      window.innerHeight -
        chapterSelectionAIActionHeight -
        chapterSelectionAIActionViewportPadding,
    ),
    left: clampToViewport(
      centeredLeft,
      chapterSelectionAIActionViewportPadding,
      window.innerWidth -
        chapterSelectionAIActionWidth -
        chapterSelectionAIActionViewportPadding,
    ),
  };
}

// selectionBelongsToEditor 判断当前浏览器选区是否完全位于正文编辑器内。
// 参数 selection 表示浏览器当前选区；参数 editor 表示章节正文段落编辑器。
function selectionBelongsToEditor(selection: Selection, editor: HTMLDivElement): boolean {
  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (!anchorNode || !focusNode) {
    return false;
  }
  return editor.contains(anchorNode) && editor.contains(focusNode);
}

// firstVisibleSelectionRect 返回选区中第一个可用于定位的矩形。
// 参数 range 表示浏览器当前选区范围。
function firstVisibleSelectionRect(range: Range): DOMRect | null {
  const boundingRect = range.getBoundingClientRect();
  if (boundingRect.width > 0 || boundingRect.height > 0) {
    return boundingRect;
  }

  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width > 0 || rect.height > 0) {
      return rect;
    }
  }
  return null;
}

// clampToViewport 将数值限制在指定视口范围内。
// 参数 value 表示原始坐标；参数 min 表示允许的最小值；参数 max 表示允许的最大值。
function clampToViewport(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}

// formatAIModelName 返回 AI 模型在对话提示中的展示名。
// 参数 model 表示当前选择的 AI 模型，可以为空。
function formatAIModelName(model?: AIProviderModelItem): string {
  if (!model) {
    return "当前模型";
  }
  return model.display_name || model.id;
}

// defaultAIProviderModel 根据手动填写的默认模型标识构造前端模型选项。
// 参数 modelID 表示 AI 提供商配置的默认模型标识。
function defaultAIProviderModel(modelID: string): AIProviderModelItem {
  return {
    id: modelID,
    display_name: modelID,
    owned_by: "",
    created_at: "",
    supported_generation_methods: [],
  };
}

// modelsWithDefaultModel 合并官方模型列表和 AI 提供商默认模型。
// 参数 items 表示模型列表接口返回的模型选项；参数 defaultModel 表示 AI 提供商配置的默认模型标识。
function modelsWithDefaultModel(
  items: AIProviderModelItem[],
  defaultModel: string,
): AIProviderModelItem[] {
  const normalizedDefaultModel = defaultModel.trim();
  if (!normalizedDefaultModel) {
    return items;
  }
  const hasDefaultModel = items.some(function matchDefaultModel(model) {
    return model.id === normalizedDefaultModel;
  });
  if (hasDefaultModel) {
    return items;
  }
  return [defaultAIProviderModel(normalizedDefaultModel), ...items];
}

// preferredModelID 返回模型列表加载完成后应优先选中的模型标识。
// 参数 items 表示可选模型列表；参数 defaultModel 表示 AI 提供商配置的默认模型标识。
function preferredModelID(items: AIProviderModelItem[], defaultModel: string): string {
  const normalizedDefaultModel = defaultModel.trim();
  if (
    normalizedDefaultModel &&
    items.some(function matchDefaultModel(model) {
      return model.id === normalizedDefaultModel;
    })
  ) {
    return normalizedDefaultModel;
  }
  return items[0]?.id ?? "";
}

// formatAIModelOption 返回 AI 模型下拉选项展示文本。
// 参数 model 表示需要渲染的 AI 模型。
function formatAIModelOption(model: AIProviderModelItem): string {
  if (!model.display_name || model.display_name === model.id) {
    return model.id;
  }
  return `${model.display_name} (${model.id})`;
}

// ChapterEditorSkeleton 渲染章节编辑页加载中的占位内容。
function ChapterEditorSkeleton() {
  return (
    <div className="chapter-editor-paper chapter-editor-skeleton" aria-label="章节加载中">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

// ChapterEditorErrorProps 表示章节编辑页错误状态需要展示的数据和回调。
interface ChapterEditorErrorProps {
  // message 表示章节加载失败时展示的错误提示。
  message: string;
  // onBack 表示返回小说详情页时执行的回调。
  onBack: () => void;
  // onRetry 表示点击重试按钮时执行的回调。
  onRetry: () => void;
}

// ChapterEditorError 渲染章节编辑页错误状态。
// 参数 props 表示章节编辑页错误状态需要展示的数据和回调。
function ChapterEditorError(props: ChapterEditorErrorProps) {
  return (
    <div className="chapter-editor-error" role="alert">
      <p>{props.message}</p>
      <div>
        <button type="button" onClick={props.onRetry}>
          重新加载
        </button>
        <button type="button" onClick={props.onBack}>
          返回详情
        </button>
      </div>
    </div>
  );
}

// chapterToFormValues 将章节详情转换成表单初始值。
// 参数 chapter 表示后端返回的章节详情数据。
function chapterToFormValues(chapter: ChapterDetailItem): ChapterFormValues {
  return {
    title: normalizeText(chapter.title),
    content: normalizeText(chapter.content),
  };
}

// normalizeChapterFormValues 清理章节表单数据。
// 参数 values 表示用户在章节编辑页输入的原始字段值。
function normalizeChapterFormValues(
  values: ChapterFormValues,
): ChapterUpdateParams {
  return {
    title: normalizeText(values.title),
    content: normalizeText(values.content),
  };
}

// normalizeChapterCreateValues 生成创建章节时提交给后端的请求参数。
// 参数 values 表示已清理的章节标题和正文；参数 chapterNumber 表示后端返回的只读章节号。
function normalizeChapterCreateValues(
  values: ChapterUpdateParams,
  chapterNumber: number | null,
): ChapterCreateParams {
  return {
    chapter_number: chapterNumber ?? 0,
    title: values.title,
    content: values.content,
  };
}

// formatChapterNumber 格式化只读章节号展示文本。
// 参数 chapterNumber 表示后端返回的章节号。
function formatChapterNumber(chapterNumber: number | null): string {
  return chapterNumber === null ? "第 ... 章" : `第 ${chapterNumber} 章`;
}

// renderContentEditorText 将纯文本正文渲染成带首行缩进样式的段落节点。
// 参数 element 表示正文段落编辑器；参数 value 表示需要渲染的纯文本正文。
function renderContentEditorText(element: HTMLDivElement | null, value: string) {
  if (!element) {
    return;
  }

  const normalizedValue = normalizeEditorPlainText(value);
  if (!normalizedValue) {
    element.replaceChildren();
    return;
  }

  element.replaceChildren(
    ...normalizedValue.split("\n").map(createContentParagraph),
  );
}

// createContentParagraph 创建一个正文段落节点。
// 参数 text 表示该段落保存的纯文本内容。
function createContentParagraph(text: string): HTMLParagraphElement {
  const paragraph = document.createElement("p");
  paragraph.className = "chapter-content-paragraph";

  if (text) {
    paragraph.textContent = text;
  } else {
    paragraph.appendChild(document.createElement("br"));
  }

  return paragraph;
}

// readContentEditorText 从正文段落编辑器读取纯文本正文。
// 参数 element 表示正文段落编辑器。
function readContentEditorText(element: HTMLDivElement | null): string {
  if (!element) {
    return "";
  }

  const lines = trimTrailingEmptyEditorLines(
    Array.from(element.childNodes).flatMap(readContentNodeLines),
  );
  if (lines.length === 0) {
    return normalizeEditorPlainText(element.textContent ?? "");
  }

  return normalizeEditorPlainText(lines.join("\n"));
}

// readContentNodeLines 从正文编辑器子节点读取一组文本行。
// 参数 node 表示正文编辑器内的子节点。
function readContentNodeLines(node: ChildNode): string[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return splitEditorTextLines(node.textContent ?? "");
  }

  if (!(node instanceof HTMLElement)) {
    return [];
  }

  if (node.tagName === "BR") {
    return [""];
  }

  const lines = splitEditorTextLines(readContentElementText(node));
  if (
    lines.length > 1 &&
    lines[lines.length - 1] === "" &&
    endsWithLineBreak(node)
  ) {
    return lines.slice(0, -1);
  }

  return lines;
}

// readContentElementText 从正文元素读取由真实文本和显式换行组成的纯文本。
// 参数 element 表示需要读取文本的正文元素。
function readContentElementText(element: HTMLElement): string {
  let value = "";

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      value += child.textContent ?? "";
      continue;
    }

    if (!(child instanceof HTMLElement)) {
      continue;
    }

    if (child.tagName === "BR") {
      value += "\n";
      continue;
    }

    value += readContentElementText(child);
  }

  return value;
}

// endsWithLineBreak 判断元素末尾是否是浏览器用于占位的换行节点。
// 参数 element 表示需要检查末尾节点的正文元素。
function endsWithLineBreak(element: HTMLElement): boolean {
  for (let index = element.childNodes.length - 1; index >= 0; index -= 1) {
    const child = element.childNodes[index];
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) {
        return false;
      }
      continue;
    }

    if (!(child instanceof HTMLElement)) {
      continue;
    }

    return child.tagName === "BR" || endsWithLineBreak(child);
  }

  return false;
}

// splitEditorTextLines 将编辑器文本拆分为段落行。
// 参数 value 表示需要拆分的文本。
function splitEditorTextLines(value: string): string[] {
  return normalizeEditorPlainText(value).split("\n");
}

// trimTrailingEmptyEditorLines 移除编辑器尾部由空白占位段落产生的空行。
// 参数 lines 表示从正文编辑器 DOM 中读取到的段落行。
function trimTrailingEmptyEditorLines(lines: string[]): string[] {
  let endIndex = lines.length;

  while (endIndex > 0 && !normalizeText(lines[endIndex - 1])) {
    endIndex -= 1;
  }

  return lines.slice(0, endIndex);
}

// normalizeEditorPlainText 标准化正文编辑器读写的纯文本。
// 参数 value 表示需要标准化的正文文本。
function normalizeEditorPlainText(value: string): string {
  return value.replace(/\r\n?/gu, "\n").replace(/\u00a0/gu, " ");
}

// ensureContentEditorHasParagraph 确保空编辑器获得焦点时存在可输入段落。
// 参数 element 表示正文段落编辑器。
function ensureContentEditorHasParagraph(element: HTMLDivElement) {
  if (normalizeText(readContentEditorText(element))) {
    return;
  }

  const paragraph = createContentParagraph("");
  element.replaceChildren(paragraph);
  moveCaretToEnd(paragraph);
}

// getContentEditorTailNode 获取正文编辑器中适合放置光标的末尾节点。
// 参数 element 表示正文段落编辑器。
function getContentEditorTailNode(element: HTMLDivElement): Node {
  return element.lastChild ?? element;
}

// moveCaretToEnd 将光标移动到指定节点末尾。
// 参数 node 表示需要放置光标的节点。
function moveCaretToEnd(node: Node) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

// insertPlainTextAtSelection 在当前光标位置插入纯文本。
// 参数 text 表示从剪贴板读取的纯文本。
function insertPlainTextAtSelection(text: string) {
  document.execCommand("insertText", false, normalizeEditorPlainText(text));
}

// countNonWhitespaceCharacters 统计文本中的非空白 Unicode 字符数量。
// 参数 value 表示需要统计的文本。
function countNonWhitespaceCharacters(value: string): number {
  let count = 0;
  for (const char of value) {
    if (!/\s/u.test(char)) {
      count += 1;
    }
  }
  return count;
}

// isChapterNumberConflictError 判断错误是否由章节号重复导致。
// 参数 error 表示捕获到的未知错误。
function isChapterNumberConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("章节号");
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
