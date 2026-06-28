import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchAIProviderModelsByProviderID,
  fetchAIProviders,
  fetchChapterSummaryAgentConfig,
  updateChapterSummaryAgentConfig,
  UnauthorizedError,
  type AIProviderItem,
  type AIProviderModelItem,
  type ChapterSummaryAgentConfigData,
} from "../api";
import type { ChapterSummaryAgentFormState, ChapterSummaryAgentSettingsPanelProps } from "./types";
import {
  agentModelOptionsForProvider,
  agentProviderModelCacheKey,
  buildChapterSummaryAgentConfigFromForm,
  chapterSummaryAgentConfigToFormState,
  createDefaultChapterSummaryAgentFormState,
  formatTime,
  getErrorMessage,
  isAbortError,
  isAIProviderType,
  normalizeAgentProviderType,
  validateChapterSummaryAgentForm,
} from "./settings-utils";

// ChapterSummaryAgentState 表示章节概要 Agent 设置页可展示的状态。
export interface ChapterSummaryAgentState {
  // form 表示当前章节概要 Agent 表单状态。
  form: ChapterSummaryAgentFormState;
  // loading 表示配置或提供商列表是否正在加载。
  loading: boolean;
  // saving 表示配置是否正在保存。
  saving: boolean;
  // dirty 表示表单内容是否相对最近一次加载或保存结果发生变化。
  dirty: boolean;
  // providers 表示可选 AI 提供商列表。
  providers: AIProviderItem[];
  // modelOptions 表示当前提供商可选的模型列表。
  modelOptions: AIProviderModelItem[];
  // modelLoading 表示当前提供商模型列表是否正在加载。
  modelLoading: boolean;
}

// ChapterSummaryAgentActions 表示章节概要 Agent 设置页可执行的动作。
export interface ChapterSummaryAgentActions {
  // reload 重新加载章节概要 Agent 配置。
  reload: () => void;
  // save 保存当前章节概要 Agent 配置。
  save: () => void;
  // changeEnabled 切换章节概要 Agent 启用状态。
  changeEnabled: (enabled: boolean) => void;
  // changeTextField 修改章节概要 Agent 文本字段。
  changeTextField: (field: ChapterSummaryAgentTextField, value: string) => void;
  // changeProvider 修改章节概要 Agent 模型提供商。
  changeProvider: (providerId: string) => void;
  // changeProviderType 修改章节概要 Agent 模型 API 协议。
  changeProviderType: (providerType: string) => void;
  // changeModel 修改章节概要 Agent 模型标识。
  changeModel: (model: string) => void;
  // changeReasoningEffort 修改 GPT 推理强度。
  changeReasoningEffort: (reasoningEffort: string) => void;
  // focusModelSelect 在模型下拉聚焦时加载当前提供商模型列表。
  focusModelSelect: () => void;
}

// ChapterSummaryAgentMeta 表示章节概要 Agent 设置页元信息。
export interface ChapterSummaryAgentMeta {
  // errorMessage 表示当前需要展示给用户的错误消息。
  errorMessage: string;
  // configFile 表示后端启动使用的配置文件路径。
  configFile: string;
  // modifiedAtText 表示配置文件最后修改时间文本。
  modifiedAtText: string;
  // reloadedAtText 表示后端最近成功加载配置时间文本。
  reloadedAtText: string;
}

// ChapterSummaryAgentContextValue 表示章节概要 Agent 设置上下文。
export interface ChapterSummaryAgentContextValue {
  // state 表示章节概要 Agent 设置页状态。
  state: ChapterSummaryAgentState;
  // actions 表示章节概要 Agent 设置页动作集合。
  actions: ChapterSummaryAgentActions;
  // meta 表示章节概要 Agent 设置页元信息。
  meta: ChapterSummaryAgentMeta;
}

// ChapterSummaryAgentTextField 表示章节概要 Agent 表单中以文本方式编辑的字段名。
export type ChapterSummaryAgentTextField =
  | "name"
  | "description"
  | "instruction"
  | "maxIterations"
  | "providerType"
  | "userAgent"
  | "retryMaxRetries"
  | "retryBackoffMS";

