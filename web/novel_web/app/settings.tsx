import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import JsonViewer from "@douyinfe/semi-ui-19/lib/es/jsonViewer";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Switch from "@douyinfe/semi-ui-19/lib/es/switch";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";

import {
  createAIProvider,
  deleteAIProvider,
  fetchAgentConfig,
  fetchAIProviderModels,
  fetchAIProviderModelsByProviderID,
  fetchAIProviders,
  fetchConfigFile,
  triggerSystemUpdate,
  updateAgentConfig,
  updateAIProvider,
  updateConfigFile,
  UnauthorizedError,
  type AgentConfig,
  type AgentConfigData,
  type AgentDefinition,
  type AgentParameterDefinition,
  type AgentToolConfig,
  type AIProviderAPIType,
  type AIProviderItem,
  type AIProviderModelItem,
  type AIProviderType,
  type AIProviderUpsertParams,
  type ConfigFileData,
} from "./api";
import { LogsPanel } from "./logs";

// SettingsSection 表示设置中心支持切换的功能分区。
export type SettingsSection =
  | "config"
  | "agents"
  | "logs"
  | "system"
  | "ai-providers";

// AIProviderFormMode 表示 AI 提供商表单当前处于创建或编辑模式。
type AIProviderFormMode = "create" | "edit";

