import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import { fetchAgentConfig, fetchAIProviderModelsByProviderID, fetchAIProviders, updateAgentConfig, UnauthorizedError, type AgentConfigData, type AgentToolConfig, type AIProviderItem, type AIProviderModelItem } from "../api";
import { aiProviderDefaultPage } from "./settings-constants";
import { AgentSettingsContext } from "./agent-settings-context";
import { AgentSettingsEditorModal } from "./agent-settings-editor-modal";
import { AgentSettingsOverview } from "./agent-settings-overview";
import type { AgentChildFormState, AgentChildTextField, AgentParameterJsonViewerRef, AgentSettingsFormState, AgentSettingsPanelProps, EditingAgentTarget } from "./types";
import { agentConfigToFormState, buildAgentConfigFromForm, copyAgentToolConfig, createDefaultAgentChildFormState, createDefaultAgentSettingsFormState, defaultAgentModelOption, defaultModelForAgentProvider, formatTime, getErrorMessage, isAbortError, modelsWithDefaultAgentModel, toggleAgentToolName, validateAgentSettingsForm } from "./settings-utils";

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

  // bindChildParametersEditor 绑定子 Agent 参数 JSON 编辑器实例。
  // 参数 childID 表示子 Agent 前端稳定标识；参数 instance 表示 JsonViewer 暴露的实例。
  function bindChildParametersEditor(
    childID: string,
    instance: AgentParameterJsonViewerRef | null,
  ) {
    parameterEditorRefs.current[childID] = instance;
  }

  // markParameterEditorChanged 标记参数 JSON 编辑器内容发生变化，用于重新计算脏数据。
  function markParameterEditorChanged() {
    setParameterEditorRevision(function updateRevision(revision) {
      return revision + 1;
    });
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
          editingAgentTarget,
          editingChildIndex,
          editingChild,
          modelProviders,
          modelOptionsByProvider,
          modelLoadingByProvider,
        },
        actions: {
          reload: handleReloadAgentClick,
          save: handleSaveAgentClick,
          changeMemoryRecentRounds: handleMemoryRecentRoundsChange,
          changeRetryMaxRetries: handleRetryMaxRetriesChange,
          changeRetryBackoffMS: handleRetryBackoffMSChange,
          openAgentEditor: handleOpenAgentEditor,
          openAgentEditorWithKeyboard: handleAgentCardKeyDown,
          addChildAgent: handleAddChildClick,
          closeAgentEditor: handleCloseAgentEditor,
          changeSupervisorInput: handleSupervisorInputChange,
          changeSupervisorTool: handleSupervisorToolChange,
          changeSupervisorModelProvider: handleSupervisorModelProviderChange,
          changeSupervisorModel: handleSupervisorModelChange,
          changeSupervisorReasoningEffort: handleSupervisorReasoningEffortChange,
          changeChildEnabled: handleChildEnabledChange,
          changeChildShareChatHistory: handleChildShareChatHistoryChange,
          changeChildInput: handleChildInputChange,
          changeChildTool: handleChildToolChange,
          changeChildModelProvider: handleChildModelProviderChange,
          changeChildModel: handleChildModelChange,
          changeEditingChildReasoningEffort:
            handleEditingChildReasoningEffortChange,
          focusAgentModelSelect: handleAgentModelSelectFocus,
          moveChildAgent: handleMoveChildClick,
          removeChildAgent: handleRemoveChildClick,
          bindChildParametersEditor,
          markParameterEditorChanged,
        },
        meta: {
          errorMessage,
          configFile: agentData?.config_file || "",
          modifiedAtText,
          reloadedAtText,
          agentEditorVisible,
          agentEditorTitle,
        },
      };
    },
    [
      agentData?.config_file,
      agentEditorTitle,
      agentEditorVisible,
      dirty,
      editingAgentTarget,
      editingChild,
      editingChildIndex,
      errorMessage,
      form,
      loading,
      modelLoadingByProvider,
      modelOptionsByProvider,
      modelProviders,
      modifiedAtText,
      reloadedAtText,
      saving,
    ],
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

      <AgentSettingsOverview />
      <AgentSettingsEditorModal />
      </article>
    </AgentSettingsContext>
  );
}
