import JsonViewer from "@douyinfe/semi-ui-19/lib/es/jsonViewer";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Switch from "@douyinfe/semi-ui-19/lib/es/switch";
import {
  agentProviderTypeOptions,
  agentReasoningEffortOptions,
} from "./settings-constants";
import { useAgentSettingsContext } from "./agent-settings-context";
import type { AgentParameterJsonViewerRef } from "./types";
import {
  agentModelOptionsForProvider,
  agentProviderModelCacheKey,
  formatAgentModelOption,
  formatAgentProviderOption,
  renderReasoningEffortOption,
} from "./settings-utils";

// AgentSettingsEditorModal 渲染顶层 Agent 和子 Agent 的编辑弹窗。
export function AgentSettingsEditorModal() {
  const { state, actions, meta } = useAgentSettingsContext();

  return (
    <Modal
      className="ai-provider-modal agent-settings-modal"
      footer={null}
      maskClosable={!state.saving}
      onCancel={actions.closeAgentEditor}
      title={meta.agentEditorTitle}
      visible={meta.agentEditorVisible}
      width={900}
    >
      {state.editingAgentTarget?.kind === "supervisor" ? (
        <SupervisorAgentEditor />
      ) : null}
      {state.editingAgentTarget?.kind === "child" && state.editingChild ? (
        <ChildAgentEditor />
      ) : null}
    </Modal>
  );
}

