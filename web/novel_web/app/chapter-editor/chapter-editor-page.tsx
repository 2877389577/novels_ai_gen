import { IconAIEditLevel1, IconClose } from "@douyinfe/semi-icons";
import { Button, FloatButton, Modal, Toast } from "@douyinfe/semi-ui-19";
import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type ChangeEvent, type FocusEvent, type FormEvent, type KeyboardEvent, type MouseEvent } from "react";
import { UnauthorizedError, createChapter, fetchChapterDetail, fetchNextChapterNumber, updateChapter, type ChapterDetailItem, type ChapterUpdateParams } from "../api";
import { normalizeText } from "../novel-utils";
import { chapterAutoSaveIntervalMs, chapterEditorScrollbarHiddenClass, emptyChapterFormValues } from "./constants";
import { ChapterAiAssistantPanel } from "./chapter-ai-panel";
import { ChapterEditorContext } from "./editor-context";
import { ChapterEditorError, ChapterEditorSkeleton } from "./editor-frame";
import type { ChapterAiPrefillMessage, ChapterAiRequestContext, ChapterEditorPageProps, ChapterEditorState, ChapterFormValues, ChapterSaveOptions, ChapterSaveSnapshot, ChapterSelectionAIAction } from "./types";
import { countNonWhitespaceCharacters, ensureContentEditorHasParagraph, formatChapterNumber, getChapterSelectionAIAction, getContentEditorTailNode, getErrorMessage, insertPlainTextAtSelection, isChapterNumberConflictError, moveCaretToEnd, normalizeChapterContentText, normalizeChapterCreateValues, normalizeChapterFormValues, readContentEditorText, renderContentEditorText, splitEditorTextLines, chapterToFormValues } from "./content-editor-utils";

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
  const [mobilePreviewVisible, setMobilePreviewVisible] = useState(false);
  const [mobilePreviewValues, setMobilePreviewValues] =
    useState<ChapterFormValues>(emptyChapterFormValues);
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
  const onAiPanelOpenChange = props.onAiPanelOpenChange;
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

  // syncAiPanelOpenState 将 AI 侧栏打开状态同步给应用层页脚布局。
  useEffect(
    function syncAiPanelOpenState() {
      onAiPanelOpenChange(aiPanelOpen);

      return function resetAiPanelOpenState() {
        onAiPanelOpenChange(false);
      };
    },
    [aiPanelOpen, onAiPanelOpenChange],
  );

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
      content: normalizeChapterContentText(values.content),
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
      options?: { generateSummary?: boolean },
    ): Promise<ChapterDetailItem> {
      const currentChapterID = persistedChapterIDRef.current;
      let savedChapter: ChapterDetailItem;
      const saveValues: ChapterUpdateParams = {
        ...values,
        generate_summary: options?.generateSummary === true,
      };

      if (currentChapterID === null) {
        const currentChapterNumber = chapterNumberRef.current;
        if (currentChapterNumber === null) {
          throw new Error("章节号尚未加载，请稍后再试");
        }

        savedChapter = await createChapter(
          props.novelId,
          normalizeChapterCreateValues(saveValues, currentChapterNumber),
        );
        syncPersistedChapterID(savedChapter.id);
        skipRouteLoadChapterIDRef.current = savedChapter.id;
        props.onChapterPersisted(props.novelId, savedChapter.id);
      } else {
        savedChapter = await updateChapter(
          props.novelId,
          currentChapterID,
          saveValues,
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
          if (options.generateSummary && persistedChapterIDRef.current !== null) {
            const nextSavingPromise = persistChapterValues(values, {
              generateSummary: true,
            });
            savingPromiseRef.current = nextSavingPromise;
            try {
              return await nextSavingPromise;
            } finally {
              if (savingPromiseRef.current === nextSavingPromise) {
                savingPromiseRef.current = null;
              }
            }
          }
          return null;
        }

        setTitleError("");
        const nextSavingPromise = persistChapterValues(values, {
          generateSummary: options.generateSummary === true,
        });
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
    async function ensureChapterSavedForAgent(): Promise<
      ChapterAiRequestContext | null
    > {
      if (stateRef.current !== "ready") {
        Toast.info("章节仍在加载，请稍后再试");
        return null;
      }

      await saveCurrentChapter({ force: true, showTitleError: true });
      if (!readCurrentChapterValues().title) {
        return null;
      }
      const savedChapterID = persistedChapterIDRef.current;
      const savedChapterNumber = chapterNumberRef.current;
      if (
        savedChapterID === null ||
        savedChapterNumber === null ||
        savedChapterNumber <= 0
      ) {
        Toast.warning("当前章节信息缺失，请保存后重试");
        return null;
      }
      return {
        chapterId: savedChapterID,
        chapterNumber: savedChapterNumber,
      };
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

  // handleMobilePreviewOpen 打开手机预览弹窗并捕获当前编辑器内容。
  function handleMobilePreviewOpen() {
    hideSelectionAIAction();
    const values = readCurrentChapterValues();
    setMobilePreviewValues({
      title: values.title,
      content: values.content,
    });
    setMobilePreviewVisible(true);
  }

  // handleMobilePreviewClose 关闭手机预览弹窗。
  function handleMobilePreviewClose() {
    setMobilePreviewVisible(false);
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
      await saveCurrentChapter({
        force: true,
        showTitleError: true,
        generateSummary: true,
      });
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
  const mobilePreviewParagraphs = useMemo(
    // buildMobilePreviewParagraphs 将预览正文拆分为手机阅读段落。
    function buildMobilePreviewParagraphs() {
      return splitEditorTextLines(mobilePreviewValues.content);
    },
    [mobilePreviewValues.content],
  );
  const chapterEditorContextValue = useMemo(
    // buildChapterEditorContextValue 创建章节编辑页的组合式上下文值。
    function buildChapterEditorContextValue() {
      return {
        state: {
          state,
          aiPanelOpen,
          selectionAIAction,
        },
        actions: {
          save: function saveChapterFromContext() {
            void saveCurrentChapter({
              force: true,
              showTitleError: true,
              generateSummary: true,
            });
          },
          toggleAI: handleAiAssistantToggle,
        },
        meta: {
          message,
        },
      };
    },
    [
      aiPanelOpen,
      handleAiAssistantToggle,
      message,
      saveCurrentChapter,
      selectionAIAction,
      state,
    ],
  );

  return (
    <ChapterEditorContext value={chapterEditorContextValue}>
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
                <div className="chapter-editor-footer-actions">
                  <button
                    type="button"
                    className="chapter-editor-preview"
                    onClick={handleMobilePreviewOpen}
                  >
                    手机预览
                  </button>
                  <button
                    type="submit"
                    className="chapter-editor-save"
                    disabled={submitting}
                  >
                    {submitting ? "保存中..." : "保存"}
                  </button>
                </div>
              </footer>
            </form>
          ) : null}
        </section>

        {aiPanelOpen ? (
          <ChapterAiAssistantPanel
            novelId={props.novelId}
            prepareRequestContext={ensureChapterSavedForAgent}
            prepareRequestErrorMessage="章节保存失败，请稍后再试"
            prefillMessage={aiPrefillMessage}
            onClose={handleAiAssistantClose}
            onUnauthorized={props.onUnauthorized}
          />
        ) : null}
      </div>

      <ChapterMobilePreviewModal
        visible={mobilePreviewVisible}
        chapterNumber={displayedChapterNumber}
        title={mobilePreviewValues.title}
        paragraphs={mobilePreviewParagraphs}
        onClose={handleMobilePreviewClose}
      />

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
    </ChapterEditorContext>
  );
}

// ChapterMobilePreviewModalProps 表示手机预览弹窗需要的数据和回调。
interface ChapterMobilePreviewModalProps {
  // visible 表示手机预览弹窗是否可见。
  visible: boolean;
  // chapterNumber 表示手机预览中展示的章节号文本。
  chapterNumber: string;
  // title 表示手机预览中展示的章节标题。
  title: string;
  // paragraphs 表示手机预览中按段落拆分后的正文内容。
  paragraphs: string[];
  // onClose 表示点击关闭按钮时执行的回调。
  onClose: () => void;
}

// ChapterMobilePreviewModal 渲染模拟手机阅读界面的章节预览弹窗。
// 参数 props 表示手机预览弹窗需要展示的数据和关闭回调。
function ChapterMobilePreviewModal(props: ChapterMobilePreviewModalProps) {
  return (
    <Modal
      centered
      className="chapter-mobile-preview-modal"
      closeOnEsc={false}
      closable={false}
      footer={null}
      header={null}
      maskClosable={false}
      onCancel={props.onClose}
      visible={props.visible}
      width={420}
    >
      <div className="chapter-mobile-preview-wrap">
        <button
          type="button"
          className="chapter-mobile-preview-close"
          aria-label="关闭手机预览"
          onClick={props.onClose}
        >
          <IconClose aria-hidden="true" />
        </button>
        <div className="chapter-mobile-preview-frame">
          <span className="chapter-mobile-preview-speaker" aria-hidden="true" />
          <article className="chapter-mobile-preview-screen">
            <p className="chapter-mobile-preview-number">
              {props.chapterNumber}
            </p>
            <h2 className="chapter-mobile-preview-title">{props.title}</h2>
            <div className="chapter-mobile-preview-content">
              {props.paragraphs.map(function renderPreviewParagraph(
                paragraph,
                index,
              ) {
                return (
                  <p
                    className="chapter-mobile-preview-paragraph"
                    key={`chapter-mobile-preview-${index}`}
                  >
                    {paragraph}
                  </p>
                );
              })}
            </div>
          </article>
        </div>
      </div>
    </Modal>
  );
}
