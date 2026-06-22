import type {
  AgentToolConfig,
} from "../api";

// SettingsSection 表示设置中心支持切换的功能分区。
export type SettingsSection =
  | "config"
  | "agents"
  | "agent-tools"
  | "logs"
  | "system"
  | "ai-providers";

// AIProviderFormMode 表示 AI 提供商表单当前处于创建或编辑模式。
export type AIProviderFormMode = "create" | "edit";

// SettingsPageProps 表示设置中心页面需要的外部状态和回调。
export interface SettingsPageProps {
  // section 表示设置中心当前激活的功能分区。
  section: SettingsSection;
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onSectionChange 表示设置中心切换功能分区时执行的回调。
  onSectionChange: (section: SettingsSection) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ConfigSettingsPanelProps 表示配置管理面板需要的外部回调。
export interface ConfigSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// AgentSettingsPanelProps 表示智能体配置面板需要的外部回调。
export interface AgentSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// AgentToolsSettingsPanelProps 表示智能体工具配置面板需要的外部回调。
export interface AgentToolsSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// AIProviderSettingsPanelProps 表示 AI 提供商面板需要的外部回调。
export interface AIProviderSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// SystemSettingsPanelProps 表示系统更新面板需要的外部回调。
export interface SystemSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// AIProviderFormState 表示 AI 提供商表单中各字段的前端输入状态。
export interface AIProviderFormState {
  // name 表示 AI 提供商名称。
  name: string;
  // providerType 表示 AI 提供商类型。
  providerType: string;
  // apiKey 表示 AI 提供商 API Key。
  apiKey: string;
  // baseURL 表示 AI 提供商接口基础地址。
  baseURL: string;
  // defaultModel 表示模型列表不可用时使用的默认模型标识。
  defaultModel: string;
  // priority 表示 AI 提供商排序优先级，0 最低，数值越大优先级越高。
  priority: string;
  // apiType 表示 AI 接口类型。
  apiType: string;
  // enabled 表示是否启用该 AI 提供商。
  enabled: boolean;
}

// AgentSupervisorFormState 表示顶层 Agent 表单输入状态。
export interface AgentSupervisorFormState {
  // name 表示顶层 Agent 名称。
  name: string;
  // description 表示顶层 Agent 能力描述。
  description: string;
  // instruction 表示顶层 Agent 系统提示词。
  instruction: string;
  // maxIterations 表示顶层 Agent 最大生成循环次数文本。
  maxIterations: string;
  // toolNames 表示顶层 Agent 已选择的普通工具名称列表。
  toolNames: string[];
  // providerId 表示顶层 Agent 使用的 AI 提供商 ID 文本。
  providerId: string;
  // model 表示顶层 Agent 使用的模型标识。
  model: string;
  // reasoningEffort 表示顶层 Agent 使用 GPT 类模型时的推理强度。
  reasoningEffort: string;
}

// AgentChildFormState 表示子 Agent 表单输入状态。
export interface AgentChildFormState {
  // id 表示前端渲染列表时使用的稳定标识。
  id: string;
  // enabled 表示该子 Agent 是否启用。
  enabled: boolean;
  // shareChatHistory 表示父 Agent 调用该子 Agent 时是否共享完整聊天历史。
  shareChatHistory: boolean;
  // name 表示子 Agent 名称，同时也是工具名称。
  name: string;
  // task 表示子 Agent 流事件任务标识。
  task: string;
  // description 表示子 Agent 能力描述。
  description: string;
  // instruction 表示子 Agent 系统提示词。
  instruction: string;
  // maxIterations 表示子 Agent 最大生成循环次数文本。
  maxIterations: string;
  // toolNames 表示该子 Agent 已选择的普通工具名称列表。
  toolNames: string[];
  // providerId 表示该子 Agent 使用的 AI 提供商 ID 文本。
  providerId: string;
  // model 表示该子 Agent 使用的模型标识。
  model: string;
  // reasoningEffort 表示该子 Agent 使用 GPT 类模型时的推理强度。
  reasoningEffort: string;
  // parametersText 表示子 Agent 工具参数 JSON 文本。
  parametersText: string;
}

// AgentParameterJsonViewerRef 表示子 Agent 参数 JSON 编辑器暴露给页面读取的实例方法。
export interface AgentParameterJsonViewerRef {
  // getValue 表示读取编辑器中当前 JSON 文本的方法。
  getValue: () => string;
}

// EditingAgentTarget 表示当前正在弹窗中编辑的 Agent 目标。
export type EditingAgentTarget =
  | {
      // kind 表示当前编辑目标为顶层 Agent。
      kind: "supervisor";
    }
  | {
      // kind 表示当前编辑目标为子 Agent。
      kind: "child";
      // childID 表示子 Agent 前端稳定标识，用于移动排序后继续定位。
      childID: string;
    };

// AgentChildTextField 表示子 Agent 表单中以文本方式编辑的字段名。
export type AgentChildTextField =
  | "name"
  | "task"
  | "description"
  | "instruction"
  | "maxIterations";

// AgentSettingsFormState 表示智能体配置页完整表单状态。
export interface AgentSettingsFormState {
  // toolRegistry 表示当前配置中的普通工具注册表。
  toolRegistry: AgentToolConfig[];
  // memoryRecentRounds 表示最近原始对话轮数配置文本。
  memoryRecentRounds: string;
  // retryMaxRetries 表示模型失败最大重试次数配置文本。
  retryMaxRetries: string;
  // retryBackoffMS 表示模型失败重试间隔毫秒数配置文本。
  retryBackoffMS: string;
  // supervisor 表示顶层 Agent 表单状态。
  supervisor: AgentSupervisorFormState;
  // children 表示全部子 Agent 表单状态。
  children: AgentChildFormState[];
}
