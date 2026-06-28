import { createContext, use, type ChangeEvent, type KeyboardEvent } from "react";
import type { AIProviderItem, AIProviderModelItem } from "../api";
import type {
  AgentChildFormState,
  AgentChildTextField,
  AgentParameterJsonViewerRef,
  AgentSettingsFormState,
  EditingAgentTarget,
} from "./types";

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
  // editingAgentTarget 表示当前正在编辑的 Agent 目标。
  editingAgentTarget: EditingAgentTarget | null;
  // editingChildIndex 表示当前编辑子 Agent 在列表中的位置，非子 Agent 时为 -1。
  editingChildIndex: number;
  // editingChild 表示当前正在编辑的子 Agent 表单数据。
  editingChild: AgentChildFormState | null;
  // modelProviders 表示可用于 Agent 模型选择的 AI 提供商列表。
  modelProviders: AIProviderItem[];
  // modelOptionsByProvider 表示按 AI 提供商缓存的模型选项。
  modelOptionsByProvider: Record<string, AIProviderModelItem[]>;
  // modelLoadingByProvider 表示按 AI 提供商和 API 协议记录的模型列表加载状态。
  modelLoadingByProvider: Record<string, boolean>;
}

// AgentSettingsContextActions 表示智能体设置上下文中可被组合式子组件调用的动作。
export interface AgentSettingsContextActions {
  // reload 表示重新加载后端智能体配置。
  reload: () => void;
  // save 表示保存当前智能体配置。
  save: () => void;
  // changeMemoryRecentRounds 表示更新最近对话轮数输入。
  changeMemoryRecentRounds: (event: ChangeEvent<HTMLInputElement>) => void;
  // changeMemoryContextTokens 表示更新上下文压缩 Token 阈值输入。
  changeMemoryContextTokens: (event: ChangeEvent<HTMLInputElement>) => void;
  // changeMemoryRawHistoryTokens 表示更新原文历史 Token 预算输入。
  changeMemoryRawHistoryTokens: (event: ChangeEvent<HTMLInputElement>) => void;
  // changeRetryMaxRetries 表示更新模型失败最大重试次数输入。
  changeRetryMaxRetries: (event: ChangeEvent<HTMLInputElement>) => void;
  // changeRetryBackoffMS 表示更新模型失败重试间隔输入。
  changeRetryBackoffMS: (event: ChangeEvent<HTMLInputElement>) => void;
  // openAgentEditor 表示打开指定 Agent 的编辑弹窗。
  openAgentEditor: (target: EditingAgentTarget) => void;
  // openAgentEditorWithKeyboard 表示通过键盘操作打开指定 Agent 的编辑弹窗。
  openAgentEditorWithKeyboard: (
    event: KeyboardEvent<HTMLDivElement>,
    target: EditingAgentTarget,
  ) => void;
  // addChildAgent 表示新增一个子 Agent。
  addChildAgent: () => void;
  // closeAgentEditor 表示关闭当前 Agent 编辑弹窗。
  closeAgentEditor: () => void;
  // changeSupervisorInput 表示更新顶层 Agent 文本或数字字段。
  changeSupervisorInput: (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  // changeSupervisorTool 表示更新顶层 Agent 普通工具启用状态。
  changeSupervisorTool: (toolName: string, enabled: boolean) => void;
  // changeSupervisorModelProvider 表示更新顶层 Agent 模型提供商。
  changeSupervisorModelProvider: (event: ChangeEvent<HTMLSelectElement>) => void;
  // changeSupervisorProviderType 表示更新顶层 Agent 模型 API 协议。
  changeSupervisorProviderType: (event: ChangeEvent<HTMLSelectElement>) => void;
  // changeSupervisorModel 表示更新顶层 Agent 模型。
  changeSupervisorModel: (event: ChangeEvent<HTMLSelectElement>) => void;
  // changeSupervisorReasoningEffort 表示更新顶层 Agent GPT 推理强度。
  changeSupervisorReasoningEffort: (
    event: ChangeEvent<HTMLSelectElement>,
  ) => void;
  // changeChildEnabled 表示更新子 Agent 启用状态。
  changeChildEnabled: (index: number, enabled: boolean) => void;
  // changeChildShareChatHistory 表示更新子 Agent 共享历史状态。
  changeChildShareChatHistory: (index: number, enabled: boolean) => void;
  // changeChildInput 表示更新子 Agent 文本字段。
  changeChildInput: (
    index: number,
    field: AgentChildTextField,
    value: string,
  ) => void;
  // changeChildTool 表示更新子 Agent 普通工具启用状态。
  changeChildTool: (index: number, toolName: string, enabled: boolean) => void;
  // changeChildModelProvider 表示更新子 Agent 模型提供商。
  changeChildModelProvider: (index: number, providerId: string) => void;
  // changeChildProviderType 表示更新子 Agent 模型 API 协议。
  changeChildProviderType: (index: number, providerType: string) => void;
  // changeChildModel 表示更新子 Agent 模型。
  changeChildModel: (index: number, model: string) => void;
  // changeEditingChildReasoningEffort 表示更新当前编辑子 Agent 的 GPT 推理强度。
  changeEditingChildReasoningEffort: (
    event: ChangeEvent<HTMLSelectElement>,
  ) => void;
  // focusAgentModelSelect 表示模型下拉框聚焦时按需加载模型列表。
  focusAgentModelSelect: (providerId: string, providerType: string) => void;
  // moveChildAgent 表示移动子 Agent 顺序。
  moveChildAgent: (index: number, direction: -1 | 1) => void;
  // removeChildAgent 表示删除指定子 Agent。
  removeChildAgent: (index: number) => void;
  // bindChildParametersEditor 表示绑定子 Agent 参数 JSON 编辑器实例。
  bindChildParametersEditor: (
    childID: string,
    instance: AgentParameterJsonViewerRef | null,
  ) => void;
  // markParameterEditorChanged 表示 JsonViewer 内容发生变化并需要重新计算脏数据。
  markParameterEditorChanged: () => void;
}

// AgentSettingsContextMeta 表示智能体设置上下文中的补充信息。
export interface AgentSettingsContextMeta {
  // errorMessage 表示当前需要展示的错误消息。
  errorMessage: string;
  // configFile 表示当前智能体配置文件路径。
  configFile: string;
  // modifiedAtText 表示配置文件最近修改时间的展示文本。
  modifiedAtText: string;
  // reloadedAtText 表示配置文件最近加载时间的展示文本。
  reloadedAtText: string;
  // agentEditorVisible 表示 Agent 编辑弹窗是否可见。
  agentEditorVisible: boolean;
  // agentEditorTitle 表示 Agent 编辑弹窗标题。
  agentEditorTitle: string;
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
