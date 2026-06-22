import {
  createContext,
  use,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import type {
  DialogueRenderConfig,
} from "@douyinfe/semi-ui-19/lib/es/aiChatDialogue/interface";
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
  // inputValue 表示当前 AI 输入框文本。
  inputValue: string;
  // conversationLoading 表示 AI 会话列表是否正在加载。
  conversationLoading: boolean;
  // historyLoading 表示当前会话历史消息是否正在加载。
  historyLoading: boolean;
  // conversationDeleting 表示当前会话是否正在删除。
  conversationDeleting: boolean;
  // conversationSelectOptions 表示 AI 会话下拉框选项。
  conversationSelectOptions: Array<{ label: string; value: string }>;
}

// ChapterAIContextActions 表示章节 AI 助手组合式上下文中的动作。
export interface ChapterAIContextActions {
  // submit 表示发送当前 AI 输入。
  submit: () => void;
  // cancel 表示中断当前 AI 回复。
  cancel: () => void;
  // close 表示关闭章节 AI 助手侧栏。
  close: () => void;
  // changeInput 表示更新 AI 输入框文本。
  changeInput: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  // handleInputKeyDown 表示处理 AI 输入框键盘事件。
  handleInputKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  // submitForm 表示提交 AI 输入表单。
  submitForm: (event: FormEvent<HTMLFormElement>) => void;
  // changeConversation 表示切换当前 AI 会话。
  changeConversation: (value: string | string[] | undefined) => void;
  // startNewConversation 表示开启一个新的 AI 会话。
  startNewConversation: () => void;
  // deleteConversation 表示删除当前 AI 会话。
  deleteConversation: () => void;
}

// ChapterAIContextMeta 表示章节 AI 助手组合式上下文中的补充信息。
export interface ChapterAIContextMeta {
  // selectedConversationID 表示当前选中的 AI 会话 ID。
  selectedConversationID: number | null;
  // conversationSelectPlaceholder 表示 AI 会话下拉框占位文案。
  conversationSelectPlaceholder: string;
  // assistantInputRef 表示 AI 输入框 DOM 引用。
  assistantInputRef: RefObject<HTMLTextAreaElement | null>;
  // dialogueRenderConfig 表示 Semi AIChatDialogue 自定义渲染配置。
  dialogueRenderConfig: DialogueRenderConfig;
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
