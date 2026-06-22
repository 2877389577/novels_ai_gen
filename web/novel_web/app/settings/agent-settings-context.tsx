import { createContext, use } from "react";
import type { AgentSettingsFormState } from "./types";

// AgentSettingsContextState 表示智能体设置上下文中可被组合式子组件读取的状态。
export interface AgentSettingsContextState {
  // form 表示当前智能体设置表单快照。
  form: AgentSettingsFormState;
  // loading 表示智能体设置是否正在加载。
  loading: boolean;
  // saving 表示智能体设置是否正在保存。
  saving: boolean;
  // dirty 表示当前表单是否相对已保存快照发生变化。
  dirty: boolean;
}

// AgentSettingsContextActions 表示智能体设置上下文中可被组合式子组件调用的动作。
export interface AgentSettingsContextActions {
  // reload 表示重新加载后端智能体配置。
  reload: () => void;
  // save 表示保存当前智能体配置。
  save: () => void;
}

// AgentSettingsContextMeta 表示智能体设置上下文中的补充信息。
export interface AgentSettingsContextMeta {
  // errorMessage 表示当前需要展示的错误消息。
  errorMessage: string;
}

// AgentSettingsContextValue 表示智能体设置组合式上下文契约。
export interface AgentSettingsContextValue {
  // state 表示智能体设置状态。
  state: AgentSettingsContextState;
  // actions 表示智能体设置动作。
  actions: AgentSettingsContextActions;
  // meta 表示智能体设置补充信息。
  meta: AgentSettingsContextMeta;
}

// AgentSettingsContext 保存智能体设置面板拆分后共享的 state/actions/meta。
export const AgentSettingsContext = createContext<AgentSettingsContextValue | null>(null);

// useAgentSettingsContext 读取智能体设置组合式上下文。
export function useAgentSettingsContext(): AgentSettingsContextValue {
  const value = use(AgentSettingsContext);
  if (!value) {
    throw new Error("AgentSettingsContext 缺少 Provider");
  }
  return value;
}
