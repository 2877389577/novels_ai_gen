import Modal from "@douyinfe/semi-ui-19/lib/es/modal";

import { formatUpdatedText } from "../novel-utils";
import { useChapterSummary } from "./chapter-summary-context";

// ChapterSummaryFrame 渲染章节概要页的整体界面。
export function ChapterSummaryFrame() {
  const { state, actions, meta } = useChapterSummary();
  const chapterTitle = state.summary?.title ?? `章节 ${meta.chapterId}`;
  const chapterNumber = state.summary?.chapter_number;

  return (
    <main className="chapter-summary-page">
      <nav className="chapter-summary-nav" aria-label="章节概要导航">
        <button type="button" onClick={actions.back}>
          返回小说详情
        </button>
      </nav>

      <section
        className="chapter-summary-panel"
        aria-labelledby="chapter-summary-title"
      >
        <div className="character-card-panel-header chapter-summary-header">
          <p className="detail-kicker">Chapter Summary</p>
          <div>
            <h1 id="chapter-summary-title">章节概要</h1>
            <p>
              {chapterNumber ? `第 ${chapterNumber} 章 · ` : ""}
              {chapterTitle}
            </p>
          </div>
          <ChapterSummaryActions />
        </div>

        {state.status === "loading" ? <ChapterSummarySkeleton /> : null}
        {state.status === "error" ? <ChapterSummaryError /> : null}
        {state.status === "empty" && !state.editing ? (
          <ChapterSummaryEmpty />
        ) : null}
        {state.editing ? <ChapterSummaryEditor /> : null}
        {state.status === "ready" && state.summary && !state.editing ? (
          <ChapterSummaryViewer />
        ) : null}
      </section>

      <ChapterSummaryDeleteModal />
    </main>
  );
}

// ChapterSummaryActions 渲染章节概要页顶部操作按钮。
function ChapterSummaryActions() {
  const { state, actions, meta } = useChapterSummary();

  return (
    <div className="chapter-summary-actions">
      {state.status === "empty" && !state.editing ? (
        <button
          type="button"
          className="chapter-summary-primary-action"
          onClick={actions.startCreate}
        >
          新建概要
        </button>
      ) : null}
      {state.status === "ready" && !state.editing ? (
        <>
          <button type="button" onClick={actions.startEdit}>
            编辑
          </button>
          <button
            type="button"
            className="chapter-summary-danger-action"
            disabled={!meta.hasSummary}
            onClick={actions.openDelete}
          >
            删除
          </button>
        </>
      ) : null}
      {state.editing ? (
        <>
          <button
            type="button"
            disabled={state.saving}
            onClick={actions.cancelEdit}
          >
            取消
          </button>
          <button
            type="button"
            className="chapter-summary-primary-action"
            disabled={state.saving || !meta.isDirty}
            onClick={actions.save}
          >
            {state.saving ? "保存中..." : "保存"}
          </button>
        </>
      ) : null}
    </div>
  );
}

// ChapterSummaryError 渲染章节概要加载失败状态。
function ChapterSummaryError() {
  const { state, actions } = useChapterSummary();

  return (
    <div className="chapter-summary-error" role="alert">
      <p>{state.message}</p>
      <button type="button" onClick={actions.reload}>
        重新加载
      </button>
    </div>
  );
}

// ChapterSummaryEmpty 渲染章节概要空状态。
function ChapterSummaryEmpty() {
  const { state } = useChapterSummary();
  const title = state.summary?.title ?? "当前章节";

  return (
    <div className="chapter-summary-empty">
      <strong>《{title}》还没有章节概要</strong>
      <p>可以在这里为这一章记录剧情节点、人物状态和后续伏笔。</p>
    </div>
  );
}

// ChapterSummaryEditor 渲染章节概要编辑区。
function ChapterSummaryEditor() {
  const { state, actions } = useChapterSummary();

  return (
    <div className="chapter-summary-editor">
      <label className="chapter-summary-content-editor">
        <span>概要正文</span>
        <textarea
          value={state.draft}
          rows={16}
          disabled={state.saving}
          placeholder="写下这一章的剧情推进、人物变化、伏笔和下一章衔接"
          onChange={actions.changeDraft}
        />
      </label>
    </div>
  );
}

// ChapterSummaryViewer 渲染章节概要查看区。
function ChapterSummaryViewer() {
  const { state } = useChapterSummary();
  const summary = state.summary;
  if (!summary) {
    return null;
  }

  return (
    <article className="chapter-summary-viewer">
      <div className="chapter-summary-meta">
        <span>最后更新</span>
        <time dateTime={summary.updated_at}>
          {formatUpdatedText(summary.updated_at)}
        </time>
        <span>章节</span>
        <strong>第 {summary.chapter_number} 章</strong>
      </div>
      <div
        className={
          summary.summary
            ? "chapter-summary-content"
            : "chapter-summary-content chapter-summary-content-empty"
        }
      >
        {summary.summary || "当前概要为空，可点击编辑补充内容。"}
      </div>
    </article>
  );
}

// ChapterSummaryDeleteModal 渲染章节概要删除确认弹窗。
function ChapterSummaryDeleteModal() {
  const { state, actions } = useChapterSummary();
  const title = state.summary?.title ?? "该章节";

  return (
    <Modal
      className="delete-novel-modal"
      title="删除章节概要"
      visible={state.deleteVisible}
      width={420}
      okText="确认删除"
      cancelText="取消"
      confirmLoading={state.deleting}
      maskClosable={!state.deleting}
      closable={!state.deleting}
      onOk={actions.deleteSummary}
      onCancel={actions.closeDelete}
    >
      <p>将清空《{title}》当前保存的章节概要。</p>
    </Modal>
  );
}

// ChapterSummarySkeleton 渲染章节概要加载中的占位内容。
function ChapterSummarySkeleton() {
  return (
    <div className="chapter-summary-skeleton" aria-label="章节概要加载中">
      <span />
      <span />
      <span />
    </div>
  );
}
