import type {
  AgentConfig,
  AgentDefinition,
  AgentParameterDefinition,
  AgentToolConfig,
  AIProviderItem,
  AIProviderModelItem,
  AIProviderType,
  AIProviderUpsertParams,
  ChapterSummaryAgentConfig,
} from "../api";
import type {
  AgentChildFormState,
  AgentSettingsFormState,
  AIProviderFormState,
  AIProviderFormMode,
  ChapterSummaryAgentFormState,
} from "./types";
import { agentProviderTypeOptions } from "./settings-constants";

const defaultAIProviderFormState: AIProviderFormState = {
  name: "",
  apiKey: "",
  baseURL: "",
  httpProxy: "",
  defaultModel: "",
  priority: "0",
  enabled: true,
};
const defaultAgentSettingsFormState: AgentSettingsFormState = {
  toolRegistry: [],
  memoryRecentRounds: "10",
  memoryContextTokens: "32000",
  memoryRawHistoryTokens: "19200",
  retryMaxRetries: "0",
  retryBackoffMS: "300",
  supervisor: {
    name: "",
    description: "",
    instruction: "",
    maxIterations: "8",
    toolNames: [],
    providerId: "",
    providerType: "openai",
    model: "",
    reasoningEffort: "",
    userAgent: "",
  },
  children: [],
};
const defaultChapterSummaryAgentFormState: ChapterSummaryAgentFormState = {
  enabled: false,
  name: "generate_chapter_summary",
  description: "",
  instruction: "",
  maxIterations: "1",
  providerId: "",
  providerType: "openai",
  model: "",
  reasoningEffort: "",
  userAgent: "",
  retryMaxRetries: "0",
  retryBackoffMS: "300",
};
let agentChildIDSeed = 0;

export function createDefaultAgentSettingsFormState(): AgentSettingsFormState {
  return {
    toolRegistry: defaultAgentSettingsFormState.toolRegistry.map(copyAgentToolConfig),
    memoryRecentRounds: defaultAgentSettingsFormState.memoryRecentRounds,
    memoryContextTokens: defaultAgentSettingsFormState.memoryContextTokens,
    memoryRawHistoryTokens: defaultAgentSettingsFormState.memoryRawHistoryTokens,
    retryMaxRetries: defaultAgentSettingsFormState.retryMaxRetries,
    retryBackoffMS: defaultAgentSettingsFormState.retryBackoffMS,
    supervisor: { ...defaultAgentSettingsFormState.supervisor },
    children: [],
  };
}

// createDefaultChapterSummaryAgentFormState 创建章节概要 Agent 默认表单状态。
export function createDefaultChapterSummaryAgentFormState(): ChapterSummaryAgentFormState {
  return { ...defaultChapterSummaryAgentFormState };
}

// createDefaultAgentChildFormState 创建空白子 Agent 表单状态。
export function createDefaultAgentChildFormState(): AgentChildFormState {
  return {
    id: createAgentChildID(),
    enabled: true,
    shareChatHistory: false,
    name: "",
    task: "",
    description: "",
    instruction: "",
    maxIterations: "6",
    toolNames: [],
    providerId: "",
    providerType: "openai",
    model: "",
    reasoningEffort: "",
    userAgent: "",
    parametersText: "{}",
  };
}

// createAgentChildID 创建子 Agent 表单项前端渲染标识。
function createAgentChildID(): string {
  agentChildIDSeed += 1;
  return `agent-child-${Date.now()}-${agentChildIDSeed}`;
}

// copyAgentToolConfig 复制普通工具配置，避免表单状态共享引用。
// 参数 toolConfig 表示需要复制的普通工具配置。
export function copyAgentToolConfig(toolConfig: AgentToolConfig): AgentToolConfig {
  return {
    name: toolConfig.name ?? "",
    description: toolConfig.description ?? "",
    require_approval: toolConfig.require_approval === true,
  };
}

// normalizeAgentToolNames 标准化 Agent 已选择的工具名称列表。
// 参数 toolNames 表示接口返回的工具名称列表。
export function normalizeAgentToolNames(toolNames: string[] | null): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const rawName of toolNames ?? []) {
    const name = rawName.trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    result.push(name);
  }
  return result;
}

