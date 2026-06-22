import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";

import {
  UnauthorizedError,
  deleteChapterSummary,
  fetchChapterSummary,
  saveChapterSummary,
  type ChapterSummaryDetailItem,
} from "../api";
import { getErrorMessage } from "../novel-detail/detail-utils";

// ChapterSummaryLoadState 表示章节概要页的数据加载状态。
export type ChapterSummaryLoadState = "loading" | "ready" | "empty" | "error";

// ChapterSummaryState 表示章节概要页 provider 暴露的状态。
export interface ChapterSummaryState {
  // status 表示当前章节概要的数据加载状态。
  status: ChapterSummaryLoadState;
  // message 表示错误状态下展示给用户的提示文案。
  message: string;
  // summary 表示后端返回的章节概要详情，尚未加载或已清空时为空。
  summary: ChapterSummaryDetailItem | null;
  // draft 表示概要编辑区中的草稿内容。
  draft: string;
  // editing 表示当前是否处于编辑或新建状态。
  editing: boolean;
  // saving 表示当前是否正在保存概要。
  saving: boolean;
  // deleting 表示当前是否正在删除概要。
  deleting: boolean;
  // deleteVisible 表示删除确认弹窗是否可见。
  deleteVisible: boolean;
}

// ChapterSummaryActions 表示章节概要页 provider 暴露的操作。
export interface ChapterSummaryActions {
  // reload 重新加载当前章节概要。
  reload: () => void;
  // back 返回当前小说详情页。
  back: () => void;
  // startCreate 进入概要新建状态。
  startCreate: () => void;
  // startEdit 进入概要编辑状态。
  startEdit: () => void;
  // cancelEdit 取消当前概要编辑。
  cancelEdit: () => void;
  // changeDraft 同步概要草稿输入内容。
  changeDraft: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  // save 保存当前概要草稿。
  save: () => Promise<void>;
  // openDelete 打开删除概要确认弹窗。
  openDelete: () => void;
  // closeDelete 关闭删除概要确认弹窗。
  closeDelete: () => void;
  // deleteSummary 确认删除当前章节概要。
  deleteSummary: () => Promise<void>;
}

// ChapterSummaryMeta 表示章节概要页 provider 暴露的派生信息。
export interface ChapterSummaryMeta {
  // novelId 表示当前章节所属小说主键 ID。
  novelId: number;
  // chapterId 表示当前需要查看或编辑概要的章节主键 ID。
  chapterId: number;
  // hasSummary 表示当前章节是否已有非空概要。
  hasSummary: boolean;
  // isDirty 表示当前概要草稿是否与后端快照不同。
  isDirty: boolean;
}

// ChapterSummaryContextValue 表示章节概要页上下文值。
export interface ChapterSummaryContextValue {
  // state 表示章节概要页当前状态。
  state: ChapterSummaryState;
  // actions 表示章节概要页可执行操作。
  actions: ChapterSummaryActions;
  // meta 表示章节概要页派生信息。
  meta: ChapterSummaryMeta;
}

