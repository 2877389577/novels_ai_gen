import Card from "@douyinfe/semi-ui-19/lib/es/card";
import { useAgentSettingsContext } from "./agent-settings-context";

// AgentSettingsOverview 渲染智能体设置页弹窗外的概览区域。
export function AgentSettingsOverview() {
  return (
    <>
      <AgentSettingsHeading />
      <AgentSettingsConfigMeta />
      <AgentSettingsMemoryRetrySection />
      <AgentSettingsSupervisorPreview />
      <AgentSettingsChildrenPreview />
    </>
  );
}

// AgentSettingsHeading 渲染智能体设置标题和保存操作区。
function AgentSettingsHeading() {
  const { state, actions } = useAgentSettingsContext();

  return (
    <div className="settings-editor-heading">
      <div>
        <p className="settings-kicker">Agents</p>
        <h1 id="settings-agent-title">智能体设置</h1>
      </div>
      <div className="settings-editor-actions">
        <button
          type="button"
          className="settings-secondary-button"
          disabled={state.loading || state.saving}
          onClick={actions.reload}
        >
          重新加载
        </button>
        <button
          type="button"
          className="settings-primary-button"
          disabled={state.loading || state.saving || !state.dirty}
          onClick={actions.save}
        >
          {state.saving ? "保存中..." : "保存配置"}
        </button>
      </div>
    </div>
  );
}

// AgentSettingsConfigMeta 渲染智能体配置文件状态信息。
function AgentSettingsConfigMeta() {
  const { meta } = useAgentSettingsContext();

  return (
    <>
      <div className="settings-file-meta" aria-label="智能体配置文件状态">
        <span title={meta.configFile}>文件：{meta.configFile || "加载中..."}</span>
        <span>修改：{meta.modifiedAtText}</span>
        <span>加载：{meta.reloadedAtText}</span>
      </div>

      {meta.errorMessage ? (
        <p className="settings-error-message" role="alert">
          {meta.errorMessage}
        </p>
      ) : null}
    </>
  );
}

// AgentSettingsMemoryRetrySection 渲染记忆和模型重试配置输入区。
function AgentSettingsMemoryRetrySection() {
  const { state, actions } = useAgentSettingsContext();

  return (
    <section className="agent-settings-section" aria-labelledby="agent-memory-title">
      <div className="ai-provider-section-heading">
        <div>
          <h2 id="agent-memory-title">记忆与重试</h2>
        </div>
      </div>
      <div className="agent-settings-grid">
        <label className="ai-provider-field">
          <span>最近对话轮数（兼容）</span>
          <input
            type="number"
            min="0"
            step="1"
            value={state.form.memoryRecentRounds}
            disabled={state.loading || state.saving}
            onChange={actions.changeMemoryRecentRounds}
          />
        </label>
        <label className="ai-provider-field">
          <span>上下文压缩 Token 阈值</span>
          <input
            type="number"
            min="0"
            step="1"
            value={state.form.memoryContextTokens}
            disabled={state.loading || state.saving}
            onChange={actions.changeMemoryContextTokens}
          />
        </label>
        <label className="ai-provider-field">
          <span>原文历史 Token 预算</span>
          <input
            type="number"
            min="0"
            step="1"
            value={state.form.memoryRawHistoryTokens}
            disabled={state.loading || state.saving}
            onChange={actions.changeMemoryRawHistoryTokens}
          />
        </label>
        <label className="ai-provider-field">
          <span>模型失败最大重试次数</span>
          <input
            type="number"
            min="0"
            step="1"
            value={state.form.retryMaxRetries}
            disabled={state.loading || state.saving}
            onChange={actions.changeRetryMaxRetries}
          />
        </label>
        <label className="ai-provider-field">
          <span>重试间隔毫秒</span>
          <input
            type="number"
            min="0"
            step="1"
            value={state.form.retryBackoffMS}
            disabled={state.loading || state.saving}
            onChange={actions.changeRetryBackoffMS}
          />
        </label>
      </div>
    </section>
  );
}

// AgentSettingsSupervisorPreview 渲染顶层 Agent 预览卡片。
function AgentSettingsSupervisorPreview() {
  const { state, actions } = useAgentSettingsContext();

  return (
    <section className="agent-settings-section" aria-labelledby="agent-supervisor-title">
      <div className="ai-provider-section-heading">
        <div>
          <h2 id="agent-supervisor-title">顶层 Agent</h2>
        </div>
      </div>
      <div className="agent-card-grid agent-card-grid-single">
        {state.loading ? (
          <p className="ai-provider-empty">正在加载顶层 Agent...</p>
        ) : (
          <div
            className="agent-card-shell"
            role="button"
            tabIndex={0}
            aria-label="编辑顶层 Agent"
            onClick={function handleSupervisorCardClick() {
              actions.openAgentEditor({ kind: "supervisor" });
            }}
            onKeyDown={function handleSupervisorCardKeyboard(event) {
              actions.openAgentEditorWithKeyboard(event, { kind: "supervisor" });
            }}
          >
            <Card
              className="agent-preview-card agent-supervisor-preview-card"
              shadows="hover"
              headerLine={false}
            >
              <div className="agent-preview-card-content">
                <h3>{state.form.supervisor.name.trim() || "顶层 Agent"}</h3>
                <p title={state.form.supervisor.description}>
                  {state.form.supervisor.description.trim() || "暂无 Description"}
                </p>
              </div>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}

// AgentSettingsChildrenPreview 渲染子 Agent 预览卡片列表。
function AgentSettingsChildrenPreview() {
  const { state, actions } = useAgentSettingsContext();

  return (
    <section className="agent-settings-section" aria-labelledby="agent-children-title">
      <div className="ai-provider-section-heading agent-settings-child-heading">
        <div>
          <h2 id="agent-children-title">子 Agent</h2>
        </div>
        <button
          type="button"
          className="settings-secondary-button"
          disabled={state.loading || state.saving}
          onClick={actions.addChildAgent}
        >
          新增子 Agent
        </button>
      </div>

      <div className="agent-card-grid">
        {state.loading ? (
          <p className="ai-provider-empty">正在加载智能体配置...</p>
        ) : null}
        {!state.loading && state.form.children.length === 0 ? (
          <p className="ai-provider-empty">还没有子 Agent。</p>
        ) : null}
        {!state.loading
          ? state.form.children.map(function renderAgentChildCard(child, index) {
              return (
                <div
                  className="agent-card-shell"
                  key={child.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`编辑 ${child.name.trim() || `子 Agent ${index + 1}`}`}
                  onClick={function handleChildCardClick() {
                    actions.openAgentEditor({
                      kind: "child",
                      childID: child.id,
                    });
                  }}
                  onKeyDown={function handleChildCardKeyboard(event) {
                    actions.openAgentEditorWithKeyboard(event, {
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
  );
}