// SettingsPageProps 表示设置中心页面需要的外部状态和回调。
interface SettingsPageProps {
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
interface ConfigSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// AgentSettingsPanelProps 表示智能体配置面板需要的外部回调。
interface AgentSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// AIProviderSettingsPanelProps 表示 AI 提供商面板需要的外部回调。
interface AIProviderSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// SystemSettingsPanelProps 表示系统更新面板需要的外部回调。
interface SystemSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// AIProviderFormState 表示 AI 提供商表单中各字段的前端输入状态。
interface AIProviderFormState {
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
interface AgentSupervisorFormState {
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
  // customModelEnabled 表示顶层 Agent 是否启用自定义模型。
  customModelEnabled: boolean;
  // providerId 表示顶层 Agent 自定义模型使用的 AI 提供商 ID 文本。
  providerId: string;
  // model 表示顶层 Agent 自定义模型标识，空值时使用提供商默认模型。
  model: string;
}

// AgentChildFormState 表示子 Agent 表单输入状态。
interface AgentChildFormState {
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
  // customModelEnabled 表示该子 Agent 是否启用自定义模型。
  customModelEnabled: boolean;
  // providerId 表示该子 Agent 自定义模型使用的 AI 提供商 ID 文本。
  providerId: string;
  // model 表示该子 Agent 自定义模型标识，空值时使用提供商默认模型。
  model: string;
  // parametersText 表示子 Agent 工具参数 JSON 文本。
  parametersText: string;
}

// AgentParameterJsonViewerRef 表示子 Agent 参数 JSON 编辑器暴露给页面读取的实例方法。
interface AgentParameterJsonViewerRef {
  // getValue 表示读取编辑器中当前 JSON 文本的方法。
  getValue: () => string;
}

// AgentChildTextField 表示子 Agent 表单中以文本方式编辑的字段名。
type AgentChildTextField =
  | "name"
  | "task"
  | "description"
  | "instruction"
  | "maxIterations";

// AgentSettingsFormState 表示智能体配置页完整表单状态。
interface AgentSettingsFormState {
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

const aiProviderDefaultPage = 1;
const aiProviderPageSize = 20;
const aiProviderTypeOptions: { value: AIProviderType; label: string }[] = [
  { value: "openai", label: "OpenAI" },
  { value: "claude", label: "Claude" },
  { value: "gemini", label: "Gemini" },
];
const aiProviderAPITypeOptions: {
  value: AIProviderAPIType;
  label: string;
}[] = [
  { value: "completions", label: "completions" },
  { value: "response", label: "response" },
];
const defaultAIProviderFormState: AIProviderFormState = {
  name: "",
  providerType: "openai",
  apiKey: "",
  baseURL: "",
  defaultModel: "",
  priority: "0",
  apiType: "completions",
  enabled: true,
};
const defaultAgentSettingsFormState: AgentSettingsFormState = {
  toolRegistry: [],
  memoryRecentRounds: "10",
  retryMaxRetries: "0",
  retryBackoffMS: "300",
  supervisor: {
    name: "",
    description: "",
    instruction: "",
    maxIterations: "8",
    toolNames: [],
    customModelEnabled: false,
    providerId: "",
    model: "",
  },
  children: [],
};
let agentChildIDSeed = 0;

// SettingsPage 渲染聚合配置、日志和系统更新的设置中心。
// 参数 props 表示设置中心页面需要的外部状态和回调。
export function SettingsPage(props: SettingsPageProps) {
  // handleConfigSectionClick 切换到配置管理分区。
  function handleConfigSectionClick() {
    props.onSectionChange("config");
  }

  // handleAgentsSectionClick 切换到智能体设置分区。
  function handleAgentsSectionClick() {
    props.onSectionChange("agents");
  }

  // handleLogsSectionClick 切换到日志预览分区。
  function handleLogsSectionClick() {
    props.onSectionChange("logs");
  }

  // handleSystemSectionClick 切换到系统更新分区。
  function handleSystemSectionClick() {
    props.onSectionChange("system");
  }

  // handleAIProvidersSectionClick 切换到 AI 提供商分区。
  function handleAIProvidersSectionClick() {
    props.onSectionChange("ai-providers");
  }

  return (
    <main className="settings-page">
      <header className="settings-nav">
        <button
          type="button"
          className="settings-brand"
          onClick={props.onBackToBookshelf}
        >
          <span className="settings-seal" aria-hidden="true">
            墨
          </span>
          <span>墨香墨苑</span>
        </button>

        <button
          type="button"
          className="settings-back-button"
          onClick={props.onBackToBookshelf}
        >
          <span aria-hidden="true">←</span>
          <span>返回书架</span>
        </button>
      </header>

      <section className="settings-center-shell" aria-label="设置中心">
        <aside className="settings-sidebar" aria-label="设置菜单">
          <div className="settings-sidebar-heading">
            <p className="settings-kicker">Settings</p>
            <h1>设置</h1>
          </div>
          <nav className="settings-sidebar-nav" aria-label="设置分区">
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={props.section === "config" ? "page" : undefined}
              onClick={handleConfigSectionClick}
            >
              <span aria-hidden="true">⚙</span>
              <span>配置管理</span>
            </button>
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={props.section === "agents" ? "page" : undefined}
              onClick={handleAgentsSectionClick}
            >
              <span aria-hidden="true">AI</span>
              <span>智能体设置</span>
            </button>
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={props.section === "logs" ? "page" : undefined}
              onClick={handleLogsSectionClick}
            >
              <span aria-hidden="true">☰</span>
              <span>日志预览</span>
            </button>
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={props.section === "system" ? "page" : undefined}
              onClick={handleSystemSectionClick}
            >
              <span aria-hidden="true">↻</span>
              <span>系统更新</span>
            </button>
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={
                props.section === "ai-providers" ? "page" : undefined
              }
              onClick={handleAIProvidersSectionClick}
            >
              <span aria-hidden="true">AI</span>
              <span>AI 提供商</span>
            </button>
          </nav>
        </aside>

        <div className="settings-content">
          {props.section === "config" ? (
            <ConfigSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "agents" ? (
            <AgentSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "logs" ? (
            <LogsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "system" ? (
            <SystemSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "ai-providers" ? (
            <AIProviderSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
        </div>
      </section>
    </main>
  );
}

// ConfigSettingsPanel 渲染配置文件管理面板。
// 参数 props 表示配置管理面板需要的外部回调。
function ConfigSettingsPanel(props: ConfigSettingsPanelProps) {
	const [configData, setConfigData] = useState<ConfigFileData | null>(null);
	const [content, setContent] = useState("");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");

	const dirty = useMemo(
    function calculateDirty() {
      return configData !== null && content !== configData.content;
    },
    [configData, content],
  );

  const loadConfig = useCallback(
    // loadConfig 读取后端配置文件内容。
    // 参数 signal 表示用于取消请求的浏览器 AbortSignal；参数 showSuccess 表示重新加载成功时是否展示提示。
    async function loadConfig(signal?: AbortSignal, showSuccess = false) {
      setLoading(true);
      setErrorMessage("");

      try {
        const data = await fetchConfigFile(signal);
        setConfigData(data);
        setContent(data.content);
        if (showSuccess) {
          Toast.success("配置文件已重新加载");
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        const message = getErrorMessage(error, "配置文件加载失败，请稍后再试");
        setErrorMessage(message);
        Toast.error(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [props.onUnauthorized],
  );

  useEffect(
    function loadConfigOnMount() {
      const controller = new AbortController();
      void loadConfig(controller.signal);

      // cancelConfigLoad 取消卸载中的配置文件加载请求。
      return function cancelConfigLoad() {
        controller.abort();
      };
    },
    [loadConfig],
  );

  // handleContentChange 处理配置文本编辑变化。
  // 参数 event 表示配置编辑器的输入变化事件。
  function handleContentChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setContent(event.target.value);
  }

  // handleReloadClick 处理重新加载配置文件按钮点击。
  function handleReloadClick() {
    if (!dirty) {
      void loadConfig(undefined, true);
      return;
    }

    Modal.confirm({
      title: "重新加载配置文件",
      content: "当前未保存的修改会被磁盘上的配置文件内容覆盖。",
      okText: "重新加载",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmReload() {
        void loadConfig(undefined, true);
      },
    });
  }

  // handleSaveClick 处理保存配置文件按钮点击。
  function handleSaveClick() {
    if (!dirty) {
      Toast.info("配置文件没有变化");
      return;
    }

    Modal.confirm({
      title: "保存配置文件",
      content:
        "保存后会写入后端启动时使用的配置文件，auth.password 会立即用于下一次登录。",
      okText: "保存",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmSave() {
        void saveConfig();
      },
    });
  }

  // saveConfig 保存当前编辑器中的配置文件文本。
  async function saveConfig() {
    setSaving(true);
    setErrorMessage("");

    try {
      const data = await updateConfigFile({ content });
      setConfigData(data);
      setContent(data.content);
      Toast.success("配置文件已保存");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      const message = getErrorMessage(error, "配置文件保存失败，请稍后再试");
      setErrorMessage(message);
      Toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const modifiedAtText = formatTime(configData?.modified_at);
  const reloadedAtText = formatTime(configData?.reloaded_at);

  return (
    <article
      className="settings-panel settings-editor-panel"
      aria-labelledby="settings-config-title"
    >
      <div className="settings-corner settings-corner-left-top" />
      <div className="settings-corner settings-corner-right-top" />
      <div className="settings-corner settings-corner-left-bottom" />
      <div className="settings-corner settings-corner-right-bottom" />

      <div className="settings-editor-heading">
        <div>
          <p className="settings-kicker">Config</p>
          <h1 id="settings-config-title">配置管理</h1>
        </div>
        <div className="settings-editor-actions">
          <button
            type="button"
            className="settings-secondary-button"
            disabled={loading || saving}
            onClick={handleReloadClick}
          >
            重新加载
          </button>
          <button
            type="button"
            className="settings-primary-button"
            disabled={loading || saving || !dirty}
            onClick={handleSaveClick}
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      <div className="settings-file-meta" aria-label="配置文件状态">
        <span title={configData?.config_file || ""}>
          文件：{configData?.config_file || "加载中..."}
        </span>
        <span>修改：{modifiedAtText}</span>
        <span>加载：{reloadedAtText}</span>
      </div>

      {errorMessage ? (
        <p className="settings-error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <label className="settings-editor-label" htmlFor="config-content">
        配置文件内容
      </label>
      <textarea
        id="config-content"
        className="settings-config-editor"
        value={content}
        spellCheck={false}
        disabled={loading || saving}
        placeholder={loading ? "正在加载配置文件..." : "请输入 YAML 配置"}
        onChange={handleContentChange}
      />

      <p className="settings-editor-note">
        保存成功后仅登录密码会立即热更新；数据库、HTTP 服务、对象存储等连接型配置需要重启后生效。
      </p>
    </article>
  );
}

// AgentSettingsPanel 渲染结构化智能体配置面板。
// 参数 props 表示智能体配置面板需要的外部回调。
function AgentSettingsPanel(props: AgentSettingsPanelProps) {
	const [agentData, setAgentData] = useState<AgentConfigData | null>(null);
	const [form, setForm] = useState<AgentSettingsFormState>(
		createDefaultAgentSettingsFormState,
	);
  const [savedForm, setSavedForm] = useState<AgentSettingsFormState>(
    createDefaultAgentSettingsFormState,
  );
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [modelProviders, setModelProviders] = useState<AIProviderItem[]>([]);
	const [modelOptionsByProvider, setModelOptionsByProvider] = useState<
		Record<string, AIProviderModelItem[]>
	>({});
	const [modelLoadingByProvider, setModelLoadingByProvider] = useState<
		Record<string, boolean>
	>({});
  const parameterEditorRefs = useRef<
    Record<string, AgentParameterJsonViewerRef | null>
  >({});
  const [parameterEditorRevision, setParameterEditorRevision] = useState(0);

	const dirty = useMemo(
    function calculateAgentSettingsDirty() {
      const currentForm = agentFormWithParameterEditorValues(form);
      return JSON.stringify(currentForm) !== JSON.stringify(savedForm);
    },
    [form, savedForm, parameterEditorRevision],
  );

  // getAgentParameterEditorValue 读取指定子 Agent 参数编辑器中的最新 JSON 文本。
  // 参数 child 表示需要读取参数编辑器内容的子 Agent 表单项。
  function getAgentParameterEditorValue(child: AgentChildFormState): string {
    const editor = parameterEditorRefs.current[child.id];
    if (!editor) {
      return child.parametersText;
    }

    try {
      return editor.getValue();
    } catch {
      return child.parametersText;
    }
  }

  // agentFormWithParameterEditorValues 生成包含 JsonViewer 当前值的智能体表单快照。
  // 参数 sourceForm 表示需要同步参数编辑器值的智能体表单状态。
  function agentFormWithParameterEditorValues(
    sourceForm: AgentSettingsFormState,
  ): AgentSettingsFormState {
    return {
      ...sourceForm,
      children: sourceForm.children.map(function syncChildParameters(child) {
        return {
          ...child,
          parametersText: getAgentParameterEditorValue(child),
        };
      }),
    };
  }

  const loadAgentConfig = useCallback(
    // loadAgentConfig 读取后端结构化智能体配置。
    // 参数 signal 表示用于取消请求的浏览器 AbortSignal；参数 showSuccess 表示重新加载成功时是否展示提示。
    async function loadAgentConfig(
      signal?: AbortSignal,
      showSuccess = false,
    ) {
      setLoading(true);
      setErrorMessage("");

      try {
        const data = await fetchAgentConfig(signal);
        const nextForm = agentConfigToFormState(data.agent);
        setAgentData(data);
        setForm(nextForm);
        setSavedForm(nextForm);
        if (showSuccess) {
          Toast.success("智能体配置已重新加载");
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        const message = getErrorMessage(error, "智能体配置加载失败，请稍后再试");
        setErrorMessage(message);
        Toast.error(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [props.onUnauthorized],
  );

  const loadModelProviders = useCallback(
    // loadModelProviders 读取可用于 Agent 自定义模型选择的 AI 提供商列表。
    // 参数 signal 表示用于取消请求的浏览器 AbortSignal。
    async function loadModelProviders(signal?: AbortSignal) {
      try {
        const data = await fetchAIProviders({
          page: aiProviderDefaultPage,
          pageSize: 100,
          signal,
        });
        setModelProviders(data.items);
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        Toast.error(getErrorMessage(error, "AI 提供商列表加载失败，请稍后再试"));
      }
    },
    [props.onUnauthorized],
  );

  const loadAgentModelOptions = useCallback(
    // loadAgentModelOptions 读取指定 AI 提供商的模型列表，失败时按默认模型兜底。
    // 参数 providerId 表示 AI 提供商 ID 文本；参数 signal 表示用于取消请求的浏览器 AbortSignal。
    async function loadAgentModelOptions(
      providerId: string,
      signal?: AbortSignal,
    ) {
      const normalizedProviderID = providerId.trim();
      if (!normalizedProviderID || modelLoadingByProvider[normalizedProviderID]) {
        return;
      }

      setModelLoadingByProvider(function markModelLoading(current) {
        return { ...current, [normalizedProviderID]: true };
      });
      try {
        const data = await fetchAIProviderModelsByProviderID(
          Number(normalizedProviderID),
          signal,
        );
        const defaultModel = defaultModelForAgentProvider(
          modelProviders,
          normalizedProviderID,
        );
        setModelOptionsByProvider(function updateModelOptions(current) {
          return {
            ...current,
            [normalizedProviderID]: modelsWithDefaultAgentModel(
              data.items,
              defaultModel,
            ),
          };
        });
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        const defaultModel = defaultModelForAgentProvider(
          modelProviders,
          normalizedProviderID,
        );
        if (defaultModel) {
          setModelOptionsByProvider(function fallbackModelOptions(current) {
            return {
              ...current,
              [normalizedProviderID]: [defaultAgentModelOption(defaultModel)],
            };
          });
          return;
        }
        Toast.error(getErrorMessage(error, "AI 模型列表加载失败，请稍后再试"));
      } finally {
        if (!signal?.aborted) {
          setModelLoadingByProvider(function clearModelLoading(current) {
            return { ...current, [normalizedProviderID]: false };
          });
        }
      }
    },
    [modelLoadingByProvider, modelProviders, props.onUnauthorized],
  );

  useEffect(
    function loadAgentConfigOnMount() {
      const controller = new AbortController();
      void loadAgentConfig(controller.signal);

      // cancelAgentConfigLoad 取消卸载中的智能体配置加载请求。
      return function cancelAgentConfigLoad() {
        controller.abort();
      };
    },
    [loadAgentConfig],
  );

  useEffect(
    function loadAgentModelProvidersOnMount() {
      const controller = new AbortController();
      void loadModelProviders(controller.signal);

      // cancelAgentModelProviderLoad 取消卸载中的 AI 提供商加载请求。
      return function cancelAgentModelProviderLoad() {
        controller.abort();
      };
    },
    [loadModelProviders],
  );

  // handleMemoryRecentRoundsChange 处理最近对话轮数字段变化。
  // 参数 event 表示输入框变化事件。
  function handleMemoryRecentRoundsChange(event: ChangeEvent<HTMLInputElement>) {
    setForm(function updateMemoryRecentRounds(current) {
      return { ...current, memoryRecentRounds: event.target.value };
    });
  }

  // handleRetryMaxRetriesChange 处理模型失败最大重试次数字段变化。
  // 参数 event 表示输入框变化事件。
  function handleRetryMaxRetriesChange(event: ChangeEvent<HTMLInputElement>) {
    setForm(function updateRetryMaxRetries(current) {
      return { ...current, retryMaxRetries: event.target.value };
    });
  }

  // handleRetryBackoffMSChange 处理模型失败重试间隔字段变化。
  // 参数 event 表示输入框变化事件。
  function handleRetryBackoffMSChange(event: ChangeEvent<HTMLInputElement>) {
    setForm(function updateRetryBackoffMS(current) {
      return { ...current, retryBackoffMS: event.target.value };
    });
  }

  // handleSupervisorInputChange 处理顶层 Agent 文本或数字字段变化。
  // 参数 event 表示输入框或文本域变化事件。
  function handleSupervisorInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setForm(function updateSupervisor(current) {
      return {
        ...current,
        supervisor: {
          ...current.supervisor,
          [name]: value,
        },
      };
    });
  }

  // handleAgentToolDescriptionChange 处理普通工具注册表描述变化。
  // 参数 toolName 表示工具固定名称；参数 description 表示新的工具描述。
  function handleAgentToolDescriptionChange(toolName: string, description: string) {
    setForm(function updateAgentToolDescription(current) {
      return {
        ...current,
        toolRegistry: current.toolRegistry.map(function updateTool(toolConfig) {
          return toolConfig.name === toolName
            ? { ...toolConfig, description }
            : toolConfig;
        }),
      };
    });
  }

  // handleSupervisorToolChange 处理顶层 Agent 普通工具启用状态变化。
  // 参数 toolName 表示工具固定名称；参数 enabled 表示是否启用。
  function handleSupervisorToolChange(toolName: string, enabled: boolean) {
    setForm(function updateSupervisorTool(current) {
      return {
        ...current,
        supervisor: {
          ...current.supervisor,
          toolNames: toggleAgentToolName(
            current.supervisor.toolNames,
            toolName,
            enabled,
          ),
        },
      };
    });
  }

  // handleSupervisorCustomModelChange 处理顶层 Agent 自定义模型启用状态变化。
  // 参数 event 表示复选框变化事件。
  function handleSupervisorCustomModelChange(event: ChangeEvent<HTMLInputElement>) {
    const enabled = event.target.checked;
    const providerId =
      enabled && !form.supervisor.providerId
        ? String(modelProviders[0]?.id ?? "")
        : form.supervisor.providerId;
    setForm(function updateSupervisorCustomModel(current) {
      return {
        ...current,
        supervisor: {
          ...current.supervisor,
          customModelEnabled: enabled,
          providerId: enabled ? providerId : "",
          model: enabled ? current.supervisor.model : "",
        },
      };
    });
    if (enabled && providerId) {
      void loadAgentModelOptions(providerId);
    }
  }

  // handleSupervisorModelProviderChange 处理顶层 Agent 自定义模型提供商变化。
  // 参数 event 表示下拉框变化事件。
  function handleSupervisorModelProviderChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const providerId = event.target.value;
    setForm(function updateSupervisorModelProvider(current) {
      return {
        ...current,
        supervisor: {
          ...current.supervisor,
          providerId,
          model: "",
        },
      };
    });
    void loadAgentModelOptions(providerId);
  }

  // handleSupervisorModelChange 处理顶层 Agent 自定义模型变化。
  // 参数 event 表示下拉框变化事件。
  function handleSupervisorModelChange(event: ChangeEvent<HTMLSelectElement>) {
    const model = event.target.value;
    setForm(function updateSupervisorModel(current) {
      return {
        ...current,
        supervisor: {
          ...current.supervisor,
          model,
        },
      };
    });
  }

  // handleChildEnabledChange 处理子 Agent 启用状态变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 enabled 表示是否启用。
  function handleChildEnabledChange(index: number, enabled: boolean) {
    updateChildForm(index, function updateChildEnabled(child) {
      return { ...child, enabled };
    });
  }

  // handleChildShareChatHistoryChange 处理子 Agent 共享完整聊天历史开关变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 enabled 表示是否共享父 Agent 的完整聊天历史。
  function handleChildShareChatHistoryChange(index: number, enabled: boolean) {
    updateChildForm(index, function updateChildShareChatHistory(child) {
      return { ...child, shareChatHistory: enabled };
    });
  }

  // handleChildInputChange 处理指定子 Agent 字段变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 field 表示需要更新的字段名；参数 value 表示新的字段值。
  function handleChildInputChange(
    index: number,
    field: AgentChildTextField,
    value: string,
  ) {
    updateChildForm(index, function updateChildField(child) {
      return { ...child, [field]: value };
    });
  }

  // handleChildToolChange 处理子 Agent 普通工具启用状态变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 toolName 表示工具固定名称；参数 enabled 表示是否启用。
  function handleChildToolChange(index: number, toolName: string, enabled: boolean) {
    updateChildForm(index, function updateChildTool(child) {
      return {
        ...child,
        toolNames: toggleAgentToolName(child.toolNames, toolName, enabled),
      };
    });
  }

  // handleChildCustomModelChange 处理子 Agent 自定义模型启用状态变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 enabled 表示是否启用自定义模型。
  function handleChildCustomModelChange(index: number, enabled: boolean) {
    const child = form.children[index];
    const providerId =
      enabled && !child?.providerId
        ? String(modelProviders[0]?.id ?? "")
        : child?.providerId ?? "";
    updateChildForm(index, function updateChildCustomModel(child) {
      return {
        ...child,
        customModelEnabled: enabled,
        providerId: enabled ? providerId : "",
        model: enabled ? child.model : "",
      };
    });
    if (enabled && providerId) {
      void loadAgentModelOptions(providerId);
    }
  }

  // handleChildModelProviderChange 处理子 Agent 自定义模型提供商变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 providerId 表示新的 AI 提供商 ID 文本。
  function handleChildModelProviderChange(index: number, providerId: string) {
    updateChildForm(index, function updateChildModelProvider(child) {
      return { ...child, providerId, model: "" };
    });
    void loadAgentModelOptions(providerId);
  }

  // handleChildModelChange 处理子 Agent 自定义模型变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 model 表示新的模型标识。
  function handleChildModelChange(index: number, model: string) {
    updateChildForm(index, function updateChildModel(child) {
      return { ...child, model };
    });
  }

  // handleAgentModelSelectFocus 处理模型下拉框聚焦时的按需加载。
  // 参数 providerId 表示当前选择的 AI 提供商 ID 文本。
  function handleAgentModelSelectFocus(providerId: string) {
    if (!providerId.trim()) {
      return;
    }
    void loadAgentModelOptions(providerId);
  }

  // updateChildForm 更新指定子 Agent 的表单状态。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 updater 表示子 Agent 状态更新函数。
  function updateChildForm(
    index: number,
    updater: (child: AgentChildFormState) => AgentChildFormState,
  ) {
    setForm(function updateChildren(current) {
      return {
        ...current,
        children: current.children.map((child, childIndex) =>
          childIndex === index ? updater(child) : child,
        ),
      };
    });
  }

  // handleAddChildClick 新增一个空白子 Agent 表单项。
  function handleAddChildClick() {
    setForm(function addChild(current) {
      return {
        ...current,
        children: [...current.children, createDefaultAgentChildFormState()],
      };
    });
  }

  // handleRemoveChildClick 删除指定子 Agent 表单项。
  // 参数 index 表示子 Agent 在表单列表中的位置。
  function handleRemoveChildClick(index: number) {
    setForm(function removeChild(current) {
      return {
        ...current,
        children: current.children.filter((_, childIndex) => childIndex !== index),
      };
    });
  }

  // handleMoveChildClick 移动指定子 Agent 的排序位置。
  // 参数 index 表示子 Agent 当前所在位置；参数 direction 表示移动方向。
  function handleMoveChildClick(index: number, direction: -1 | 1) {
    setForm(function moveChild(current) {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.children.length) {
        return current;
      }

      const children = [...current.children];
      const [target] = children.splice(index, 1);
      children.splice(nextIndex, 0, target);
      return { ...current, children };
    });
  }

  // handleReloadAgentClick 处理重新加载智能体配置按钮点击。
  function handleReloadAgentClick() {
    if (!dirty) {
      void loadAgentConfig(undefined, true);
      return;
    }

    Modal.confirm({
      title: "重新加载智能体配置",
      content: "当前未保存的智能体配置修改会被磁盘上的配置覆盖。",
      okText: "重新加载",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmAgentReload() {
        void loadAgentConfig(undefined, true);
      },
    });
  }

  // handleSaveAgentClick 处理保存智能体配置按钮点击。
  function handleSaveAgentClick() {
    if (!dirty) {
      Toast.info("智能体配置没有变化");
      return;
    }

    const currentForm = agentFormWithParameterEditorValues(form);
    const validationMessage = validateAgentSettingsForm(currentForm);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      Toast.error(validationMessage);
      return;
    }

    Modal.confirm({
      title: "保存智能体配置",
      content: "保存后会写入后端启动配置文件，并立即用于后续 AI Agent 请求。",
      okText: "保存",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmAgentSave() {
        void saveAgentConfig(currentForm);
      },
    });
  }

  // saveAgentConfig 保存当前结构化智能体配置。
  // 参数 sourceForm 表示已经同步 JsonViewer 当前值的智能体表单快照。
  async function saveAgentConfig(sourceForm: AgentSettingsFormState) {
    const buildResult = buildAgentConfigFromForm(sourceForm);
    if (buildResult.error || !buildResult.agent) {
      const message = buildResult.error || "智能体配置不完整";
      setErrorMessage(message);
      Toast.error(message);
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const data = await updateAgentConfig({ agent: buildResult.agent });
      const nextForm = agentConfigToFormState(data.agent);
      setAgentData(data);
      setForm(nextForm);
      setSavedForm(nextForm);
      Toast.success("智能体配置已保存");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      const message = getErrorMessage(error, "智能体配置保存失败，请稍后再试");
      setErrorMessage(message);
      Toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const modifiedAtText = formatTime(agentData?.modified_at);
  const reloadedAtText = formatTime(agentData?.reloaded_at);

  return (
    <article
      className="settings-panel agent-settings-panel"
      aria-labelledby="settings-agent-title"
    >
      <div className="settings-corner settings-corner-left-top" />
      <div className="settings-corner settings-corner-right-top" />
      <div className="settings-corner settings-corner-left-bottom" />
      <div className="settings-corner settings-corner-right-bottom" />

      <div className="settings-editor-heading">
        <div>
          <p className="settings-kicker">Agents</p>
          <h1 id="settings-agent-title">智能体设置</h1>
        </div>
        <div className="settings-editor-actions">
          <button
            type="button"
            className="settings-secondary-button"
            disabled={loading || saving}
            onClick={handleReloadAgentClick}
          >
            重新加载
          </button>
          <button
            type="button"
            className="settings-primary-button"
            disabled={loading || saving || !dirty}
            onClick={handleSaveAgentClick}
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      <div className="settings-file-meta" aria-label="智能体配置文件状态">
        <span title={agentData?.config_file || ""}>
          文件：{agentData?.config_file || "加载中..."}
        </span>
        <span>修改：{modifiedAtText}</span>
        <span>加载：{reloadedAtText}</span>
      </div>

      {errorMessage ? (
        <p className="settings-error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section className="agent-settings-section" aria-labelledby="agent-tools-title">
        <div className="ai-provider-section-heading">
          <div>
            <h2 id="agent-tools-title">工具注册表</h2>
          </div>
        </div>
        <div className="agent-tool-registry">
          {form.toolRegistry.length === 0 ? (
            <p className="ai-provider-empty">当前配置中还没有可用工具。</p>
          ) : null}
          {form.toolRegistry.map(function renderAgentToolConfig(toolConfig) {
            return (
              <label className="ai-provider-field ai-provider-field-wide" key={toolConfig.name}>
                <span>{toolConfig.name}</span>
                <textarea
                  className="agent-settings-textarea agent-settings-tool-description"
                  value={toolConfig.description}
                  disabled={loading || saving}
                  spellCheck={false}
                  onChange={function handleAgentToolDescriptionInput(event) {
                    handleAgentToolDescriptionChange(
                      toolConfig.name,
                      event.target.value,
                    );
                  }}
                />
              </label>
            );
          })}
        </div>
      </section>

      <section className="agent-settings-section" aria-labelledby="agent-memory-title">
        <div className="ai-provider-section-heading">
          <div>
            <h2 id="agent-memory-title">记忆与重试</h2>
          </div>
        </div>
        <div className="agent-settings-grid">
          <label className="ai-provider-field">
            <span>最近对话轮数</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.memoryRecentRounds}
              disabled={loading || saving}
              onChange={handleMemoryRecentRoundsChange}
            />
          </label>
          <label className="ai-provider-field">
            <span>模型失败最大重试次数</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.retryMaxRetries}
              disabled={loading || saving}
              onChange={handleRetryMaxRetriesChange}
            />
          </label>
          <label className="ai-provider-field">
            <span>重试间隔毫秒</span>
            <input
              type="number"
              min="0"
              step="1"
              value={form.retryBackoffMS}
              disabled={loading || saving}
              onChange={handleRetryBackoffMSChange}
            />
          </label>
        </div>
      </section>

      <section className="agent-settings-section" aria-labelledby="agent-supervisor-title">
        <div className="ai-provider-section-heading">
          <div>
            <h2 id="agent-supervisor-title">顶层 Agent</h2>
          </div>
        </div>
        <div className="agent-settings-grid">
          <label className="ai-provider-field">
            <span>Name</span>
            <input
              name="name"
              value={form.supervisor.name}
              disabled={loading || saving}
              onChange={handleSupervisorInputChange}
            />
          </label>
          <label className="ai-provider-field">
            <span>最大迭代次数</span>
            <input
              name="maxIterations"
              type="number"
              min="0"
              step="1"
              value={form.supervisor.maxIterations}
              disabled={loading || saving}
              onChange={handleSupervisorInputChange}
            />
          </label>
          {form.toolRegistry.map(function renderSupervisorToolToggle(toolConfig) {
            return (
              <label className="agent-settings-tool-toggle" key={toolConfig.name}>
                <input
                  type="checkbox"
                  checked={form.supervisor.toolNames.includes(toolConfig.name)}
                  disabled={loading || saving}
                  onChange={function handleSupervisorToolToggle(event) {
                    handleSupervisorToolChange(
                      toolConfig.name,
                      event.target.checked,
                    );
                  }}
                />
                <span title={toolConfig.description}>{toolConfig.name}</span>
              </label>
            );
          })}
          <label className="agent-settings-tool-toggle">
            <input
              type="checkbox"
              checked={form.supervisor.customModelEnabled}
              disabled={loading || saving}
              onChange={handleSupervisorCustomModelChange}
            />
            <span>自定义模型</span>
          </label>
          {form.supervisor.customModelEnabled ? (
            <>
              <label className="ai-provider-field">
                <span>模型提供商</span>
                <select
                  value={form.supervisor.providerId}
                  disabled={loading || saving || modelProviders.length === 0}
                  onChange={handleSupervisorModelProviderChange}
                >
                  <option value="">选择提供商</option>
                  {modelProviders.map(function renderAgentProviderOption(provider) {
                    return (
                      <option key={provider.id} value={String(provider.id)}>
                        {formatAgentProviderOption(provider)}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="ai-provider-field">
                <span>模型</span>
                <select
                  value={form.supervisor.model}
                  disabled={loading || saving || !form.supervisor.providerId}
                  onFocus={function handleSupervisorModelSelectFocus() {
                    handleAgentModelSelectFocus(form.supervisor.providerId);
                  }}
                  onChange={handleSupervisorModelChange}
                >
                  <option value="">
                    {modelLoadingByProvider[form.supervisor.providerId]
                      ? "正在加载模型..."
                      : "使用提供商默认模型"}
                  </option>
                  {agentModelOptionsForProvider(
                    form.supervisor.providerId,
                    form.supervisor.model,
                    modelProviders,
                    modelOptionsByProvider,
                  ).map(function renderSupervisorModelOption(model) {
                    return (
                      <option key={model.id} value={model.id}>
                        {formatAgentModelOption(model)}
                      </option>
                    );
                  })}
                </select>
              </label>
            </>
          ) : null}
          <label className="ai-provider-field ai-provider-field-wide">
            <span>Description</span>
            <input
              name="description"
              value={form.supervisor.description}
              disabled={loading || saving}
              onChange={handleSupervisorInputChange}
            />
          </label>
          <label className="ai-provider-field ai-provider-field-wide">
            <span>Instruction</span>
            <textarea
              name="instruction"
              className="agent-settings-textarea agent-settings-instruction"
              value={form.supervisor.instruction}
              disabled={loading || saving}
              spellCheck={false}
              onChange={handleSupervisorInputChange}
            />
          </label>
        </div>
      </section>

      <section className="agent-settings-section" aria-labelledby="agent-children-title">
        <div className="ai-provider-section-heading agent-settings-child-heading">
          <div>
            <h2 id="agent-children-title">子 Agent</h2>
          </div>
          <button
            type="button"
            className="settings-secondary-button"
            disabled={loading || saving}
            onClick={handleAddChildClick}
          >
            新增子 Agent
          </button>
        </div>

        <div className="agent-child-list">
          {loading ? (
            <p className="ai-provider-empty">正在加载智能体配置...</p>
          ) : null}
          {!loading && form.children.length === 0 ? (
            <p className="ai-provider-empty">还没有子 Agent。</p>
          ) : null}
          {!loading
            ? form.children.map((child, index) => (
                <article
                  className={
                    child.enabled
                      ? "agent-child-card"
                      : "agent-child-card agent-child-card-disabled"
                  }
                  key={child.id}
                >
                  <div className="agent-child-card-heading">
                    <h3>{child.name.trim() || `子 Agent ${index + 1}`}</h3>
                    <div className="agent-child-card-actions">
                      <label className="agent-settings-inline-toggle">
                        <input
                          type="checkbox"
                          checked={child.enabled}
                          disabled={saving}
                          onChange={function handleChildEnabledToggle(event) {
                            handleChildEnabledChange(index, event.target.checked);
                          }}
                        />
                        <span>启用</span>
                      </label>
                      <div className="agent-settings-inline-toggle">
                        <Switch
                          checked={child.shareChatHistory}
                          disabled={saving}
                          aria-label="共享历史"
                          onChange={function handleChildShareChatHistoryToggle(
                            checked,
                          ) {
                            handleChildShareChatHistoryChange(index, checked);
                          }}
                        />
                        <span>共享历史</span>
                      </div>
                      <button
                        type="button"
                        className="settings-secondary-button"
                        disabled={saving || index === 0}
                        onClick={function handleMoveChildUpClick() {
                          handleMoveChildClick(index, -1);
                        }}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="settings-secondary-button"
                        disabled={saving || index === form.children.length - 1}
                        onClick={function handleMoveChildDownClick() {
                          handleMoveChildClick(index, 1);
                        }}
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        className="settings-secondary-button ai-provider-danger-button"
                        disabled={saving}
                        onClick={function handleRemoveAgentChildClick() {
                          handleRemoveChildClick(index);
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  <div className="agent-settings-grid">
                    <label className="ai-provider-field">
                      <span>Name</span>
                      <input
                        value={child.name}
                        disabled={saving}
                        onChange={function handleChildNameChange(event) {
                          handleChildInputChange(index, "name", event.target.value);
                        }}
                      />
                    </label>
                    <label className="ai-provider-field">
                      <span>Task</span>
                      <input
                        value={child.task}
                        disabled={saving}
                        onChange={function handleChildTaskChange(event) {
                          handleChildInputChange(index, "task", event.target.value);
                        }}
                      />
                    </label>
                    <label className="ai-provider-field">
                      <span>最大迭代次数</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={child.maxIterations}
                        disabled={saving}
                        onChange={function handleChildMaxIterationsChange(event) {
                          handleChildInputChange(
                            index,
                            "maxIterations",
                            event.target.value,
                          );
                        }}
                      />
                    </label>
                    {form.toolRegistry.map(function renderChildToolToggle(toolConfig) {
                      return (
                        <label className="agent-settings-tool-toggle" key={toolConfig.name}>
                          <input
                            type="checkbox"
                            checked={child.toolNames.includes(toolConfig.name)}
                            disabled={saving}
                            onChange={function handleChildToolToggle(event) {
                              handleChildToolChange(
                                index,
                                toolConfig.name,
                                event.target.checked,
                              );
                            }}
                          />
                          <span title={toolConfig.description}>{toolConfig.name}</span>
                        </label>
                      );
                    })}
                    <label className="agent-settings-tool-toggle">
                      <input
                        type="checkbox"
                        checked={child.customModelEnabled}
                        disabled={saving}
                        onChange={function handleChildCustomModelToggle(event) {
                          handleChildCustomModelChange(index, event.target.checked);
                        }}
                      />
                      <span>自定义模型</span>
                    </label>
                    {child.customModelEnabled ? (
                      <>
                        <label className="ai-provider-field">
                          <span>模型提供商</span>
                          <select
                            value={child.providerId}
                            disabled={saving || modelProviders.length === 0}
                            onChange={function handleChildProviderSelect(event) {
                              handleChildModelProviderChange(
                                index,
                                event.target.value,
                              );
                            }}
                          >
                            <option value="">选择提供商</option>
                            {modelProviders.map(function renderChildProviderOption(
                              provider,
                            ) {
                              return (
                                <option
                                  key={provider.id}
                                  value={String(provider.id)}
                                >
                                  {formatAgentProviderOption(provider)}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                        <label className="ai-provider-field">
                          <span>模型</span>
                          <select
                            value={child.model}
                            disabled={saving || !child.providerId}
                            onFocus={function handleChildModelSelectFocus() {
                              handleAgentModelSelectFocus(child.providerId);
                            }}
                            onChange={function handleChildModelSelect(event) {
                              handleChildModelChange(index, event.target.value);
                            }}
                          >
                            <option value="">
                              {modelLoadingByProvider[child.providerId]
                                ? "正在加载模型..."
                                : "使用提供商默认模型"}
                            </option>
                            {agentModelOptionsForProvider(
                              child.providerId,
                              child.model,
                              modelProviders,
                              modelOptionsByProvider,
                            ).map(function renderChildModelOption(model) {
                              return (
                                <option key={model.id} value={model.id}>
                                  {formatAgentModelOption(model)}
                                </option>
                              );
                            })}
                          </select>
                        </label>
                      </>
                    ) : null}
                    <label className="ai-provider-field ai-provider-field-wide">
                      <span>Description</span>
                      <input
                        value={child.description}
                        disabled={saving}
                        onChange={function handleChildDescriptionChange(event) {
                          handleChildInputChange(
                            index,
                            "description",
                            event.target.value,
                          );
                        }}
                      />
                    </label>
                    <label className="ai-provider-field ai-provider-field-wide">
                      <span>Instruction</span>
                      <textarea
                        className="agent-settings-textarea agent-settings-instruction"
                        value={child.instruction}
                        disabled={saving}
                        spellCheck={false}
                        onChange={function handleChildInstructionChange(event) {
                          handleChildInputChange(
                            index,
                            "instruction",
                            event.target.value,
                          );
                        }}
                      />
                    </label>
                    <div className="ai-provider-field ai-provider-field-wide agent-settings-json-field">
                      <span>Parameters JSON</span>
                      <div className="agent-settings-json-viewer-wrap">
                        <JsonViewer
                          ref={function bindChildParametersJsonViewer(instance) {
                            parameterEditorRefs.current[child.id] =
                              instance as AgentParameterJsonViewerRef | null;
                          }}
                          className="agent-settings-json-viewer"
                          height={220}
                          width="100%"
                          showSearch={true}
                          options={{
                            autoWrap: true,
                            lineHeight: 20,
                            readOnly: saving,
                            formatOptions: {
                              tabSize: 2,
                              insertSpaces: true,
                              eol: "\n",
                            },
                          }}
                          value={child.parametersText}
                          onChange={function handleChildParametersJsonChange() {
                            setParameterEditorRevision(function updateRevision(
                              revision,
                            ) {
                              return revision + 1;
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              ))
            : null}
        </div>
      </section>
    </article>
  );
}

// AIProviderSettingsPanel 渲染 AI 提供商管理面板。
// 参数 props 表示 AI 提供商面板需要的外部回调。
function AIProviderSettingsPanel(props: AIProviderSettingsPanelProps) {
  const [providers, setProviders] = useState<AIProviderItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(aiProviderDefaultPage);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingID, setDeletingID] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [providerModalVisible, setProviderModalVisible] = useState(false);
  const [formMode, setFormMode] = useState<AIProviderFormMode>("create");
  const [editingProvider, setEditingProvider] =
    useState<AIProviderItem | null>(null);
  const [form, setForm] = useState<AIProviderFormState>(
    createDefaultAIProviderFormState,
  );
  const [providerModelOptions, setProviderModelOptions] = useState<
    AIProviderModelItem[]
  >([]);
  const [providerModelLoading, setProviderModelLoading] = useState(false);
  const [providerModelError, setProviderModelError] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / aiProviderPageSize));
  const pageSummary =
    total > 0 ? `${page} / ${totalPages} 页，共 ${total} 条` : "暂无记录";

  const loadProviders = useCallback(
    // loadProviders 读取 AI 提供商分页列表。
    // 参数 signal 表示用于取消请求的浏览器 AbortSignal；参数 pageNumber 表示需要读取的页码；参数 showSuccess 表示刷新成功时是否展示提示。
    async function loadProviders(
      signal?: AbortSignal,
      pageNumber = page,
      showSuccess = false,
    ) {
      setLoading(true);
      setErrorMessage("");

      try {
        const data = await fetchAIProviders({
          page: pageNumber,
          pageSize: aiProviderPageSize,
          signal,
        });
        setProviders(data.items);
        setTotal(data.total);
        setPage(data.page || pageNumber);
        if (showSuccess) {
          Toast.success("AI 提供商列表已刷新");
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        const message = getErrorMessage(error, "AI 提供商加载失败，请稍后再试");
        setErrorMessage(message);
        Toast.error(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [page, props.onUnauthorized],
  );

  useEffect(
    function loadAIProvidersOnPageChange() {
      const controller = new AbortController();
      void loadProviders(controller.signal, page);

      // cancelAIProviderLoad 取消卸载中的 AI 提供商列表请求。
      return function cancelAIProviderLoad() {
        controller.abort();
      };
    },
    [loadProviders, page],
  );

  // handleReloadClick 处理刷新 AI 提供商列表按钮点击。
  function handleReloadClick() {
    void loadProviders(undefined, page, true);
  }

  // handleCreateClick 切换为创建 AI 提供商表单。
  function handleCreateClick() {
    setFormMode("create");
    setEditingProvider(null);
    setForm(createDefaultAIProviderFormState());
    setErrorMessage("");
    clearProviderModelOptions();
    setProviderModalVisible(true);
  }

  // handleEditClick 切换为编辑指定 AI 提供商表单。
  // 参数 provider 表示需要编辑的 AI 提供商。
  function handleEditClick(provider: AIProviderItem) {
    setFormMode("edit");
    setEditingProvider(provider);
    setForm(providerToAIProviderFormState(provider));
    setErrorMessage("");
    clearProviderModelOptions();
    setProviderModalVisible(true);
  }

  // handleProviderModalCancel 关闭 AI 提供商表单弹窗并恢复默认创建状态。
  function handleProviderModalCancel() {
    if (submitting) {
      return;
    }
    setProviderModalVisible(false);
    setFormMode("create");
    setEditingProvider(null);
    setForm(createDefaultAIProviderFormState());
    setErrorMessage("");
    clearProviderModelOptions();
  }

  // clearProviderModelOptions 清空 AI 提供商表单中已加载的模型候选。
  function clearProviderModelOptions() {
    setProviderModelOptions([]);
    setProviderModelError("");
  }

  // handleFormInputChange 处理 AI 提供商文本或数字字段输入变化。
  // 参数 event 表示输入框变化事件。
  function handleFormInputChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    const shouldClearModelOptions =
      name === "providerType" || name === "apiKey" || name === "baseURL";
    if (shouldClearModelOptions) {
      clearProviderModelOptions();
    }
    setForm(function updateForm(current) {
      switch (name) {
        case "name":
          return { ...current, name: value };
        case "providerType":
          if (value === "openai") {
            return { ...current, providerType: value, apiType: "completions" };
          }
          return { ...current, providerType: value };
        case "apiKey":
          return { ...current, apiKey: value };
        case "baseURL":
          return { ...current, baseURL: value };
        case "defaultModel":
          return { ...current, defaultModel: value };
        case "priority":
          return { ...current, priority: value };
        case "apiType":
          return { ...current, apiType: value };
        default:
          return current;
      }
    });
  }

  // handleProviderModelListClick 处理默认模型候选列表获取按钮点击。
  function handleProviderModelListClick() {
    void loadProviderModelOptions();
  }

  // handleEnabledChange 处理 AI 提供商启用状态变化。
  // 参数 event 表示复选框变化事件。
  function handleEnabledChange(event: ChangeEvent<HTMLInputElement>) {
    setForm(function updateEnabled(current) {
      return { ...current, enabled: event.target.checked };
    });
  }

  // handleFormSubmit 处理 AI 提供商表单提交。
  // 参数 event 表示表单提交事件。
  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void saveProvider();
  }

  // handlePreviousPageClick 切换到上一页 AI 提供商列表。
  function handlePreviousPageClick() {
    if (page > 1) {
      setPage(page - 1);
    }
  }

  // handleNextPageClick 切换到下一页 AI 提供商列表。
  function handleNextPageClick() {
    if (page < totalPages) {
      setPage(page + 1);
    }
  }

  // handleDeleteClick 打开删除 AI 提供商确认框。
  // 参数 provider 表示需要删除的 AI 提供商。
  function handleDeleteClick(provider: AIProviderItem) {
    Modal.confirm({
      title: "删除 AI 提供商",
      content: `确认删除「${provider.name}」吗？删除后无法从前端恢复。`,
      okText: "删除",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmDelete() {
        void removeProvider(provider);
      },
    });
  }

  // saveProvider 创建或更新 AI 提供商。
  async function saveProvider() {
    const validationMessage = validateAIProviderForm(form, formMode);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      Toast.error(validationMessage);
      return;
    }
    if (formMode === "edit" && editingProvider === null) {
      const message = "请选择需要编辑的 AI 提供商";
      setErrorMessage(message);
      Toast.error(message);
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const params = toAIProviderUpsertParams(form);
      if (formMode === "edit" && editingProvider) {
        await updateAIProvider(editingProvider.id, params);
        Toast.success("AI 提供商已更新");
      } else {
        await createAIProvider(params);
        Toast.success("AI 提供商已创建");
      }

      setFormMode("create");
      setEditingProvider(null);
      setForm(createDefaultAIProviderFormState());
      setProviderModalVisible(false);
      clearProviderModelOptions();

      const nextPage =
        formMode === "create" ? aiProviderDefaultPage : page;
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await loadProviders(undefined, nextPage);
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      const message = getErrorMessage(error, "AI 提供商保存失败，请稍后再试");
      setErrorMessage(message);
      Toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // loadProviderModelOptions 获取当前 AI 提供商表单可用的模型候选。
  async function loadProviderModelOptions() {
    const providerType = form.providerType.trim();
    if (!isAIProviderType(providerType)) {
      const message = "AI 提供商类型只能是 openai、claude 或 gemini";
      setProviderModelError(message);
      Toast.error(message);
      return;
    }

    const apiKey = form.apiKey.trim();
    const baseURL = form.baseURL.trim();
    const canUseSavedProvider =
      formMode === "edit" &&
      editingProvider !== null &&
      !apiKey &&
      isProviderConnectionUnchanged(form, editingProvider);

    if (!apiKey && !canUseSavedProvider) {
      const message =
        formMode === "edit" && editingProvider !== null
          ? "请输入 API Key 后获取当前配置的模型列表"
          : "请输入 API Key 后获取模型列表";
      setProviderModelError(message);
      Toast.warning(message);
      return;
    }

    setProviderModelLoading(true);
    setProviderModelError("");

    try {
      const data = canUseSavedProvider
        ? await fetchAIProviderModelsByProviderID(editingProvider.id)
        : await fetchAIProviderModels({
            provider_type: providerType,
            api_key: apiKey,
            base_url: baseURL,
          });
      const options = uniqueAIProviderModelOptions(data.items);
      setProviderModelOptions(options);
      if (options.length === 0) {
        Toast.info("未获取到模型列表，可手动填写默认模型");
        return;
      }
      Toast.success("模型列表已获取");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      const message = getErrorMessage(error, "AI 模型列表获取失败，请稍后再试");
      setProviderModelError(message);
      Toast.error(message);
    } finally {
      setProviderModelLoading(false);
    }
  }

  // removeProvider 删除指定 AI 提供商并刷新列表。
  // 参数 provider 表示需要删除的 AI 提供商。
  async function removeProvider(provider: AIProviderItem) {
    setDeletingID(provider.id);
    setErrorMessage("");

    try {
      await deleteAIProvider(provider.id);
      Toast.success("AI 提供商已删除");
      if (providers.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        await loadProviders(undefined, page);
      }
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      const message = getErrorMessage(error, "AI 提供商删除失败，请稍后再试");
      setErrorMessage(message);
      Toast.error(message);
    } finally {
      setDeletingID(null);
    }
  }

  return (
    <article
      className="settings-panel ai-provider-panel"
      aria-labelledby="settings-ai-provider-title"
    >
      <div className="settings-corner settings-corner-left-top" />
      <div className="settings-corner settings-corner-right-top" />
      <div className="settings-corner settings-corner-left-bottom" />
      <div className="settings-corner settings-corner-right-bottom" />

      <div className="settings-editor-heading ai-provider-heading">
        <div>
          <p className="settings-kicker">AI Providers</p>
          <h1 id="settings-ai-provider-title">AI 提供商</h1>
        </div>
        <div className="settings-editor-actions">
          <button
            type="button"
            className="settings-secondary-button"
            disabled={loading || submitting}
            onClick={handleReloadClick}
          >
            刷新列表
          </button>
          <button
            type="button"
            className="settings-primary-button"
            disabled={submitting}
            onClick={handleCreateClick}
          >
            新增提供商
          </button>
        </div>
      </div>

      {errorMessage && !providerModalVisible ? (
        <p className="settings-error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <section
        className="ai-provider-list-section"
        aria-labelledby="ai-provider-list-title"
      >
        <div className="ai-provider-section-heading">
          <div>
            <h2 id="ai-provider-list-title">提供商列表</h2>
            <p>{pageSummary}</p>
          </div>
          <div className="ai-provider-page-actions">
            <button
              type="button"
              className="settings-secondary-button"
              disabled={loading || page <= 1}
              onClick={handlePreviousPageClick}
            >
              上一页
            </button>
            <button
              type="button"
              className="settings-secondary-button"
              disabled={loading || page >= totalPages}
              onClick={handleNextPageClick}
            >
              下一页
            </button>
          </div>
        </div>

        <div className="ai-provider-list" aria-label="AI 提供商列表">
          {loading ? (
            <p className="ai-provider-empty">正在加载 AI 提供商...</p>
          ) : null}
          {!loading && providers.length === 0 ? (
            <p className="ai-provider-empty">还没有 AI 提供商。</p>
          ) : null}
          {!loading
            ? providers.map((provider) => (
                <article
                  className="ai-provider-card"
                  key={provider.id}
                  aria-label={provider.name}
                >
                  <div className="ai-provider-card-heading">
                    <div>
                      <h3>{provider.name}</h3>
                      <p>{provider.provider_type}</p>
                    </div>
                    <span
                      className={
                        provider.enabled
                          ? "ai-provider-status ai-provider-status-enabled"
                          : "ai-provider-status"
                      }
                    >
                      {provider.enabled ? "启用" : "停用"}
                    </span>
                  </div>

                  <dl className="ai-provider-card-meta">
                    <div>
                      <dt>API 类型</dt>
                      <dd>{provider.api_type || "未设置"}</dd>
                    </div>
                    <div>
                      <dt>Key</dt>
                      <dd>{provider.masked_api_key || "未设置"}</dd>
                    </div>
                    <div>
                      <dt>Base URL</dt>
                      <dd title={provider.base_url}>
                        {formatOptionalText(provider.base_url)}
                      </dd>
                    </div>
                    <div>
                      <dt>默认模型</dt>
                      <dd title={provider.default_model}>
                        {formatOptionalText(provider.default_model)}
                      </dd>
                    </div>
                    <div>
                      <dt>优先级</dt>
                      <dd>{provider.priority}</dd>
                    </div>
                    <div>
                      <dt>更新</dt>
                      <dd>{formatTime(provider.updated_at)}</dd>
                    </div>
                  </dl>

                  <div className="ai-provider-card-actions">
                    <button
                      type="button"
                      className="settings-secondary-button"
                      disabled={submitting || deletingID !== null}
                      onClick={function handleProviderEditClick() {
                        handleEditClick(provider);
                      }}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="settings-secondary-button ai-provider-danger-button"
                      disabled={submitting || deletingID !== null}
                      onClick={function handleProviderDeleteClick() {
                        handleDeleteClick(provider);
                      }}
                    >
                      {deletingID === provider.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </article>
              ))
            : null}
        </div>
      </section>

      <Modal
        className="ai-provider-modal"
        footer={null}
        maskClosable={!submitting}
        onCancel={handleProviderModalCancel}
        title={formMode === "edit" ? "编辑 AI 提供商" : "新增 AI 提供商"}
        visible={providerModalVisible}
        width={760}
      >
        <form className="ai-provider-form" onSubmit={handleFormSubmit}>
          <div className="ai-provider-form-heading">
            <div>
              <h2>{formMode === "edit" ? "编辑提供商" : "新增提供商"}</h2>
              <p>
                {formMode === "edit" && editingProvider
                  ? `正在编辑：${editingProvider.name}`
                  : "创建新的 AI 调用配置"}
              </p>
            </div>
          </div>

          {errorMessage ? (
            <p className="settings-error-message" role="alert">
              {errorMessage}
            </p>
          ) : null}

          <div className="ai-provider-form-grid">
            <label className="ai-provider-field">
              <span>名称</span>
              <input
                name="name"
                value={form.name}
                disabled={submitting}
                placeholder="默认 OpenAI"
                onChange={handleFormInputChange}
              />
            </label>
            <fieldset className="ai-provider-choice-field">
              <legend>提供商类型</legend>
              <div className="ai-provider-choice-list">
                {aiProviderTypeOptions.map((option) => (
                  <label className="ai-provider-choice" key={option.value}>
                    <input
                      type="radio"
                      name="providerType"
                      value={option.value}
                      checked={form.providerType === option.value}
                      disabled={submitting}
                      onChange={handleFormInputChange}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="ai-provider-field">
              <span>API Key</span>
              <input
                name="apiKey"
                type="password"
                value={form.apiKey}
                disabled={submitting}
                placeholder={
                  formMode === "edit" ? "留空保留旧密钥" : "sk-..."
                }
                onChange={handleFormInputChange}
              />
            </label>
            <label className="ai-provider-field ai-provider-field-wide">
              <span>Base URL</span>
              <input
                name="baseURL"
                value={form.baseURL}
                disabled={submitting}
                placeholder="https://api.openai.com/v1"
                onChange={handleFormInputChange}
              />
            </label>
            <div className="ai-provider-field ai-provider-field-wide">
              <span>默认模型</span>
              <div className="ai-provider-model-picker">
                <input
                  name="defaultModel"
                  list="ai-provider-default-model-options"
                  value={form.defaultModel}
                  disabled={submitting}
                  placeholder="例如 gpt-5、claude-sonnet-4-5 或 gemini-2.5-pro"
                  onChange={handleFormInputChange}
                />
                <button
                  type="button"
                  className="settings-secondary-button"
                  disabled={submitting || providerModelLoading}
                  onClick={handleProviderModelListClick}
                >
                  {providerModelLoading ? "获取中..." : "获取模型列表"}
                </button>
              </div>
              <datalist id="ai-provider-default-model-options">
                {providerModelOptions.map(function renderProviderModelOption(
                  model,
                ) {
                  return (
                    <option
                      key={model.id}
                      value={model.id}
                      label={formatAgentModelOption(model)}
                    />
                  );
                })}
              </datalist>
              {providerModelError ? (
                <small className="ai-provider-model-message">
                  {providerModelError}
                </small>
              ) : null}
            </div>
            <label className="ai-provider-field">
              <span>优先级</span>
              <input
                name="priority"
                type="number"
                min="0"
                step="1"
                value={form.priority}
                disabled={submitting}
                placeholder="0"
                onChange={handleFormInputChange}
              />
            </label>
            <fieldset className="ai-provider-choice-field">
              <legend>API 类型</legend>
              <div className="ai-provider-choice-list">
                {aiProviderAPITypeOptions.map((option) => (
                  <label className="ai-provider-choice" key={option.value}>
                    <input
                      type="radio"
                      name="apiType"
                      value={option.value}
                      checked={form.apiType === option.value}
                      disabled={submitting || form.providerType === "openai"}
                      onChange={handleFormInputChange}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="ai-provider-toggle-field">
              <input
                type="checkbox"
                checked={form.enabled}
                disabled={submitting}
                onChange={handleEnabledChange}
              />
              <span>启用该提供商</span>
            </label>
          </div>

          <div className="ai-provider-form-actions">
            <button
              type="button"
              className="settings-secondary-button"
              disabled={submitting}
              onClick={handleProviderModalCancel}
            >
              取消
            </button>
            <button
              type="submit"
              className="settings-primary-button"
              disabled={loading || submitting}
            >
              {submitting
                ? "保存中..."
                : formMode === "edit"
                  ? "保存修改"
                  : "创建提供商"}
            </button>
          </div>
        </form>
      </Modal>
    </article>
  );
}

// SystemSettingsPanel 渲染系统更新面板。
// 参数 props 表示系统更新面板需要的外部回调。
function SystemSettingsPanel(props: SystemSettingsPanelProps) {
  const [systemUpdating, setSystemUpdating] = useState(false);

  // handleSystemUpdateClick 打开系统一键更新确认框。
  function handleSystemUpdateClick() {
    if (systemUpdating) {
      return;
    }

    Modal.confirm({
      title: "更新系统",
      content: "确认后会从 GitHub 拉取最新代码并重启服务，页面会短暂不可用。",
      okText: "更新",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmSystemUpdate() {
        void updateSystem();
      },
    });
  }

  // updateSystem 请求后端执行一键更新并在成功后回到登录页。
  async function updateSystem() {
    setSystemUpdating(true);
    let shouldResetUpdating = true;

    try {
      await triggerSystemUpdate();
      Toast.success("更新已开始，服务即将重启");
      shouldResetUpdating = false;
      props.onUnauthorized();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        shouldResetUpdating = false;
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "系统更新失败，请稍后再试"));
    } finally {
      if (shouldResetUpdating) {
        setSystemUpdating(false);
      }
    }
  }

  return (
    <article
      className="settings-panel settings-system-panel"
      aria-labelledby="settings-system-title"
    >
      <div className="settings-corner settings-corner-left-top" />
      <div className="settings-corner settings-corner-right-top" />
      <div className="settings-corner settings-corner-left-bottom" />
      <div className="settings-corner settings-corner-right-bottom" />

      <div className="settings-system-heading">
        <p className="settings-kicker">System</p>
        <h1 id="settings-system-title">系统更新</h1>
      </div>

      <div className="settings-system-card">
        <div>
          <h2>一键更新</h2>
          <p>拉取最新代码并重启服务，更新开始后会返回登录页。</p>
        </div>
        <button
          type="button"
          className="settings-primary-button"
          disabled={systemUpdating}
          onClick={handleSystemUpdateClick}
        >
          {systemUpdating ? "更新中..." : "开始更新"}
        </button>
      </div>
    </article>
  );
}

// createDefaultAgentSettingsFormState 创建智能体设置默认表单状态。
function createDefaultAgentSettingsFormState(): AgentSettingsFormState {
  return {
    toolRegistry: defaultAgentSettingsFormState.toolRegistry.map(copyAgentToolConfig),
    memoryRecentRounds: defaultAgentSettingsFormState.memoryRecentRounds,
    retryMaxRetries: defaultAgentSettingsFormState.retryMaxRetries,
    retryBackoffMS: defaultAgentSettingsFormState.retryBackoffMS,
    supervisor: { ...defaultAgentSettingsFormState.supervisor },
    children: [],
  };
}

// createDefaultAgentChildFormState 创建空白子 Agent 表单状态。
function createDefaultAgentChildFormState(): AgentChildFormState {
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
    customModelEnabled: false,
    providerId: "",
    model: "",
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
function copyAgentToolConfig(toolConfig: AgentToolConfig): AgentToolConfig {
  return {
    name: toolConfig.name ?? "",
    description: toolConfig.description ?? "",
  };
}

// normalizeAgentToolNames 标准化 Agent 已选择的工具名称列表。
// 参数 toolNames 表示接口返回的工具名称列表。
function normalizeAgentToolNames(toolNames: string[] | null): string[] {
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

// toggleAgentToolName 根据复选框状态增删指定工具名称。
// 参数 toolNames 表示当前已选择的工具名称列表；参数 toolName 表示需要切换的工具名称；参数 enabled 表示是否启用该工具。
function toggleAgentToolName(
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
function agentConfigToFormState(agent: AgentConfig): AgentSettingsFormState {
  return {
    toolRegistry: (agent.tools ?? []).map(copyAgentToolConfig),
    memoryRecentRounds: String(agent.memory?.recent_rounds ?? 10),
    retryMaxRetries: String(agent.retry?.max_retries ?? 0),
    retryBackoffMS: String(agent.retry?.backoff_ms ?? 300),
    supervisor: {
      name: agent.supervisor?.name ?? "",
      description: agent.supervisor?.description ?? "",
      instruction: agent.supervisor?.instruction ?? "",
      maxIterations: String(agent.supervisor?.max_iterations ?? 8),
      toolNames: normalizeAgentToolNames(agent.supervisor?.tools ?? []),
      customModelEnabled: Number(agent.supervisor?.provider_id ?? 0) > 0,
      providerId:
        Number(agent.supervisor?.provider_id ?? 0) > 0
          ? String(agent.supervisor?.provider_id ?? "")
          : "",
      model: agent.supervisor?.model ?? "",
    },
    children: (agent.agent ?? []).map(agentDefinitionToChildFormState),
  };
}

// agentDefinitionToChildFormState 将子 Agent 配置转换为表单状态。
// 参数 definition 表示后端返回的子 Agent 配置；参数 index 表示子 Agent 在列表中的位置。
function agentDefinitionToChildFormState(
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
    customModelEnabled: Number(definition.provider_id ?? 0) > 0,
    providerId:
      Number(definition.provider_id ?? 0) > 0
        ? String(definition.provider_id ?? "")
        : "",
    model: definition.model ?? "",
    parametersText: formatAgentParameters(definition.parameters),
  };
}

// formatAgentParameters 将参数对象格式化为稳定的 JSON 文本。
// 参数 parameters 表示后端返回的子 Agent 参数定义。
function formatAgentParameters(
  parameters: Record<string, AgentParameterDefinition> | null,
): string {
  return JSON.stringify(parameters ?? {}, null, 2);
}

// validateAgentSettingsForm 校验智能体设置表单。
// 参数 form 表示当前智能体设置表单状态。
function validateAgentSettingsForm(form: AgentSettingsFormState): string {
  return buildAgentConfigFromForm(form).error;
}

// buildAgentConfigFromForm 将智能体设置表单转换为后端保存参数。
// 参数 form 表示当前智能体设置表单状态。
function buildAgentConfigFromForm(form: AgentSettingsFormState): {
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
    form.supervisor.customModelEnabled,
    form.supervisor.providerId,
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
    const childModel = child.enabled
      ? parseAgentCustomModel(
          child.customModelEnabled,
          child.providerId,
          child.model,
          `第 ${index + 1} 个子 Agent`,
        )
      : parseDisabledAgentCustomModel(
          child.customModelEnabled,
          child.providerId,
          child.model,
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
      model: childModel.model,
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
      },
      retry: {
        max_retries: retryMaxRetries.value,
        backoff_ms: retryBackoffMS.value,
      },
      supervisor: {
        name: supervisorName,
        provider_id: supervisorModel.providerId,
        model: supervisorModel.model,
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

// normalizeAgentToolRegistryForSave 标准化并校验普通工具注册表。
// 参数 tools 表示当前表单中的普通工具注册表。
function normalizeAgentToolRegistryForSave(
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
    result.push({ name, description });
  }
  return { value: result, error: "" };
}

// normalizeSelectedAgentTools 标准化并校验单个 Agent 选择的普通工具列表。
// 参数 toolNames 表示 Agent 当前选择的工具名称；参数 registeredToolNames 表示工具注册表名称集合；参数 label 表示错误提示使用的 Agent 名称。
function normalizeSelectedAgentTools(
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

// parseAgentCustomModel 将启用 Agent 的自定义模型表单字段转换为后端字段。
// 参数 enabled 表示是否启用自定义模型；参数 providerId 表示提供商 ID 文本；参数 model 表示模型标识文本；参数 label 表示错误提示使用的 Agent 名称。
function parseAgentCustomModel(
  enabled: boolean,
  providerId: string,
  model: string,
  label: string,
): { providerId: number; model: string; error: string } {
  if (!enabled) {
    return { providerId: 0, model: "", error: "" };
  }
  const normalizedProviderID = providerId.trim();
  if (!/^[1-9]\d*$/.test(normalizedProviderID)) {
    return { providerId: 0, model: "", error: `${label} 自定义模型必须选择提供商` };
  }
  return {
    providerId: Number.parseInt(normalizedProviderID, 10),
    model: model.trim(),
    error: "",
  };
}

// parseDisabledAgentCustomModel 将禁用子 Agent 的自定义模型草稿转换为后端字段。
// 参数 enabled 表示是否启用自定义模型；参数 providerId 表示提供商 ID 文本；参数 model 表示模型标识文本。
function parseDisabledAgentCustomModel(
  enabled: boolean,
  providerId: string,
  model: string,
): { providerId: number; model: string; error: string } {
  if (!enabled || !/^[1-9]\d*$/.test(providerId.trim())) {
    return { providerId: 0, model: "", error: "" };
  }
  return {
    providerId: Number.parseInt(providerId.trim(), 10),
    model: model.trim(),
    error: "",
  };
}

// parseAgentParametersText 解析子 Agent 参数 JSON 文本。
// 参数 value 表示参数 JSON 文本；参数 childIndex 表示子 Agent 在表单列表中的位置。
function parseAgentParametersText(
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
function parseNonNegativeInteger(
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
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// createDefaultAIProviderFormState 创建 AI 提供商默认表单状态。
function createDefaultAIProviderFormState(): AIProviderFormState {
  return { ...defaultAIProviderFormState };
}

// providerToAIProviderFormState 将 AI 提供商接口数据转换为表单状态。
// 参数 provider 表示需要编辑的 AI 提供商。
function providerToAIProviderFormState(
  provider: AIProviderItem,
): AIProviderFormState {
  return {
    name: provider.name,
    providerType: provider.provider_type,
    apiKey: "",
    baseURL: provider.base_url,
    defaultModel: provider.default_model,
    priority: String(provider.priority ?? 0),
    apiType: provider.provider_type === "openai" ? "completions" : provider.api_type,
    enabled: provider.enabled,
  };
}

// validateAIProviderForm 校验 AI 提供商表单输入。
// 参数 form 表示 AI 提供商表单状态；参数 mode 表示当前表单模式。
function validateAIProviderForm(
  form: AIProviderFormState,
  mode: AIProviderFormMode,
): string {
  if (!form.name.trim()) {
    return "AI 提供商名称不能为空";
  }
  if (!form.providerType.trim()) {
    return "AI 提供商类型不能为空";
  }
  if (!isAIProviderType(form.providerType)) {
    return "AI 提供商类型只能是 openai、claude 或 gemini";
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
  if (!isAIProviderAPIType(form.apiType)) {
    return "AI 接口类型只能是 response 或 completions";
  }
  return "";
}

// toAIProviderUpsertParams 将表单状态转换为后端创建或更新参数。
// 参数 form 表示 AI 提供商表单状态。
function toAIProviderUpsertParams(
  form: AIProviderFormState,
): AIProviderUpsertParams {
  const providerType = form.providerType.trim() as AIProviderType;
  const apiType =
    providerType === "openai"
      ? "completions"
      : (form.apiType.trim() as AIProviderAPIType);

  return {
    name: form.name.trim(),
    provider_type: providerType,
    api_key: form.apiKey.trim(),
    base_url: form.baseURL.trim(),
    default_model: form.defaultModel.trim(),
    priority: parseAIProviderPriority(form.priority) ?? 0,
    api_type: apiType,
    enabled: form.enabled,
  };
}

// isProviderConnectionUnchanged 判断编辑表单中的模型列表连接配置是否仍与已保存提供商一致。
// 参数 form 表示 AI 提供商表单状态；参数 provider 表示当前正在编辑的已保存 AI 提供商。
function isProviderConnectionUnchanged(
  form: AIProviderFormState,
  provider: AIProviderItem,
): boolean {
  return (
    form.providerType.trim() === provider.provider_type &&
    form.baseURL.trim() === provider.base_url.trim()
  );
}

// uniqueAIProviderModelOptions 对模型列表按模型标识去重并过滤空标识。
// 参数 items 表示接口返回的模型候选列表。
function uniqueAIProviderModelOptions(
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
function parseAIProviderPriority(value: string): number | null {
  const text = value.trim();
  if (text === "") {
    return 0;
  }
  if (!/^\d+$/.test(text)) {
    return null;
  }
  return Number.parseInt(text, 10);
}

// isAIProviderType 判断前端表单中的 AI 提供商类型是否为允许值。
// 参数 value 表示需要校验的 AI 提供商类型文本。
function isAIProviderType(value: string): value is AIProviderType {
  return aiProviderTypeOptions.some(
    function matchAIProviderType(option) {
      return option.value === value;
    },
  );
}

// isAIProviderAPIType 判断前端表单中的 AI 接口类型是否为允许值。
// 参数 value 表示需要校验的 AI 接口类型文本。
function isAIProviderAPIType(value: string): value is AIProviderAPIType {
  return aiProviderAPITypeOptions.some(
    function matchAIProviderAPIType(option) {
      return option.value === value;
    },
  );
}

// defaultAgentModelOption 根据模型标识创建智能体设置页的模型选项。
// 参数 modelID 表示 AI 提供商默认模型或已配置模型标识。
function defaultAgentModelOption(modelID: string): AIProviderModelItem {
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
function defaultModelForAgentProvider(
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
function modelsWithDefaultAgentModel(
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

// agentModelOptionsForProvider 返回指定提供商在表单中可选的模型列表。
// 参数 providerId 表示当前选择的 AI 提供商 ID 文本；参数 configuredModel 表示配置文件中已保存的模型；参数 providers 表示 AI 提供商列表；参数 optionsByProvider 表示已加载的模型选项缓存。
function agentModelOptionsForProvider(
  providerId: string,
  configuredModel: string,
  providers: AIProviderItem[],
  optionsByProvider: Record<string, AIProviderModelItem[]>,
): AIProviderModelItem[] {
  const normalizedProviderID = providerId.trim();
  if (!normalizedProviderID) {
    return [];
  }
  let items = optionsByProvider[normalizedProviderID] ?? [];
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
function formatAgentModelOption(model: AIProviderModelItem): string {
  if (!model.display_name || model.display_name === model.id) {
    return model.id;
  }
  return `${model.display_name} (${model.id})`;
}

// formatAgentProviderOption 返回智能体设置页提供商下拉选项文案。
// 参数 provider 表示需要展示的 AI 提供商。
function formatAgentProviderOption(provider: AIProviderItem): string {
  const suffix = provider.enabled ? "" : "（已停用）";
  return `${provider.name}${suffix}`;
}

// formatTime 将接口返回的时间文本转换为本地展示文本。
// 参数 value 表示接口返回的 ISO 时间文本。
function formatTime(value?: string): string {
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
function formatOptionalText(value?: string): string {
  const text = value?.trim();
  return text ? text : "未设置";
}

// getErrorMessage 从未知错误中提取用户提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底提示。
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// isAbortError 判断错误是否来自请求取消。
// 参数 error 表示捕获到的未知错误。
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
