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
  UnauthorizedError,
  createPrompt,
  createPromptType,
  deletePrompt,
  deletePromptType,
  fetchPromptDetail,
  fetchPromptTypes,
  fetchPrompts,
  renamePromptType,
  updatePrompt,
  type PromptItem,
  type PromptListData,
  type PromptSummaryItem,
  type PromptTypesData,
  type PromptUpsertParams,
} from "./api";
import { BookshelfHeader } from "./bookshelf";
import type { AppTheme } from "./theme";

const promptPageSize = 20;

// InspirationLoadState 表示灵感社页面局部数据加载状态。
type InspirationLoadState = "loading" | "ready" | "error";

// PromptModalMode 表示提示词弹窗当前用途。
type PromptModalMode = "create" | "edit" | "view";

// TypeModalMode 表示提示词类型弹窗当前用途。
type TypeModalMode = "create" | "rename";

// InspirationPageProps 表示灵感社页面需要的外部状态和回调。
interface InspirationPageProps {
  // currentTheme 表示全站当前使用的黑白主题。
  currentTheme: AppTheme;
  // onOpenBookshelf 表示用户切换到书架页时执行的回调。
  onOpenBookshelf: () => void;
  // onOpenInspiration 表示用户切换到灵感社页时执行的回调。
  onOpenInspiration: () => void;
  // onOpenSettings 表示用户进入设置中心时执行的回调。
  onOpenSettings: () => void;
  // onToggleTheme 表示用户切换全站黑白主题时执行的回调。
  onToggleTheme: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// PromptFormState 表示提示词新增或编辑弹窗中的表单状态。
interface PromptFormState {
  // promptType 表示当前提示词所属类型。
  promptType: string;
  // description 表示提示词简介。
  description: string;
  // content 表示提示词正文。
  content: string;
}

// TypeModalState 表示提示词类型新增或重命名弹窗状态。
interface TypeModalState {
  // visible 表示类型弹窗是否可见。
  visible: boolean;
  // mode 表示类型弹窗当前用途。
  mode: TypeModalMode;
  // originalName 表示重命名时的原类型名称。
  originalName: string;
  // name 表示类型输入框当前文本。
  name: string;
}

const emptyPromptForm: PromptFormState = {
  promptType: "",
  description: "",
  content: "",
};

const defaultTypeModalState: TypeModalState = {
  visible: false,
  mode: "create",
  originalName: "",
  name: "",
};

// InspirationPage 渲染提示词类型库和提示词库管理页。
// 参数 props 表示灵感社页面需要的外部状态和回调。
export function InspirationPage(props: InspirationPageProps) {
  const [typeState, setTypeState] =
    useState<InspirationLoadState>("loading");
  const [promptState, setPromptState] =
    useState<InspirationLoadState>("loading");
  const [typeData, setTypeData] = useState<PromptTypesData | null>(null);
  const [promptData, setPromptData] = useState<PromptListData | null>(null);
  const [selectedPromptType, setSelectedPromptType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [errorMessage, setErrorMessage] = useState("");
  const [typeModal, setTypeModal] = useState<TypeModalState>(
    defaultTypeModalState,
  );
  const [typeSubmitting, setTypeSubmitting] = useState(false);
  const [promptModalVisible, setPromptModalVisible] = useState(false);
  const [promptModalMode, setPromptModalMode] =
    useState<PromptModalMode>("create");
  const [promptForm, setPromptForm] =
    useState<PromptFormState>(emptyPromptForm);
  const [editingPromptID, setEditingPromptID] = useState<number | null>(null);
  const [promptDetailLoading, setPromptDetailLoading] = useState(false);
  const [promptSubmitting, setPromptSubmitting] = useState(false);
  const [deletingPromptID, setDeletingPromptID] = useState<number | null>(null);

  const promptTypes = typeData?.items ?? [];
  const prompts = promptData?.items ?? [];
  const totalPrompts = promptData?.total ?? 0;
  const pageSize = promptData?.page_size || promptPageSize;
  const totalPages = Math.max(1, Math.ceil(totalPrompts / pageSize));
  const isPromptFormReadonly = promptModalMode === "view";
  const summaryItems = useMemo(
    function buildInspirationSummaryItems() {
      return [`${promptTypes.length} 个类型`, `${totalPrompts} 条提示词`];
    },
    [promptTypes.length, totalPrompts],
  );

  const handleUnauthorized = props.onUnauthorized;

  // loadPromptTypes 加载提示词类型库并同步当前筛选项。
  // 参数 signal 表示用于取消请求的浏览器 AbortSignal。
  const loadPromptTypes = useCallback(
    async function loadPromptTypes(signal?: AbortSignal) {
      setTypeState("loading");
      setErrorMessage("");

      try {
        const data = await fetchPromptTypes(signal);
        setTypeData(data);
        setSelectedPromptType(function keepSelectedType(currentType) {
          if (!currentType || data.items.includes(currentType)) {
            return currentType;
          }
          return "";
        });
        setTypeState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setTypeState("error");
        setErrorMessage(getErrorMessage(error, "提示词类型加载失败，请稍后再试"));
      }
    },
    [handleUnauthorized],
  );

  // loadPromptList 加载提示词分页列表。
  // 参数 page 表示当前页码；参数 promptType 表示类型筛选；参数 signal 表示请求取消信号。
  const loadPromptList = useCallback(
    async function loadPromptList(
      page: number,
      promptType: string,
      signal?: AbortSignal,
    ) {
      setPromptState("loading");
      setErrorMessage("");

      try {
        const data = await fetchPrompts({
          page,
          pageSize: promptPageSize,
          promptType,
          signal,
        });
        setPromptData(data);
        setPromptState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          handleUnauthorized();
          return;
        }
        setPromptState("error");
        setErrorMessage(getErrorMessage(error, "提示词列表加载失败，请稍后再试"));
      }
    },
    [handleUnauthorized],
  );

  useEffect(
    function loadTypesOnMount() {
      const controller = new AbortController();
      void loadPromptTypes(controller.signal);

      // cancelTypeLoad 取消卸载中的提示词类型请求。
      return function cancelTypeLoad() {
        controller.abort();
      };
    },
    [loadPromptTypes],
  );

  useEffect(
    function loadPromptsOnQueryChange() {
      const controller = new AbortController();
      void loadPromptList(
        currentPage,
        selectedPromptType,
        controller.signal,
      );

      // cancelPromptLoad 取消卸载或查询条件变化中的提示词列表请求。
      return function cancelPromptLoad() {
        controller.abort();
      };
    },
    [currentPage, loadPromptList, selectedPromptType],
  );

  // handleRetryClick 处理页面加载失败后的重试。
  function handleRetryClick() {
    void loadPromptTypes();
    void loadPromptList(currentPage, selectedPromptType);
  }

  // handleSelectAllTypes 选择全部提示词类型筛选。
  function handleSelectAllTypes() {
    setSelectedPromptType("");
    setCurrentPage(1);
  }

  // handleSelectPromptType 选择指定提示词类型筛选。
  // 参数 promptType 表示需要筛选的提示词类型。
  function handleSelectPromptType(promptType: string) {
    setSelectedPromptType(promptType);
    setCurrentPage(1);
  }

  // handleOpenCreateTypeModal 打开新增提示词类型弹窗。
  function handleOpenCreateTypeModal() {
    setTypeModal({
      visible: true,
      mode: "create",
      originalName: "",
      name: "",
    });
  }

  // handleOpenRenameTypeModal 打开重命名提示词类型弹窗。
  // 参数 promptType 表示需要重命名的提示词类型。
  function handleOpenRenameTypeModal(promptType: string) {
    setTypeModal({
      visible: true,
      mode: "rename",
      originalName: promptType,
      name: promptType,
    });
  }

  // handleTypeModalCancel 关闭提示词类型弹窗。
  function handleTypeModalCancel() {
    if (typeSubmitting) {
      return;
    }
    setTypeModal(defaultTypeModalState);
  }

  // handleTypeNameChange 同步提示词类型名称输入框。
  // 参数 event 表示类型名称输入框变化事件。
  function handleTypeNameChange(event: ChangeEvent<HTMLInputElement>) {
    setTypeModal(function updateTypeModal(currentState) {
      return { ...currentState, name: event.target.value };
    });
  }

  // handleTypeFormSubmit 提交提示词类型新增或重命名表单。
  // 参数 event 表示类型弹窗表单提交事件。
  function handleTypeFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void savePromptType();
  }

