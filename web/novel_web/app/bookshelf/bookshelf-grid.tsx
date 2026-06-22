import { useEffect, useState, type KeyboardEvent } from "react";

import { UnauthorizedError, refreshImagePreview, type NovelItem } from "../api";
import {
  formatUpdatedText,
  getCoverInitial,
  isPrivateObjectKey,
  normalizeNovelStatus,
  normalizeText,
  splitNovelTags,
} from "../novel-utils";

const coverToneClasses = [
  "book-cover-tone-jade",
  "book-cover-tone-cinnabar",
  "book-cover-tone-ink",
  "book-cover-tone-gold",
];

// NovelGridProps 表示小说网格需要展示的数据。
interface NovelGridProps {
  // novels 表示当前书架中的小说列表。
  novels: NovelItem[];
  // onCreateClick 表示点击创建小说入口时执行的回调。
  onCreateClick: () => void;
  // onNovelSelect 表示用户选择某本小说后进入详情页的回调。
  onNovelSelect: (novelId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// NovelGrid 渲染小说卡片网格和新建入口。
// 参数 props 表示小说网格需要展示的数据。
export function NovelGrid(props: NovelGridProps) {
  if (props.novels.length === 0) {
    return (
      <div className="bookshelf-empty">
        <CreateBookButton onClick={props.onCreateClick} />
        <p>书架还空着，第一卷可以从这里开始。</p>
      </div>
    );
  }

  return (
    <div className="book-grid">
      {props.novels.map((novel, index) =>
        renderNovelCard(
          novel,
          index,
          props.onNovelSelect,
          props.onUnauthorized,
        ),
      )}
      <CreateBookButton onClick={props.onCreateClick} />
    </div>
  );
}

// NovelCardProps 表示小说卡片需要展示的数据。
interface NovelCardProps {
  // novel 表示当前卡片展示的小说条目。
  novel: NovelItem;
  // index 表示当前小说在列表中的位置。
  index: number;
  // onSelect 表示用户选择当前小说时执行的回调。
  onSelect: (novelId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// NovelCard 渲染单本小说的封面与元信息。
// 参数 props 表示小说卡片需要展示的数据。
function NovelCard(props: NovelCardProps) {
  const tags = splitNovelTags(props.novel.tags);
  const updatedText = formatUpdatedText(props.novel.updated_at);
  const status = normalizeNovelStatus(props.novel.status);

  // handleSelect 处理小说卡片点击。
  function handleSelect() {
    props.onSelect(props.novel.id);
  }

  // handleKeyDown 处理小说卡片键盘选择。
  // 参数 event 表示 React 键盘事件。
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleSelect();
  }

  return (
    <article
      className="book-card"
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
    >
      <BookCover
        novel={props.novel}
        index={props.index}
        onUnauthorized={props.onUnauthorized}
      />

      <div className="book-meta">
        <h2>{props.novel.name}</h2>
        <p>{props.novel.author_name || "未署名作者"}</p>
        <div className="book-status-row">
          <span className={`book-status ${getBookStatusClassName(status)}`}>
            {status}
          </span>
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
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// BookCover 渲染小说封面或无封面时的书卷占位图。
// 参数 props 表示小说封面需要展示的数据。
function BookCover(props: BookCoverProps) {
  const toneClass = getCoverToneClass(props.index);
  const [resolvedCoverURL, setResolvedCoverURL] = useState("");
  const rawCoverURL = normalizeText(props.novel.cover_url);
  const coverURL = isPrivateObjectKey(rawCoverURL)
    ? resolvedCoverURL
    : rawCoverURL;

  // resolvePrivateCoverURL 在封面字段为对象 key 时刷新私有图片预览链接。
  useEffect(
    function resolvePrivateCoverURL() {
      if (!rawCoverURL || !isPrivateObjectKey(rawCoverURL)) {
        setResolvedCoverURL("");
        return;
      }

      const controller = new AbortController();
      setResolvedCoverURL("");

      void refreshImagePreview(rawCoverURL, controller.signal)
        .then(function handlePreviewLoaded(data) {
          setResolvedCoverURL(data.preview_url);
        })
        .catch(function handlePreviewError(error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            props.onUnauthorized();
          }
        });

      return function cancelPreviewLoad() {
        controller.abort();
      };
    },
    [rawCoverURL, props.onUnauthorized],
  );

  return (
    <div className={`book-cover ${toneClass}`}>
      <div className="book-binding" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      {coverURL ? (
        <img src={coverURL} alt={`${props.novel.name}封面`} />
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
export function BookshelfSkeleton() {
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
export function BookshelfError(props: BookshelfErrorProps) {
  return (
    <div className="bookshelf-error" role="alert">
      <p>{props.message}</p>
      <button type="button" onClick={props.onRetry}>
        重新加载
      </button>
    </div>
  );
}

// CreateBookButtonProps 表示开启新卷按钮需要的外部回调。
interface CreateBookButtonProps {
  // onClick 表示点击开启新卷按钮时执行的回调。
  onClick: () => void;
}

// CreateBookButton 渲染开启新卷按钮。
// 参数 props 表示开启新卷按钮需要的外部回调。
function CreateBookButton(props: CreateBookButtonProps) {
  return (
    <button
      type="button"
      className="create-book-button"
      aria-label="开启新卷"
      onClick={props.onClick}
    >
      <span className="create-book-symbol" aria-hidden="true">
        ＋
      </span>
      <span className="create-book-text">开启新卷</span>
    </button>
  );
}

// renderNovelCard 渲染小说列表中的单个小说卡片。
// 参数 novel 表示当前需要渲染的小说；参数 index 表示小说在列表中的位置；参数 onNovelSelect 表示用户选择小说时执行的回调；参数 onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
function renderNovelCard(
  novel: NovelItem,
  index: number,
  onNovelSelect: (novelId: number) => void,
  onUnauthorized: () => void,
) {
  return (
    <NovelCard
      key={novel.id}
      novel={novel}
      index={index}
      onSelect={onNovelSelect}
      onUnauthorized={onUnauthorized}
    />
  );
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

// getCoverToneClass 根据小说位置选择封面配色。
// 参数 index 表示当前小说在列表中的位置。
function getCoverToneClass(index: number): string {
  return coverToneClasses[index % coverToneClasses.length];
}

// getBookStatusClassName 获取书架卡片状态标签的样式类名。
// 参数 status 表示已经标准化后的小说状态。
function getBookStatusClassName(status: string): string {
  return status === "已完结" ? "book-status-finished" : "book-status-ongoing";
}