// renderReasoningEffortOption 渲染 GPT 推理强度下拉选项。
// 参数 option 表示推理强度选项配置。
export function renderReasoningEffortOption(option: { value: string; label: string }) {
  return (
    <option key={option.value || "default"} value={option.value}>
      {option.label}
    </option>
  );
}

// toggleAgentToolName 根据复选框状态增删指定工具名称。
// 参数 toolNames 表示当前已选择的工具名称列表；参数 toolName 表示需要切换的工具名称；参数 enabled 表示是否启用该工具。
export function toggleAgentToolName(
  toolNames: string[],
  toolName: string,
  enabled: boolean,
): string[] {
  const normalizedName = toolName.trim();
  if (!normalizedName) {
    return normalizeAgentToolNames(toolNames);
  }
  const current = normalizeAgentToolNames(toolNames);
  if (enabled) {
    return current.includes(normalizedName)
      ? current
      : [...current, normalizedName];
  }
  return current.filter(function keepToolName(name) {
    return name !== normalizedName;
  });
}

// agentConfigToFormState 将智能体接口数据转换为前端表单状态。
// 参数 agent 表示后端返回的结构化智能体配置。
export function agentConfigToFormState(agent: AgentConfig): AgentSettingsFormState {
  return {
    toolRegistry: (agent.tools ?? []).map(copyAgentToolConfig),
    memoryRecentRounds: String(agent.memory?.recent_rounds ?? 10),
    memoryContextTokens: String(
      positiveConfigNumber(agent.memory?.context_tokens, 32000),
    ),
    memoryRawHistoryTokens: String(
      positiveConfigNumber(agent.memory?.raw_history_tokens, 19200),
    ),
    retryMaxRetries: String(agent.retry?.max_retries ?? 0),
    retryBackoffMS: String(agent.retry?.backoff_ms ?? 300),
    supervisor: {
      name: agent.supervisor?.name ?? "",
      description: agent.supervisor?.description ?? "",
      instruction: agent.supervisor?.instruction ?? "",
      maxIterations: String(agent.supervisor?.max_iterations ?? 8),
      toolNames: normalizeAgentToolNames(agent.supervisor?.tools ?? []),
      providerId:
        Number(agent.supervisor?.provider_id ?? 0) > 0
          ? String(agent.supervisor?.provider_id ?? "")
          : "",
      providerType: normalizeAgentProviderType(agent.supervisor?.provider_type),
      model: agent.supervisor?.model ?? "",
      reasoningEffort: agent.supervisor?.reasoning_effort ?? "",
      userAgent: agent.supervisor?.user_agent ?? "",
    },
    children: (agent.agent ?? []).map(agentDefinitionToChildFormState),
  };
}

// positiveConfigNumber 返回配置中的正整数，非正数或缺失时返回默认值。
// 参数 value 表示后端返回的配置值；参数 fallback 表示默认值。
function positiveConfigNumber(value: number | undefined, fallback: number): number {
  return Number(value ?? 0) > 0 ? Number(value) : fallback;
}

// agentDefinitionToChildFormState 将子 Agent 配置转换为表单状态。
// 参数 definition 表示后端返回的子 Agent 配置；参数 index 表示子 Agent 在列表中的位置。
export function agentDefinitionToChildFormState(
  definition: AgentDefinition,
  index: number,
): AgentChildFormState {
  return {
    id: `${createAgentChildID()}-${index}`,
    enabled: definition.enabled !== false,
    shareChatHistory: definition.share_chat_history === true,
    name: definition.name ?? "",
    task: definition.task ?? "",
    description: definition.description ?? "",
    instruction: definition.instruction ?? "",
    maxIterations: String(definition.max_iterations ?? 6),
    toolNames: normalizeAgentToolNames(definition.tools ?? []),
    providerId:
      Number(definition.provider_id ?? 0) > 0
        ? String(definition.provider_id ?? "")
        : "",
    providerType: normalizeAgentProviderType(definition.provider_type),
    model: definition.model ?? "",
    reasoningEffort: definition.reasoning_effort ?? "",
    userAgent: definition.user_agent ?? "",
    parametersText: formatAgentParameters(definition.parameters),
  };
}

