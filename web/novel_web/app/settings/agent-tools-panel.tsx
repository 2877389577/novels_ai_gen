import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import Card from "@douyinfe/semi-ui-19/lib/es/card";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Switch from "@douyinfe/semi-ui-19/lib/es/switch";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import { fetchAgentConfig, updateAgentConfig, UnauthorizedError, type AgentConfigData, type AgentToolConfig } from "../api";
import type { AgentToolsSettingsPanelProps } from "./types";
import { copyAgentToolConfig, formatTime, getErrorMessage, isAbortError, normalizeAgentToolRegistryForSave } from "./settings-utils";

export function AgentToolsSettingsPanel(props: AgentToolsSettingsPanelProps) {
  const [agentData, setAgentData] = useState<AgentConfigData | null>(null);
  const [toolRegistry, setToolRegistry] = useState<AgentToolConfig[]>([]);
  const [savedToolRegistry, setSavedToolRegistry] = useState<AgentToolConfig[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [editingToolName, setEditingToolName] = useState<string | null>(null);

  const dirty = useMemo(
    function calculateAgentToolsDirty() {
      return JSON.stringify(toolRegistry) !== JSON.stringify(savedToolRegistry);
    },
    [savedToolRegistry, toolRegistry],
  );
  const editingToolConfig =
    editingToolName === null
      ? null
      : toolRegistry.find(function findEditingTool(toolConfig) {
          return toolConfig.name === editingToolName;
        }) ?? null;

  const loadAgentToolsConfig = useCallback(
    // loadAgentToolsConfig 读取后端结构化智能体配置中的普通工具注册表。
    // 参数 signal 表示用于取消请求的浏览器 AbortSignal；参数 showSuccess 表示重新加载成功时是否展示提示。
    async function loadAgentToolsConfig(
      signal?: AbortSignal,
      showSuccess = false,
    ) {
      setLoading(true);
      setErrorMessage("");

      try {
        const data = await fetchAgentConfig(signal);
        const nextTools = (data.agent.tools ?? []).map(copyAgentToolConfig);
        setAgentData(data);
        setToolRegistry(nextTools);
        setSavedToolRegistry(nextTools);
        setEditingToolName(null);
        if (showSuccess) {
          Toast.success("智能体工具已重新加载");
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        const message = getErrorMessage(error, "智能体工具加载失败，请稍后再试");
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
    function loadAgentToolsOnMount() {
      const controller = new AbortController();
      void loadAgentToolsConfig(controller.signal);

      // cancelAgentToolsLoad 取消卸载中的智能体工具配置加载请求。
      return function cancelAgentToolsLoad() {
        controller.abort();
      };
    },
    [loadAgentToolsConfig],
  );

  // handleOpenToolEditor 打开指定工具描述编辑弹窗。
  // 参数 toolName 表示需要编辑的工具固定名称。
  function handleOpenToolEditor(toolName: string) {
    setEditingToolName(toolName);
  }

  // handleToolCardKeyDown 处理工具卡片键盘打开编辑弹窗。
  // 参数 event 表示卡片键盘事件；参数 toolName 表示需要编辑的工具固定名称。
  function handleToolCardKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    toolName: string,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    handleOpenToolEditor(toolName);
  }

  // handleToolEditorClose 关闭当前工具描述编辑弹窗。
  function handleToolEditorClose() {
    setEditingToolName(null);
  }

  // handleToolDescriptionChange 处理工具完整描述输入变化。
  // 参数 event 表示工具描述文本域输入事件。
  function handleToolDescriptionChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const toolName = editingToolName;
    if (!toolName) {
      return;
    }
    const description = event.target.value;
    setToolRegistry(function updateToolRegistry(current) {
      return current.map(function updateToolDescription(toolConfig) {
        return toolConfig.name === toolName
          ? { ...toolConfig, description }
          : toolConfig;
      });
    });
  }

  // handleToolRequireApprovalChange 切换当前工具执行前是否需要人工审核。
  // 参数 checked 表示 Semi Switch 返回的开关状态。
  function handleToolRequireApprovalChange(checked: boolean) {
    const toolName = editingToolName;
    if (!toolName) {
      return;
    }
    setToolRegistry(function updateToolRegistry(current) {
      return current.map(function updateToolApproval(toolConfig) {
        return toolConfig.name === toolName
          ? { ...toolConfig, require_approval: checked }
          : toolConfig;
      });
    });
  }

  // handleReloadAgentToolsClick 处理重新加载智能体工具配置按钮点击。
  function handleReloadAgentToolsClick() {
    if (!dirty) {
      void loadAgentToolsConfig(undefined, true);
      return;
    }

    Modal.confirm({
      title: "重新加载智能体工具",
      content: "当前未保存的工具描述修改会被磁盘上的配置覆盖。",
      okText: "重新加载",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmAgentToolsReload() {
        void loadAgentToolsConfig(undefined, true);
      },
    });
  }

  // handleSaveAgentToolsClick 处理保存智能体工具配置按钮点击。
  function handleSaveAgentToolsClick() {
    if (!dirty) {
      Toast.info("智能体工具配置没有变化");
      return;
    }

    const validation = normalizeAgentToolRegistryForSave(toolRegistry);
    if (validation.error) {
      setErrorMessage(validation.error);
      Toast.error(validation.error);
      return;
    }

    Modal.confirm({
      title: "保存智能体工具",
      content: "保存后会写入后端启动配置文件，并立即用于后续 AI Agent 请求。",
      okText: "保存",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmAgentToolsSave() {
        void saveAgentToolsConfig(toolRegistry);
      },
    });
  }

  // saveAgentToolsConfig 保存普通工具注册表，并保留最新智能体主体配置。
  // 参数 sourceTools 表示需要写入 ai.agent.tools 的工具注册表。
  async function saveAgentToolsConfig(sourceTools: AgentToolConfig[]) {
    const normalized = normalizeAgentToolRegistryForSave(sourceTools);
    if (normalized.error || !normalized.value) {
      const message = normalized.error || "智能体工具配置不完整";
      setErrorMessage(message);
      Toast.error(message);
      return;
    }

    setSaving(true);
    setErrorMessage("");

    try {
      const latestData = await fetchAgentConfig();
      const data = await updateAgentConfig({
        agent: {
          ...latestData.agent,
          tools: normalized.value,
        },
      });
      const nextTools = (data.agent.tools ?? []).map(copyAgentToolConfig);
      setAgentData(data);
      setToolRegistry(nextTools);
      setSavedToolRegistry(nextTools);
      setEditingToolName(null);
      Toast.success("智能体工具已保存");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      const message = getErrorMessage(error, "智能体工具保存失败，请稍后再试");
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
      aria-labelledby="settings-agent-tools-title"
    >
      <div className="settings-corner settings-corner-left-top" />
      <div className="settings-corner settings-corner-right-top" />
      <div className="settings-corner settings-corner-left-bottom" />
      <div className="settings-corner settings-corner-right-bottom" />

      <div className="settings-editor-heading">
        <div>
          <p className="settings-kicker">Agent Tools</p>
          <h1 id="settings-agent-tools-title">智能体工具</h1>
        </div>
        <div className="settings-editor-actions">
          <button
            type="button"
            className="settings-secondary-button"
            disabled={loading || saving}
            onClick={handleReloadAgentToolsClick}
          >
            重新加载
          </button>
          <button
            type="button"
            className="settings-primary-button"
            disabled={loading || saving || !dirty}
            onClick={handleSaveAgentToolsClick}
          >
            {saving ? "保存中..." : "保存工具"}
          </button>
        </div>
      </div>

      <div className="settings-file-meta" aria-label="智能体工具配置文件状态">
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

      <section
        className="agent-settings-section"
        aria-labelledby="agent-tools-list-title"
      >
        <div className="ai-provider-section-heading">
          <div>
            <h2 id="agent-tools-list-title">工具列表</h2>
          </div>
        </div>
        <div className="agent-card-grid">
          {loading ? (
            <p className="ai-provider-empty">正在加载智能体工具...</p>
          ) : null}
          {!loading && toolRegistry.length === 0 ? (
            <p className="ai-provider-empty">当前配置中还没有可用工具。</p>
          ) : null}
          {!loading
            ? toolRegistry.map(function renderAgentToolCard(toolConfig) {
                const description = toolConfig.description.trim() || "暂无描述";
                const approvalText = toolConfig.require_approval
                  ? "需要审核"
                  : "直接执行";
                return (
                  <div
                    className="agent-card-shell"
                    key={toolConfig.name}
                    role="button"
                    tabIndex={0}
                    aria-label={`编辑工具 ${toolConfig.name}`}
                    onClick={function handleToolCardClick() {
                      handleOpenToolEditor(toolConfig.name);
                    }}
                    onKeyDown={function handleToolCardKeyboard(event) {
                      handleToolCardKeyDown(event, toolConfig.name);
                    }}
                  >
                    <Card
                      className="agent-preview-card agent-tool-preview-card"
                      shadows="hover"
                      headerLine={false}
                    >
                      <div className="agent-preview-card-content">
                        <h3>{toolConfig.name}</h3>
                        <span className="agent-tool-approval-badge">
                          {approvalText}
                        </span>
                        <p title={description}>{description}</p>
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
        onCancel={handleToolEditorClose}
        title={editingToolConfig ? `编辑工具：${editingToolConfig.name}` : "编辑工具"}
        visible={editingToolConfig !== null}
        width={760}
      >
        {editingToolConfig ? (
          <form
            className="ai-provider-form"
            onSubmit={function handleToolEditorSubmit(event) {
              event.preventDefault();
              handleToolEditorClose();
            }}
          >
            <div className="agent-settings-modal-body">
              <label className="ai-provider-field ai-provider-field-wide">
                <span>工具名称</span>
                <input value={editingToolConfig.name} disabled />
              </label>
              <label className="ai-provider-field ai-provider-field-wide">
                <span>Description</span>
                <textarea
                  className="agent-settings-textarea agent-settings-tool-description"
                  value={editingToolConfig.description}
                  disabled={saving}
                  spellCheck={false}
                  onChange={handleToolDescriptionChange}
                />
              </label>
              <div className="agent-tool-approval-field">
                <div>
                  <span>人工审核</span>
                  <p>
                    {editingToolConfig.require_approval
                      ? "执行前会等待用户批准"
                      : "模型调用时直接执行"}
                  </p>
                </div>
                <Switch
                  aria-label="切换工具人工审核"
                  checked={editingToolConfig.require_approval === true}
                  disabled={saving}
                  onChange={handleToolRequireApprovalChange}
                />
              </div>
            </div>
            <div className="ai-provider-form-actions">
              <button
                type="button"
                className="settings-secondary-button"
                disabled={saving}
                onClick={handleToolEditorClose}
              >
                关闭
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </article>
  );
}
