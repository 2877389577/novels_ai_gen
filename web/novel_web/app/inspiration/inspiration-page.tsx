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
} from "../api";
import { BookshelfHeader } from "../bookshelf";
import {
  getErrorMessage,
  normalizePromptForm,
  toPromptFormState,
} from "./inspiration-utils";
import { PromptModal, TypeModal } from "./inspiration-modals";
import { PromptPanel, TypePanel } from "./inspiration-workspace";
import type {
  InspirationLoadState,
  InspirationPageProps,
  PromptFormState,
  PromptModalMode,
  TypeModalState,
} from "./types";
import { defaultTypeModalState, emptyPromptForm } from "./types";

const promptPageSize = 20;

// InspirationPage 渲染提示词类型库和提示词库管理页。
// 参数 props 表示灵感社页面需要的外部状态和回调。
export function InspirationPage(props: InspirationPageProps) {
  const [typeState, setTypeState] = useState<InspirationLoadState>("loading");
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
        setErrorMessage(
          getErrorMessage(error, "提示词类型加载失败，请稍后再试"),
        );
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
        setErrorMessage(
          getErrorMessage(error, "提示词列表加载失败，请稍后再试"),
        );
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
      void loadPromptList(currentPage, selectedPromptType, controller.signal);

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
  async function loadPromptDetailForModal(
    promptID: number,
    mode: PromptModalMode,
  ) {
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
  function handlePromptFieldChange(
    field: keyof PromptFormState,
    value: string,
  ) {
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
          <p>
            整理小说修改、润色和扩写提示词，把常用灵感沉淀成随取随用的素材。
          </p>
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
          <TypePanel
            promptTypes={promptTypes}
            selectedPromptType={selectedPromptType}
            totalPrompts={totalPrompts}
            typeState={typeState}
            onCreate={handleOpenCreateTypeModal}
            onSelectAll={handleSelectAllTypes}
            onSelectType={handleSelectPromptType}
            onRename={handleOpenRenameTypeModal}
            onDelete={handleDeleteTypeClick}
          />

          <PromptPanel
            selectedPromptType={selectedPromptType}
            promptTypes={promptTypes}
            promptState={promptState}
            prompts={prompts}
            deletingPromptID={deletingPromptID}
            currentPage={currentPage}
            totalPages={totalPages}
            onCreate={handleOpenCreatePromptModal}
            onOpenPrompt={handleOpenPromptDetailModal}
            onDeletePrompt={handleDeletePromptClick}
            onPreviousPage={handlePreviousPage}
            onNextPage={handleNextPage}
          />
        </div>
      </section>

      <TypeModal
        state={typeModal}
        submitting={typeSubmitting}
        onCancel={handleTypeModalCancel}
        onNameChange={handleTypeNameChange}
        onSubmit={handleTypeFormSubmit}
      />

      <PromptModal
        visible={promptModalVisible}
        mode={promptModalMode}
        form={promptForm}
        promptTypes={promptTypes}
        readonly={isPromptFormReadonly}
        detailLoading={promptDetailLoading}
        submitting={promptSubmitting}
        onCancel={handlePromptModalCancel}
        onSubmit={handlePromptFormSubmit}
        onFieldChange={handlePromptFieldChange}
        onSwitchToEdit={handleSwitchPromptModalToEdit}
      />
    </main>
  );
}