// formatAgentParameters 将参数对象格式化为稳定的 JSON 文本。
// 参数 parameters 表示后端返回的子 Agent 参数定义。
export function formatAgentParameters(
  parameters: Record<string, AgentParameterDefinition> | null,
): string {
  return JSON.stringify(parameters ?? {}, null, 2);
}

// validateAgentSettingsForm 校验智能体设置表单。
// 参数 form 表示当前智能体设置表单状态。
export function validateAgentSettingsForm(form: AgentSettingsFormState): string {
  return buildAgentConfigFromForm(form).error;
}

// buildAgentConfigFromForm 将智能体设置表单转换为后端保存参数。
// 参数 form 表示当前智能体设置表单状态。
export function buildAgentConfigFromForm(form: AgentSettingsFormState): {
  agent: AgentConfig | null;
  error: string;
} {
  const toolRegistry = normalizeAgentToolRegistryForSave(form.toolRegistry);
  if (toolRegistry.error) {
    return { agent: null, error: toolRegistry.error };
  }
  const registeredToolNames = new Set(
    (toolRegistry.value ?? []).map(function collectToolName(toolConfig) {
      return toolConfig.name;
    }),
  );

  const recentRounds = parseNonNegativeInteger(
    form.memoryRecentRounds,
    "最近对话轮数",
  );
  if (recentRounds.error) {
    return { agent: null, error: recentRounds.error };
  }

  const contextTokens = parseNonNegativeInteger(
    form.memoryContextTokens,
    "上下文压缩 Token 阈值",
  );
  if (contextTokens.error) {
    return { agent: null, error: contextTokens.error };
  }

  const rawHistoryTokens = parseNonNegativeInteger(
    form.memoryRawHistoryTokens,
    "原文历史 Token 预算",
  );
  if (rawHistoryTokens.error) {
    return { agent: null, error: rawHistoryTokens.error };
  }

  const retryMaxRetries = parseNonNegativeInteger(
    form.retryMaxRetries,
    "模型失败最大重试次数",
  );
  if (retryMaxRetries.error) {
    return { agent: null, error: retryMaxRetries.error };
  }

  const retryBackoffMS = parseNonNegativeInteger(
    form.retryBackoffMS,
    "模型失败重试间隔毫秒",
  );
  if (retryBackoffMS.error) {
    return { agent: null, error: retryBackoffMS.error };
  }

  const supervisorMaxIterations = parseNonNegativeInteger(
    form.supervisor.maxIterations,
    "顶层 Agent 最大迭代次数",
  );
  if (supervisorMaxIterations.error) {
    return { agent: null, error: supervisorMaxIterations.error };
  }

  const supervisorName = form.supervisor.name.trim();
  const supervisorDescription = form.supervisor.description.trim();
  const supervisorInstruction = form.supervisor.instruction.trim();
  if (!supervisorName) {
    return { agent: null, error: "顶层 Agent name 不能为空" };
  }
  if (!supervisorDescription) {
    return { agent: null, error: "顶层 Agent description 不能为空" };
  }
  if (!supervisorInstruction) {
    return { agent: null, error: "顶层 Agent instruction 不能为空" };
  }
  const supervisorModel = parseAgentCustomModel(
    form.supervisor.providerId,
    form.supervisor.providerType,
    form.supervisor.model,
    "顶层 Agent",
  );
  if (supervisorModel.error) {
    return { agent: null, error: supervisorModel.error };
  }
  const supervisorTools = normalizeSelectedAgentTools(
    form.supervisor.toolNames,
    registeredToolNames,
    "顶层 Agent",
  );
  if (supervisorTools.error) {
    return { agent: null, error: supervisorTools.error };
  }

  const names = new Set<string>();
  const children: AgentDefinition[] = [];
  for (const [index, child] of form.children.entries()) {
    const childName = child.name.trim();
    const childDescription = child.description.trim();
    const childInstruction = child.instruction.trim();
    const childTask = child.task.trim();
    if (child.enabled) {
      if (!childName) {
        return { agent: null, error: `第 ${index + 1} 个子 Agent name 不能为空` };
      }
      if (!childDescription) {
        return {
          agent: null,
          error: `第 ${index + 1} 个子 Agent description 不能为空`,
        };
      }
      if (!childInstruction) {
        return {
          agent: null,
          error: `第 ${index + 1} 个子 Agent instruction 不能为空`,
        };
      }
      if (childTask === "direct") {
        return { agent: null, error: "子 Agent task 不能为 direct" };
      }
      if (names.has(childName)) {
        return { agent: null, error: `子 Agent 名称重复：${childName}` };
      }
      names.add(childName);
    }

    const childMaxIterations = parseNonNegativeInteger(
      child.maxIterations,
      `第 ${index + 1} 个子 Agent 最大迭代次数`,
    );
    if (child.enabled && childMaxIterations.error) {
      return { agent: null, error: childMaxIterations.error };
    }

    const parameters = parseAgentParametersText(child.parametersText, index);
    if (child.enabled && (parameters.error || !parameters.value)) {
      return { agent: null, error: parameters.error };
    }
    const childModel = parseAgentCustomModel(
      child.providerId,
      child.providerType,
      child.model,
      `第 ${index + 1} 个子 Agent`,
    );
    if (childModel.error) {
      return { agent: null, error: childModel.error };
    }
    const childTools = normalizeSelectedAgentTools(
      child.toolNames,
      registeredToolNames,
      `第 ${index + 1} 个子 Agent`,
    );
    if (childTools.error) {
      return { agent: null, error: childTools.error };
    }

    children.push({
      name: childName,
      enabled: child.enabled,
      share_chat_history: child.shareChatHistory,
      provider_id: childModel.providerId,
      provider_type: childModel.providerType,
      model: childModel.model,
      reasoning_effort: child.reasoningEffort.trim(),
      user_agent: child.userAgent.trim(),
      task: childTask,
      description: childDescription,
      instruction: childInstruction,
      max_iterations: childMaxIterations.error ? 0 : childMaxIterations.value,
      tools: childTools.value,
      parameters: parameters.value ?? {},
    });
  }
  for (const toolName of supervisorTools.value) {
    if (names.has(toolName)) {
      return {
        agent: null,
        error: `顶层 Agent 工具 ${toolName} 与启用子 Agent 名称冲突`,
      };
    }
  }

  return {
    agent: {
      tools: toolRegistry.value ?? [],
      memory: {
        recent_rounds: recentRounds.value,
        context_tokens: contextTokens.value,
        raw_history_tokens: rawHistoryTokens.value,
      },
      retry: {
        max_retries: retryMaxRetries.value,
        backoff_ms: retryBackoffMS.value,
      },
      supervisor: {
        name: supervisorName,
        provider_id: supervisorModel.providerId,
        provider_type: supervisorModel.providerType,
        model: supervisorModel.model,
        reasoning_effort: form.supervisor.reasoningEffort.trim(),
        user_agent: form.supervisor.userAgent.trim(),
        task: "",
        description: supervisorDescription,
        instruction: supervisorInstruction,
        max_iterations: supervisorMaxIterations.value,
        tools: supervisorTools.value,
        parameters: {},
      },
      agent: children,
    },
    error: "",
  };
}

