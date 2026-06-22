import { useCallback, useEffect, useState } from "react";

import {
  UnauthorizedError,
  fetchNovelDetail,
  fetchNovelWordCount,
  type ChapterSummaryItem,
  type NovelItem,
} from "../api";
import { EventGraphPanel } from "../event-graph";
import { RelationshipGraphPanel } from "../relationship-graph";
import { CharacterCardPanel } from "./character-card-panel";
import { ChapterListPanel } from "./chapter-list-panel";
import { DetailNav } from "./detail-nav";
import {
  NovelDetailError,
  NovelDetailHero,
  NovelDetailSkeleton,
} from "./detail-overview";
import { formatNovelWordCountText, normalizeWordCount } from "./detail-utils";
import { NovelOutlinePanel } from "./novel-outline-panel";
import { DeleteNovelConfirmModal, EditNovelModal } from "./novel-modals";
import { NovelSummaryPanel } from "./novel-summary-panel";
import type {
  NovelDetailPageProps,
  NovelDetailState,
  NovelDetailTab,
  NovelWordCountState,
} from "./types";

// NovelDetailPage 渲染小说详情页。
// 参数 props 表示小说详情页需要的外部参数和回调。
export function NovelDetailPage(props: NovelDetailPageProps) {
  const [state, setState] = useState<NovelDetailState>("loading");
  const [message, setMessage] = useState("");
  const [novel, setNovel] = useState<NovelItem | null>(null);
  const [wordCountState, setWordCountState] =
    useState<NovelWordCountState>("loading");
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<NovelDetailTab>("detail");
  const onUnauthorized = props.onUnauthorized;

  // loadNovelDetail 从后端加载小说详情数据。
  // 参数 signal 表示可选的请求取消信号。
  const loadNovelDetail = useCallback(
    async function loadNovelDetail(signal?: AbortSignal) {
      setState("loading");
      setMessage("");

      try {
        const data = await fetchNovelDetail(props.novelId, signal);
        setNovel(data);
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        setState("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "小说详情加载失败，请稍后再试",
        );
      }
    },
    [onUnauthorized, props.novelId],
  );

  // loadNovelWordCount 从后端聚合接口加载小说总字数。
  // 参数 signal 表示可选的请求取消信号。
  const loadNovelWordCount = useCallback(
    async function loadNovelWordCount(signal?: AbortSignal) {
      setWordCountState("loading");
      setWordCount(null);

      try {
        const data = await fetchNovelWordCount(props.novelId, signal);
        setWordCount(data.word_count);
        setWordCountState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        setWordCount(null);
        setWordCountState("error");
      }
    },
    [onUnauthorized, props.novelId],
  );

  // loadNovelDetailOnChange 在小说 ID 变化时加载详情。
  useEffect(
    function loadNovelDetailOnChange() {
      const controller = new AbortController();
      void loadNovelDetail(controller.signal);

      return function cancelNovelDetailLoad() {
        controller.abort();
      };
    },
    [loadNovelDetail],
  );

  // loadNovelWordCountOnChange 在小说 ID 变化时统计总字数。
  useEffect(
    function loadNovelWordCountOnChange() {
      const controller = new AbortController();
      void loadNovelWordCount(controller.signal);

      return function cancelNovelWordCountLoad() {
        controller.abort();
      };
    },
    [loadNovelWordCount],
  );

  // resetActiveTabOnNovelChange 在切换小说时默认回到作品详情页签。
  useEffect(
    function resetActiveTabOnNovelChange() {
      setActiveTab("detail");
    },
    [props.novelId],
  );

  // handleRetry 处理详情加载失败后的重试。
  function handleRetry() {
    void loadNovelDetail();
    void loadNovelWordCount();
  }

  // handleOpenEditModal 打开编辑小说弹窗。
  function handleOpenEditModal() {
    setEditVisible(true);
  }

  // handleCloseEditModal 关闭编辑小说弹窗。
  function handleCloseEditModal() {
    setEditVisible(false);
  }

  // handleNovelUpdated 处理小说更新成功后的详情刷新。
  // 参数 data 表示后端返回的最新小说数据。
  function handleNovelUpdated(data: NovelItem) {
    setNovel(data);
  }

  // handleChapterDeleted 处理章节删除后对小说总字数的同步扣减。
  // 参数 chapter 表示已经删除的章节摘要数据。
  function handleChapterDeleted(chapter: ChapterSummaryItem) {
    setWordCount(function subtractDeletedChapterWordCount(currentWordCount) {
      if (currentWordCount === null) {
        return currentWordCount;
      }

      return Math.max(
        0,
        currentWordCount - normalizeWordCount(chapter.word_count),
      );
    });
  }

  // handleOpenDeleteModal 打开删除确认弹窗。
  function handleOpenDeleteModal() {
    setDeleteVisible(true);
  }

  // handleCloseDeleteModal 关闭删除确认弹窗。
  function handleCloseDeleteModal() {
    setDeleteVisible(false);
  }

  // handleTabChange 处理详情页顶部 Tab 切换。
  // 参数 nextTab 表示用户选择的目标 Tab。
  function handleTabChange(nextTab: NovelDetailTab) {
    setActiveTab(nextTab);
  }

  return (
    <main className="novel-detail-page">
      <DetailNav
        activeTab={activeTab}
        onBackToBookshelf={props.onBackToBookshelf}
        onTabChange={handleTabChange}
      />

      <section
        className={
          activeTab === "relationshipGraph" || activeTab === "events"
            ? "novel-detail-content novel-detail-content-relationship"
            : "novel-detail-content"
        }
        aria-label="小说详情内容"
      >
        {state === "loading" ? <NovelDetailSkeleton /> : null}
        {state === "error" ? (
          <NovelDetailError
            message={message}
            onBackToBookshelf={props.onBackToBookshelf}
            onRetry={handleRetry}
          />
        ) : null}
        {state === "ready" && novel ? (
          activeTab === "detail" ? (
            <div className="detail-tab-panel" id="detail-panel" role="tabpanel">
              <NovelDetailHero
                novel={novel}
                wordCountText={formatNovelWordCountText(
                  wordCountState,
                  wordCount,
                )}
                onBackToBookshelf={props.onBackToBookshelf}
                onDelete={handleOpenDeleteModal}
                onEdit={handleOpenEditModal}
                onUnauthorized={props.onUnauthorized}
              />
              <ChapterListPanel
                novelId={props.novelId}
                onChapterCreate={props.onChapterCreate}
                onChapterDeleted={handleChapterDeleted}
                onChapterEdit={props.onChapterEdit}
                onUnauthorized={props.onUnauthorized}
              />
            </div>
          ) : activeTab === "summary" ? (
            <NovelSummaryPanel
              novel={novel}
              onUnauthorized={props.onUnauthorized}
            />
          ) : activeTab === "outline" ? (
            <NovelOutlinePanel
              novel={novel}
              onUnauthorized={props.onUnauthorized}
            />
          ) : activeTab === "characters" ? (
            <CharacterCardPanel
              novel={novel}
              onUnauthorized={props.onUnauthorized}
            />
          ) : activeTab === "relationshipGraph" ? (
            <RelationshipGraphPanel
              novel={novel}
              onUnauthorized={props.onUnauthorized}
            />
          ) : (
            <EventGraphPanel
              novel={novel}
              onUnauthorized={props.onUnauthorized}
            />
          )
        ) : null}
      </section>

      {novel ? (
        <>
          <EditNovelModal
            novel={novel}
            visible={editVisible}
            onCancel={handleCloseEditModal}
            onUpdated={handleNovelUpdated}
            onUnauthorized={props.onUnauthorized}
          />
          <DeleteNovelConfirmModal
            novel={novel}
            visible={deleteVisible}
            onCancel={handleCloseDeleteModal}
            onDeleted={props.onDeleted}
            onUnauthorized={props.onUnauthorized}
          />
        </>
      ) : null}
    </main>
  );
}
