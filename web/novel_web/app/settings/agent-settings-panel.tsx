import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import Card from "@douyinfe/semi-ui-19/lib/es/card";
import JsonViewer from "@douyinfe/semi-ui-19/lib/es/jsonViewer";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Switch from "@douyinfe/semi-ui-19/lib/es/switch";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import { fetchAgentConfig, fetchAIProviderModelsByProviderID, fetchAIProviders, updateAgentConfig, UnauthorizedError, type AgentConfigData, type AgentToolConfig, type AIProviderItem, type AIProviderModelItem } from "../api";
import { aiProviderDefaultPage, agentReasoningEffortOptions } from "./settings-constants";
import { AgentSettingsContext } from "./agent-settings-context";
import type { AgentChildFormState, AgentChildTextField, AgentParameterJsonViewerRef, AgentSettingsFormState, AgentSettingsPanelProps, EditingAgentTarget } from "./types";
import { agentConfigToFormState, agentModelOptionsForProvider, buildAgentConfigFromForm, copyAgentToolConfig, createDefaultAgentChildFormState, createDefaultAgentSettingsFormState, defaultAgentModelOption, defaultModelForAgentProvider, formatAgentModelOption, formatAgentProviderOption, formatTime, getErrorMessage, isAbortError, modelsWithDefaultAgentModel, renderReasoningEffortOption, toggleAgentToolName, validateAgentSettingsForm } from "./settings-utils";

