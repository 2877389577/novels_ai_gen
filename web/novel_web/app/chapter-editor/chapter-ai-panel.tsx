import { Modal, Toast } from "@douyinfe/semi-ui-19";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { UnauthorizedError, deleteNovelAgentConversation, fetchNovelAgentConversationMessages, fetchNovelAgentConversations, fetchNovelAgentRuns, resumeNovelAgentChatApproval, stopNovelAgentRun, streamNovelAgentChat, streamNovelAgentRun, type NovelAgentConversationItem, type NovelAgentRunItem, type NovelAgentStreamApprovalRequiredEvent, type NovelAgentStreamEvent } from "../api";
import { chapterAiAssistantMessages } from "./constants";
import { ChapterAIContext } from "./chapter-ai-context";
import { createChapterAiDialogueRenderConfig } from "./chapter-ai-dialogue-actions";
import {
  appendAssistantReplyMessageToList,
  appendChapterAiLoadingMessageToList,
  bindChapterAiPairConversation,
  clearChapterAiApprovalInList,
  markChapterAiPairFailedInList,
  markAssistantRepliesCancelledInList,
  removeAssistantRepliesNotInList,
  removeChapterAiLoadingMessageFromList,
  removeChapterAiPairInList,
  setChapterAiApprovalInList,
  updateAssistantReplyMessageInList,
  updateChapterAiApprovalStatusInList,
  updateChapterAiPairRetryableInList,
} from "./chapter-ai-message-list-utils";
import { ChapterAiAssistantShell } from "./chapter-ai-shell";
import type { ChapterAiApprovalState, ChapterAiApprovalStatus, ChapterAiAssistantPanelProps, ChapterAiMessage, ChapterAiReplyDraft, ChapterAiRequestContext, ChapterAiRetryPayload, ChapterAiStreamRequest } from "./types";
import { createChapterAiMessageID, createChapterAiPairID, createChapterAiReplyMessageID, chapterAiMessageFromHistory, syncChapterAiInputHeight } from "./chapter-ai-utils";
import { getErrorMessage } from "./content-editor-utils";

