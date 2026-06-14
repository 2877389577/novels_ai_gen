import { useCallback, useEffect, useState } from "react";

import {
  UnauthorizedError,
  fetchNovelList,
  type NovelItem,
  type NovelListData,
} from "./api";

const bookshelfPageSize = 20;
const coverToneClasses = [
  "book-cover-tone-jade",
  "book-cover-tone-cinnabar",
  "book-cover-tone-ink",
  "book-cover-tone-gold",
];

// BookshelfPageProps 表示书架首页需要的外部回调。
interface BookshelfPageProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// BookshelfState 表示书架首页的数据加载状态。
type BookshelfState = "loading" | "ready" | "error";

// BookshelfPage 渲染小说书架首页。
// 参数 props 表示书架首页需要的外部回调。
export function BookshelfPage(props: BookshelfPageProps) {
  const [state, setState] = useState<BookshelfState>("loading");
  const [message, setMessage] = useState("");
  const [listData, setListData] = useState<NovelListData | null>(null);
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

  return (
    <main className="bookshelf-page">
      <BookshelfHeader totalCount={totalCount} updatedCount={updatedCount} />

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
        {state === "ready" ? <NovelGrid novels={novels} /> : null}
      </section>
    </main>
  );
}

// BookshelfHeaderProps 表示书架顶部导航需要的统计数据。
interface BookshelfHeaderProps {
  // totalCount 表示当前书架中的小说总数。
  totalCount: number;
  // updatedCount 表示最近有更新的小说数量。
  updatedCount: number;
}

// BookshelfHeader 渲染书架首页顶部导航。
// 参数 props 表示书架顶部导航需要的统计数据。
function BookshelfHeader(props: BookshelfHeaderProps) {
  return (
    <header className="bookshelf-nav">
      <div className="bookshelf-nav-inner">
        <div className="bookshelf-brand" aria-label="墨香墨苑">
          <div className="bookshelf-seal" aria-hidden="true">
            墨
          </div>
          <span>墨香墨苑</span>
        </div>

        <nav className="bookshelf-links" aria-label="主导航">
          <a href="/" aria-current="page">
            藏书阁
          </a>
          <a href="/">我的作品</a>
          <a href="/">灵感社</a>
        </nav>

        <div className="bookshelf-actions">
          <button type="button" aria-label="搜索">
            ⌕
          </button>
          <button type="button" aria-label="设置">
            ⚙
          </button>
          <div className="bookshelf-avatar" aria-label="作者头像">
            <span>书</span>
          </div>
        </div>
      </div>

      <div className="bookshelf-summary" aria-label="书架统计">
        <span>{props.totalCount} 部作品</span>
        <span>{props.updatedCount} 部近日更新</span>
      </div>
    </header>
  );
}

// NovelGridProps 表示小说网格需要展示的数据。
interface NovelGridProps {
  // novels 表示当前书架中的小说列表。
  novels: NovelItem[];
}

// NovelGrid 渲染小说卡片网格和新建入口。
// 参数 props 表示小说网格需要展示的数据。
function NovelGrid(props: NovelGridProps) {
  if (props.novels.length === 0) {
    return (
      <div className="bookshelf-empty">
        <CreateBookButton />
        <p>书架还空着，第一卷可以从这里开始。</p>
      </div>
    );
  }

  return (
    <div className="book-grid">
      {props.novels.map(renderNovelCard)}
      <CreateBookButton />
    </div>
  );
}

// NovelCardProps 表示小说卡片需要展示的数据。
interface NovelCardProps {
  // novel 表示当前卡片展示的小说条目。
  novel: NovelItem;
  // index 表示当前小说在列表中的位置。
  index: number;
}

// NovelCard 渲染单本小说的封面与元信息。
// 参数 props 表示小说卡片需要展示的数据。
function NovelCard(props: NovelCardProps) {
  const tags = splitNovelTags(props.novel.tags);
  const updatedText = formatUpdatedText(props.novel.updated_at);

  return (
    <article className="book-card">
      <BookCover novel={props.novel} index={props.index} />

      <div className="book-meta">
        <h2>{props.novel.name}</h2>
        <p>{props.novel.author_name || "未署名作者"}</p>
        <div className="book-status-row">
          <span className="book-status">草稿</span>
          <span>{updatedText}</span>
        </div>
        {tags.length > 0 ? <TagList tags={tags} /> : null}
      </div>
    </article>
  );
}

// BookCoverProps 表示小说封面需要展示的数据。
interface BookCoverProps {
  // novel 表示当前封面对应的小说条目。
  novel: NovelItem;
  // index 表示当前小说在列表中的位置。
  index: number;
}