// chapterSummaryAgentConfigToFormState 将章节概要 Agent 接口数据转换为前端表单状态。
// 参数 config 表示后端返回的章节概要 Agent 配置。
export function chapterSummaryAgentConfigToFormState(
  config: ChapterSummaryAgentConfig,
): ChapterSummaryAgentFormState {
  const agent = config.agent;
  return {
    enabled: agent?.enabled === true,
    name: agent?.name ?? "",
    description: agent?.description ?? "",
    instruction: agent?.instruction ?? "",
    maxIterations: String(agent?.max_iterations ?? 1),
    providerId:
      Number(agent?.provider_id ?? 0) > 0
        ? String(agent?.provider_id ?? "")
        : "",
    providerType: normalizeAgentProviderType(agent?.provider_type),
    model: agent?.model ?? "",
    reasoningEffort: agent?.reasoning_effort ?? "",
    userAgent: agent?.user_agent ?? "",
    retryMaxRetries: String(config.retry?.max_retries ?? 0),
    retryBackoffMS: String(config.retry?.backoff_ms ?? 300),
  };
}

// buildChapterSummaryAgentConfigFromForm 将章节概要 Agent 表单转换为后端保存参数。
// 参数 form 表示当前章节概要 Agent 表单状态。
export function buildChapterSummaryAgentConfigFromForm(
  form: ChapterSummaryAgentFormState,
): { config: ChapterSummaryAgentConfig | null; error: string } {
  const retryMaxRetries = parseNonNegativeInteger(
    form.retryMaxRetries,
    "模型失败最大重试次数",
  );
  if (retryMaxRetries.error) {
    return { config: null, error: retryMaxRetries.error };
  }

  const retryBackoffMS = parseNonNegativeInteger(
    form.retryBackoffMS,
    "模型失败重试间隔毫秒",
  );
  if (retryBackoffMS.error) {
    return { config: null, error: retryBackoffMS.error };
  }

  const maxIterations = parseNonNegativeInteger(
    form.maxIterations,
    "章节概要 Agent 最大迭代次数",
  );
  if (maxIterations.error) {
    return { config: null, error: maxIterations.error };
  }

  const name = form.name.trim();
  const description = form.description.trim();
  const instruction = form.instruction.trim();
  if (!name) {
    return { config: null, error: "章节概要 Agent name 不能为空" };
  }
  if (!description) {
    return { config: null, error: "章节概要 Agent description 不能为空" };
  }
  if (!instruction) {
    return { config: null, error: "章节概要 Agent instruction 不能为空" };
  }

  const disabledProviderId = /^[1-9]\d*$/.test(form.providerId.trim())
    ? Number.parseInt(form.providerId.trim(), 10)
    : 0;
  const model = form.enabled
    ? parseAgentCustomModel(
        form.providerId,
        form.providerType,
        form.model,
        "章节概要 Agent",
      )
    : {
        providerId: disabledProviderId,
        providerType: normalizeAgentProviderType(form.providerType),
        model: form.model.trim(),
        error: "",
      };
  if (model.error) {
    return { config: null, error: model.error };
  }

  return {
    config: {
      retry: {
        max_retries: retryMaxRetries.value,
        backoff_ms: retryBackoffMS.value,
      },
      agent: {
        name,
        enabled: form.enabled,
        share_chat_history: false,
        provider_id: model.providerId,
        provider_type: model.providerType,
        model: model.model,
        reasoning_effort: form.reasoningEffort.trim(),
        user_agent: form.userAgent.trim(),
        task: "generate_summary",
        description,
        instruction: form.instruction,
        max_iterations: maxIterations.value,
        tools: [],
        parameters: {},
      },
    },
    error: "",
  };
}

