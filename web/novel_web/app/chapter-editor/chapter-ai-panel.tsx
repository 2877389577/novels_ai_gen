import { IconArrowUp, IconClose, IconDelete, IconDeleteStroked, IconEditStroked, IconPlus, IconRedoStroked, IconStop } from "@douyinfe/semi-icons";
import { AIChatDialogue, Button, Modal, Select, Toast } from "@douyinfe/semi-ui-19";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import type { DialogueRenderConfig, RenderActionProps } from "@douyinfe/semi-ui-19/lib/es/aiChatDialogue/interface";
import { UnauthorizedError, deleteNovelAgentConversation, fetchNovelAgentConversationMessages, fetchNovelAgentConversations, streamNovelAgentChat, type NovelAgentConversationItem } from "../api";
import { chapterAiAssistantMessages, chapterAiAssistantRoleConfig } from "./constants";
import { ChapterAIContext } from "./chapter-ai-context";
import type { ChapterAiAssistantPanelProps, ChapterAiMessage, ChapterAiReplyDraft, ChapterAiRetryPayload, ChapterAiSavedChapterContext, ChapterAiStreamRequest } from "./types";
import { createChapterAiMessageID, createChapterAiPairID, createChapterAiRenderMessageID, createChapterAiReplyMessageID, chapterAiMessageFromHistory, handleChapterAiPendingMessageAction, syncChapterAiInputHeight } from "./chapter-ai-utils";
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
  const selectedConversationIDRef = useRef<number | null>(null);

  const conversationSelectOptions = useMemo(
    // buildConversationSelectOptions 将 AI 会话列表转换为 Semi Select 选项。
    function buildConversationSelectOptions() {
      const titleCounts = new Map<string, number>();
      for (const conversation of conversations) {
        const title = conversation.title?.trim() || "未命名会话";
        titleCounts.set(title, (titleCounts.get(title) ?? 0) + 1);
      }
      return conversations.map(function mapConversationToOption(conversation) {
        const title = conversation.title?.trim() || "未命名会话";
        const duplicateTitle = (titleCounts.get(title) ?? 0) > 1;
        return {
          label: duplicateTitle ? `${title} #${conversation.id}` : title,
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
          const data = await fetchNovelAgentConversations(props.novelId, controller.signal);
          if (controller.signal.aborted) {
            return;
          }

          setConversations(data.items);
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

  // handleAssistantClose 关闭 AI 侧栏并取消仍在进行的流式请求。
  function handleAssistantClose() {
    streamControllerRef.current?.abort();
    props.onClose();
  }

  // handleCancelAssistantMessage 中断当前正在进行的 AI 流式回复。
  function handleCancelAssistantMessage() {
    streamControllerRef.current?.abort();
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
    let savedChapterContext: ChapterAiSavedChapterContext | null;
    try {
      savedChapterContext = await props.ensureChapterSavedForAgent();
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
    if (savedChapterContext === null) {
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
      savedChapterID: savedChapterContext.chapterId,
      savedChapterNumber: savedChapterContext.chapterNumber,
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
    let savedChapterContext: ChapterAiSavedChapterContext | null;
    try {
      savedChapterContext = await props.ensureChapterSavedForAgent();
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
    if (savedChapterContext === null) {
      setAssistantSending(false);
      return;
    }

    resetChapterAiRequestForRetry(pairID, assistantMessageID);
    await runChapterAiStream({
      pairID,
      assistantMessageID,
      savedChapterID: savedChapterContext.chapterId,
      savedChapterNumber: savedChapterContext.chapterNumber,
      retryPayload,
    });
  }

  // runChapterAiStream 执行章节 AI 流式请求并更新对应助手消息。
  // 参数 request 表示本次流式请求所需的消息配对和章节上下文。
  async function runChapterAiStream(request: ChapterAiStreamRequest) {
    const controller = new AbortController();
    streamControllerRef.current?.abort();
    streamControllerRef.current = controller;

    let assistantContent = "";
    let handledFailure = false;
    const assistantReplies = new Map<number, ChapterAiReplyDraft>();
    assistantReplies.set(1, {
      messageID: createChapterAiReplyMessageID(request.assistantMessageID, 1),
      content: "",
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
          message: request.retryPayload.message,
          novelId: props.novelId,
          conversationId: request.retryPayload.conversationId,
          chapterId: request.savedChapterID,
          chapterNumber: request.savedChapterNumber,
          signal: controller.signal,
        },
        {
          onEvent(event) {
            if (handledFailure) {
              return;
            }
            if (event.type === "delta") {
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
              return;
            }
            if (event.type === "done") {
              assistantContent = event.content || assistantContent;
              completeAssistantReplies(event.replies ?? []);
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
        collapseAssistantRepliesToStatus(
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
    collapseAssistantRepliesToStatus(assistantMessageID, errorMessage, "failed");
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
      return currentChats.map(function updateChatConversationID(chat) {
        if (chat.chapterAiPairID !== pairID) {
          return chat;
        }
        return {
          ...chat,
          chapterAiConversationID: conversationID,
          chapterAiRetryPayload: chat.chapterAiRetryPayload
            ? {
                ...chat.chapterAiRetryPayload,
                conversationId: conversationID,
              }
            : undefined,
        };
      });
    });
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
      let assistantReset = false;
      return currentChats.flatMap(function resetRetryMessage(chat) {
        if (chat.chapterAiPairID !== pairID) {
          return [chat];
        }
        if (chat.role === "user") {
          return [{
            ...chat,
            chapterAiRetryable: false,
          }];
        }
        if (chat.role === "assistant") {
          if (assistantReset) {
            return [];
          }
          assistantReset = true;
          return [{
            ...chat,
            id: assistantMessageID,
            chapterAiSourceID: assistantMessageID,
            chapterAiReplyIndex: 1,
            content: "",
            status: "in_progress",
          }];
        }
        return [chat];
      });
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
      if (
        currentChats.some(function hasReplyMessage(chat) {
          return (
            chat.role === "assistant" &&
            chat.chapterAiSourceID === sourceMessageID &&
            chat.chapterAiReplyIndex === replyIndex
          );
        })
      ) {
        return currentChats;
      }
      return [
        ...currentChats,
        {
          id: messageID,
          chapterAiConversationID: conversationID,
          chapterAiPairID: pairID,
          chapterAiSourceID: sourceMessageID,
          chapterAiReplyIndex: replyIndex,
          role: "assistant",
          content: "",
          status: "in_progress",
        },
      ];
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
    const messageID = createChapterAiReplyMessageID(sourceMessageID, replyIndex);
    setChats(function updateMessage(currentChats) {
      return currentChats.map(function updateChat(chat) {
        const chatReplyIndex = chat.chapterAiReplyIndex ?? 1;
        if (
          chat.role !== "assistant" ||
          chat.chapterAiSourceID !== sourceMessageID ||
          chatReplyIndex !== replyIndex
        ) {
          return chat;
        }
        return {
          ...chat,
          id:
            status === "in_progress"
              ? chat.id
              : createChapterAiRenderMessageID(messageID, status, content.length),
          chapterAiSourceID: sourceMessageID,
          chapterAiReplyIndex: replyIndex,
          content,
          status,
        };
      });
    });
  }

  // collapseAssistantRepliesToStatus 将本次请求的多个助手气泡折叠为一个状态气泡。
  // 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 content 表示状态气泡文本；参数 status 表示消息状态。
  function collapseAssistantRepliesToStatus(
    sourceMessageID: string,
    content: string,
    status: string,
  ) {
    setChats(function collapseReplyMessages(currentChats) {
      let statusMessageKept = false;
      return currentChats.flatMap(function collapseReplyMessage(chat) {
        if (
          chat.role !== "assistant" ||
          chat.chapterAiSourceID !== sourceMessageID
        ) {
          return [chat];
        }
        if (statusMessageKept) {
          return [];
        }
        statusMessageKept = true;
        return [{
          ...chat,
          id: createChapterAiRenderMessageID(
            sourceMessageID,
            status,
            content.length,
          ),
          chapterAiSourceID: sourceMessageID,
          chapterAiReplyIndex: 1,
          content,
          status,
        }];
      });
    });
  }

  // removeAssistantRepliesNotIn 移除后端最终结果中不存在的临时助手分段气泡。
  // 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 replyIndexes 表示需要保留的回复段序号集合。
  function removeAssistantRepliesNotIn(
    sourceMessageID: string,
    replyIndexes: Set<number>,
  ) {
    setChats(function removeStaleReplies(currentChats) {
      return currentChats.filter(function keepReplyMessage(chat) {
        if (
          chat.role !== "assistant" ||
          chat.chapterAiSourceID !== sourceMessageID
        ) {
          return true;
        }
        return replyIndexes.has(chat.chapterAiReplyIndex ?? 1);
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
  const chapterAIContextValue = useMemo(
    // buildChapterAIContextValue 创建章节 AI 助手的组合式上下文值。
    function buildChapterAIContextValue() {
      return {
        state: {
          chats,
          conversations,
          assistantSending,
        },
        actions: {
          submit: function submitChapterAIFromContext() {
            void submitAssistantMessage();
          },
          cancel: handleCancelAssistantMessage,
        },
        meta: {
          selectedConversationID,
        },
      };
    },
    [assistantSending, chats, conversations, selectedConversationID],
  );

  return (
    <ChapterAIContext value={chapterAIContextValue}>
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
              aria-label="删除当前 AI 会话"
              className="chapter-ai-assistant-clear"
              disabled={
                conversationLoading ||
                historyLoading ||
                conversationDeleting ||
                assistantSending ||
                selectedConversationID === null
              }
              onClick={handleDeleteAssistantConversation}
              title="删除会话"
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
        <div className="chapter-ai-conversation-bar">
          <span
            className="chapter-ai-conversation-label"
            id="chapter-ai-conversation-label"
          >
            会话
          </span>
          <Select<string>
            aria-labelledby="chapter-ai-conversation-label"
            className="chapter-ai-conversation-select"
            disabled={
              conversationLoading || assistantSending || conversations.length === 0
            }
            loading={conversationLoading}
            onChange={handleConversationChange}
            optionList={conversationSelectOptions}
            placeholder={conversationSelectPlaceholder}
            size="small"
            value={
              selectedConversationID === null
                ? undefined
                : String(selectedConversationID)
            }
          />
          <button
            aria-label="开启新 AI 会话"
            className="chapter-ai-new-conversation"
            disabled={conversationLoading || assistantSending}
            onClick={handleStartNewConversation}
            title="新会话"
            type="button"
          >
            <IconPlus aria-hidden="true" />
            <span>新会话</span>
          </button>
        </div>
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
                aria-label={assistantSending ? "中断 AI 回复" : "发送给 AI 写作助手"}
                className={
                  assistantSending
                    ? "chapter-ai-send chapter-ai-send-stop"
                    : "chapter-ai-send"
                }
                onClick={
                  assistantSending
                    ? handleCancelAssistantMessage
                    : undefined
                }
                title={assistantSending ? "中断" : "发送"}
                type={assistantSending ? "button" : "submit"}
              >
                {assistantSending ? (
                  <IconStop aria-hidden="true" />
                ) : (
                  <IconArrowUp aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
      </aside>
    </ChapterAIContext>
  );
}

// createChapterAiMessageID 创建章节 AI 对话本地消息 ID。
