import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import { createAIProvider, deleteAIProvider, fetchAIProviderModels, fetchAIProviderModelsByProviderID, fetchAIProviders, updateAIProvider, UnauthorizedError, type AIProviderItem, type AIProviderModelItem } from "../api";
import { aiProviderAPITypeOptions, aiProviderDefaultPage, aiProviderPageSize, aiProviderTypeOptions } from "./settings-constants";
import { AIProviderContext } from "./ai-provider-context";
import type { AIProviderFormMode, AIProviderFormState, AIProviderSettingsPanelProps } from "./types";
import { createDefaultAIProviderFormState, formatAgentModelOption, formatOptionalText, formatTime, getErrorMessage, isAbortError, isAIProviderType, isProviderConnectionUnchanged, providerToAIProviderFormState, toAIProviderUpsertParams, uniqueAIProviderModelOptions, validateAIProviderForm } from "./settings-utils";

// AIProviderSettingsPanel 渲染 AI 提供商管理面板。
// 参数 props 表示 AI 提供商面板需要的外部回调。
export function AIProviderSettingsPanel(props: AIProviderSettingsPanelProps) {
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
      name === "providerType" ||
      name === "apiKey" ||
      name === "baseURL" ||
      name === "httpProxy";
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
        case "httpProxy":
          return { ...current, httpProxy: value };
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
    const httpProxy = form.httpProxy.trim();
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
          http_proxy: httpProxy,
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
  const aiProviderContextValue = useMemo(
    // buildAIProviderContextValue 创建 AI 提供商面板的组合式上下文值。
    function buildAIProviderContextValue() {
      return {
        state: {
          providers,
          form,
          formMode,
          loading,
          submitting,
        },
        actions: {
          reload: handleReloadClick,
          openCreate: handleCreateClick,
        },
        meta: {
          errorMessage,
        },
      };
    },
    [errorMessage, form, formMode, loading, providers, submitting],
  );

  return (
    <AIProviderContext value={aiProviderContextValue}>
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
                      <dt>HTTP 代理</dt>
                      <dd title={provider.http_proxy}>
                        {formatOptionalText(provider.http_proxy)}
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
            <label className="ai-provider-field ai-provider-field-wide">
              <span>HTTP 代理</span>
              <input
                name="httpProxy"
                value={form.httpProxy}
                disabled={submitting}
                placeholder="http://127.0.0.1:7890"
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
    </AIProviderContext>
  );
}
