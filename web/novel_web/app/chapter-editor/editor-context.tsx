import { createContext, use } from "react";
import type { ChapterEditorState, ChapterSelectionAIAction } from "./types";

// ChapterEditorContextState 表示章节编辑器组合式上下文中的页面状态。
export interface ChapterEditorContextState {
  // state 表示章节详情加载状态。
  state: ChapterEditorState;
  // aiPanelOpen 表示 AI 写作助手侧栏是否打开。
  aiPanelOpen: boolean;
  // selectionAIAction 表示正文选区 AI 操作按钮状态。
  selectionAIAction: ChapterSelectionAIAction | null;
}

// ChapterEditorContextActions 表示章节编辑器组合式上下文中的动作。
export interface ChapterEditorContextActions {
  // save 表示保存当前章节内容。
  save: () => void;
  // toggleAI 表示切换 AI 写作助手侧栏。
  toggleAI: () => void;
}

// ChapterEditorContextMeta 表示章节编辑器组合式上下文中的补充信息。
export interface ChapterEditorContextMeta {
  // message 表示当前错误或状态提示。
  message: string;
}

// ChapterEditorContextValue 表示章节编辑器 state/actions/meta 契约。
export interface ChapterEditorContextValue {
  // state 表示章节编辑器状态。
  state: ChapterEditorContextState;
  // actions 表示章节编辑器动作。
  actions: ChapterEditorContextActions;
  // meta 表示章节编辑器补充信息。
  meta: ChapterEditorContextMeta;
}

// ChapterEditorContext 保存章节编辑器拆分后共享的 state/actions/meta。
export const ChapterEditorContext = createContext<ChapterEditorContextValue | null>(null);

// useChapterEditorContext 读取章节编辑器组合式上下文。
export function useChapterEditorContext(): ChapterEditorContextValue {
  const value = use(ChapterEditorContext);
  if (!value) {
    throw new Error("ChapterEditorContext 缺少 Provider");
  }
  return value;
}