// validateChapterSummaryAgentForm 校验章节概要 Agent 设置表单。
// 参数 form 表示当前章节概要 Agent 设置表单状态。
export function validateChapterSummaryAgentForm(
  form: ChapterSummaryAgentFormState,
): string {
  return buildChapterSummaryAgentConfigFromForm(form).error;
}

// normalizeAgentToolRegistryForSave 标准化并校验普通工具注册表。
// 参数 tools 表示当前表单中的普通工具注册表。
export function normalizeAgentToolRegistryForSave(
  tools: AgentToolConfig[],
): { value: AgentToolConfig[] | null; error: string } {
  const seen = new Set<string>();
  const result: AgentToolConfig[] = [];
  for (const [index, toolConfig] of tools.entries()) {
    const name = toolConfig.name.trim();
    const description = toolConfig.description.trim();
    if (!name) {
      return { value: null, error: `第 ${index + 1} 个工具名称不能为空` };
    }
    if (!description) {
      return { value: null, error: `工具 ${name} 的描述不能为空` };
    }
    if (seen.has(name)) {
      return { value: null, error: `工具名称重复：${name}` };
    }
    seen.add(name);
    result.push({
      name,
      description,
      require_approval: toolConfig.require_approval === true,
    });
  }
  return { value: result, error: "" };
}

