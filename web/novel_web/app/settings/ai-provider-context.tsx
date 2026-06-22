import { createContext, use } from "react";
import type { AIProviderFormMode, AIProviderFormState } from "./types";
import type { AIProviderItem } from "../api";

// AIProviderContextState 表示 AI 提供商上下文中可被组合式子组件读取的状态。
export interface AIProviderContextState {
  // providers 表示当前分页中的 AI 提供商列表。
  providers: AIProviderItem[];
  // form 表示当前 AI 提供商表单状态。
  form: AIProviderFormState;
  // formMode 表示表单当前创建或编辑模式。
  formMode: AIProviderFormMode;
  // loading 表示列表是否正在加载。
  loading: boolean;
  // submitting 表示表单是否正在提交。
  submitting: boolean;
}

// AIProviderContextActions 表示 AI 提供商上下文中可被组合式子组件调用的动作。
export interface AIProviderContextActions {
  // reload 表示重新加载 AI 提供商列表。
  reload: () => void;
  // openCreate 表示打开创建提供商表单。
  openCreate: () => void;
}

// AIProviderContextMeta 表示 AI 提供商上下文中的补充信息。
export interface AIProviderContextMeta {
  // errorMessage 表示当前需要展示的错误消息。
  errorMessage: string;
}

// AIProviderContextValue 表示 AI 提供商组合式上下文契约。
export interface AIProviderContextValue {
  // state 表示 AI 提供商状态。
  state: AIProviderContextState;
  // actions 表示 AI 提供商动作。
  actions: AIProviderContextActions;
  // meta 表示 AI 提供商补充信息。
  meta: AIProviderContextMeta;
}

// AIProviderContext 保存 AI 提供商面板拆分后共享的 state/actions/meta。
export const AIProviderContext = createContext<AIProviderContextValue | null>(null);

// useAIProviderContext 读取 AI 提供商组合式上下文。
export function useAIProviderContext(): AIProviderContextValue {
  const value = use(AIProviderContext);
  if (!value) {
    throw new Error("AIProviderContext 缺少 Provider");
  }
  return value;
}
