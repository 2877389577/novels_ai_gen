import { useCallback, useEffect, useState } from "react";

import { UnauthorizedError, fetchNovelList, type NovelListData } from "../api";
import { BookshelfError, BookshelfSkeleton, NovelGrid } from "./bookshelf-grid";
import { BookshelfHeader } from "./bookshelf-header";
import { countRecentlyUpdatedNovels } from "./bookshelf-utils";
import { CreateNovelModal } from "./create-novel-modal";
import type { BookshelfPageProps, BookshelfState } from "./types";

const bookshelfPageSize = 20;

// BookshelfPage 渲染小说书架首页。
// 参数 props 表示书架首页需要的外部回调。
export function BookshelfPage(props: BookshelfPageProps) {
  const [state, setState] = useState<BookshelfState>("loading");
  const [message, setMessage] = useState("");
  const [listData, setListData] = useState<NovelListData | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const onUnauthorized = props.onUnauthorized;

  // loadBookshelf 从后端加载小说书架数据。
  // 参数 signal 表示可选的请求取消信号。
  const loadBookshelf = useCallback(
    async function loadBookshelf(signal?: AbortSignal) {
      setState("loading");
      setMessage("");

      try {
        const data = await fetchNovelList({
          page: 1,
          pageSize: bookshelfPageSize,
          signal,
        });
        setListData(data);
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
          error instanceof Error ? error.message : "书架加载失败，请稍后再试",
        );
      }
    },
    [onUnauthorized],
  );

  // loadBookshelfOnMount 在书架页面挂载时加载小说列表。
  useEffect(
    function loadBookshelfOnMount() {
      const controller = new AbortController();
      void loadBookshelf(controller.signal);

      return function cancelBookshelfLoad() {
        controller.abort();
      };
    },
    [loadBookshelf],
  );

  const novels = listData?.items ?? [];
  const totalCount = listData?.total ?? 0;
  const updatedCount = countRecentlyUpdatedNovels(novels);

  // handleRetry 处理书架加载失败后的重试动作。
  function handleRetry() {
    void loadBookshelf();
  }

  // handleOpenCreateModal 打开添加小说弹窗。
  function handleOpenCreateModal() {
    setCreateModalVisible(true);
  }

  // handleCloseCreateModal 关闭添加小说弹窗。
  function handleCloseCreateModal() {
    setCreateModalVisible(false);
  }

  // handleNovelCreated 处理小说创建成功后的书架刷新。
  async function handleNovelCreated() {
    await loadBookshelf();
  }

  return (
    <main className="bookshelf-page">
      <BookshelfHeader
        activeTab="bookshelf"
        currentTheme={props.currentTheme}
        summaryItems={[`${totalCount} 部作品`, `${updatedCount} 部近日更新`]}
        onOpenBookshelf={props.onOpenBookshelf}
        onOpenInspiration={props.onOpenInspiration}
        onOpenSettings={props.onOpenSettings}
        onToggleTheme={props.onToggleTheme}
      />

      <section className="bookshelf-content" aria-labelledby="bookshelf-title">
        <header className="bookshelf-title-block">
          <p className="bookshelf-kicker">Library</p>
          <h1 id="bookshelf-title">藏书阁</h1>
          <p>
            安放正在生长的卷册，回看灵感的枝叶，也为下一次落笔留出安静的位置。
          </p>
        </header>

        {state === "loading" ? <BookshelfSkeleton /> : null}
        {state === "error" ? (
          <BookshelfError message={message} onRetry={handleRetry} />
        ) : null}
        {state === "ready" ? (
          <NovelGrid
            novels={novels}
            onCreateClick={handleOpenCreateModal}
            onNovelSelect={props.onNovelSelect}
            onUnauthorized={onUnauthorized}
          />
        ) : null}
      </section>

      <CreateNovelModal
        visible={createModalVisible}
        onCancel={handleCloseCreateModal}
        onCreated={handleNovelCreated}
        onUnauthorized={onUnauthorized}
      />
    </main>
  );
}