// ChapterSummaryProviderProps 表示章节概要 provider 需要的参数。
interface ChapterSummaryProviderProps {
  // novelId 表示当前章节所属小说主键 ID。
  novelId: number;
  // chapterId 表示当前需要查看或编辑概要的章节主键 ID。
  chapterId: number;
  // onBackToNovelDetail 表示返回小说详情页时执行的回调。
  onBackToNovelDetail: (novelId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
  // children 表示被 provider 包裹的章节概要页面内容。
  children: ReactNode;
}

const ChapterSummaryContext = createContext<ChapterSummaryContextValue | null>(
  null,
);

// ChapterSummaryProvider 承载章节概要页的数据加载、保存和删除状态。
// 参数 props 表示章节概要 provider 需要的参数。
export function ChapterSummaryProvider(props: ChapterSummaryProviderProps) {
  const [status, setStatus] = useState<ChapterSummaryLoadState>("loading");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<ChapterSummaryDetailItem | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const onUnauthorized = props.onUnauthorized;
  const onBackToNovelDetail = props.onBackToNovelDetail;

  // loadSummary 从后端加载当前章节概要。
  // 参数 signal 表示可选的请求取消信号。
  const loadSummary = useCallback(
    async function loadSummary(signal?: AbortSignal) {
      setStatus("loading");
      setMessage("");
      setEditing(false);

      try {
        const data = await fetchChapterSummary(
          props.novelId,
          props.chapterId,
          signal,
        );
        setSummary(data);
        setDraft(data.summary);
        setStatus(data.summary ? "ready" : "empty");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        setSummary(null);
        setDraft("");
        setStatus("error");
        setMessage(getErrorMessage(error, "章节概要加载失败，请稍后再试"));
      }
    },
    [onUnauthorized, props.chapterId, props.novelId],
  );

  // loadSummaryOnChange 在章节变化时加载对应概要。
  useEffect(
    function loadSummaryOnChange() {
      const controller = new AbortController();
      void loadSummary(controller.signal);

      return function cancelSummaryLoad() {
        controller.abort();
      };
    },
    [loadSummary],
  );

  // reload 重新加载当前章节概要。
  const reload = useCallback(
    function reload() {
      void loadSummary();
    },
    [loadSummary],
  );

  // back 返回当前小说详情页。
  const back = useCallback(
    function back() {
      onBackToNovelDetail(props.novelId);
    },
    [onBackToNovelDetail, props.novelId],
  );

  // startCreate 进入概要新建状态。
  const startCreate = useCallback(function startCreate() {
    setDraft("");
    setEditing(true);
  }, []);

  // startEdit 进入概要编辑状态。
  const startEdit = useCallback(function startEdit() {
    setDraft(summary?.summary ?? "");
    setEditing(true);
  }, [summary]);

  // cancelEdit 取消当前概要编辑。
  const cancelEdit = useCallback(
    function cancelEdit() {
      if (saving) {
        return;
      }

      setDraft(summary?.summary ?? "");
      setEditing(false);
    },
    [saving, summary],
  );

  // changeDraft 同步概要草稿输入内容。
  // 参数 event 表示概要正文输入框变更事件。
  const changeDraft = useCallback(function changeDraft(
    event: ChangeEvent<HTMLTextAreaElement>,
  ) {
    setDraft(event.target.value);
  }, []);

  // save 保存当前概要草稿。
  const save = useCallback(
    async function save() {
      setSaving(true);

      try {
        const data = await saveChapterSummary(props.novelId, props.chapterId, {
          summary: draft,
        });
        setSummary(data);
        setDraft(data.summary);
        setStatus(data.summary ? "ready" : "empty");
        setEditing(false);
        Toast.success("章节概要已保存");
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        Toast.error(getErrorMessage(error, "章节概要保存失败，请稍后再试"));
      } finally {
        setSaving(false);
      }
    },
    [draft, onUnauthorized, props.chapterId, props.novelId],
  );

  // openDelete 打开删除概要确认弹窗。
  const openDelete = useCallback(
    function openDelete() {
      if (!summary || saving) {
        return;
      }

      setDeleteVisible(true);
    },
    [saving, summary],
  );

  // closeDelete 关闭删除概要确认弹窗。
  const closeDelete = useCallback(
    function closeDelete() {
      if (deleting) {
        return;
      }

      setDeleteVisible(false);
    },
    [deleting],
  );

  // deleteSummary 确认删除当前章节概要。
  const deleteSummary = useCallback(
    async function deleteSummary() {
      if (!summary) {
        setDeleteVisible(false);
        return;
      }

      setDeleting(true);

      try {
        await deleteChapterSummary(props.novelId, props.chapterId);
        setSummary({ ...summary, summary: "" });
        setDraft("");
        setEditing(false);
        setStatus("empty");
        setDeleteVisible(false);
        Toast.success("章节概要已删除");
      } catch (error) {
        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        Toast.error(getErrorMessage(error, "章节概要删除失败，请稍后再试"));
      } finally {
        setDeleting(false);
      }
    },
    [onUnauthorized, props.chapterId, props.novelId, summary],
  );

  const state = useMemo<ChapterSummaryState>(
    function buildState() {
      return {
        status,
        message,
        summary,
        draft,
        editing,
        saving,
        deleting,
        deleteVisible,
      };
    },
    [deleteVisible, deleting, draft, editing, message, saving, status, summary],
  );
  const actions = useMemo<ChapterSummaryActions>(
    function buildActions() {
      return {
        reload,
        back,
        startCreate,
        startEdit,
        cancelEdit,
        changeDraft,
        save,
        openDelete,
        closeDelete,
        deleteSummary,
      };
    },
    [
      back,
      cancelEdit,
      changeDraft,
      closeDelete,
      deleteSummary,
      openDelete,
      reload,
      save,
      startCreate,
      startEdit,
    ],
  );
  const meta = useMemo<ChapterSummaryMeta>(
    function buildMeta() {
      const baseline = summary?.summary ?? "";
      return {
        novelId: props.novelId,
        chapterId: props.chapterId,
        hasSummary: Boolean(summary?.summary),
        isDirty: draft !== baseline,
      };
    },
    [draft, props.chapterId, props.novelId, summary],
  );

  return (
    <ChapterSummaryContext value={{ state, actions, meta }}>
      {props.children}
    </ChapterSummaryContext>
  );
}

// useChapterSummary 读取章节概要页上下文。
export function useChapterSummary(): ChapterSummaryContextValue {
  const context = use(ChapterSummaryContext);
  if (!context) {
    throw new Error("useChapterSummary 必须在 ChapterSummaryProvider 内使用");
  }
  return context;
}
