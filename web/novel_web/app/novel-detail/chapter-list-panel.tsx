import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import {
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type UIEvent,
} from "react";

import {
  UnauthorizedError,
  deleteChapter,
  fetchChapterList,
  type ChapterSummaryItem,
} from "../api";
import { formatUpdatedText } from "../novel-utils";
import { formatChapterWordCount, getErrorMessage } from "./detail-utils";

const chapterPageSize = 50;

// ChapterListState 表示章节列表的数据加载状态。
type ChapterListState = "loading" | "ready" | "error";

// ChapterListPanelProps 表示章节列表区域需要的数据和回调。
interface ChapterListPanelProps {
  // novelId 表示当前章节列表所属小说 ID。
  novelId: number;
  // onChapterCreate 表示进入章节创建页时执行的回调。
  onChapterCreate: (novelId: number) => void;
  // onChapterDeleted 表示章节删除成功后通知父层同步派生数据的回调。
  onChapterDeleted: (chapter: ChapterSummaryItem) => void;
  // onChapterEdit 表示进入章节编辑页时执行的回调。
  onChapterEdit: (novelId: number, chapterId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ChapterListPanel 渲染小说详情页下方的章节列表。
// 参数 props 表示章节列表区域需要的数据和回调。
export function ChapterListPanel(props: ChapterListPanelProps) {
  const [state, setState] = useState<ChapterListState>("loading");
  const [message, setMessage] = useState("");
  const [chapters, setChapters] = useState<ChapterSummaryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChapterSummaryItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const hasMore = chapters.length < total;
  const onUnauthorized = props.onUnauthorized;

  // loadChapterPage 从后端加载章节列表页。
  // 参数 pageToLoad 表示需要加载的页码；参数 mode 表示加载方式；参数 signal 表示可选的请求取消信号。
  const loadChapterPage = useCallback(
    async function loadChapterPage(
      pageToLoad: number,
      mode: "reset" | "append",
      signal?: AbortSignal,
    ) {
      if (mode === "reset") {
        setState("loading");
        setMessage("");
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await fetchChapterList(props.novelId, {
          page: pageToLoad,
          pageSize: chapterPageSize,
          signal,
        });
        setChapters(function updateChapters(currentChapters) {
          return mode === "reset"
            ? data.items
            : appendUniqueChapters(currentChapters, data.items);
        });
        setTotal(data.total);
        setPage(data.page);
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        if (mode === "reset") {
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "章节列表加载失败，请稍后再试",
          );
          return;
        }

        Toast.error(getErrorMessage(error, "更多章节加载失败，请稍后再试"));
      } finally {
        if (mode === "append") {
          setLoadingMore(false);
        }
      }
    },
    [onUnauthorized, props.novelId],
  );

  // loadChaptersOnNovelChange 在小说 ID 变化时重新加载章节列表。
  useEffect(
    function loadChaptersOnNovelChange() {
      const controller = new AbortController();
      void loadChapterPage(1, "reset", controller.signal);

      return function cancelChapterListLoad() {
        controller.abort();
      };
    },
    [loadChapterPage],
  );

  // handleCreateChapter 进入章节创建页。
  function handleCreateChapter() {
    props.onChapterCreate(props.novelId);
  }

  // handleRetry 处理章节列表加载失败后的重试。
  function handleRetry() {
    void loadChapterPage(1, "reset");
  }

  // handleScroll 在滚动接近底部时继续加载章节。
  // 参数 event 表示章节列表滚动事件。
  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const distanceToBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    if (distanceToBottom > 96 || state !== "ready" || loadingMore || !hasMore) {
      return;
    }

    void loadChapterPage(page + 1, "append");
  }

  // handleChapterSelect 进入指定章节编辑页。
  // 参数 chapter 表示用户选择的章节摘要数据。
  function handleChapterSelect(chapter: ChapterSummaryItem) {
    props.onChapterEdit(props.novelId, chapter.id);
  }

