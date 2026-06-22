import type { ChapterAiMessage } from "./types";
import {
  createChapterAiLoadingMessageID,
  createChapterAiRenderMessageID,
  createChapterAiReplyMessageID,
} from "./chapter-ai-utils";

// bindChapterAiPairConversation 将本地一轮消息绑定到后端会话 ID。
// 参数 chats 表示当前章节 AI 消息列表；参数 pairID 表示需要更新的消息配对 ID；参数 conversationID 表示后端返回的 Agent 会话 ID。
export function bindChapterAiPairConversation(
  chats: ChapterAiMessage[],
  pairID: string,
  conversationID: number,
): ChapterAiMessage[] {
  return chats.map(function updateChatConversationID(chat) {
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
}

// updateChapterAiPairRetryableInList 更新指定配对中用户消息的可重试状态。
// 参数 chats 表示当前章节 AI 消息列表；参数 pairID 表示需要更新的消息配对 ID；参数 retryable 表示是否允许展示重试按钮。
export function updateChapterAiPairRetryableInList(
  chats: ChapterAiMessage[],
  pairID: string,
  retryable: boolean,
): ChapterAiMessage[] {
  return chats.map(function updateChatRetryable(chat) {
    if (chat.role !== "user" || chat.chapterAiPairID !== pairID) {
      return chat;
    }
    return {
      ...chat,
      chapterAiRetryable: retryable,
    };
  });
}

// resetChapterAiRequestForRetryInList 重置指定配对的助手消息，使重试复用原对话位置。
// 参数 chats 表示当前章节 AI 消息列表；参数 pairID 表示需要重试的消息配对 ID；参数 assistantMessageID 表示助手消息基础 ID。
export function resetChapterAiRequestForRetryInList(
  chats: ChapterAiMessage[],
  pairID: string,
  assistantMessageID: string,
): ChapterAiMessage[] {
  let assistantReset = false;
  return chats.flatMap(function resetRetryMessage(chat) {
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
      if (chat.chapterAiLoading) {
        return [];
      }
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
}

// appendChapterAiLoadingMessageToList 追加当前 AI 请求仍在进行中的本地加载占位消息。
// 参数 chats 表示当前章节 AI 消息列表；参数 pairID 表示当前用户消息和助手消息共用的配对 ID；参数 conversationID 表示当前会话 ID。
export function appendChapterAiLoadingMessageToList(
  chats: ChapterAiMessage[],
  pairID: string,
  conversationID: number | undefined,
): ChapterAiMessage[] {
  if (
    chats.some(function hasLoadingMessage(chat) {
      return chat.chapterAiPairID === pairID && chat.chapterAiLoading;
    })
  ) {
    return chats;
  }
  return [
    ...chats,
    {
      id: createChapterAiLoadingMessageID(pairID),
      chapterAiConversationID: conversationID,
      chapterAiPairID: pairID,
      chapterAiLoading: true,
      role: "assistant",
      content: "",
      status: "in_progress",
    },
  ];
}

// removeChapterAiLoadingMessageFromList 移除当前 AI 请求的本地加载占位消息。
// 参数 chats 表示当前章节 AI 消息列表；参数 pairID 表示当前用户消息和助手消息共用的配对 ID。
export function removeChapterAiLoadingMessageFromList(
  chats: ChapterAiMessage[],
  pairID: string,
): ChapterAiMessage[] {
  return chats.filter(function keepMessage(chat) {
    return !(chat.chapterAiPairID === pairID && chat.chapterAiLoading);
  });
}

// appendAssistantReplyMessageToList 追加一段新的 AI 助手回复气泡。
// 参数 chats 表示当前章节 AI 消息列表；参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 messageID 表示当前回复段消息 ID；参数 pairID 表示本轮消息配对 ID；参数 conversationID 表示当前会话 ID；参数 replyIndex 表示回复段序号。
export function appendAssistantReplyMessageToList(
  chats: ChapterAiMessage[],
  sourceMessageID: string,
  messageID: string,
  pairID: string,
  conversationID: number | undefined,
  replyIndex: number,
): ChapterAiMessage[] {
  if (
    chats.some(function hasReplyMessage(chat) {
      return (
        chat.role === "assistant" &&
        chat.chapterAiSourceID === sourceMessageID &&
        chat.chapterAiReplyIndex === replyIndex
      );
    })
  ) {
    return chats;
  }
  const replyMessage: ChapterAiMessage = {
    id: messageID,
    chapterAiConversationID: conversationID,
    chapterAiPairID: pairID,
    chapterAiSourceID: sourceMessageID,
    chapterAiReplyIndex: replyIndex,
    role: "assistant",
    content: "",
    status: "in_progress",
  };
  const loadingMessageIndex = chats.findIndex(
    function findLoadingMessage(chat) {
      return chat.chapterAiPairID === pairID && chat.chapterAiLoading;
    },
  );
  if (loadingMessageIndex < 0) {
    return [...chats, replyMessage];
  }
  return [
    ...chats.slice(0, loadingMessageIndex),
    replyMessage,
    ...chats.slice(loadingMessageIndex),
  ];
}

// updateAssistantReplyMessageInList 更新指定回复段的 AI 助手消息内容。
// 参数 chats 表示当前章节 AI 消息列表；参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 replyIndex 表示回复段序号；参数 content 表示新的消息内容；参数 status 表示消息当前生成状态。
export function updateAssistantReplyMessageInList(
  chats: ChapterAiMessage[],
  sourceMessageID: string,
  replyIndex: number,
  content: string,
  status: string,
): ChapterAiMessage[] {
  const messageID = createChapterAiReplyMessageID(sourceMessageID, replyIndex);
  return chats.map(function updateChat(chat) {
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
}

// collapseAssistantRepliesToStatusInList 将本次请求的多个助手气泡折叠为一个状态气泡。
// 参数 chats 表示当前章节 AI 消息列表；参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 content 表示状态气泡文本；参数 status 表示消息状态。
export function collapseAssistantRepliesToStatusInList(
  chats: ChapterAiMessage[],
  sourceMessageID: string,
  content: string,
  status: string,
): ChapterAiMessage[] {
  let statusMessageKept = false;
  return chats.flatMap(function collapseReplyMessage(chat) {
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
}

// removeAssistantRepliesNotInList 移除后端最终结果中不存在的临时助手分段气泡。
// 参数 chats 表示当前章节 AI 消息列表；参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 replyIndexes 表示需要保留的回复段序号集合。
export function removeAssistantRepliesNotInList(
  chats: ChapterAiMessage[],
  sourceMessageID: string,
  replyIndexes: Set<number>,
): ChapterAiMessage[] {
  return chats.filter(function keepReplyMessage(chat) {
    if (
      chat.role !== "assistant" ||
      chat.chapterAiSourceID !== sourceMessageID
    ) {
      return true;
    }
    return replyIndexes.has(chat.chapterAiReplyIndex ?? 1);
  });
}
