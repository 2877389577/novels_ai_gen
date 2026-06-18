import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";

import {
  createAIProvider,
  deleteAIProvider,
  fetchAIProviders,
  fetchConfigFile,
  triggerSystemUpdate,
  updateAIProvider,
  updateConfigFile,
  UnauthorizedError,
  type AIProviderAPIType,
  type AIProviderItem,
  type AIProviderType,
  type AIProviderUpsertParams,
  type ConfigFileData,
} from "./api";
import { LogsPanel } from "./logs";

// SettingsSection 表示设置中心支持切换的功能分区。
export type SettingsSection = "config" | "logs" | "system" | "ai-providers";

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
  // apiType 表示 AI 接口类型。
  apiType: string;
  // enabled 表示是否启用该 AI 提供商。
  enabled: boolean;
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
  { value: "response", label: "response" },
  { value: "completions", label: "completions" },
];
const defaultAIProviderFormState: AIProviderFormState = {
  name: "",
  providerType: "openai",
  apiKey: "",
  baseURL: "",
  apiType: "response",
  enabled: true,
};

// SettingsPage 渲染聚合配置、日志和系统更新的设置中心。
// 参数 props 表示设置中心页面需要的外部状态和回调。
export function SettingsPage(props: SettingsPageProps) {
  // handleConfigSectionClick 切换到配置管理分区。
  function handleConfigSectionClick() {
    props.onSectionChange("config");
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
  const [formMode, setFormMode] = useState<AIProviderFormMode>("create");
  const [editingProvider, setEditingProvider] =
    useState<AIProviderItem | null>(null);
  const [form, setForm] = useState<AIProviderFormState>(
    createDefaultAIProviderFormState,
  );

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
  }

  // handleEditClick 切换为编辑指定 AI 提供商表单。
  // 参数 provider 表示需要编辑的 AI 提供商。
  function handleEditClick(provider: AIProviderItem) {
    setFormMode("edit");
    setEditingProvider(provider);
    setForm(providerToAIProviderFormState(provider));
    setErrorMessage("");
  }

  // handleCancelEditClick 取消编辑并恢复创建表单。
  function handleCancelEditClick() {
    handleCreateClick();
  }

  // handleFormInputChange 处理 AI 提供商文本或数字字段输入变化。
  // 参数 event 表示输入框变化事件。
  function handleFormInputChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm(function updateForm(current) {
      switch (name) {
        case "name":
          return { ...current, name: value };
        case "providerType":
          return { ...current, providerType: value };
        case "apiKey":
          return { ...current, apiKey: value };
        case "baseURL":
          return { ...current, baseURL: value };
        case "apiType":
          return { ...current, apiType: value };
        default:
          return current;
      }
    });
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

      {errorMessage ? (
        <p className="settings-error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="ai-provider-layout">
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
            {formMode === "edit" ? (
              <button
                type="button"
                className="settings-secondary-button"
                disabled={submitting}
                onClick={handleCancelEditClick}
              >
                取消编辑
              </button>
            ) : null}
          </div>

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
                      disabled={submitting}
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
      </div>
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
    apiType: provider.api_type,
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
  const apiType = form.apiType.trim() as AIProviderAPIType;

  return {
    name: form.name.trim(),
    provider_type: providerType,
    api_key: form.apiKey.trim(),
    base_url: form.baseURL.trim(),
    api_type: apiType,
    enabled: form.enabled,
  };
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