  // handleChapterKeyDown 处理章节行键盘选择。
  // 参数 event 表示 React 键盘事件；参数 chapter 表示当前章节摘要数据。
  function handleChapterKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    chapter: ChapterSummaryItem,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleChapterSelect(chapter);
  }

  // handleOpenDeleteConfirm 打开删除章节确认弹窗。
  // 参数 event 表示删除按钮点击事件；参数 chapter 表示需要删除的章节摘要数据。
  function handleOpenDeleteConfirm(
    event: MouseEvent<HTMLButtonElement>,
    chapter: ChapterSummaryItem,
  ) {
    event.stopPropagation();
    setDeleteTarget(chapter);
  }

  // handleCloseDeleteConfirm 关闭删除章节确认弹窗。
  function handleCloseDeleteConfirm() {
    if (deleting) {
      return;
    }

    setDeleteTarget(null);
  }

  // handleDeleteChapter 确认删除当前章节。
  async function handleDeleteChapter() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      await deleteChapter(props.novelId, deleteTarget.id);
      Toast.success("章节已删除");
      setChapters(function removeDeletedChapter(currentChapters) {
        return currentChapters.filter(
          (chapter) => chapter.id !== deleteTarget.id,
        );
      });
      props.onChapterDeleted(deleteTarget);
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      setDeleteTarget(null);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "章节删除失败，请稍后再试"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section
      className="chapter-list-panel"
      aria-labelledby="chapter-list-title"
    >
      <div className="chapter-list-header">
        <div>
          <p className="chapter-list-kicker">Chapters</p>
          <h2 id="chapter-list-title">章节目录</h2>
          <span>{total} 章</span>
        </div>
        <button
          type="button"
          className="chapter-create-button"
          onClick={handleCreateChapter}
        >
          <span>新增章节</span>
        </button>
      </div>

      {state === "loading" ? <ChapterListSkeleton /> : null}
      {state === "error" ? (
        <div className="chapter-list-error" role="alert">
          <p>{message}</p>
          <button type="button" onClick={handleRetry}>
            重新加载
          </button>
        </div>
      ) : null}
      {state === "ready" && chapters.length === 0 ? (
        <div className="chapter-list-empty">
          <p>这一卷还没有章节，第一笔可以从这里落下。</p>
          <button type="button" onClick={handleCreateChapter}>
            新增章节
          </button>
        </div>
      ) : null}
      {state === "ready" && chapters.length > 0 ? (
        <div
          className="chapter-scroll-list"
          aria-label="章节列表"
          onScroll={handleScroll}
        >
          {chapters.map((chapter) => (
            <ChapterRow
              chapter={chapter}
              key={chapter.id}
              onDelete={handleOpenDeleteConfirm}
              onKeyDown={handleChapterKeyDown}
              onSelect={handleChapterSelect}
            />
          ))}
          {loadingMore ? (
            <div className="chapter-list-more">加载更多章节...</div>
          ) : null}
          {!hasMore ? (
            <div className="chapter-list-end">已到目录尽头</div>
          ) : null}
        </div>
      ) : null}

      <Modal
        className="delete-novel-modal delete-chapter-modal"
        title="删除章节"
        visible={deleteTarget !== null}
        width={420}
        okText="确认删除"
        cancelText="取消"
        confirmLoading={deleting}
        maskClosable={!deleting}
        closable={!deleting}
        onOk={handleDeleteChapter}
        onCancel={handleCloseDeleteConfirm}
      >
        <p>
          将删除《{deleteTarget?.title || "该章节"}
          》。删除后无法恢复，请确认是否继续。
        </p>
      </Modal>
    </section>
  );
}

// ChapterRowProps 表示章节行需要展示的数据和回调。
interface ChapterRowProps {
  // chapter 表示当前章节摘要数据。
  chapter: ChapterSummaryItem;
  // onDelete 表示点击删除章节按钮时执行的回调。
  onDelete: (
    event: MouseEvent<HTMLButtonElement>,
    chapter: ChapterSummaryItem,
  ) => void;
  // onKeyDown 表示章节行键盘选择时执行的回调。
  onKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
    chapter: ChapterSummaryItem,
  ) => void;
  // onSelect 表示选择章节行时执行的回调。
  onSelect: (chapter: ChapterSummaryItem) => void;
}

// ChapterRow 渲染章节列表中的单行章节。
// 参数 props 表示章节行需要展示的数据和回调。
function ChapterRow(props: ChapterRowProps) {
  return (
    <div
      className="chapter-row"
      role="button"
      tabIndex={0}
      onClick={() => props.onSelect(props.chapter)}
      onKeyDown={(event) => props.onKeyDown(event, props.chapter)}
    >
      <div className="chapter-row-number">
        第 {props.chapter.chapter_number} 章
      </div>
      <div className="chapter-row-main">
        <strong>{props.chapter.title}</strong>
        <span>{formatUpdatedText(props.chapter.updated_at)}</span>
      </div>
      <div className="chapter-row-meta">
        <span>{formatChapterWordCount(props.chapter.word_count)}</span>
        <button
          type="button"
          className="chapter-delete-button"
          onClick={(event) => props.onDelete(event, props.chapter)}
        >
          删除
        </button>
      </div>
    </div>
  );
}

// ChapterListSkeleton 渲染章节列表加载中的占位内容。
function ChapterListSkeleton() {
  return (
    <div className="chapter-list-skeleton" aria-label="章节列表加载中">
      {[0, 1, 2].map(renderChapterSkeletonRow)}
    </div>
  );
}

// renderChapterSkeletonRow 渲染单行章节占位内容。
// 参数 index 表示当前占位行的位置。
function renderChapterSkeletonRow(index: number) {
  return (
    <div className="chapter-row chapter-row-skeleton" key={index}>
      <span />
      <span />
      <span />
    </div>
  );
}

// appendUniqueChapters 将新章节追加到已有列表中并去重。
// 参数 currentChapters 表示当前已经加载的章节列表；参数 nextChapters 表示下一页章节列表。
function appendUniqueChapters(
  currentChapters: ChapterSummaryItem[],
  nextChapters: ChapterSummaryItem[],
): ChapterSummaryItem[] {
  const existingIds = new Set(currentChapters.map((chapter) => chapter.id));
  const mergedChapters = [...currentChapters];
  for (const chapter of nextChapters) {
    if (!existingIds.has(chapter.id)) {
      mergedChapters.push(chapter);
    }
  }
  return mergedChapters;
}