// SupervisorAgentEditor 渲染顶层 Agent 的完整配置表单。
function SupervisorAgentEditor() {
  const { state, actions } = useAgentSettingsContext();

  return (
    <form
      className="ai-provider-form"
      onSubmit={function handleSupervisorEditorSubmit(event) {
        event.preventDefault();
        actions.closeAgentEditor();
      }}
    >
      <div className="agent-settings-modal-body">
        <div className="agent-settings-grid">
          <label className="ai-provider-field">
            <span>Name</span>
            <input
              name="name"
              value={state.form.supervisor.name}
              disabled={state.loading || state.saving}
              onChange={actions.changeSupervisorInput}
            />
          </label>
          <label className="ai-provider-field">
            <span>最大迭代次数</span>
            <input
              name="maxIterations"
              type="number"
              min="0"
              step="1"
              value={state.form.supervisor.maxIterations}
              disabled={state.loading || state.saving}
              onChange={actions.changeSupervisorInput}
            />
          </label>
          {state.form.toolRegistry.map(function renderSupervisorToolToggle(
            toolConfig,
          ) {
            return (
              <label
                className="agent-settings-tool-toggle"
                key={toolConfig.name}
              >
                <input
                  type="checkbox"
                  checked={state.form.supervisor.toolNames.includes(
                    toolConfig.name,
                  )}
                  disabled={state.loading || state.saving}
                  onChange={function handleSupervisorToolToggle(event) {
                    actions.changeSupervisorTool(
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
              value={state.form.supervisor.providerId}
              disabled={
                state.loading || state.saving || state.modelProviders.length === 0
              }
              onChange={actions.changeSupervisorModelProvider}
            >
              <option value="">选择提供商</option>
              {state.modelProviders.map(function renderAgentProviderOption(
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
            <span>API 协议</span>
            <select
              name="providerType"
              value={state.form.supervisor.providerType}
              disabled={state.loading || state.saving}
              onChange={actions.changeSupervisorProviderType}
            >
              {agentProviderTypeOptions.map(function renderProviderTypeOption(
                option,
              ) {
                return (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                );
              })}
            </select>
          </label>
          <label className="ai-provider-field">
            <span>模型</span>
            <select
              value={state.form.supervisor.model}
              disabled={
                state.loading ||
                state.saving ||
                !state.form.supervisor.providerId
              }
              onFocus={function handleSupervisorModelSelectFocus() {
                actions.focusAgentModelSelect(
                  state.form.supervisor.providerId,
                  state.form.supervisor.providerType,
                );
              }}
              onChange={actions.changeSupervisorModel}
            >
              <option value="">
                {state.modelLoadingByProvider[
                  agentProviderModelCacheKey(
                    state.form.supervisor.providerId,
                    state.form.supervisor.providerType,
                  )
                ]
                  ? "正在加载模型..."
                  : "选择模型"}
              </option>
              {agentModelOptionsForProvider(
                state.form.supervisor.providerId,
                state.form.supervisor.providerType,
                state.form.supervisor.model,
                state.modelProviders,
                state.modelOptionsByProvider,
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
              value={state.form.supervisor.reasoningEffort}
              disabled={state.loading || state.saving}
              onChange={actions.changeSupervisorReasoningEffort}
            >
              {agentReasoningEffortOptions.map(renderReasoningEffortOption)}
            </select>
          </label>
          <label className="ai-provider-field">
            <span>User-Agent</span>
            <input
              name="userAgent"
              value={state.form.supervisor.userAgent}
              disabled={
                state.loading ||
                state.saving ||
                !state.form.supervisor.providerId ||
                !state.form.supervisor.model
              }
              onChange={actions.changeSupervisorInput}
            />
          </label>
          <label className="ai-provider-field ai-provider-field-wide">
            <span>Description</span>
            <input
              name="description"
              value={state.form.supervisor.description}
              disabled={state.loading || state.saving}
              onChange={actions.changeSupervisorInput}
            />
          </label>
          <label className="ai-provider-field ai-provider-field-wide">
            <span>Instruction</span>
            <textarea
              name="instruction"
              className="agent-settings-textarea agent-settings-instruction"
              value={state.form.supervisor.instruction}
              disabled={state.loading || state.saving}
              spellCheck={false}
              onChange={actions.changeSupervisorInput}
            />
          </label>
        </div>
      </div>
      <EditorCloseActions />
    </form>
  );
}

// ChildAgentEditor 渲染当前子 Agent 的完整配置表单。
function ChildAgentEditor() {
  const { state, actions } = useAgentSettingsContext();
  const editingChild = state.editingChild;
  if (!editingChild) {
    return null;
  }

  return (
    <form
      className="ai-provider-form"
      onSubmit={function handleChildEditorSubmit(event) {
        event.preventDefault();
        actions.closeAgentEditor();
      }}
    >
      <div className="agent-settings-modal-body">
        <ChildAgentEditorToolbar />

        <div className="agent-settings-grid">
          <label className="ai-provider-field">
            <span>Name</span>
            <input
              value={editingChild.name}
              disabled={state.saving}
              onChange={function handleChildNameChange(event) {
                actions.changeChildInput(
                  state.editingChildIndex,
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
              disabled={state.saving}
              onChange={function handleChildTaskChange(event) {
                actions.changeChildInput(
                  state.editingChildIndex,
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
              disabled={state.saving}
              onChange={function handleChildMaxIterationsChange(event) {
                actions.changeChildInput(
                  state.editingChildIndex,
                  "maxIterations",
                  event.target.value,
                );
              }}
            />
          </label>
          {state.form.toolRegistry.map(function renderChildToolToggle(
            toolConfig,
          ) {
            return (
              <label
                className="agent-settings-tool-toggle"
                key={toolConfig.name}
              >
                <input
                  type="checkbox"
                  checked={editingChild.toolNames.includes(toolConfig.name)}
                  disabled={state.saving}
                  onChange={function handleChildToolToggle(event) {
                    actions.changeChildTool(
                      state.editingChildIndex,
                      toolConfig.name,
                      event.target.checked,
                    );
                  }}
                />
                <span title={toolConfig.description}>{toolConfig.name}</span>
              </label>
            );
          })}
          <ChildAgentModelFields />
          <label className="ai-provider-field">
            <span>Reasoning Effort</span>
            <select
              value={editingChild.reasoningEffort}
              disabled={state.saving}
              onChange={actions.changeEditingChildReasoningEffort}
            >
              {agentReasoningEffortOptions.map(renderReasoningEffortOption)}
            </select>
          </label>
          <label className="ai-provider-field ai-provider-field-wide">
            <span>Description</span>
            <input
              value={editingChild.description}
              disabled={state.saving}
              onChange={function handleChildDescriptionChange(event) {
                actions.changeChildInput(
                  state.editingChildIndex,
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
              disabled={state.saving}
              spellCheck={false}
              onChange={function handleChildInstructionChange(event) {
                actions.changeChildInput(
                  state.editingChildIndex,
                  "instruction",
                  event.target.value,
                );
              }}
            />
          </label>
          <ChildAgentParametersEditor />
        </div>
      </div>
      <EditorCloseActions />
    </form>
  );
}

// ChildAgentEditorToolbar 渲染子 Agent 弹窗顶部操作条。
function ChildAgentEditorToolbar() {
  const { state, actions } = useAgentSettingsContext();
  const editingChild = state.editingChild;
  if (!editingChild) {
    return null;
  }

  return (
    <div className="agent-child-card-actions agent-settings-modal-toolbar">
      <label className="agent-settings-inline-toggle">
        <input
          type="checkbox"
          checked={editingChild.enabled}
          disabled={state.saving}
          onChange={function handleChildEnabledToggle(event) {
            actions.changeChildEnabled(
              state.editingChildIndex,
              event.target.checked,
            );
          }}
        />
        <span>启用</span>
      </label>
      <div className="agent-settings-inline-toggle">
        <Switch
          checked={editingChild.shareChatHistory}
          disabled={state.saving}
          aria-label="共享历史"
          onChange={function handleChildShareChatHistoryToggle(checked) {
            actions.changeChildShareChatHistory(
              state.editingChildIndex,
              checked,
            );
          }}
        />
        <span>共享历史</span>
      </div>
      <button
        type="button"
        className="settings-secondary-button"
        disabled={state.saving || state.editingChildIndex === 0}
        onClick={function handleMoveChildUpClick() {
          actions.moveChildAgent(state.editingChildIndex, -1);
        }}
      >
        上移
      </button>
      <button
        type="button"
        className="settings-secondary-button"
        disabled={
          state.saving ||
          state.editingChildIndex === state.form.children.length - 1
        }
        onClick={function handleMoveChildDownClick() {
          actions.moveChildAgent(state.editingChildIndex, 1);
        }}
      >
        下移
      </button>
      <button
        type="button"
        className="settings-secondary-button ai-provider-danger-button"
        disabled={state.saving}
        onClick={function handleRemoveAgentChildClick() {
          actions.removeChildAgent(state.editingChildIndex);
        }}
      >
        删除
      </button>
    </div>
  );
}

// ChildAgentModelFields 渲染子 Agent 的模型提供商和模型选择字段。
function ChildAgentModelFields() {
  const { state, actions } = useAgentSettingsContext();
  const editingChild = state.editingChild;
  if (!editingChild) {
    return null;
  }

  return (
    <>
      <label className="ai-provider-field">
        <span>模型提供商</span>
        <select
          value={editingChild.providerId}
          disabled={state.saving || state.modelProviders.length === 0}
          onChange={function handleChildProviderSelect(event) {
            actions.changeChildModelProvider(
              state.editingChildIndex,
              event.target.value,
            );
          }}
        >
          <option value="">选择提供商</option>
          {state.modelProviders.map(function renderChildProviderOption(provider) {
            return (
              <option key={provider.id} value={String(provider.id)}>
                {formatAgentProviderOption(provider)}
              </option>
            );
          })}
        </select>
      </label>
      <label className="ai-provider-field">
        <span>API 协议</span>
        <select
          value={editingChild.providerType}
          disabled={state.saving}
          onChange={function handleChildProviderTypeSelect(event) {
            actions.changeChildProviderType(
              state.editingChildIndex,
              event.target.value,
            );
          }}
        >
          {agentProviderTypeOptions.map(function renderProviderTypeOption(
            option,
          ) {
            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          })}
        </select>
      </label>
      <label className="ai-provider-field">
        <span>模型</span>
        <select
          value={editingChild.model}
          disabled={state.saving || !editingChild.providerId}
          onFocus={function handleChildModelSelectFocus() {
            actions.focusAgentModelSelect(
              editingChild.providerId,
              editingChild.providerType,
            );
          }}
          onChange={function handleChildModelSelect(event) {
            actions.changeChildModel(
              state.editingChildIndex,
              event.target.value,
            );
          }}
        >
          <option value="">
            {state.modelLoadingByProvider[
              agentProviderModelCacheKey(
                editingChild.providerId,
                editingChild.providerType,
              )
            ]
              ? "正在加载模型..."
              : "选择模型"}
          </option>
          {agentModelOptionsForProvider(
            editingChild.providerId,
            editingChild.providerType,
            editingChild.model,
            state.modelProviders,
            state.modelOptionsByProvider,
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
        <span>User-Agent</span>
        <input
          value={editingChild.userAgent}
          disabled={state.saving || !editingChild.providerId || !editingChild.model}
          onChange={function handleChildUserAgentChange(event) {
            actions.changeChildInput(
              state.editingChildIndex,
              "userAgent",
              event.target.value,
            );
          }}
        />
      </label>
    </>
  );
}

// ChildAgentParametersEditor 渲染子 Agent 参数 JSON 编辑器。
function ChildAgentParametersEditor() {
  const { state, actions } = useAgentSettingsContext();
  const editingChild = state.editingChild;
  if (!editingChild) {
    return null;
  }

  return (
    <div className="ai-provider-field ai-provider-field-wide agent-settings-json-field">
      <span>Parameters JSON</span>
      <div className="agent-settings-json-viewer-wrap">
        <JsonViewer
          ref={function bindChildParametersJsonViewer(instance) {
            actions.bindChildParametersEditor(
              editingChild.id,
              instance as AgentParameterJsonViewerRef | null,
            );
          }}
          className="agent-settings-json-viewer"
          height={220}
          width="100%"
          showSearch={true}
          options={{
            autoWrap: true,
            lineHeight: 20,
            readOnly: state.saving,
            formatOptions: {
              tabSize: 2,
              insertSpaces: true,
              eol: "\n",
            },
          }}
          value={editingChild.parametersText}
          onChange={actions.markParameterEditorChanged}
        />
      </div>
    </div>
  );
}

// EditorCloseActions 渲染 Agent 编辑弹窗底部关闭按钮。
function EditorCloseActions() {
  const { state, actions } = useAgentSettingsContext();

  return (
    <div className="ai-provider-form-actions">
      <button
        type="button"
        className="settings-secondary-button"
        disabled={state.saving}
        onClick={actions.closeAgentEditor}
      >
        关闭
      </button>
    </div>
  );
}