// ChapterAiAssistantPanel 渲染章节编辑页右侧 AI 对话侧栏。
// 参数 props 表示章节 AI 助手侧栏需要的回调。
export function ChapterAiAssistantPanel(props: ChapterAiAssistantPanelProps) {
  const [chats, setChats] = useState<ChapterAiMessage[]>(chapterAiAssistantMessages);
  const [conversations, setConversations] = useState<NovelAgentConversationItem[]>([]);
  const [selectedConversationID, setSelectedConversationID] = useState<number | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [conversationLoading, setConversationLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [conversationDeleting, setConversationDeleting] = useState(false);
  const [assistantSending, setAssistantSending] = useState(false);
  const assistantInputRef = useRef<HTMLTextAreaElement | null>(null);
  const streamControllerRef = useRef<AbortController | null>(null);
  const currentRunIDRef = useRef<string | null>(null);
  const selectedConversationIDRef = useRef<number | null>(null);

  const conversationSelectOptions = useMemo(
    // buildConversationSelectOptions 将 AI 会话列表转换为 Semi Select 选项。
    function buildConversationSelectOptions() {
      return conversations.map(function mapConversationToOption(conversation) {
        const title = conversation.title?.trim() || "未命名会话";
        return {
          label: title,
          value: String(conversation.id),
        };
      });
    },
    [conversations],
  );
  const conversationSelectPlaceholder = conversationLoading
    ? "会话加载中..."
    : conversations.length === 0
      ? "暂无会话记录"
      : "选择会话记录";
  const consumedPrefillMessageIDRef = useRef<number | null>(null);
  const onUnauthorized = props.onUnauthorized;

  useEffect(
    function syncSelectedConversationRef() {
      selectedConversationIDRef.current = selectedConversationID;
    },
    [selectedConversationID],
  );

  useLayoutEffect(
    function syncAssistantInputHeight() {
      syncChapterAiInputHeight(assistantInputRef.current);
    },
    [inputValue],
  );

  useEffect(
    function loadAgentConversations() {
      const controller = new AbortController();
      setConversationLoading(true);
      setHistoryLoading(true);

      async function loadConversations() {
        try {
          const [data, runData] = await Promise.all([
            fetchNovelAgentConversations(props.novelId, controller.signal),
            fetchNovelAgentRuns(props.novelId, controller.signal),
          ]);
          if (controller.signal.aborted) {
            return;
          }

          setConversations(data.items);
          const activeRun = runData.items[0];
          if (activeRun) {
            attachActiveAgentRun(activeRun);
            setConversationLoading(false);
            setHistoryLoading(false);
            return;
          }
          if (data.items.length === 0) {
            setSelectedConversationID(null);
            setChats(chapterAiAssistantMessages);
            setHistoryLoading(false);
            return;
          }
          setSelectedConversationID(function selectConversation(currentID) {
            if (
              currentID !== null &&
              data.items.some(function matchConversation(item) {
                return item.id === currentID;
              })
            ) {
              return currentID;
            }
            return data.items[0].id;
          });
        } catch (error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            onUnauthorized();
            return;
          }
          setConversations([]);
          setSelectedConversationID(null);
          setChats(chapterAiAssistantMessages);
          setHistoryLoading(false);
          Toast.error(getErrorMessage(error, "AI 会话列表加载失败，请稍后再试"));
        } finally {
          if (!controller.signal.aborted) {
            setConversationLoading(false);
          }
        }
      }

      void loadConversations();
      return function cancelConversationLoad() {
        controller.abort();
      };
    },
    [onUnauthorized, props.novelId],
  );

  useEffect(
    function loadSelectedConversationHistory() {
      if (currentRunIDRef.current) {
        setHistoryLoading(false);
        return;
      }
      if (assistantSending) {
        setHistoryLoading(false);
        return;
      }
      if (selectedConversationID === null) {
        setChats(chapterAiAssistantMessages);
        setHistoryLoading(false);
        return;
      }

      const conversationID = selectedConversationID;
      const controller = new AbortController();
      setHistoryLoading(true);

      async function loadHistory() {
        try {
          const data = await fetchNovelAgentConversationMessages(
            props.novelId,
            conversationID,
            controller.signal,
          );
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
    [onUnauthorized, props.novelId, selectedConversationID],
  );

  useEffect(
    function cancelAssistantStreamOnUnmount() {
      return function cancelAssistantStream() {
        streamControllerRef.current?.abort();
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

  // attachActiveAgentRun 将后端仍在运行的 AI 任务恢复为当前前端对话。
  // 参数 run 表示后端返回的 AI 对话运行任务快照。
  function attachActiveAgentRun(run: NovelAgentRunItem) {
    const createdAt = Date.parse(run.created_at) || Date.now();
    const pairID = `agent-run-${run.run_id}`;
    const userMessageID = `agent-run-user-${run.run_id}`;
    const assistantMessageID = `agent-run-assistant-${run.run_id}`;
    const retryPayload: ChapterAiRetryPayload = {
      conversationId: run.conversation_id,
      message: run.message,
    };
    currentRunIDRef.current = run.run_id;
    setSelectedConversationID(run.conversation_id ?? null);
    setAssistantSending(true);
    setInputValue("");
    setChats([
      ...chapterAiAssistantMessages,
      {
        id: userMessageID,
        chapterAiConversationID: run.conversation_id,
        chapterAiPairID: pairID,
        chapterAiRetryable: false,
        chapterAiRetryPayload: retryPayload,
        role: "user",
        content: run.message,
        createAt: createdAt,
      },
      {
        id: assistantMessageID,
        chapterAiConversationID: run.conversation_id,
        chapterAiPairID: pairID,
        chapterAiSourceID: assistantMessageID,
        chapterAiReplyIndex: 1,
        role: "assistant",
        content: "",
        status: "in_progress",
        createAt: createdAt,
      },
    ]);
    void runChapterAiStream({
      runId: run.run_id,
      pairID,
      assistantMessageID,
      requestContext: {
        chapterId: run.chapter_id,
        chapterNumber: run.chapter_number,
      },
      retryPayload,
    });
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
      void submitAssistantMessage();
    }
  }

  // handleAssistantSubmit 处理 AI 对话输入区提交。
  // 参数 event 表示输入区表单提交事件。
  function handleAssistantSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitAssistantMessage();
  }

  // handleAssistantClose 关闭 AI 侧栏但不停止仍在后台运行的 AI 任务。
  function handleAssistantClose() {
    props.onClose();
  }

  // handleCancelAssistantMessage 中断当前正在进行的 AI 流式回复。
  async function handleCancelAssistantMessage() {
    const runID = currentRunIDRef.current;
    if (!runID) {
      Toast.info("AI 任务正在启动，请稍后再停止");
      return;
    }
    try {
      await stopNovelAgentRun(runID);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "停止 AI 对话失败，请稍后再试"));
    }
  }

  // handleConversationChange 切换当前 AI 会话。
  // 参数 value 表示 Semi 会话选择器返回的会话 ID。
  function handleConversationChange(value: string | string[] | undefined) {
    if (assistantSending) {
      Toast.info("AI 正在回复，稍后再切换会话");
      return;
    }
    if (!value || Array.isArray(value)) {
      return;
    }
    const conversationID = Number(value);
    if (!Number.isSafeInteger(conversationID) || conversationID <= 0) {
      return;
    }
    setSelectedConversationID(conversationID);
  }

  // handleStartNewConversation 进入新的 AI 会话草稿。
  function handleStartNewConversation() {
    if (assistantSending) {
      Toast.info("AI 正在回复，稍后再开启新会话");
      return;
    }
    setSelectedConversationID(null);
    setChats(chapterAiAssistantMessages);
  }

  // handleDeleteAssistantConversation 删除当前 AI 会话及其历史消息。
  function handleDeleteAssistantConversation() {
    if (assistantSending) {
      Toast.info("AI 正在回复，稍后再删除会话");
      return;
    }
    if (conversationDeleting) {
      return;
    }
    if (selectedConversationID === null) {
      Toast.info("当前没有可删除的 AI 会话");
      return;
    }

    const conversationID = selectedConversationID;
    const conversationTitle =
      conversations.find(function findConversation(conversation) {
        return conversation.id === conversationID;
      })?.title?.trim() || "当前会话";

    Modal.confirm({
      title: "删除会话",
      content: `确定删除「${conversationTitle}」吗？该会话和聊天记录将无法恢复。`,
      okText: "删除",
      cancelText: "取消",
      okType: "danger",
      onOk: async function confirmDeleteConversation() {
        setConversationDeleting(true);
        try {
          await deleteNovelAgentConversation(props.novelId, conversationID);
          const nextConversations = conversations.filter(function keepConversation(
            conversation,
          ) {
            return conversation.id !== conversationID;
          });
          setConversations(nextConversations);
          setSelectedConversationID(nextConversations[0]?.id ?? null);
          setChats(chapterAiAssistantMessages);
          setHistoryLoading(nextConversations.length > 0);
          Toast.success("AI 会话已删除");
        } catch (error) {
          if (error instanceof UnauthorizedError) {
            onUnauthorized();
            return;
          }
          Toast.error(getErrorMessage(error, "AI 会话删除失败，请稍后再试"));
        } finally {
          setConversationDeleting(false);
        }
      },
    });
  }

  // submitAssistantMessage 将用户输入发送给后端小说写作 Agent。
  async function submitAssistantMessage() {
    const normalizedInput = inputValue.trim();
    if (assistantSending) {
      Toast.info("AI 正在回复，请稍后再发送");
      return;
    }
    if (!normalizedInput) {
      Toast.warning("请输入要发送给 AI 的内容");
      return;
    }

    setAssistantSending(true);
    let requestContext: ChapterAiRequestContext | null;
    try {
      requestContext = await props.prepareRequestContext();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        setAssistantSending(false);
        onUnauthorized();
        return;
      }
      Toast.error(
        getErrorMessage(
          error,
          props.prepareRequestErrorMessage || "AI 请求准备失败，请稍后再试",
        ),
      );
      setAssistantSending(false);
      return;
    }
    if (requestContext === null) {
      setAssistantSending(false);
      return;
    }

    const createdAt = Date.now();
    const pairID = createChapterAiPairID(createdAt);
    const userMessageID = createChapterAiMessageID("user", createdAt);
    const assistantMessageID = createChapterAiMessageID("assistant", createdAt);
    const retryPayload: ChapterAiRetryPayload = {
      conversationId: selectedConversationIDRef.current ?? undefined,
      message: normalizedInput,
    };
    setChats(function appendAssistantMessages(currentChats) {
      return [
        ...currentChats,
        {
          id: userMessageID,
          chapterAiConversationID: retryPayload.conversationId,
          chapterAiPairID: pairID,
          chapterAiRetryable: false,
          chapterAiRetryPayload: retryPayload,
          role: "user",
          content: normalizedInput,
        },
        {
          id: assistantMessageID,
          chapterAiConversationID: retryPayload.conversationId,
          chapterAiPairID: pairID,
          chapterAiSourceID: assistantMessageID,
          chapterAiReplyIndex: 1,
          role: "assistant",
          content: "",
          status: "in_progress",
        },
      ];
    });
    setInputValue("");

    await runChapterAiStream({
      pairID,
      assistantMessageID,
      requestContext,
      retryPayload,
    });
  }

  // handleRetryAssistantMessage 将失败用户消息回填到输入框并移除本地失败气泡。
  // 参数 message 表示触发重试的用户消息。
  function handleRetryAssistantMessage(message: ChapterAiMessage) {
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

    setInputValue(retryPayload.message);
    setChats(function removeFailedPair(currentChats) {
      return removeChapterAiPairInList(currentChats, pairID);
    });
    window.setTimeout(function focusRetryMessageInput() {
      assistantInputRef.current?.focus();
      syncChapterAiInputHeight(assistantInputRef.current);
    }, 0);
  }

  // handleApproveToolApproval 批准当前助手消息等待中的工具调用。
  // 参数 message 表示承载人工审核状态的助手消息。
  function handleApproveToolApproval(message: ChapterAiMessage) {
    void resumeChapterAiApproval(message, true);
  }

  // handleRejectToolApproval 拒绝当前助手消息等待中的工具调用。
  // 参数 message 表示承载人工审核状态的助手消息。
  function handleRejectToolApproval(message: ChapterAiMessage) {
    void resumeChapterAiApproval(message, false);
  }

  // resumeChapterAiApproval 根据用户选择恢复当前等待人工审核的 Agent 流。
  // 参数 message 表示承载人工审核状态的助手消息；参数 approved 表示用户是否批准工具执行。
  async function resumeChapterAiApproval(
    message: ChapterAiMessage,
    approved: boolean,
  ) {
    if (assistantSending) {
      Toast.info("AI 正在回复，请稍后再操作");
      return;
    }
    const approval = message.chapterAiApproval;
    if (!approval) {
      Toast.warning("人工审核记录缺失，请重新发起 AI 请求");
      return;
    }
    if (approval.status === "submitting") {
      return;
    }
    const pairID = message.chapterAiPairID;
    const assistantMessageID =
      message.chapterAiSourceID ?? (typeof message.id === "string" ? message.id : "");
    if (!pairID || !assistantMessageID) {
      Toast.warning("人工审核消息缺少恢复信息");
      return;
    }

    setAssistantSending(true);
    updateChapterAiApprovalStatus(assistantMessageID, "submitting");
    appendChapterAiLoadingMessage(pairID, approval.retryPayload.conversationId);
    await runChapterAiStream({
      pairID,
      assistantMessageID,
      requestContext: approval.requestContext,
      retryPayload: approval.retryPayload,
      approvalDecision: {
        checkpointId: approval.checkpointId,
        interruptId: approval.interruptId,
        approved,
        existingContent: getChapterAiApprovalExistingContent(message),
      },
    });
  }

  // getChapterAiApprovalExistingContent 读取恢复流继续追加前已经展示的助手文本。
  // 参数 message 表示承载人工审核状态的助手消息。
  function getChapterAiApprovalExistingContent(message: ChapterAiMessage): string {
    return typeof message.content === "string" &&
      message.content !== "等待工具人工审核。"
      ? message.content
      : "";
  }

  // runChapterAiStream 执行章节 AI 流式请求并更新对应助手消息。
  // 参数 request 表示本次流式请求所需的消息配对和章节上下文。
  async function runChapterAiStream(request: ChapterAiStreamRequest) {
    const controller = new AbortController();
    streamControllerRef.current?.abort();
    streamControllerRef.current = controller;
    currentRunIDRef.current = request.runId ?? null;

    const initialAssistantContent =
      request.approvalDecision?.existingContent ?? "";
    let assistantContent = initialAssistantContent;
    let handledFailure = false;
    let waitingForApproval = false;
    const assistantReplies = new Map<number, ChapterAiReplyDraft>();
    assistantReplies.set(1, {
      messageID: createChapterAiReplyMessageID(request.assistantMessageID, 1),
      content: initialAssistantContent,
    });

    // normalizeReplyIndex 标准化后端返回的回复段序号。
    // 参数 value 表示后端流事件中的 reply_index。
    function normalizeReplyIndex(value: number | undefined): number {
      return Number.isSafeInteger(value) && value !== undefined && value > 0
        ? value
        : 1;
    }

    // ensureAssistantReplyDraft 确保指定回复段已有本地气泡草稿。
    // 参数 replyIndex 表示同一次 AI 请求中的助手回复段序号。
    function ensureAssistantReplyDraft(replyIndex: number): ChapterAiReplyDraft {
      const existing = assistantReplies.get(replyIndex);
      if (existing) {
        return existing;
      }

      const messageID = createChapterAiReplyMessageID(
        request.assistantMessageID,
        replyIndex,
      );
      const draft: ChapterAiReplyDraft = { messageID, content: "" };
      assistantReplies.set(replyIndex, draft);
      appendAssistantReplyMessage(
        request.assistantMessageID,
        messageID,
        request.pairID,
        request.retryPayload.conversationId,
        replyIndex,
      );
      return draft;
    }

    // completeAssistantReplies 按后端最终分段结果收口所有助手气泡。
    // 参数 replies 表示后端 done 事件返回的完整分段回复列表。
    function completeAssistantReplies(
      replies: Array<{ reply_index: number; content: string }>,
    ) {
      if (replies.length === 0) {
        updateAssistantReplyMessage(
          request.assistantMessageID,
          1,
          assistantContent,
          "completed",
        );
        return;
      }

      const completedReplyIndexes = new Set<number>();
      for (const reply of replies) {
        const replyIndex = normalizeReplyIndex(reply.reply_index);
        const draft = ensureAssistantReplyDraft(replyIndex);
        draft.content = reply.content ?? "";
        completedReplyIndexes.add(replyIndex);
        updateAssistantReplyMessage(
          request.assistantMessageID,
          replyIndex,
          draft.content,
          "completed",
        );
      }
      removeAssistantRepliesNotIn(
        request.assistantMessageID,
        completedReplyIndexes,
      );
    }

    // handleChapterAiStreamFailure 将当前 AI 请求标记为失败并开启用户消息重试入口。
    // 参数 errorMessage 表示展示给用户的失败原因。
    function handleChapterAiStreamFailure(errorMessage: string) {
      if (handledFailure) {
        return;
      }
      handledFailure = true;
      markChapterAiRequestFailed(request.pairID, errorMessage);
      Toast.error(errorMessage);
    }

    // handleApprovalRequiredEvent 将工具人工审核事件写入当前助手消息。
    // 参数 event 表示后端返回的工具人工审核事件。
    function handleApprovalRequiredEvent(
      event: NovelAgentStreamApprovalRequiredEvent,
    ) {
      const approval: ChapterAiApprovalState = {
        checkpointId: event.checkpoint_id,
        interruptId: event.interrupt_id,
        toolName: event.tool_name,
        toolArguments: event.tool_arguments,
        message: event.message,
        status: "waiting",
        requestContext: request.requestContext,
        retryPayload: request.retryPayload,
      };
      waitingForApproval = true;
      removeChapterAiLoadingMessage(request.pairID);
      updateChapterAiPairRetryable(request.pairID, false);
      setChapterAiApproval(request.assistantMessageID, approval);
    }

    // handleNovelAgentStreamEvent 处理小说写作 Agent NDJSON 流事件。
    // 参数 event 表示后端返回的单个流事件。
    function handleNovelAgentStreamEvent(event: NovelAgentStreamEvent) {
      if (handledFailure) {
        return;
      }
      if (event.run_id) {
        currentRunIDRef.current = event.run_id;
      }
      if (event.type === "approval_required") {
        handleApprovalRequiredEvent(event);
        return;
      }
      if (event.type === "delta") {
        clearChapterAiApproval(request.assistantMessageID);
        const replyIndex = normalizeReplyIndex(event.reply_index);
        const draft = ensureAssistantReplyDraft(replyIndex);
        draft.content += event.content ?? "";
        assistantContent = Array.from(assistantReplies.keys())
          .sort(function sortReplyIndex(left, right) {
            return left - right;
          })
          .map(function mapReplyContent(index) {
            return assistantReplies.get(index)?.content ?? "";
          })
          .join("");
        updateAssistantReplyMessage(
          request.assistantMessageID,
          replyIndex,
          draft.content,
          "in_progress",
        );
        appendChapterAiLoadingMessage(
          request.pairID,
          request.retryPayload.conversationId,
        );
        return;
      }
      if (event.type === "done") {
        clearChapterAiApproval(request.assistantMessageID);
        assistantContent = event.content || assistantContent;
        const replies = event.replies ?? [];
        if (replies.length === 0 && assistantContent.trim() === "") {
          handleChapterAiStreamFailure(
            "AI 没有返回可展示内容，请重试或检查模型配置",
          );
          currentRunIDRef.current = null;
          return;
        }
        completeAssistantReplies(replies);
        removeChapterAiLoadingMessage(request.pairID);
        if (event.conversation_id && event.conversation_id > 0) {
          const conversationTitle =
            event.conversation_title?.trim() || "新会话";
          setSelectedConversationID(event.conversation_id);
          upsertChapterAiConversation({
            id: event.conversation_id,
            novel_id: props.novelId,
            title: conversationTitle,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          updateChapterAiPairConversation(
            request.pairID,
            event.conversation_id,
          );
        }
        updateChapterAiPairRetryable(request.pairID, false);
        currentRunIDRef.current = null;
        return;
      }
      if (event.type === "error") {
        const baseErrorMessage =
          event.message || "AI 写作助手生成失败，请稍后再试";
        const requestID = event.request_id?.trim();
        const errorMessage = requestID
          ? `${baseErrorMessage}（请求ID：${requestID}）`
          : baseErrorMessage;
        handleChapterAiStreamFailure(errorMessage);
        currentRunIDRef.current = null;
        return;
      }
      if (event.type === "cancelled") {
        updateChapterAiPairRetryable(request.pairID, false);
        removeChapterAiLoadingMessage(request.pairID);
        markAssistantRepliesCancelled(
          request.assistantMessageID,
          event.message || "本次 AI 回复已取消。",
        );
        currentRunIDRef.current = null;
      }
    }

    try {
      const approvalDecision = request.approvalDecision;
      if (request.runId) {
        await streamNovelAgentRun(
          request.runId,
          { onEvent: handleNovelAgentStreamEvent },
          controller.signal,
        );
      } else if (approvalDecision) {
        await resumeNovelAgentChatApproval(
          {
            novelId: props.novelId,
            conversationId: request.retryPayload.conversationId,
            chapterId: request.requestContext.chapterId,
            chapterNumber: request.requestContext.chapterNumber,
            checkpointId: approvalDecision.checkpointId,
            interruptId: approvalDecision.interruptId,
            approved: approvalDecision.approved,
            signal: controller.signal,
          },
          { onEvent: handleNovelAgentStreamEvent },
        );
      } else {
        await streamNovelAgentChat(
          {
            message: request.retryPayload.message,
            novelId: props.novelId,
            conversationId: request.retryPayload.conversationId,
            chapterId: request.requestContext.chapterId,
            chapterNumber: request.requestContext.chapterNumber,
            signal: controller.signal,
          },
          { onEvent: handleNovelAgentStreamEvent },
        );
      }
    } catch (error) {
      if (handledFailure) {
        return;
      }
      if (controller.signal.aborted) {
        return;
      }
      if (error instanceof UnauthorizedError) {
        currentRunIDRef.current = null;
        handleChapterAiStreamFailure(getErrorMessage(error, "登录已过期，请重新登录"));
        onUnauthorized();
        return;
      }
      const errorMessage = getErrorMessage(error, "AI 写作助手生成失败，请稍后再试");
      currentRunIDRef.current = null;
      handleChapterAiStreamFailure(errorMessage);
    } finally {
      removeChapterAiLoadingMessage(request.pairID);
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null;
      }
      if (!waitingForApproval && currentRunIDRef.current === request.runId) {
        currentRunIDRef.current = null;
      }
      setAssistantSending(false);
    }
  }

  // markChapterAiRequestFailed 将失败状态落在本轮用户消息上，并移除同轮助手消息。
  // 参数 pairID 表示失败请求的消息配对 ID；参数 errorMessage 表示失败说明。
  function markChapterAiRequestFailed(pairID: string, errorMessage: string) {
    setChats(function markFailedPair(currentChats) {
      return markChapterAiPairFailedInList(currentChats, pairID, errorMessage);
    });
  }

  // upsertChapterAiConversation 将后端返回的会话信息写入本地会话列表。
  // 参数 conversation 表示需要插入或更新的 Agent 会话。
  function upsertChapterAiConversation(conversation: NovelAgentConversationItem) {
    setConversations(function updateConversationList(currentConversations) {
      const filteredConversations = currentConversations.filter(
        function removeSameConversation(item) {
          return item.id !== conversation.id;
        },
      );
      return [conversation, ...filteredConversations];
    });
  }

  // updateChapterAiPairConversation 将本地一轮消息绑定到后端会话 ID。
  // 参数 pairID 表示需要更新的消息配对 ID；参数 conversationID 表示后端返回的 Agent 会话 ID。
  function updateChapterAiPairConversation(pairID: string, conversationID: number) {
    setChats(function updateConversationID(currentChats) {
      return bindChapterAiPairConversation(
        currentChats,
        pairID,
        conversationID,
      );
    });
  }

  // updateChapterAiPairRetryable 更新指定配对中用户消息的可重试状态。
  // 参数 pairID 表示需要更新的消息配对 ID；参数 retryable 表示是否允许展示重试按钮。
  function updateChapterAiPairRetryable(pairID: string, retryable: boolean) {
    setChats(function updateMessageRetryable(currentChats) {
      return updateChapterAiPairRetryableInList(
        currentChats,
        pairID,
        retryable,
      );
    });
  }

  // setChapterAiApproval 将指定助手消息切换为等待工具人工审核状态。
  // 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 approval 表示需要展示并用于恢复的审核状态。
  function setChapterAiApproval(
    sourceMessageID: string,
    approval: ChapterAiApprovalState,
  ) {
    setChats(function setApproval(currentChats) {
      return setChapterAiApprovalInList(currentChats, sourceMessageID, approval);
    });
  }

  // updateChapterAiApprovalStatus 更新指定助手消息的工具人工审核提交状态。
  // 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 status 表示新的人工审核提交状态。
  function updateChapterAiApprovalStatus(
    sourceMessageID: string,
    status: ChapterAiApprovalStatus,
  ) {
    setChats(function updateApprovalStatus(currentChats) {
      return updateChapterAiApprovalStatusInList(
        currentChats,
        sourceMessageID,
        status,
      );
    });
  }

  // clearChapterAiApproval 清除指定助手消息上的工具人工审核状态。
  // 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID。
  function clearChapterAiApproval(sourceMessageID: string) {
    setChats(function clearApproval(currentChats) {
      return clearChapterAiApprovalInList(currentChats, sourceMessageID);
    });
  }

  // appendChapterAiLoadingMessage 追加当前 AI 请求仍在进行中的本地加载占位消息。
  // 参数 pairID 表示当前用户消息和助手消息共用的配对 ID；参数 conversationID 表示当前会话 ID。
  function appendChapterAiLoadingMessage(
    pairID: string,
    conversationID: number | undefined,
  ) {
    setChats(function appendLoadingMessage(currentChats) {
      return appendChapterAiLoadingMessageToList(
        currentChats,
        pairID,
        conversationID,
      );
    });
  }

  // removeChapterAiLoadingMessage 移除当前 AI 请求的本地加载占位消息。
  // 参数 pairID 表示当前用户消息和助手消息共用的配对 ID。
  function removeChapterAiLoadingMessage(pairID: string) {
    setChats(function removeLoadingMessage(currentChats) {
      return removeChapterAiLoadingMessageFromList(currentChats, pairID);
    });
  }

  // appendAssistantReplyMessage 追加一段新的 AI 助手回复气泡。
  // 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 messageID 表示当前回复段消息 ID；参数 pairID 表示本轮消息配对 ID；参数 conversationID 表示当前会话 ID；参数 replyIndex 表示回复段序号。
  function appendAssistantReplyMessage(
    sourceMessageID: string,
    messageID: string,
    pairID: string,
    conversationID: number | undefined,
    replyIndex: number,
  ) {
    setChats(function appendReplyMessage(currentChats) {
      return appendAssistantReplyMessageToList(
        currentChats,
        sourceMessageID,
        messageID,
        pairID,
        conversationID,
        replyIndex,
      );
    });
  }

  // updateAssistantReplyMessage 更新指定回复段的 AI 助手消息内容。
  // 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 replyIndex 表示回复段序号；参数 content 表示新的消息内容；参数 status 表示消息当前生成状态。
  function updateAssistantReplyMessage(
    sourceMessageID: string,
    replyIndex: number,
    content: string,
    status: string,
  ) {
    setChats(function updateMessage(currentChats) {
      return updateAssistantReplyMessageInList(
        currentChats,
        sourceMessageID,
        replyIndex,
        content,
        status,
      );
    });
  }

  // markAssistantRepliesCancelled 将当前流式回复标记为已取消并保留已展示内容。
  // 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 content 表示尚无内容时展示的取消说明。
  function markAssistantRepliesCancelled(
    sourceMessageID: string,
    content: string,
  ) {
    setChats(function markCancelledReplies(currentChats) {
      return markAssistantRepliesCancelledInList(
        currentChats,
        sourceMessageID,
        content,
      );
    });
  }

  // removeAssistantRepliesNotIn 移除后端最终结果中不存在的临时助手分段气泡。
  // 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 replyIndexes 表示需要保留的回复段序号集合。
  function removeAssistantRepliesNotIn(
    sourceMessageID: string,
    replyIndexes: Set<number>,
  ) {
    setChats(function removeStaleReplies(currentChats) {
      return removeAssistantRepliesNotInList(
        currentChats,
        sourceMessageID,
        replyIndexes,
      );
    });
  }

  const chapterAiDialogueRenderConfig = useMemo(
    // buildChapterAiDialogueRenderConfig 创建章节 AI 对话消息操作区渲染配置。
    function buildChapterAiDialogueRenderConfig() {
      return createChapterAiDialogueRenderConfig(
        function retryChapterAiMessage(message) {
          void handleRetryAssistantMessage(message);
        },
        handleApproveToolApproval,
        handleRejectToolApproval,
      );
    },
    [assistantSending, chats],
  );
  const chapterAIContextValue = useMemo(
    // buildChapterAIContextValue 创建章节 AI 助手的组合式上下文值。
    function buildChapterAIContextValue() {
      return {
        state: {
          chats,
          conversations,
          assistantSending,
          inputValue,
          conversationLoading,
          historyLoading,
          conversationDeleting,
          conversationSelectOptions,
        },
        actions: {
          submit: function submitChapterAIFromContext() {
            void submitAssistantMessage();
          },
          cancel: handleCancelAssistantMessage,
          close: handleAssistantClose,
          changeInput: handleAssistantInputChange,
          handleInputKeyDown: handleAssistantInputKeyDown,
          submitForm: handleAssistantSubmit,
          changeConversation: handleConversationChange,
          startNewConversation: handleStartNewConversation,
          deleteConversation: handleDeleteAssistantConversation,
        },
        meta: {
          selectedConversationID,
          conversationSelectPlaceholder,
          assistantInputRef,
          dialogueRenderConfig: chapterAiDialogueRenderConfig,
        },
      };
    },
    [
      assistantSending,
      chats,
      chapterAiDialogueRenderConfig,
      conversationDeleting,
      conversationLoading,
      conversationSelectOptions,
      conversationSelectPlaceholder,
      conversations,
      historyLoading,
      inputValue,
      selectedConversationID,
    ],
  );

  return (
    <ChapterAIContext value={chapterAIContextValue}>
      <ChapterAiAssistantShell />
    </ChapterAIContext>
  );
}

// createChapterAiMessageID 创建章节 AI 对话本地消息 ID。