// normalizeSelectedAgentTools 标准化并校验单个 Agent 选择的普通工具列表。
// 参数 toolNames 表示 Agent 当前选择的工具名称；参数 registeredToolNames 表示工具注册表名称集合；参数 label 表示错误提示使用的 Agent 名称。
export function normalizeSelectedAgentTools(
  toolNames: string[],
  registeredToolNames: Set<string>,
  label: string,
): { value: string[]; error: string } {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const rawName of toolNames) {
    const name = rawName.trim();
    if (!name) {
      return { value: [], error: `${label} 工具名称不能为空` };
    }
    if (!registeredToolNames.has(name)) {
      return {
        value: [],
        error: `${label} 工具 ${name} 未在工具注册表中配置`,
      };
    }
    if (seen.has(name)) {
      return { value: [], error: `${label} 工具名称重复：${name}` };
    }
    seen.add(name);
    result.push(name);
  }
  return { value: result, error: "" };
}

// parseAgentCustomModel 将 Agent 模型表单字段转换为后端字段。
// 参数 providerId 表示提供商 ID 文本；参数 providerType 表示模型 API 协议文本；参数 model 表示模型标识文本；参数 label 表示错误提示使用的 Agent 名称。
export function parseAgentCustomModel(
  providerId: string,
  providerType: string,
  model: string,
  label: string,
): { providerId: number; providerType: AIProviderType; model: string; error: string } {
  const normalizedProviderType = normalizeAgentProviderType(providerType);
  if (!isAIProviderType(normalizedProviderType)) {
    return {
      providerId: 0,
      providerType: "openai",
      model: "",
      error: `${label} API 协议只能是 openai 或 claude`,
    };
  }
  const normalizedProviderID = providerId.trim();
  if (!/^[1-9]\d*$/.test(normalizedProviderID)) {
    return {
      providerId: 0,
      providerType: normalizedProviderType,
      model: "",
      error: `${label} 必须选择模型提供商`,
    };
  }
  const normalizedModel = model.trim();
  if (!normalizedModel) {
    return {
      providerId: 0,
      providerType: normalizedProviderType,
      model: "",
      error: `${label} 必须选择模型`,
    };
  }
  return {
    providerId: Number.parseInt(normalizedProviderID, 10),
    providerType: normalizedProviderType,
    model: normalizedModel,
    error: "",
  };
}

// normalizeAgentProviderType 标准化 Agent 模型使用的 API 协议文本。
// 参数 value 表示表单或配置中的 provider_type 字段，空值默认 openai。
export function normalizeAgentProviderType(value?: string | null): string {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized || "openai";
}

// parseAgentParametersText 解析子 Agent 参数 JSON 文本。
// 参数 value 表示参数 JSON 文本；参数 childIndex 表示子 Agent 在表单列表中的位置。
export function parseAgentParametersText(
  value: string,
  childIndex: number,
): { value: Record<string, AgentParameterDefinition> | null; error: string } {
  const text = value.trim();
  if (!text) {
    return { value: {}, error: "" };
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isPlainRecord(parsed)) {
      return {
        value: null,
        error: `第 ${childIndex + 1} 个子 Agent parameters 必须是 JSON 对象`,
      };
    }
    return {
      value: parsed as Record<string, AgentParameterDefinition>,
      error: "",
    };
  } catch {
    return {
      value: null,
      error: `第 ${childIndex + 1} 个子 Agent parameters 不是合法 JSON`,
    };
  }
}

// parseNonNegativeInteger 将表单数字文本转换为非负整数。
// 参数 value 表示表单中的数字文本；参数 label 表示错误提示使用的字段名。
export function parseNonNegativeInteger(
  value: string,
  label: string,
): { value: number; error: string } {
  const text = value.trim();
  if (!text) {
    return { value: 0, error: "" };
  }
  if (!/^\d+$/.test(text)) {
    return { value: 0, error: `${label}必须是非负整数` };
  }
  return { value: Number.parseInt(text, 10), error: "" };
}

// isPlainRecord 判断未知值是否为普通 JSON 对象。
// 参数 value 表示需要判断的未知值。
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// createDefaultAIProviderFormState 创建 AI 提供商默认表单状态。
export function createDefaultAIProviderFormState(): AIProviderFormState {
  return { ...defaultAIProviderFormState };
}

