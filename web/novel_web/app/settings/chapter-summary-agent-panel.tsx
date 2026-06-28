import type { ChangeEvent } from "react";
import type { ChapterSummaryAgentSettingsPanelProps } from "./types";
import { agentReasoningEffortOptions } from "./settings-constants";
import {
  formatAgentModelOption,
  formatAgentProviderOption,
  renderReasoningEffortOption,
} from "./settings-utils";
import {
  ChapterSummaryAgentSettingsProvider,
  useChapterSummaryAgentSettings,
  type ChapterSummaryAgentTextField,
} from "./chapter-summary-agent-context";

// ChapterSummaryAgentSettingsPanel 渲染章节概要 Agent 独立设置面板。
// 参数 props 表示章节概要 Agent 面板需要的外部回调。
export function ChapterSummaryAgentSettingsPanel(
  props: ChapterSummaryAgentSettingsPanelProps,
) {
  return (
    <ChapterSummaryAgentSettingsProvider onUnauthorized={props.onUnauthorized}>
      <ChapterSummaryAgentSettingsFrame />
    </ChapterSummaryAgentSettingsProvider>
  );
}

// ChapterSummaryAgentSettingsFrame 渲染章节概要 Agent 设置面板外壳。
function ChapterSummaryAgentSettingsFrame() {
  const { state, actions, meta } = useChapterSummaryAgentSettings();

  return (
    <article
      className="settings-panel agent-settings-panel"
      aria-labelledby="settings-chapter-summary-agent-title"
    >
      <div className="settings-corner settings-corner-left-top" />
      <div className="settings-corner settings-corner-right-top" />
      <div className="settings-corner settings-corner-left-bottom" />
      <div className="settings-corner settings-corner-right-bottom" />

      <div className="settings-editor-heading">
        <div>
          <p className="settings-kicker">Chapter Summary Agent</p>
          <h1 id="settings-chapter-summary-agent-title">章节概要 Agent</h1>
          <p>
            后台自动为新建或更新后的章节生成概要，并覆盖章节 summary 字段。
          </p>
        </div>
        <div className="settings-editor-actions">
          <button
            type="button"
            className="settings-secondary-button"
            onClick={actions.reload}
            disabled={state.loading || state.saving}
          >
            重载
          </button>
          <button
            type="button"
            className="settings-primary-button"
            onClick={actions.save}
            disabled={state.loading || state.saving || !state.dirty}
          >
            {state.saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      <div className="settings-file-meta">
        <span>配置文件：{meta.configFile || "未知"}</span>
        <span>修改时间：{meta.modifiedAtText}</span>
        <span>加载时间：{meta.reloadedAtText}</span>
      </div>

      {meta.errorMessage ? (
        <p className="settings-error-message">{meta.errorMessage}</p>
      ) : null}
      {state.loading ? (
        <p className="settings-editor-note">正在加载章节概要 Agent 配置...</p>
      ) : (
        <ChapterSummaryAgentForm />
      )}
    </article>
  );
}

// ChapterSummaryAgentForm 渲染章节概要 Agent 表单内容。
function ChapterSummaryAgentForm() {
  return (
    <div className="agent-settings-section">
      <ChapterSummaryAgentBasicSection />
      <ChapterSummaryAgentModelSection />
      <ChapterSummaryAgentRetrySection />
      <ChapterSummaryAgentInstructionSection />
    </div>
  );
}

// ChapterSummaryAgentBasicSection 渲染章节概要 Agent 基础配置。
function ChapterSummaryAgentBasicSection() {
  const { state, actions } = useChapterSummaryAgentSettings();

  // handleEnabledChange 处理启用状态切换。
  function handleEnabledChange(event: ChangeEvent<HTMLInputElement>) {
    actions.changeEnabled(event.target.checked);
  }

  return (
    <section className="agent-settings-section" aria-labelledby="chapter-summary-basic-title">
      <div className="ai-provider-form-heading">
        <div>
          <p className="settings-kicker">Basic</p>
          <h2 id="chapter-summary-basic-title">基础配置</h2>
        </div>
        <label className="ai-provider-toggle-field">
          <input
            type="checkbox"
            checked={state.form.enabled}
            onChange={handleEnabledChange}
          />
          <span>启用后台生成</span>
        </label>
      </div>
      <div className="agent-settings-grid">
        <ChapterSummaryAgentTextInput field="name" label="Agent 名称" />
        <ChapterSummaryAgentTextInput field="description" label="能力描述" />
        <ChapterSummaryAgentTextInput field="maxIterations" label="最大迭代次数" />
      </div>
    </section>
  );
}

// ChapterSummaryAgentModelSection 渲染章节概要 Agent 模型配置。
function ChapterSummaryAgentModelSection() {
  const { state, actions } = useChapterSummaryAgentSettings();

  // handleProviderChange 处理模型提供商切换。
  function handleProviderChange(event: ChangeEvent<HTMLSelectElement>) {
    actions.changeProvider(event.target.value);
  }

  // handleModelChange 处理模型选择切换。
  function handleModelChange(event: ChangeEvent<HTMLSelectElement>) {
    actions.changeModel(event.target.value);
  }

  // handleReasoningEffortChange 处理推理强度切换。
  function handleReasoningEffortChange(event: ChangeEvent<HTMLSelectElement>) {
    actions.changeReasoningEffort(event.target.value);
  }

  // handleUserAgentChange 处理自定义 User-Agent 输入。
  function handleUserAgentChange(event: ChangeEvent<HTMLInputElement>) {
    actions.changeTextField("userAgent", event.target.value);
  }

  return (
    <section className="agent-settings-section" aria-labelledby="chapter-summary-model-title">
      <div className="ai-provider-form-heading">
        <div>
          <p className="settings-kicker">Model</p>
          <h2 id="chapter-summary-model-title">模型配置</h2>
        </div>
      </div>
      <div className="agent-settings-grid">
        <label className="ai-provider-field">
          <span>模型提供商</span>
          <select value={state.form.providerId} onChange={handleProviderChange}>
            <option value="">请选择提供商</option>
            {state.providers.map(function renderProvider(provider) {
              return (
                <option key={provider.id} value={provider.id}>
                  {formatAgentProviderOption(provider)}
                </option>
              );
            })}
          </select>
        </label>
        <label className="ai-provider-field">
          <span>模型</span>
          <select
            value={state.form.model}
            onChange={handleModelChange}
            onFocus={actions.focusModelSelect}
            disabled={!state.form.providerId}
          >
            <option value="">
              {state.modelLoading ? "模型加载中..." : "请选择模型"}
            </option>
            {state.modelOptions.map(function renderModel(model) {
              return (
                <option key={model.id} value={model.id}>
                  {formatAgentModelOption(model)}
                </option>
              );
            })}
          </select>
        </label>
        <label className="ai-provider-field">
          <span>推理强度</span>
          <select
            value={state.form.reasoningEffort}
            onChange={handleReasoningEffortChange}
          >
            {agentReasoningEffortOptions.map(renderReasoningEffortOption)}
          </select>
        </label>
        <label className="ai-provider-field">
          <span>User-Agent</span>
          <input
            type="text"
            value={state.form.userAgent}
            disabled={!state.form.providerId || !state.form.model}
            onChange={handleUserAgentChange}
          />
        </label>
      </div>
    </section>
  );
}

// ChapterSummaryAgentRetrySection 渲染章节概要 Agent 重试配置。
function ChapterSummaryAgentRetrySection() {
  return (
    <section className="agent-settings-section" aria-labelledby="chapter-summary-retry-title">
      <div className="ai-provider-form-heading">
        <div>
          <p className="settings-kicker">Retry</p>
          <h2 id="chapter-summary-retry-title">失败重试</h2>
        </div>
      </div>
      <div className="agent-settings-grid">
        <ChapterSummaryAgentTextInput
          field="retryMaxRetries"
          label="最大重试次数"
        />
        <ChapterSummaryAgentTextInput
          field="retryBackoffMS"
          label="重试间隔毫秒"
        />
      </div>
    </section>
  );
}

// ChapterSummaryAgentInstructionSection 渲染章节概要 Agent 系统提示词配置。
function ChapterSummaryAgentInstructionSection() {
  const { state, actions } = useChapterSummaryAgentSettings();

  // handleInstructionChange 处理系统提示词编辑。
  function handleInstructionChange(event: ChangeEvent<HTMLTextAreaElement>) {
    actions.changeTextField("instruction", event.target.value);
  }

  return (
    <section className="agent-settings-section" aria-labelledby="chapter-summary-instruction-title">
      <div className="ai-provider-form-heading">
        <div>
          <p className="settings-kicker">Instruction</p>
          <h2 id="chapter-summary-instruction-title">系统提示词</h2>
        </div>
      </div>
      <label className="ai-provider-field ai-provider-field-wide">
        <span>提示词内容</span>
        <textarea
          className="agent-settings-textarea agent-settings-instruction"
          value={state.form.instruction}
          onChange={handleInstructionChange}
          rows={18}
        />
      </label>
    </section>
  );
}

// ChapterSummaryAgentTextInput 渲染章节概要 Agent 普通文本输入框。
// 参数 props 表示文本输入对应的字段名和展示标签。
function ChapterSummaryAgentTextInput(props: {
  // field 表示需要编辑的章节概要 Agent 表单字段。
  field: ChapterSummaryAgentTextField;
  // label 表示输入框标签。
  label: string;
}) {
  const { state, actions } = useChapterSummaryAgentSettings();

  // handleChange 处理文本输入变更。
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    actions.changeTextField(props.field, event.target.value);
  }

  return (
    <label className="ai-provider-field">
      <span>{props.label}</span>
      <input
        type="text"
        value={state.form[props.field]}
        onChange={handleChange}
      />
    </label>
  );
}