const ChapterSummaryAgentContext = createContext<ChapterSummaryAgentContextValue | null>(null);

// useChapterSummaryAgentSettings 读取章节概要 Agent 设置上下文。
export function useChapterSummaryAgentSettings(): ChapterSummaryAgentContextValue {
  const value = use(ChapterSummaryAgentContext);
  if (!value) {
    throw new Error("章节概要 Agent 设置上下文未初始化");
  }
  return value;
}

// ChapterSummaryAgentSettingsProvider 承载章节概要 Agent 设置页状态和动作。
// 参数 props 表示 provider 子节点和外部回调。
export function ChapterSummaryAgentSettingsProvider(
  props: ChapterSummaryAgentSettingsPanelProps & { children: ReactNode },
) {
  const [configData, setConfigData] = useState<ChapterSummaryAgentConfigData | null>(null);
  const [form, setForm] = useState<ChapterSummaryAgentFormState>(createDefaultChapterSummaryAgentFormState);
  const [savedForm, setSavedForm] = useState<ChapterSummaryAgentFormState>(createDefaultChapterSummaryAgentFormState);
  const [providers, setProviders] = useState<AIProviderItem[]>([]);
  const [modelOptionsByProvider, setModelOptionsByProvider] = useState<Record<string, AIProviderModelItem[]>>({});
  const [modelLoadingByProvider, setModelLoadingByProvider] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const dirty = useMemo(
    function computeChapterSummaryAgentDirty() {
      return JSON.stringify(form) !== JSON.stringify(savedForm);
    },
    [form, savedForm],
  );
  const providerId = form.providerId.trim();
  const modelOptions = agentModelOptionsForProvider(
    providerId,
    form.providerType,
    form.model,
    providers,
    modelOptionsByProvider,
  );
  const modelLoading = providerId
    ? modelLoadingByProvider[
        agentProviderModelCacheKey(providerId, form.providerType)
      ] === true
    : false;

  const handleUnauthorized = useCallback(
    // handleUnauthorized 通知应用层登录态已经失效。
    function handleUnauthorized(error: unknown) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return true;
      }
      return false;
    },
    [props.onUnauthorized],
  );

  const loadModelOptions = useCallback(
    // loadModelOptions 加载指定提供商和 API 协议的模型列表。
    async function loadModelOptions(targetProviderId: string, targetProviderType: string) {
      const normalizedProviderId = targetProviderId.trim();
      const normalizedProviderType = normalizeAgentProviderType(targetProviderType);
      if (!isAIProviderType(normalizedProviderType)) {
        return;
      }
      const cacheKey = agentProviderModelCacheKey(
        normalizedProviderId,
        normalizedProviderType,
      );
      if (!normalizedProviderId || modelOptionsByProvider[cacheKey]) {
        return;
      }

      setModelLoadingByProvider(function markModelLoading(current) {
        return { ...current, [cacheKey]: true };
      });
      try {
        const data = await fetchAIProviderModelsByProviderID(
          Number.parseInt(normalizedProviderId, 10),
          normalizedProviderType,
        );
        setModelOptionsByProvider(function storeModelOptions(current) {
          return { ...current, [cacheKey]: data.items ?? [] };
        });
      } catch (error) {
        if (!handleUnauthorized(error)) {
          setErrorMessage(getErrorMessage(error, "模型列表加载失败，请稍后再试"));
        }
      } finally {
        setModelLoadingByProvider(function clearModelLoading(current) {
          return { ...current, [cacheKey]: false };
        });
      }
    },
    [handleUnauthorized, modelOptionsByProvider],
  );

  const loadSettings = useCallback(
    // loadSettings 加载章节概要 Agent 配置和 AI 提供商列表。
    async function loadSettings(signal?: AbortSignal) {
      setLoading(true);
      setErrorMessage("");
      try {
        const [agentData, providerData] = await Promise.all([
          fetchChapterSummaryAgentConfig(signal),
          fetchAIProviders({ page: 1, pageSize: 100, signal }),
        ]);
        const nextForm = chapterSummaryAgentConfigToFormState(
          agentData.chapter_summary_agent,
        );
        setConfigData(agentData);
        setForm(nextForm);
        setSavedForm(nextForm);
        setProviders(providerData.items ?? []);
      } catch (error) {
        if (isAbortError(error) || handleUnauthorized(error)) {
          return;
        }
        setErrorMessage(getErrorMessage(error, "章节概要 Agent 配置加载失败，请稍后再试"));
      } finally {
        setLoading(false);
      }
    },
    [handleUnauthorized],
  );

  useEffect(
    // loadSettingsOnMount 在面板挂载时加载章节概要 Agent 配置。
    function loadSettingsOnMount() {
      const controller = new AbortController();
      void loadSettings(controller.signal);
      return function cancelLoadSettings() {
        controller.abort();
      };
    },
    [loadSettings],
  );

  const reload = useCallback(
    // reload 重新加载章节概要 Agent 配置。
    function reload() {
      void loadSettings();
    },
    [loadSettings],
  );

  const save = useCallback(
    // save 保存当前章节概要 Agent 配置。
    async function save() {
      const error = validateChapterSummaryAgentForm(form);
      if (error) {
        setErrorMessage(error);
        return;
      }
      const buildResult = buildChapterSummaryAgentConfigFromForm(form);
      if (!buildResult.config) {
        setErrorMessage(buildResult.error || "章节概要 Agent 配置无效");
        return;
      }

      setSaving(true);
      setErrorMessage("");
      try {
        await fetchChapterSummaryAgentConfig();
        const data = await updateChapterSummaryAgentConfig({
          chapter_summary_agent: buildResult.config,
        });
        const nextForm = chapterSummaryAgentConfigToFormState(
          data.chapter_summary_agent,
        );
        setConfigData(data);
        setForm(nextForm);
        setSavedForm(nextForm);
      } catch (error) {
        if (!handleUnauthorized(error)) {
          setErrorMessage(getErrorMessage(error, "章节概要 Agent 配置保存失败，请稍后再试"));
        }
      } finally {
        setSaving(false);
      }
    },
    [form, handleUnauthorized],
  );

  const value = useMemo<ChapterSummaryAgentContextValue>(
    function buildChapterSummaryAgentContextValue() {
      return {
        state: {
          form,
          loading,
          saving,
          dirty,
          providers,
          modelOptions,
          modelLoading,
        },
        actions: {
          reload,
          save,
          changeEnabled(enabled) {
            setForm(function updateEnabled(current) {
              return { ...current, enabled };
            });
          },
          changeTextField(field, value) {
            setForm(function updateTextField(current) {
              return { ...current, [field]: value };
            });
          },
          changeProvider(nextProviderId) {
            setForm(function updateProvider(current) {
              return {
                ...current,
                providerId: nextProviderId,
                model: "",
                userAgent: "",
              };
            });
            void loadModelOptions(nextProviderId, form.providerType);
          },
          changeProviderType(nextProviderType) {
            setForm(function updateProviderType(current) {
              return {
                ...current,
                providerType: nextProviderType,
                model: "",
                userAgent: "",
              };
            });
            void loadModelOptions(form.providerId, nextProviderType);
          },
          changeModel(model) {
            setForm(function updateModel(current) {
              return { ...current, model, userAgent: "" };
            });
          },
          changeReasoningEffort(reasoningEffort) {
            setForm(function updateReasoningEffort(current) {
              return { ...current, reasoningEffort };
            });
          },
          focusModelSelect() {
            void loadModelOptions(form.providerId, form.providerType);
          },
        },
        meta: {
          errorMessage,
          configFile: configData?.config_file ?? "",
          modifiedAtText: formatTime(configData?.modified_at),
          reloadedAtText: formatTime(configData?.reloaded_at),
        },
      };
    },
    [
      configData?.config_file,
      configData?.modified_at,
      configData?.reloaded_at,
      dirty,
      errorMessage,
      form,
      loadModelOptions,
      loading,
      modelLoading,
      modelOptions,
      providers,
      reload,
      save,
      saving,
    ],
  );

  return (
    <ChapterSummaryAgentContext value={value}>
      {props.children}
    </ChapterSummaryAgentContext>
  );
}