// providerToAIProviderFormState 将 AI 提供商接口数据转换为表单状态。
// 参数 provider 表示需要编辑的 AI 提供商。
export function providerToAIProviderFormState(
  provider: AIProviderItem,
): AIProviderFormState {
  return {
    name: provider.name,
    apiKey: "",
    baseURL: provider.base_url,
    httpProxy: provider.http_proxy || "",
    defaultModel: provider.default_model,
    priority: String(provider.priority ?? 0),
    enabled: provider.enabled,
  };
}

// validateAIProviderForm 校验 AI 提供商表单输入。
// 参数 form 表示 AI 提供商表单状态；参数 mode 表示当前表单模式。
export function validateAIProviderForm(
  form: AIProviderFormState,
  mode: AIProviderFormMode,
): string {
  if (!form.name.trim()) {
    return "AI 提供商名称不能为空";
  }
  if (mode === "create" && !form.apiKey.trim()) {
    return "AI 提供商 API Key 不能为空";
  }
  const priority = parseAIProviderPriority(form.priority);
  if (priority === null) {
    return form.priority.trim().startsWith("-")
      ? "优先级不能小于 0"
      : "优先级必须是非负整数";
  }
  if (!isValidHTTPProxy(form.httpProxy)) {
    return "HTTP 代理地址格式无效";
  }
  return "";
}

// toAIProviderUpsertParams 将表单状态转换为后端创建或更新参数。
// 参数 form 表示 AI 提供商表单状态。
export function toAIProviderUpsertParams(
  form: AIProviderFormState,
): AIProviderUpsertParams {
  return {
    name: form.name.trim(),
    api_key: form.apiKey.trim(),
    base_url: form.baseURL.trim(),
    http_proxy: form.httpProxy.trim(),
    default_model: form.defaultModel.trim(),
    priority: parseAIProviderPriority(form.priority) ?? 0,
    enabled: form.enabled,
  };
}

// uniqueAIProviderModelOptions 对模型列表按模型标识去重并过滤空标识。
// 参数 items 表示接口返回的模型候选列表。
export function uniqueAIProviderModelOptions(
  items: AIProviderModelItem[],
): AIProviderModelItem[] {
  const seen = new Set<string>();
  const result: AIProviderModelItem[] = [];
  for (const item of items) {
    const id = item.id.trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    result.push({
      ...item,
      id,
      display_name: item.display_name || id,
    });
  }
  return result;
}

// parseAIProviderPriority 将表单优先级文本转换为非负整数。
// 参数 value 表示 AI 提供商优先级输入文本。
export function parseAIProviderPriority(value: string): number | null {
  const text = value.trim();
  if (text === "") {
    return 0;
  }
  if (!/^\d+$/.test(text)) {
    return null;
  }
  return Number.parseInt(text, 10);
}

// isAIProviderType 判断前端表单中的模型 API 协议是否为允许值。
// 参数 value 表示需要校验的模型 API 协议文本。
export function isAIProviderType(value: string): value is AIProviderType {
  return agentProviderTypeOptions.some(
    function matchAIProviderType(option) {
      return option.value === value;
    },
  );
}

// isValidHTTPProxy 判断 HTTP 代理地址是否为空或有效。
// 参数 value 表示需要校验的 HTTP 代理地址。
export function isValidHTTPProxy(value: string): boolean {
  const text = value.trim();
  if (!text) {
    return true;
  }
  try {
    const parsed = new URL(text);
    return (
      Boolean(parsed.hostname) &&
      (parsed.protocol === "http:" || parsed.protocol === "https:")
    );
  } catch {
    return false;
  }
}

// defaultAgentModelOption 根据模型标识创建智能体设置页的模型选项。
// 参数 modelID 表示 AI 提供商默认模型或已配置模型标识。
export function defaultAgentModelOption(modelID: string): AIProviderModelItem {
  return {
    id: modelID,
    display_name: modelID,
    owned_by: "",
    created_at: "",
    supported_generation_methods: [],
  };
}

