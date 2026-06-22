import { createContext, use } from "react";
import type { NovelAgentConversationItem } from "../api";
import type { ChapterAiMessage } from "./types";

// ChapterAIContextState 表示章节 AI 助手组合式上下文中的状态。
export interface ChapterAIContextState {
  // chats 表示当前展示的 AI 对话消息。
  chats: ChapterAiMessage[];
  // conversations 表示当前小说已有的 AI 会话列表。
  conversations: NovelAgentConversationItem[];
  // assistantSending 表示 AI 是否正在回复。
  assistantSending: boolean;
}

// ChapterAIContextActions 表示章节 AI 助手组合式上下文中的动作。
export interface ChapterAIContextActions {
  // submit 表示发送当前 AI 输入。
  submit: () => void;
  // cancel 表示中断当前 AI 回复。
  cancel: () => void;
}

// ChapterAIContextMeta 表示章节 AI 助手组合式上下文中的补充信息。
export interface ChapterAIContextMeta {
  // selectedConversationID 表示当前选中的 AI 会话 ID。
  selectedConversationID: number | null;
}

// ChapterAIContextValue 表示章节 AI 助手 state/actions/meta 契约。
export interface ChapterAIContextValue {
  // state 表示章节 AI 助手状态。
  state: ChapterAIContextState;
  // actions 表示章节 AI 助手动作。
  actions: ChapterAIContextActions;
  // meta 表示章节 AI 助手补充信息。
  meta: ChapterAIContextMeta;
}

// ChapterAIContext 保存章节 AI 助手拆分后共享的 state/actions/meta。
export const ChapterAIContext = createContext<ChapterAIContextValue | null>(null);

// useChapterAIContext 读取章节 AI 助手组合式上下文。
export function useChapterAIContext(): ChapterAIContextValue {
  const value = use(ChapterAIContext);
  if (!value) {
    throw new Error("ChapterAIContext 缺少 Provider");
  }
  return value;
}