  // savePromptType 保存提示词类型新增或重命名结果。
  async function savePromptType() {
    const nextName = typeModal.name.trim();
    if (!nextName) {
      Toast.warning("请输入提示词类型名称");
      return;
    }

    if (typeModal.mode === "rename" && nextName === typeModal.originalName) {
      setTypeModal(defaultTypeModalState);
      return;
    }

    setTypeSubmitting(true);
    try {
      const data =
        typeModal.mode === "create"
          ? await createPromptType(nextName)
          : await renamePromptType(typeModal.originalName, nextName);
      const nextSelectedType =
        typeModal.mode === "create" ||
        (typeModal.mode === "rename" &&
          selectedPromptType === typeModal.originalName)
          ? nextName
          : selectedPromptType;
      setTypeData(data);
      setSelectedPromptType(nextSelectedType);
      setCurrentPage(1);
      await loadPromptList(1, nextSelectedType);
      setTypeModal(defaultTypeModalState);
      Toast.success(typeModal.mode === "create" ? "类型已创建" : "类型已更新");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "提示词类型保存失败，请稍后再试"));
    } finally {
      setTypeSubmitting(false);
    }
  }

  // handleDeleteTypeClick 弹出删除提示词类型确认框。
  // 参数 promptType 表示需要删除的提示词类型。
  function handleDeleteTypeClick(promptType: string) {
    Modal.confirm({
      title: "删除提示词类型",
      content: `确认删除「${promptType}」吗？如果该类型仍被提示词使用，后端会拒绝删除。`,
      okText: "删除",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmDeletePromptType() {
        void removePromptType(promptType);
      },
    });
  }

  // removePromptType 删除指定提示词类型。
  // 参数 promptType 表示需要删除的提示词类型。
  async function removePromptType(promptType: string) {
    try {
      const data = await deletePromptType(promptType);
      setTypeData(data);
      if (selectedPromptType === promptType) {
        setSelectedPromptType("");
        setCurrentPage(1);
      } else {
        void loadPromptList(currentPage, selectedPromptType);
      }
      Toast.success("类型已删除");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "提示词类型删除失败，请稍后再试"));
    }
  }

  // handleOpenCreatePromptModal 打开新增提示词弹窗。
  function handleOpenCreatePromptModal() {
    if (promptTypes.length === 0) {
      Toast.warning("请先创建提示词类型");
      return;
    }
    setEditingPromptID(null);
    setPromptModalMode("create");
    setPromptForm({
      ...emptyPromptForm,
      promptType: selectedPromptType || promptTypes[0],
    });
    setPromptModalVisible(true);
  }

  // handleOpenPromptDetailModal 打开提示词详情或编辑弹窗。
  // 参数 prompt 表示列表中的提示词摘要；参数 mode 表示弹窗用途。
  function handleOpenPromptDetailModal(
    prompt: PromptSummaryItem,
    mode: PromptModalMode,
  ) {
    void loadPromptDetailForModal(prompt.id, mode);
  }

  // loadPromptDetailForModal 加载提示词详情并填充弹窗表单。
  // 参数 promptID 表示提示词主键 ID；参数 mode 表示弹窗用途。
  async function loadPromptDetailForModal(promptID: number, mode: PromptModalMode) {
    setEditingPromptID(promptID);
    setPromptModalMode(mode);
    setPromptModalVisible(true);
    setPromptDetailLoading(true);
    setPromptForm(emptyPromptForm);

    try {
      const prompt = await fetchPromptDetail(promptID);
      setPromptForm(toPromptFormState(prompt));
    } catch (error) {
      setPromptModalVisible(false);
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "提示词详情加载失败，请稍后再试"));
    } finally {
      setPromptDetailLoading(false);
    }
  }

  // handlePromptModalCancel 关闭提示词弹窗。
  function handlePromptModalCancel() {
    if (promptSubmitting || promptDetailLoading) {
      return;
    }
    setPromptModalVisible(false);
  }

  // handlePromptFieldChange 同步提示词表单字段。
  // 参数 field 表示需要更新的字段；参数 value 表示新的字段值。
  function handlePromptFieldChange(field: keyof PromptFormState, value: string) {
    setPromptForm(function updatePromptForm(currentForm) {
      return { ...currentForm, [field]: value };
    });
  }

  // handlePromptFormSubmit 提交提示词新增或编辑表单。
  // 参数 event 表示提示词弹窗表单提交事件。
  function handlePromptFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (promptModalMode === "view") {
      return;
    }
    void savePrompt();
  }

  // savePrompt 保存提示词新增或编辑结果。
  async function savePrompt() {
    const params = normalizePromptForm(promptForm);
    if (!params.prompt_type) {
      Toast.warning("请选择提示词类型");
      return;
    }
    if (!params.content) {
      Toast.warning("请输入提示词正文");
      return;
    }

    setPromptSubmitting(true);
    try {
      if (promptModalMode === "create") {
        await createPrompt(params);
        Toast.success("提示词已创建");
      } else if (editingPromptID !== null) {
        await updatePrompt(editingPromptID, params);
        Toast.success("提示词已更新");
      }
      setPromptModalVisible(false);
      await loadPromptList(currentPage, selectedPromptType);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "提示词保存失败，请稍后再试"));
    } finally {
      setPromptSubmitting(false);
    }
  }

  // handleSwitchPromptModalToEdit 将详情弹窗切换为编辑状态。
  function handleSwitchPromptModalToEdit() {
    setPromptModalMode("edit");
  }

  // handleDeletePromptClick 弹出删除提示词确认框。
  // 参数 prompt 表示需要删除的提示词摘要。
  function handleDeletePromptClick(prompt: PromptSummaryItem) {
    Modal.confirm({
      title: "删除提示词",
      content: "确认删除这条提示词吗？删除后无法恢复。",
      okText: "删除",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmDeletePrompt() {
        void removePrompt(prompt.id);
      },
    });
  }

  // removePrompt 删除指定提示词并刷新列表。
  // 参数 promptID 表示提示词主键 ID。
  async function removePrompt(promptID: number) {
    setDeletingPromptID(promptID);
    try {
      await deletePrompt(promptID);
      Toast.success("提示词已删除");
      await loadPromptList(currentPage, selectedPromptType);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "提示词删除失败，请稍后再试"));
    } finally {
      setDeletingPromptID(null);
    }
  }

  // handlePreviousPage 切换到上一页提示词列表。
  function handlePreviousPage() {
    setCurrentPage(function decreasePage(page) {
      return Math.max(1, page - 1);
    });
  }

  // handleNextPage 切换到下一页提示词列表。
  function handleNextPage() {
    setCurrentPage(function increasePage(page) {
      return Math.min(totalPages, page + 1);
    });
  }

  return (
    <main className="bookshelf-page inspiration-page">
      <BookshelfHeader
        activeTab="inspiration"
        currentTheme={props.currentTheme}
        summaryItems={summaryItems}
        onOpenBookshelf={props.onOpenBookshelf}
        onOpenInspiration={props.onOpenInspiration}
        onOpenSettings={props.onOpenSettings}
        onToggleTheme={props.onToggleTheme}
      />

      <section className="bookshelf-content inspiration-content">
        <header className="bookshelf-title-block inspiration-title-block">
          <p className="bookshelf-kicker">Inspiration</p>
          <h1>灵感社</h1>
          <p>整理小说修改、润色和扩写提示词，把常用灵感沉淀成随取随用的素材。</p>
        </header>

        {errorMessage ? (
          <div className="inspiration-error" role="alert">
            <p>{errorMessage}</p>
            <button type="button" onClick={handleRetryClick}>
              重新加载
            </button>
          </div>
        ) : null}

        <div className="inspiration-workspace">
          <aside className="inspiration-type-panel">
            <div className="inspiration-panel-heading">
              <div>
                <h2>提示词类型</h2>
                <p>类型来自配置文件，适合作为筛选和推荐入口。</p>
              </div>
              <button
                type="button"
                className="settings-primary-button"
                onClick={handleOpenCreateTypeModal}
              >
                新增类型
              </button>
            </div>

            <div className="inspiration-type-list">
              <button
                type="button"
                className={
                  selectedPromptType
                    ? "inspiration-type-filter"
                    : "inspiration-type-filter inspiration-type-filter-active"
                }
                onClick={handleSelectAllTypes}
              >
                <span>全部类型</span>
                <em>{totalPrompts}</em>
              </button>

              {typeState === "loading" ? (
                <p className="inspiration-muted">类型加载中...</p>
              ) : null}

              {promptTypes.map((promptType) => (
                <div className="inspiration-type-row" key={promptType}>
                  <button
                    type="button"
                    className={
                      selectedPromptType === promptType
                        ? "inspiration-type-filter inspiration-type-filter-active"
                        : "inspiration-type-filter"
                    }
                    onClick={function handlePromptTypeFilterClick() {
                      handleSelectPromptType(promptType);
                    }}
                  >
                    <span>{promptType}</span>
                  </button>
                  <div className="inspiration-type-actions">
                    <button
                      type="button"
                      onClick={function handleRenameTypeClick() {
                        handleOpenRenameTypeModal(promptType);
                      }}
                    >
                      改名
                    </button>
                    <button
                      type="button"
                      onClick={function handleRemoveTypeClick() {
                        handleDeleteTypeClick(promptType);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}

              {typeState === "ready" && promptTypes.length === 0 ? (
                <p className="inspiration-empty-hint">
                  还没有提示词类型，请先创建类型后再新增提示词。
                </p>
              ) : null}
            </div>
          </aside>

          <section className="inspiration-prompt-panel">
            <div className="inspiration-panel-heading">
              <div>
                <h2>提示词库</h2>
                <p>
                  {selectedPromptType
                    ? `当前筛选：${selectedPromptType}`
                    : "当前展示全部提示词"}
                </p>
              </div>
              <button
                type="button"
                className="settings-primary-button"
                disabled={promptTypes.length === 0}
                title={
                  promptTypes.length === 0 ? "请先创建提示词类型" : undefined
                }
                onClick={handleOpenCreatePromptModal}
              >
                新增提示词
              </button>
            </div>

            {promptState === "loading" ? (
              <div className="inspiration-prompt-skeleton" aria-label="提示词加载中">
                <span />
                <span />
                <span />
              </div>
            ) : null}

            {promptState === "ready" && prompts.length === 0 ? (
              <div className="inspiration-empty">
                <p>
                  {promptTypes.length === 0
                    ? "先创建提示词类型，就能开始沉淀提示词。"
                    : "当前筛选下还没有提示词。"}
                </p>
              </div>
            ) : null}

            {promptState === "ready" && prompts.length > 0 ? (
              <div className="inspiration-prompt-list">
                {prompts.map((prompt) => (
                  <article className="inspiration-prompt-card" key={prompt.id}>
                    <div className="inspiration-prompt-card-main">
                      <span>{prompt.prompt_type}</span>
                      <h3>{formatPromptDescription(prompt.description)}</h3>
                      <p>更新于 {formatTime(prompt.updated_at)}</p>
                    </div>
                    <div className="inspiration-prompt-card-actions">
                      <button
                        type="button"
                        className="settings-secondary-button"
                        onClick={function handleViewPromptClick() {
                          handleOpenPromptDetailModal(prompt, "view");
                        }}
                      >
                        查看
                      </button>
                      <button
                        type="button"
                        className="settings-secondary-button"
                        onClick={function handleEditPromptClick() {
                          handleOpenPromptDetailModal(prompt, "edit");
                        }}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="settings-secondary-button inspiration-danger-button"
                        disabled={deletingPromptID === prompt.id}
                        onClick={function handleRemovePromptClick() {
                          handleDeletePromptClick(prompt);
                        }}
                      >
                        {deletingPromptID === prompt.id ? "删除中..." : "删除"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="inspiration-pagination">
              <span>
                第 {Math.min(currentPage, totalPages)} / {totalPages} 页
              </span>
              <div>
                <button
                  type="button"
                  className="settings-secondary-button"
                  disabled={currentPage <= 1 || promptState === "loading"}
                  onClick={handlePreviousPage}
                >
                  上一页
                </button>
                <button
                  type="button"
                  className="settings-secondary-button"
                  disabled={currentPage >= totalPages || promptState === "loading"}
                  onClick={handleNextPage}
                >
                  下一页
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>

      <Modal
        className="inspiration-type-modal"
        footer={null}
        maskClosable={!typeSubmitting}
        onCancel={handleTypeModalCancel}
        title={typeModal.mode === "create" ? "新增提示词类型" : "重命名提示词类型"}
        visible={typeModal.visible}
        width={460}
      >
        <form className="inspiration-modal-form" onSubmit={handleTypeFormSubmit}>
          <label className="inspiration-form-field">
            <span>类型名称</span>
            <input
              value={typeModal.name}
              disabled={typeSubmitting}
              placeholder="例如：润色、情感、扩写"
              onChange={handleTypeNameChange}
            />
          </label>
          <div className="inspiration-modal-actions">
            <button
              type="button"
              className="settings-secondary-button"
              disabled={typeSubmitting}
              onClick={handleTypeModalCancel}
            >
              取消
            </button>
            <button
              type="submit"
              className="settings-primary-button"
              disabled={typeSubmitting}
            >
              {typeSubmitting ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        className="inspiration-prompt-modal"
        footer={null}
        maskClosable={!promptSubmitting && !promptDetailLoading}
        onCancel={handlePromptModalCancel}
        title={getPromptModalTitle(promptModalMode)}
        visible={promptModalVisible}
        width={760}
      >
        <form
          className="inspiration-modal-form inspiration-prompt-form"
          onSubmit={handlePromptFormSubmit}
        >
          {promptDetailLoading ? (
            <p className="inspiration-muted">提示词详情加载中...</p>
          ) : (
            <>
              <label className="inspiration-form-field">
                <span>提示词类型</span>
                <select
                  value={promptForm.promptType}
                  disabled={isPromptFormReadonly || promptSubmitting}
                  onChange={function handlePromptTypeChange(event) {
                    handlePromptFieldChange("promptType", event.target.value);
                  }}
                >
                  {promptTypes.map((promptType) => (
                    <option key={promptType} value={promptType}>
                      {promptType}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inspiration-form-field">
                <span>提示词简介</span>
                <textarea
                  value={promptForm.description}
                  disabled={isPromptFormReadonly || promptSubmitting}
                  rows={3}
                  placeholder="简短说明这个提示词适合什么场景"
                  onChange={function handleDescriptionChange(event) {
                    handlePromptFieldChange("description", event.target.value);
                  }}
                />
              </label>
              <label className="inspiration-form-field">
                <span>提示词正文</span>
                <textarea
                  value={promptForm.content}
                  disabled={isPromptFormReadonly || promptSubmitting}
                  rows={12}
                  placeholder="输入完整提示词正文"
                  onChange={function handleContentChange(event) {
                    handlePromptFieldChange("content", event.target.value);
                  }}
                />
              </label>
            </>
          )}

          <div className="inspiration-modal-actions">
            <button
              type="button"
              className="settings-secondary-button"
              disabled={promptSubmitting}
              onClick={handlePromptModalCancel}
            >
              {promptModalMode === "view" ? "关闭" : "取消"}
            </button>
            {promptModalMode === "view" ? (
              <button
                type="button"
                className="settings-primary-button"
                disabled={promptDetailLoading}
                onClick={handleSwitchPromptModalToEdit}
              >
                编辑
              </button>
            ) : (
              <button
                type="submit"
                className="settings-primary-button"
                disabled={promptSubmitting || promptDetailLoading}
              >
                {promptSubmitting ? "保存中..." : "保存"}
              </button>
            )}
          </div>
        </form>
      </Modal>
    </main>
  );
}

// toPromptFormState 将提示词详情转换为弹窗表单状态。
// 参数 prompt 表示后端返回的提示词详情。
function toPromptFormState(prompt: PromptItem): PromptFormState {
  return {
    promptType: prompt.prompt_type,
    description: prompt.description,
    content: prompt.content,
  };
}

// normalizePromptForm 清理提示词弹窗表单值。
// 参数 form 表示当前提示词弹窗表单状态。
function normalizePromptForm(form: PromptFormState): PromptUpsertParams {
  return {
    prompt_type: form.promptType.trim(),
    description: form.description.trim(),
    content: form.content.trim(),
  };
}

// getPromptModalTitle 获取提示词弹窗标题。
// 参数 mode 表示提示词弹窗当前用途。
function getPromptModalTitle(mode: PromptModalMode): string {
  if (mode === "create") {
    return "新增提示词";
  }
  if (mode === "edit") {
    return "编辑提示词";
  }
  return "查看提示词";
}

// formatPromptDescription 格式化提示词简介展示文本。
// 参数 description 表示提示词简介原文。
function formatPromptDescription(description: string): string {
  const normalizedDescription = description.trim();
  return normalizedDescription || "未填写简介";
}

// formatTime 将后端时间字符串格式化为本地可读文本。
// 参数 value 表示后端返回的时间字符串。
function formatTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value || "未知时间";
  }
  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