// defaultModelForAgentProvider 返回指定 AI 提供商配置的默认模型。
// 参数 providers 表示 AI 提供商列表；参数 providerId 表示需要查找的提供商 ID 文本。
export function defaultModelForAgentProvider(
  providers: AIProviderItem[],
  providerId: string,
): string {
  const provider = providers.find(function matchAgentProvider(item) {
    return String(item.id) === providerId.trim();
  });
  return provider?.default_model?.trim() ?? "";
}

// modelsWithDefaultAgentModel 合并模型列表和提供商默认模型。
// 参数 items 表示模型列表接口返回的模型选项；参数 defaultModel 表示提供商默认模型标识。
export function modelsWithDefaultAgentModel(
  items: AIProviderModelItem[],
  defaultModel: string,
): AIProviderModelItem[] {
  const normalizedDefaultModel = defaultModel.trim();
  if (!normalizedDefaultModel) {
    return items;
  }
  const hasDefaultModel = items.some(function matchDefaultModel(model) {
    return model.id === normalizedDefaultModel;
  });
  if (hasDefaultModel) {
    return items;
  }
  return [defaultAgentModelOption(normalizedDefaultModel), ...items];
}

// agentProviderModelCacheKey 返回模型列表缓存键。
// 参数 providerId 表示当前选择的 AI 提供商 ID 文本；参数 providerType 表示当前选择的模型 API 协议。
export function agentProviderModelCacheKey(
  providerId: string,
  providerType: string,
): string {
  return `${providerId.trim()}::${normalizeAgentProviderType(providerType)}`;
}

// agentModelOptionsForProvider 返回指定提供商和 API 协议在表单中可选的模型列表。
// 参数 providerId 表示当前选择的 AI 提供商 ID 文本；参数 providerType 表示当前选择的模型 API 协议；参数 configuredModel 表示配置文件中已保存的模型；参数 providers 表示 AI 提供商列表；参数 optionsByProvider 表示已加载的模型选项缓存。
export function agentModelOptionsForProvider(
  providerId: string,
  providerType: string,
  configuredModel: string,
  providers: AIProviderItem[],
  optionsByProvider: Record<string, AIProviderModelItem[]>,
): AIProviderModelItem[] {
  const normalizedProviderID = providerId.trim();
  if (!normalizedProviderID) {
    return [];
  }
  let items =
    optionsByProvider[
      agentProviderModelCacheKey(normalizedProviderID, providerType)
    ] ?? [];
  items = modelsWithDefaultAgentModel(
    items,
    defaultModelForAgentProvider(providers, normalizedProviderID),
  );

  const normalizedConfiguredModel = configuredModel.trim();
  if (
    normalizedConfiguredModel &&
    !items.some(function matchConfiguredModel(model) {
      return model.id === normalizedConfiguredModel;
    })
  ) {
    return [defaultAgentModelOption(normalizedConfiguredModel), ...items];
  }
  return items;
}

// formatAgentModelOption 返回智能体设置页模型下拉选项文案。
// 参数 model 表示需要展示的模型选项。
export function formatAgentModelOption(model: AIProviderModelItem): string {
  if (!model.display_name || model.display_name === model.id) {
    return model.id;
  }
  return `${model.display_name} (${model.id})`;
}

// formatAgentProviderOption 返回智能体设置页提供商下拉选项文案。
// 参数 provider 表示需要展示的 AI 提供商。
export function formatAgentProviderOption(provider: AIProviderItem): string {
  const suffix = provider.enabled ? "" : "（已停用）";
  return `${provider.name}${suffix}`;
}

// formatTime 将接口返回的时间文本转换为本地展示文本。
// 参数 value 表示接口返回的 ISO 时间文本。
export function formatTime(value?: string): string {
  if (!value) {
    return "未知";
  }

  const time = new Date(value);
  if (Number.isNaN(time.getTime())) {
    return "未知";
  }
  return time.toLocaleString();
}

// formatOptionalText 格式化可能为空的文本字段。
// 参数 value 表示需要展示的可选文本。
export function formatOptionalText(value?: string): string {
  const text = value?.trim();
  return text ? text : "未设置";
}

// getErrorMessage 从未知错误中提取用户提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底提示。
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// isAbortError 判断错误是否来自请求取消。
// 参数 error 表示捕获到的未知错误。
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
