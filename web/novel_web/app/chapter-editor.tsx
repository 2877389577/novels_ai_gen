import { IconAIEditLevel1, IconClose, IconSend } from "@douyinfe/semi-icons";
import { AIChatDialogue, FloatButton, Toast } from "@douyinfe/semi-ui-19";
import {
  useCallback,
  useEffect,
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
  Message,
  RoleConfig,
} from "@douyinfe/semi-ui-19/lib/es/aiChatDialogue/interface";

import {
  UnauthorizedError,
  createChapter,
  fetchChapterDetail,
  fetchAIProviderModelsByProviderID,
  fetchAIProviders,
  fetchNextChapterNumber,
  updateChapter,
  type AIProviderItem,
  type AIProviderModelItem,
  type ChapterCreateParams,
  type ChapterDetailItem,
  type ChapterUpdateParams,
} from "./api";
import { normalizeText } from "./novel-utils";

const chapterEditorScrollbarHiddenClass = "chapter-editor-scrollbar-hidden";
const chapterAiProviderPageSize = 100;

const emptyChapterFormValues: ChapterFormValues = {
  title: "",
  content: "",
};

const chapterAiAssistantMessages: Message[] = [
  {
    id: "chapter-ai-assistant-welcome",
    role: "assistant",
    content:
      "你好，我是章节写作助手。这里会作为写作时的 AI 对话区域，当前可选择模型并记录对话，真实生成接口待接入。",
  },
  {
    id: "chapter-ai-assistant-suggestion",
    role: "assistant",
    content:
      "你可以把正在打磨的段落、人物情绪或情节目标复制到这里，后续接入真实能力后可以继续扩写、润色和拆解节奏。",
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

// ChapterFormValues 表示章节编辑页中可由用户编辑的字段。
interface ChapterFormValues {
  // title 表示章节名，不能为空。
  title: string;
  // content 表示章节正文，可以为空。
  content: string;
}

// ChapterEditorPageProps 表示章节编辑页需要的外部参数和回调。
interface ChapterEditorPageProps {
  // novelId 表示当前章节所属小说主键 ID。
  novelId: number;
  // chapterId 表示当前需要编辑的章节主键 ID，创建章节时为空。
  chapterId: number | null;
  // onBackToNovelDetail 表示返回小说详情页时执行的回调。
  onBackToNovelDetail: (novelId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ChapterEditorState 表示章节编辑页的数据加载状态。
type ChapterEditorState = "loading" | "ready" | "error";

// ChapterAiAssistantPanelProps 表示章节 AI 助手侧栏需要的回调。
interface ChapterAiAssistantPanelProps {
  // onClose 表示关闭章节 AI 助手侧栏时执行的回调。
  onClose: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ChapterEditorPage 渲染章节创建和编辑共用页面。
// 参数 props 表示章节编辑页需要的外部参数和回调。
export function ChapterEditorPage(props: ChapterEditorPageProps) {
  const isEditMode = props.chapterId !== null;
  const [state, setState] = useState<ChapterEditorState>("loading");
  const [message, setMessage] = useState("");
  const [chapter, setChapter] = useState<ChapterDetailItem | null>(null);
  const [chapterNumber, setChapterNumber] = useState<number | null>(null);
  const [titleValue, setTitleValue] = useState(emptyChapterFormValues.title);
  const [contentValue, setContentValue] = useState(
    emptyChapterFormValues.content,
  );
  const [titleError, setTitleError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [contentSnapshotId, setContentSnapshotId] = useState(0);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const contentEditorRef = useRef<HTMLDivElement | null>(null);
  const onUnauthorized = props.onUnauthorized;
  const liveWordCount = useMemo(
    function calculateLiveWordCount() {
      return countNonWhitespaceCharacters(contentValue);
    },
    [contentValue],
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
    [onUnauthorized, props.novelId],
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
    [onUnauthorized, props.chapterId, props.novelId],
  );

  // loadChapterWhenRouteChanges 在路由参数变化时同步章节数据。
  useEffect(
    function loadChapterWhenRouteChanges() {
      const controller = new AbortController();
      setTitleError("");
      setSubmitting(false);

      if (props.chapterId === null) {
        setChapter(null);
        setChapterNumber(null);
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
    [loadChapterDetail, loadNextChapterNumber, props.chapterId],
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
    setTitleValue(nextValue);
    if (titleError && normalizeText(nextValue)) {
      setTitleError("");
    }
  }

  // handleContentChange 同步章节正文输入。
  // 参数 event 表示正文段落编辑器输入事件。
  function handleContentChange(event: FormEvent<HTMLDivElement>) {
    setContentValue(readContentEditorText(event.currentTarget));
  }

  // handleContentFocus 在空正文获得焦点时创建可输入段落。
  // 参数 event 表示正文段落编辑器聚焦事件。
  function handleContentFocus(event: FocusEvent<HTMLDivElement>) {
    ensureContentEditorHasParagraph(event.currentTarget);
  }

  // handleContentBlur 在空正文失焦时恢复 placeholder 显示。
  // 参数 event 表示正文段落编辑器失焦事件。
  function handleContentBlur(event: FocusEvent<HTMLDivElement>) {
    const nextContent = readContentEditorText(event.currentTarget);
    if (normalizeText(nextContent)) {
      setContentValue(nextContent);
      renderContentEditorText(event.currentTarget, nextContent);
      return;
    }

    event.currentTarget.innerHTML = "";
    setContentValue("");
  }

  // handleContentPaste 将粘贴内容限制为纯文本，避免外部富文本污染段落样式。
  // 参数 event 表示正文段落编辑器粘贴事件。
  function handleContentPaste(event: ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    insertPlainTextAtSelection(text);

    const target = event.currentTarget;
    window.setTimeout(function syncContentAfterPaste() {
      const nextContent = readContentEditorText(target);
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
    insertPlainTextAtSelection("　　");
    setContentValue(readContentEditorText(event.currentTarget));
  }

  // handleContentMouseDown 将编辑器空白区域点击固定为移动到正文末尾。
  // 参数 event 表示正文段落编辑器鼠标按下事件。
  function handleContentMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    event.preventDefault();
    event.currentTarget.focus();
    ensureContentEditorHasParagraph(event.currentTarget);
    moveCaretToEnd(getContentEditorTailNode(event.currentTarget));
  }

  // handleSubmit 校验章节表单并提交创建或更新请求。
  // 参数 event 表示表单提交事件。
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || state !== "ready") {
      return;
    }

    const normalizedValues = normalizeChapterFormValues({
      title: titleValue,
      content: readContentEditorText(contentEditorRef.current),
    });
    if (!normalizedValues.title) {
      setTitleError("请输入章节名");
      titleInputRef.current?.focus();
      return;
    }

    if (props.chapterId === null && chapterNumber === null) {
      Toast.error("章节号尚未加载，请稍后再试");
      return;
    }

    setSubmitting(true);

    try {
      if (props.chapterId === null) {
        await createChapter(
          props.novelId,
          normalizeChapterCreateValues(normalizedValues, chapterNumber),
        );
        Toast.success("章节已创建");
      } else {
        await updateChapter(props.novelId, props.chapterId, normalizedValues);
        Toast.success("章节已保存");
      }

      props.onBackToNovelDetail(props.novelId);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "章节保存失败，请稍后再试"));
      if (props.chapterId === null && isChapterNumberConflictError(error)) {
        void loadNextChapterNumber(undefined, true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // replaceEditorContent 使用指定正文替换编辑器内容快照。
  // 参数 value 表示需要写入编辑器的纯文本正文。
  function replaceEditorContent(value: string) {
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
                  onMouseDown={handleContentMouseDown}
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
            onClose={handleAiAssistantClose}
            onUnauthorized={props.onUnauthorized}
          />
        ) : null}
      </div>

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
  const [chats, setChats] = useState<Message[]>(chapterAiAssistantMessages);
  const [providers, setProviders] = useState<AIProviderItem[]>([]);
  const [models, setModels] = useState<AIProviderModelItem[]>([]);
  const [selectedProviderID, setSelectedProviderID] = useState("");
  const [selectedModelID, setSelectedModelID] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [providerLoading, setProviderLoading] = useState(true);
  const [modelLoading, setModelLoading] = useState(false);
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
    function loadProviderModels() {
      if (!selectedProviderID) {
        setModels([]);
        setSelectedModelID("");
        return;
      }

      const controller = new AbortController();
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

          setModels(data.items);
          setSelectedModelID(data.items[0]?.id ?? "");
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            onUnauthorized();
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
    [onUnauthorized, selectedProviderID],
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
    setInputValue(event.target.value);
  }

  // handleAssistantInputKeyDown 处理 AI 对话输入框键盘提交。
  // 参数 event 表示输入框键盘事件。
  function handleAssistantInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submitAssistantMessage();
    }
  }

  // handleAssistantSubmit 处理 AI 对话输入区提交。
  // 参数 event 表示输入区表单提交事件。
  function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitAssistantMessage();
  }

  // submitAssistantMessage 将用户输入追加到本地 AI 对话消息中。
  function submitAssistantMessage() {
    const normalizedInput = inputValue.trim();
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

    const providerName = selectedProvider?.name ?? "当前提供商";
    const modelName = formatAIModelName(selectedModel);
    setChats(function appendAssistantMessages(currentChats) {
      const createdAt = Date.now();
      return [
        ...currentChats,
        {
          id: createChapterAiMessageID("user", createdAt),
          role: "user",
          content: normalizedInput,
        },
        {
          id: createChapterAiMessageID("assistant", createdAt),
          role: "assistant",
          content: `已选择 ${providerName} / ${modelName}。真实生成接口待接入，当前先记录你的提问。`,
        },
      ];
    });
    setInputValue("");
  }

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
          <button
            aria-label="关闭 AI 写作助手"
            className="chapter-ai-assistant-close"
            onClick={props.onClose}
            type="button"
          >
            <IconClose aria-hidden="true" />
          </button>
        </header>
        <div className="chapter-ai-dialogue-wrap">
          <AIChatDialogue
            align="leftRight"
            chats={chats}
            className="chapter-ai-dialogue"
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
          <div className="chapter-ai-input-row">
            <textarea
              aria-label="AI 对话输入"
              className="chapter-ai-input"
              onChange={handleAssistantInputChange}
              onKeyDown={handleAssistantInputKeyDown}
              placeholder="输入你的问题或写作目标..."
              rows={2}
              value={inputValue}
            />
            <button
              aria-label="发送给 AI 写作助手"
              className="chapter-ai-send"
              disabled={modelLoading}
              title="发送"
              type="submit"
            >
              <IconSend aria-hidden="true" />
            </button>
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

// formatAIModelName 返回 AI 模型在对话提示中的展示名。
// 参数 model 表示当前选择的 AI 模型，可以为空。
function formatAIModelName(model?: AIProviderModelItem): string {
  if (!model) {
    return "当前模型";
  }
  return model.display_name || model.id;
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