// BookCover 渲染小说封面或无封面时的书卷占位图。
// 参数 props 表示小说封面需要展示的数据。
function BookCover(props: BookCoverProps) {
  const toneClass = getCoverToneClass(props.index);

  return (
    <div className={`book-cover ${toneClass}`}>
      <div className="book-binding" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      {props.novel.cover_url ? (
        <img src={props.novel.cover_url} alt={`${props.novel.name}封面`} />
      ) : (
        <div className="book-cover-placeholder" aria-hidden="true">
          <span>{getCoverInitial(props.novel.name)}</span>
        </div>
      )}
      <div className="book-cover-shade" aria-hidden="true" />
    </div>
  );
}

// TagListProps 表示标签列表需要展示的数据。
interface TagListProps {
  // tags 表示需要展示的小说标签列表。
  tags: string[];
}

// TagList 渲染小说标签列表。
// 参数 props 表示标签列表需要展示的数据。
function TagList(props: TagListProps) {
  return <div className="book-tags">{props.tags.map(renderTag)}</div>;
}

// BookshelfSkeleton 渲染书架加载中的占位内容。
function BookshelfSkeleton() {
  return (
    <div className="book-grid" aria-label="书架加载中">
      {[0, 1, 2].map(renderSkeletonCard)}
    </div>
  );
}

// BookshelfErrorProps 表示书架错误状态需要展示的数据。
interface BookshelfErrorProps {
  // message 表示加载失败时展示的错误提示。
  message: string;
  // onRetry 表示点击重试按钮时执行的回调。
  onRetry: () => void;
}

// BookshelfError 渲染书架加载失败状态。
// 参数 props 表示书架错误状态需要展示的数据。
function BookshelfError(props: BookshelfErrorProps) {
  return (
    <div className="bookshelf-error" role="alert">
      <p>{props.message}</p>
      <button type="button" onClick={props.onRetry}>
        重新加载
      </button>
    </div>
  );
}

// CreateBookButton 渲染开启新卷按钮。
function CreateBookButton() {
  return (
    <button type="button" className="create-book-button" aria-label="开启新卷">
      <span className="create-book-symbol" aria-hidden="true">
        ＋
      </span>
      <span className="create-book-text">开启新卷</span>
    </button>
  );
}

// countRecentlyUpdatedNovels 统计最近三十天内更新过的小说数量。
// 参数 novels 表示需要统计的小说列表。
function countRecentlyUpdatedNovels(novels: NovelItem[]): number {
  const now = Date.now();
  const recentThreshold = 30 * 24 * 60 * 60 * 1000;
  let count = 0;

  for (const novel of novels) {
    const updatedAt = new Date(novel.updated_at).getTime();
    if (!Number.isNaN(updatedAt) && now - updatedAt <= recentThreshold) {
      count += 1;
    }
  }

  return count;
}

// renderNovelCard 渲染小说列表中的单个小说卡片。
// 参数 novel 表示当前需要渲染的小说；参数 index 表示小说在列表中的位置。
function renderNovelCard(novel: NovelItem, index: number) {
  return <NovelCard key={novel.id} novel={novel} index={index} />;
}

// renderTag 渲染单个小说标签。
// 参数 tag 表示需要渲染的标签文本。
function renderTag(tag: string) {
  return <span key={tag}>{tag}</span>;
}

// renderSkeletonCard 渲染加载占位卡片。
// 参数 index 表示当前占位卡片的位置。
function renderSkeletonCard(index: number) {
  return (
    <article className="book-card book-card-skeleton" key={index}>
      <div className="book-cover" />
      <div className="book-meta">
        <span />
        <span />
        <span />
      </div>
    </article>
  );
}

// splitNovelTags 将后端返回的逗号分隔标签拆成列表。
// 参数 tags 表示后端返回的标签文本。
function splitNovelTags(tags: string): string[] {
  const normalizedTags = tags
    .split(",")
    .map(trimTag)
    .filter(Boolean);
  return normalizedTags.slice(0, 3);
}

// trimTag 清理单个标签文本两端空白。
// 参数 tag 表示需要清理的标签文本。
function trimTag(tag: string): string {
  return tag.trim();
}

// formatUpdatedText 将更新时间格式化成书架展示文本。
// 参数 updatedAt 表示后端返回的更新时间。
function formatUpdatedText(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "尚未更新";
  }

  return `${date.getMonth() + 1}月${date.getDate()}日更新`;
}

// getCoverToneClass 根据小说位置选择封面配色。
// 参数 index 表示当前小说在列表中的位置。
function getCoverToneClass(index: number): string {
  return coverToneClasses[index % coverToneClasses.length];
}

// getCoverInitial 获取封面占位图中展示的单字。
// 参数 name 表示小说名称。
function getCoverInitial(name: string): string {
  const normalizedName = name.trim();
  return normalizedName ? normalizedName.slice(0, 1) : "卷";
}
