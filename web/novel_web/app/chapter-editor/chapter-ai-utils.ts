import type { MouseEvent } from "react";
import type { NovelAgentMessageItem } from "../api";
import { chapterAiInputMaxHeight } from "./constants";
import type { ChapterAiMessage } from "./types";

// handleChapterAiPendingMessageAction 处理暂未接入真实逻辑的章节 AI 消息操作按钮。
// 参数 event 表示按钮点击事件，用于阻止占位操作触发外层交互。
export function handleChapterAiPendingMessageAction(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

export function createChapterAiMessageID(role: string, createdAt: number): string {
  return `chapter-ai-${role}-${createdAt}`;
}

// createChapterAiReplyMessageID 创建章节 AI 分段助手消息 ID。
// 参数 sourceMessageID 表示本次 AI 回复的基础消息 ID；参数 replyIndex 表示回复段序号。
export function createChapterAiReplyMessageID(
  sourceMessageID: string,
  replyIndex: number,
): string {
  if (replyIndex <= 1) {
    return sourceMessageID;
  }
  return `${sourceMessageID}-reply-${replyIndex}`;
}

// createChapterAiPairID 创建同一轮章节 AI 用户消息和助手消息共用的配对 ID。
// 参数 createdAt 表示消息创建时间戳。
export function createChapterAiPairID(createdAt: number): string {
  return `chapter-ai-pair-${createdAt}`;
}

// createChapterAiLoadingMessageID 创建章节 AI 原生加载占位消息 ID。
// 参数 pairID 表示当前用户消息和助手消息共用的配对 ID。
export function createChapterAiLoadingMessageID(pairID: string): string {
  return `${pairID}-loading`;
}

// chapterAiMessageFromHistory 将后端历史消息转换为 AIChatDialogue 消息。
// 参数 item 表示后端返回的单条 Agent 历史消息。
export function chapterAiMessageFromHistory(item: NovelAgentMessageItem): ChapterAiMessage {
  return {
    id: `chapter-ai-history-${item.id}`,
    chapterAiConversationID: item.conversation_id,
    chapterAiReplyIndex: 1,
    role: item.role,
    content: item.content,
    status: "completed",
  };
}

// createChapterAiRenderMessageID 创建章节 AI 消息最终渲染 ID，避免流式 Markdown 旧解析结果覆盖最终内容。
// 参数 messageID 表示消息的基础 ID；参数 status 表示消息最终状态；参数 contentLength 表示最终内容长度。
export function createChapterAiRenderMessageID(
  messageID: string,
  status: string,
  contentLength: number,
): string {
  return `${messageID}-${status}-${contentLength}`;
}

// syncChapterAiInputHeight 根据输入内容同步 AI 输入框高度。
// 参数 textarea 表示需要调整高度的 AI 输入框元素。
export function syncChapterAiInputHeight(textarea: HTMLTextAreaElement | null) {
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
