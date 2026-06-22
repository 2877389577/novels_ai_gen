import { useEffect, useState } from "react";

import { UnauthorizedError, refreshImagePreview, type NovelItem } from "../api";
import {
  formatUpdatedText,
  getCoverInitial,
  isPrivateObjectKey,
  normalizeNovelStatus,
  normalizeText,
  splitNovelTags,
} from "../novel-utils";

// NovelDetailHeroProps 表示小说详情主体需要展示的数据和回调。
interface NovelDetailHeroProps {
  // novel 表示当前详情页展示的小说数据。
  novel: NovelItem;
  // wordCountText 表示小说所有章节累计后的总字数展示文本。
  wordCountText: string;
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onDelete 表示点击删除作品按钮时执行的回调。
  onDelete: () => void;
  // onEdit 表示点击编辑作品按钮时执行的回调。
  onEdit: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// NovelDetailHero 渲染小说详情页主体区域。
// 参数 props 表示小说详情主体需要展示的数据和回调。
export function NovelDetailHero(props: NovelDetailHeroProps) {
  const tags = splitNovelTags(props.novel.tags, 8);
  const updatedText = formatUpdatedText(props.novel.updated_at);

  return (
    <div className="novel-detail-hero">
      <DetailCover novel={props.novel} onUnauthorized={props.onUnauthorized} />

      <article className="novel-detail-panel">
        <div className="detail-header-line" aria-hidden="true" />
        <div className="detail-title-block">
          <p className="detail-kicker">My Works</p>
          <h1 id="novel-title">{props.novel.name}</h1>
          <div className="detail-author-row">
            <span>文 / {props.novel.author_name || "未署名作者"}</span>
            <span className="detail-dot" aria-hidden="true" />
            <span>{props.wordCountText}</span>
          </div>
          <p className="detail-updated">{updatedText}</p>
        </div>

        <DetailTagList tags={tags} />

        <section className="detail-synopsis" aria-labelledby="synopsis-title">
          <div className="detail-corner detail-corner-left-top" />
          <div className="detail-corner detail-corner-right-top" />
          <div className="detail-corner detail-corner-left-bottom" />
          <div className="detail-corner detail-corner-right-bottom" />
          <h2 id="synopsis-title">
            <span aria-hidden="true">✦</span>
            内容简介
          </h2>
          <p>{props.novel.description || "这部作品还没有写下简介。"}</p>
        </section>

        <div className="detail-actions">
          <button
            type="button"
            className="detail-primary-button"
            onClick={props.onEdit}
          >
            <span aria-hidden="true">✎</span>
            <span>编辑作品</span>
          </button>
          <button
            type="button"
            className="detail-ghost-button"
            onClick={props.onDelete}
          >
            <span aria-hidden="true">×</span>
            <span>删除作品</span>
          </button>
        </div>
      </article>

      <div className="detail-watermark" aria-hidden="true">
        {getCoverInitial(props.novel.name)}
      </div>
    </div>
  );
}

// DetailCoverProps 表示详情页封面需要展示的数据。
interface DetailCoverProps {
  // novel 表示当前封面对应的小说数据。
  novel: NovelItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// DetailCover 渲染详情页封面和状态签。
// 参数 props 表示详情页封面需要展示的数据。
function DetailCover(props: DetailCoverProps) {
  const [resolvedCoverURL, setResolvedCoverURL] = useState("");
  const rawCoverURL = normalizeText(props.novel.cover_url);
  const status = normalizeNovelStatus(props.novel.status);
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
    <aside className="detail-cover-wrap" aria-label={`${props.novel.name}封面`}>
      <div className="detail-cover-frame" aria-hidden="true" />
      <div className="detail-cover-paper">
        {coverURL ? (
          <img src={coverURL} alt={`${props.novel.name}封面`} />
        ) : (
          <div className="detail-cover-placeholder" aria-hidden="true">
            <span>{getCoverInitial(props.novel.name)}</span>
          </div>
        )}
      </div>
      <div
        className={`detail-status-ribbon ${getDetailStatusClassName(status)}`}
      >
        <span>{status}</span>
      </div>
    </aside>
  );
}

// DetailTagListProps 表示详情页标签列表需要展示的数据。
interface DetailTagListProps {
  // tags 表示需要展示的小说标签列表。
  tags: string[];
}

// DetailTagList 渲染详情页标签列表。
// 参数 props 表示详情页标签列表需要展示的数据。
function DetailTagList(props: DetailTagListProps) {
  const tags = props.tags.length > 0 ? props.tags : ["未分类"];

  return <div className="detail-tags">{tags.map(renderDetailTag)}</div>;
}

// renderDetailTag 渲染详情页单个标签。
// 参数 tag 表示需要渲染的标签文本。
function renderDetailTag(tag: string) {
  return (
    <span className="detail-tag" key={tag}>
      {tag}
    </span>
  );
}

// NovelDetailSkeleton 渲染详情页加载中的占位内容。
export function NovelDetailSkeleton() {
  return (
    <div className="novel-detail-hero detail-skeleton" aria-label="详情加载中">
      <div className="detail-cover-wrap">
        <div className="detail-cover-paper" />
      </div>
      <div className="novel-detail-panel">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

// NovelDetailErrorProps 表示详情页错误状态需要展示的数据和回调。
interface NovelDetailErrorProps {
  // message 表示详情加载失败时展示的错误提示。
  message: string;
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onRetry 表示点击重试按钮时执行的回调。
  onRetry: () => void;
}

// NovelDetailError 渲染详情页错误状态。
// 参数 props 表示详情页错误状态需要展示的数据和回调。
export function NovelDetailError(props: NovelDetailErrorProps) {
  return (
    <div className="detail-error" role="alert">
      <p>{props.message}</p>
      <div>
        <button type="button" onClick={props.onRetry}>
          重新加载
        </button>
        <button type="button" onClick={props.onBackToBookshelf}>
          返回书架
        </button>
      </div>
    </div>
  );
}

// getDetailStatusClassName 获取详情页状态竖签的样式类名。
// 参数 status 表示已经标准化后的小说状态。
function getDetailStatusClassName(status: string): string {
  return status === "已完结"
    ? "detail-status-ribbon-finished"
    : "detail-status-ribbon-ongoing";
}