// AgentSettingsPanel 渲染结构化智能体配置面板。
// 参数 props 表示智能体配置面板需要的外部回调。
export function AgentSettingsPanel(props: AgentSettingsPanelProps) {
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
  const [editingAgentTarget, setEditingAgentTarget] =
    useState<EditingAgentTarget | null>(null);

  const dirty = useMemo(
    function calculateAgentSettingsDirty() {
      const currentForm = agentFormWithParameterEditorValues(form);
      return JSON.stringify(currentForm) !== JSON.stringify(savedForm);
    },
    [form, savedForm, parameterEditorRevision],
  );
  const editingChildIndex =
    editingAgentTarget?.kind === "child"
      ? form.children.findIndex(function findEditingChild(child) {
          return child.id === editingAgentTarget.childID;
        })
      : -1;
  const editingChild =
    editingChildIndex >= 0 ? form.children[editingChildIndex] : null;

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

  // syncAgentParameterEditors 将当前 JsonViewer 文本同步回表单状态。
  function syncAgentParameterEditors() {
    setForm(function syncCurrentForm(current) {
      return agentFormWithParameterEditorValues(current);
    });
  }

  // handleOpenAgentEditor 打开指定 Agent 的完整配置编辑弹窗。
  // 参数 target 表示需要打开的 Agent 编辑目标。
  function handleOpenAgentEditor(target: EditingAgentTarget) {
    syncAgentParameterEditors();
    setEditingAgentTarget(target);
  }

  // handleAgentCardKeyDown 处理 Agent 卡片键盘打开编辑弹窗。
  // 参数 event 表示卡片键盘事件；参数 target 表示需要打开的 Agent 编辑目标。
  function handleAgentCardKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    target: EditingAgentTarget,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    handleOpenAgentEditor(target);
  }

  // handleCloseAgentEditor 关闭 Agent 编辑弹窗，并同步当前 JSON 编辑器文本。
  function handleCloseAgentEditor() {
    syncAgentParameterEditors();
    setEditingAgentTarget(null);
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
        setEditingAgentTarget(null);
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
    // loadModelProviders 读取可用于 Agent 模型选择的 AI 提供商列表。
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

  // handleSupervisorModelProviderChange 处理顶层 Agent 模型提供商变化。
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

  // handleSupervisorModelChange 处理顶层 Agent 模型变化。
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

  // handleSupervisorReasoningEffortChange 处理顶层 Agent GPT 推理强度变化。
  // 参数 event 表示下拉框变化事件。
  function handleSupervisorReasoningEffortChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    const reasoningEffort = event.target.value;
    setForm(function updateSupervisorReasoningEffort(current) {
      return {
        ...current,
        supervisor: {
          ...current.supervisor,
          reasoningEffort,
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

  // handleChildModelProviderChange 处理子 Agent 模型提供商变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 providerId 表示新的 AI 提供商 ID 文本。
  function handleChildModelProviderChange(index: number, providerId: string) {
    updateChildForm(index, function updateChildModelProvider(child) {
      return { ...child, providerId, model: "" };
    });
    void loadAgentModelOptions(providerId);
  }

  // handleChildModelChange 处理子 Agent 模型变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 model 表示新的模型标识。
  function handleChildModelChange(index: number, model: string) {
    updateChildForm(index, function updateChildModel(child) {
      return { ...child, model };
    });
  }

  // handleChildReasoningEffortChange 处理子 Agent GPT 推理强度变化。
  // 参数 index 表示子 Agent 在表单列表中的位置；参数 reasoningEffort 表示新的推理强度。
  function handleChildReasoningEffortChange(
    index: number,
    reasoningEffort: string,
  ) {
    updateChildForm(index, function updateChildReasoningEffort(child) {
      return { ...child, reasoningEffort };
    });
  }

  // handleEditingChildReasoningEffortChange 处理当前编辑子 Agent 的 GPT 推理强度变化。
  // 参数 event 表示下拉框变化事件。
  function handleEditingChildReasoningEffortChange(
    event: ChangeEvent<HTMLSelectElement>,
  ) {
    handleChildReasoningEffortChange(editingChildIndex, event.target.value);
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
    const nextChild = createDefaultAgentChildFormState();
    setForm(function addChild(current) {
      return {
        ...current,
        children: [...current.children, nextChild],
      };
    });
    setEditingAgentTarget({ kind: "child", childID: nextChild.id });
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
    setEditingAgentTarget(null);
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
    setSaving(true);
    setErrorMessage("");

    try {
      const latestData = await fetchAgentConfig();
      const latestTools = (latestData.agent.tools ?? []).map(copyAgentToolConfig);
      const buildResult = buildAgentConfigFromForm({
        ...sourceForm,
        toolRegistry: latestTools,
      });
      if (buildResult.error || !buildResult.agent) {
        const message = buildResult.error || "智能体配置不完整";
        setErrorMessage(message);
        Toast.error(message);
        return;
      }
      const data = await updateAgentConfig({ agent: buildResult.agent });
      const nextForm = agentConfigToFormState(data.agent);
      setAgentData(data);
      setForm(nextForm);
      setSavedForm(nextForm);
      setEditingAgentTarget(null);
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
  const agentEditorVisible =
    editingAgentTarget?.kind === "supervisor" ||
    (editingAgentTarget?.kind === "child" && editingChild !== null);
  const agentEditorTitle =
    editingAgentTarget?.kind === "supervisor"
      ? "编辑顶层 Agent"
      : editingChild
        ? `编辑子 Agent：${editingChild.name.trim() || "未命名"}`
        : "编辑 Agent";
  const agentSettingsContextValue = useMemo(
    // buildAgentSettingsContextValue 创建智能体设置面板的组合式上下文值。
    function buildAgentSettingsContextValue() {
      return {
        state: {
          form,
          loading,
          saving,
          dirty,
        },
        actions: {
          reload: handleReloadAgentClick,
          save: handleSaveAgentClick,
        },
        meta: {
          errorMessage,
        },
      };
    },
    [dirty, errorMessage, form, loading, saving],
  );

  return (
    <AgentSettingsContext value={agentSettingsContextValue}>
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
        <div className="agent-card-grid agent-card-grid-single">
          {loading ? (
            <p className="ai-provider-empty">正在加载顶层 Agent...</p>
          ) : (
            <div
              className="agent-card-shell"
              role="button"
              tabIndex={0}
              aria-label="编辑顶层 Agent"
              onClick={function handleSupervisorCardClick() {
                handleOpenAgentEditor({ kind: "supervisor" });
              }}
              onKeyDown={function handleSupervisorCardKeyboard(event) {
                handleAgentCardKeyDown(event, { kind: "supervisor" });
              }}
            >
              <Card
                className="agent-preview-card agent-supervisor-preview-card"
                shadows="hover"
                headerLine={false}
              >
                <div className="agent-preview-card-content">
                  <h3>{form.supervisor.name.trim() || "顶层 Agent"}</h3>
                  <p title={form.supervisor.description}>
                    {form.supervisor.description.trim() || "暂无 Description"}
                  </p>
                </div>
              </Card>
            </div>
          )}
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

        <div className="agent-card-grid">
          {loading ? (
            <p className="ai-provider-empty">正在加载智能体配置...</p>
          ) : null}
          {!loading && form.children.length === 0 ? (
            <p className="ai-provider-empty">还没有子 Agent。</p>
          ) : null}
          {!loading
            ? form.children.map(function renderAgentChildCard(child, index) {
                return (
                  <div
                    className="agent-card-shell"
                    key={child.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`编辑 ${child.name.trim() || `子 Agent ${index + 1}`}`}
                    onClick={function handleChildCardClick() {
                      handleOpenAgentEditor({
                        kind: "child",
                        childID: child.id,
                      });
                    }}
                    onKeyDown={function handleChildCardKeyboard(event) {
                      handleAgentCardKeyDown(event, {
                        kind: "child",
                        childID: child.id,
                      });
                    }}
                  >
                    <Card
                      className={
                        child.enabled
                          ? "agent-preview-card"
                          : "agent-preview-card agent-preview-card-disabled"
                      }
                      shadows="hover"
                      headerLine={false}
                    >
                      <div className="agent-preview-card-content">
                        <h3>{child.name.trim() || `子 Agent ${index + 1}`}</h3>
                        <p title={child.description}>
                          {child.description.trim() || "暂无 Description"}
                        </p>
                      </div>
                    </Card>
                  </div>
                );
              })
            : null}
        </div>
      </section>

      <Modal
        className="ai-provider-modal agent-settings-modal"
        footer={null}
        maskClosable={!saving}
        onCancel={handleCloseAgentEditor}
        title={agentEditorTitle}
        visible={agentEditorVisible}
        width={900}
      >
        {editingAgentTarget?.kind === "supervisor" ? (
          <form
            className="ai-provider-form"
            onSubmit={function handleSupervisorEditorSubmit(event) {
              event.preventDefault();
              handleCloseAgentEditor();
            }}
          >
            <div className="agent-settings-modal-body">
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
                {form.toolRegistry.map(function renderSupervisorToolToggle(
                  toolConfig,
                ) {
                  return (
                    <label
                      className="agent-settings-tool-toggle"
                      key={toolConfig.name}
                    >
                      <input
                        type="checkbox"
                        checked={form.supervisor.toolNames.includes(
                          toolConfig.name,
                        )}
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
                <label className="ai-provider-field">
                  <span>模型提供商</span>
                  <select
                    value={form.supervisor.providerId}
                    disabled={loading || saving || modelProviders.length === 0}
                    onChange={handleSupervisorModelProviderChange}
                  >
                    <option value="">选择提供商</option>
                    {modelProviders.map(function renderAgentProviderOption(
                      provider,
                    ) {
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
                        : "选择模型"}
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
                <label className="ai-provider-field">
                  <span>Reasoning Effort</span>
                  <select
                    value={form.supervisor.reasoningEffort}
                    disabled={loading || saving}
                    onChange={handleSupervisorReasoningEffortChange}
                  >
                    {agentReasoningEffortOptions.map(renderReasoningEffortOption)}
                  </select>
                </label>
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
            </div>
            <div className="ai-provider-form-actions">
              <button
                type="button"
                className="settings-secondary-button"
                disabled={saving}
                onClick={handleCloseAgentEditor}
              >
                关闭
              </button>
            </div>
          </form>
        ) : null}

        {editingAgentTarget?.kind === "child" && editingChild ? (
          <form
            className="ai-provider-form"
            onSubmit={function handleChildEditorSubmit(event) {
              event.preventDefault();
              handleCloseAgentEditor();
            }}
          >
            <div className="agent-settings-modal-body">
              <div className="agent-child-card-actions agent-settings-modal-toolbar">
                <label className="agent-settings-inline-toggle">
                  <input
                    type="checkbox"
                    checked={editingChild.enabled}
                    disabled={saving}
                    onChange={function handleChildEnabledToggle(event) {
                      handleChildEnabledChange(
                        editingChildIndex,
                        event.target.checked,
                      );
                    }}
                  />
                  <span>启用</span>
                </label>
                <div className="agent-settings-inline-toggle">
                  <Switch
                    checked={editingChild.shareChatHistory}
                    disabled={saving}
                    aria-label="共享历史"
                    onChange={function handleChildShareChatHistoryToggle(checked) {
                      handleChildShareChatHistoryChange(
                        editingChildIndex,
                        checked,
                      );
                    }}
                  />
                  <span>共享历史</span>
                </div>
                <button
                  type="button"
                  className="settings-secondary-button"
                  disabled={saving || editingChildIndex === 0}
                  onClick={function handleMoveChildUpClick() {
                    handleMoveChildClick(editingChildIndex, -1);
                  }}
                >
                  上移
                </button>
                <button
                  type="button"
                  className="settings-secondary-button"
                  disabled={
                    saving || editingChildIndex === form.children.length - 1
                  }
                  onClick={function handleMoveChildDownClick() {
                    handleMoveChildClick(editingChildIndex, 1);
                  }}
                >
                  下移
                </button>
                <button
                  type="button"
                  className="settings-secondary-button ai-provider-danger-button"
                  disabled={saving}
                  onClick={function handleRemoveAgentChildClick() {
                    handleRemoveChildClick(editingChildIndex);
                  }}
                >
                  删除
                </button>
              </div>

              <div className="agent-settings-grid">
                <label className="ai-provider-field">
                  <span>Name</span>
                  <input
                    value={editingChild.name}
                    disabled={saving}
                    onChange={function handleChildNameChange(event) {
                      handleChildInputChange(
                        editingChildIndex,
                        "name",
                        event.target.value,
                      );
                    }}
                  />
                </label>
                <label className="ai-provider-field">
                  <span>Task</span>
                  <input
                    value={editingChild.task}
                    disabled={saving}
                    onChange={function handleChildTaskChange(event) {
                      handleChildInputChange(
                        editingChildIndex,
                        "task",
                        event.target.value,
                      );
                    }}
                  />
                </label>
                <label className="ai-provider-field">
                  <span>最大迭代次数</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editingChild.maxIterations}
                    disabled={saving}
                    onChange={function handleChildMaxIterationsChange(event) {
                      handleChildInputChange(
                        editingChildIndex,
                        "maxIterations",
                        event.target.value,
                      );
                    }}
                  />
                </label>
                {form.toolRegistry.map(function renderChildToolToggle(toolConfig) {
                  return (
                    <label
                      className="agent-settings-tool-toggle"
                      key={toolConfig.name}
                    >
                      <input
                        type="checkbox"
                        checked={editingChild.toolNames.includes(toolConfig.name)}
                        disabled={saving}
                        onChange={function handleChildToolToggle(event) {
                          handleChildToolChange(
                            editingChildIndex,
                            toolConfig.name,
                            event.target.checked,
                          );
                        }}
                      />
                      <span title={toolConfig.description}>{toolConfig.name}</span>
                    </label>
                  );
                })}
                <label className="ai-provider-field">
                  <span>模型提供商</span>
                  <select
                    value={editingChild.providerId}
                    disabled={saving || modelProviders.length === 0}
                    onChange={function handleChildProviderSelect(event) {
                      handleChildModelProviderChange(
                        editingChildIndex,
                        event.target.value,
                      );
                    }}
                  >
                    <option value="">选择提供商</option>
                    {modelProviders.map(function renderChildProviderOption(
                      provider,
                    ) {
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
                    value={editingChild.model}
                    disabled={saving || !editingChild.providerId}
                    onFocus={function handleChildModelSelectFocus() {
                      handleAgentModelSelectFocus(editingChild.providerId);
                    }}
                    onChange={function handleChildModelSelect(event) {
                      handleChildModelChange(
                        editingChildIndex,
                        event.target.value,
                      );
                    }}
                  >
                    <option value="">
                      {modelLoadingByProvider[editingChild.providerId]
                        ? "正在加载模型..."
                        : "选择模型"}
                    </option>
                    {agentModelOptionsForProvider(
                      editingChild.providerId,
                      editingChild.model,
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
                <label className="ai-provider-field">
                  <span>Reasoning Effort</span>
                  <select
                    value={editingChild.reasoningEffort}
                    disabled={saving}
                    onChange={handleEditingChildReasoningEffortChange}
                  >
                    {agentReasoningEffortOptions.map(renderReasoningEffortOption)}
                  </select>
                </label>
                <label className="ai-provider-field ai-provider-field-wide">
                  <span>Description</span>
                  <input
                    value={editingChild.description}
                    disabled={saving}
                    onChange={function handleChildDescriptionChange(event) {
                      handleChildInputChange(
                        editingChildIndex,
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
                    value={editingChild.instruction}
                    disabled={saving}
                    spellCheck={false}
                    onChange={function handleChildInstructionChange(event) {
                      handleChildInputChange(
                        editingChildIndex,
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
                        parameterEditorRefs.current[editingChild.id] =
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
                      value={editingChild.parametersText}
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
            </div>
            <div className="ai-provider-form-actions">
              <button
                type="button"
                className="settings-secondary-button"
                disabled={saving}
                onClick={handleCloseAgentEditor}
              >
                关闭
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
      </article>
    </AgentSettingsContext>
  );
}
