import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";

import {
  UnauthorizedError,
  createNovelSummary,
  deleteNovelSummary,
  fetchNovelSummary,
  updateNovelSummary,
  type NovelItem,
  type NovelSummaryItem,
} from "../api";
import { formatUpdatedText } from "../novel-utils";
import { getErrorMessage } from "./detail-utils";
import {
  createEmptyNovelSummaryRangeDraft,
  formatNovelSummaryRange,
  novelSummaryToRangeDraft,
  parseNovelSummaryRangeDraft,
  type NovelSummaryRangeDraft,
} from "./novel-summary-utils";

// NovelSummaryPanelState 表示小说总结面板的数据加载状态。
type NovelSummaryPanelState = "loading" | "ready" | "empty" | "error";

// NovelSummaryPanelProps 表示小说总结面板需要的小说数据和回调。
interface NovelSummaryPanelProps {
  // novel 表示当前总结所属的小说数据。
  novel: NovelItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// NovelSummaryPanel 渲染小说滚动总结的查询、创建、编辑和删除界面。
// 参数 props 表示小说总结面板需要的小说数据和回调。
export function NovelSummaryPanel(props: NovelSummaryPanelProps) {
  const [state, setState] = useState<NovelSummaryPanelState>("loading");
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState<NovelSummaryItem | null>(null);
  const [draft, setDraft] = useState("");
  const [rangeDraft, setRangeDraft] = useState<NovelSummaryRangeDraft>({
    startChapterNumber: "0",
    endChapterNumber: "0",
  });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const onUnauthorized = props.onUnauthorized;

  // loadNovelSummary 从后端加载当前小说的滚动总结。
  // 参数 signal 表示可选的请求取消信号。
  const loadNovelSummary = useCallback(
    async function loadNovelSummary(signal?: AbortSignal) {
      setState("loading");
      setMessage("");
      setEditing(false);

      try {
        const data = await fetchNovelSummary(props.novel.id, signal);
        setSummary(data);
        setDraft(data.content);
        setRangeDraft(novelSummaryToRangeDraft(data));
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        if (isNovelSummaryMissingError(error)) {
          setSummary(null);
          setDraft("");
          setRangeDraft(createEmptyNovelSummaryRangeDraft());
          setState("empty");
          return;
        }

        setSummary(null);
        setDraft("");
        setRangeDraft(createEmptyNovelSummaryRangeDraft());
        setState("error");
        setMessage(getErrorMessage(error, "小说总结加载失败，请稍后再试"));
      }
    },
    [onUnauthorized, props.novel.id],
  );

  // loadNovelSummaryOnChange 在小说变化时加载对应总结。
  useEffect(
    function loadNovelSummaryOnChange() {
      const controller = new AbortController();
      void loadNovelSummary(controller.signal);

      return function cancelNovelSummaryLoad() {
        controller.abort();
      };
    },
    [loadNovelSummary],
  );

  // handleRetrySummary 处理总结加载失败后的重试。
  function handleRetrySummary() {
    void loadNovelSummary();
  }

  // handleStartCreateSummary 进入新建小说总结状态。
  function handleStartCreateSummary() {
    setDraft("");
    setRangeDraft(createEmptyNovelSummaryRangeDraft());
    setEditing(true);
  }

  // handleStartEditSummary 进入编辑已有小说总结状态。
  function handleStartEditSummary() {
    setDraft(summary?.content ?? "");
    setRangeDraft(
      summary
        ? novelSummaryToRangeDraft(summary)
        : createEmptyNovelSummaryRangeDraft(),
    );
    setEditing(true);
  }

  // handleCancelEditSummary 取消当前总结编辑。
  function handleCancelEditSummary() {
    if (saving) {
      return;
    }

    setDraft(summary?.content ?? "");
    setRangeDraft(
      summary
        ? novelSummaryToRangeDraft(summary)
        : createEmptyNovelSummaryRangeDraft(),
    );
    setEditing(false);
  }

  // handleSummaryDraftChange 同步小说总结正文草稿。
  // 参数 event 表示总结正文输入框变更事件。
  function handleSummaryDraftChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(event.target.value);
  }

  // handleSummaryStartChapterChange 同步小说总结起始章节号草稿。
  // 参数 event 表示起始章节号输入框变更事件。
  function handleSummaryStartChapterChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    setRangeDraft(function updateStartChapterDraft(currentDraft) {
      return { ...currentDraft, startChapterNumber: event.target.value };
    });
  }

  // handleSummaryEndChapterChange 同步小说总结结束章节号草稿。
  // 参数 event 表示结束章节号输入框变更事件。
  function handleSummaryEndChapterChange(event: ChangeEvent<HTMLInputElement>) {
    setRangeDraft(function updateEndChapterDraft(currentDraft) {
      return { ...currentDraft, endChapterNumber: event.target.value };
    });
  }

  // handleSaveSummary 保存当前小说总结草稿。
  async function handleSaveSummary() {
    const range = parseNovelSummaryRangeDraft(rangeDraft);
    if (!range.valid) {
      Toast.warning(range.message);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        content: draft,
        start_chapter_number: range.startChapterNumber,
        end_chapter_number: range.endChapterNumber,
      };
      const data = summary
        ? await updateNovelSummary(props.novel.id, payload)
        : await createNovelSummary(props.novel.id, payload);
      setSummary(data);
      setDraft(data.content);
      setRangeDraft(novelSummaryToRangeDraft(data));
      setState("ready");
      setEditing(false);
      Toast.success("小说总结已保存");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "小说总结保存失败，请稍后再试"));
    } finally {
      setSaving(false);
    }
  }

  // handleOpenDeleteSummary 打开删除小说总结确认弹窗。
  function handleOpenDeleteSummary() {
    if (!summary || saving) {
      return;
    }

    setDeleteVisible(true);
  }

  // handleCloseDeleteSummary 关闭删除小说总结确认弹窗。
  function handleCloseDeleteSummary() {
    if (deleting) {
      return;
    }

    setDeleteVisible(false);
  }

  // handleDeleteSummary 确认删除当前小说总结。
  async function handleDeleteSummary() {
    if (!summary) {
      setDeleteVisible(false);
      return;
    }

    setDeleting(true);

    try {
      await deleteNovelSummary(props.novel.id);
      setSummary(null);
      setDraft("");
      setRangeDraft(createEmptyNovelSummaryRangeDraft());
      setEditing(false);
      setState("empty");
      setDeleteVisible(false);
      Toast.success("小说总结已删除");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "小说总结删除失败，请稍后再试"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section
        className="novel-summary-panel"
        id="novel-summary-panel"
        role="tabpanel"
        aria-label={`${props.novel.name}小说总结`}
      >
        <div className="character-card-panel-header novel-summary-panel-header">
          <p className="detail-kicker">Story Summary</p>
          <div>
            <h1>剧情总纲</h1>
            <p>沉淀整部作品当前最重要的剧情脉络。</p>
          </div>
          <div className="novel-summary-actions">
            {state === "empty" && !editing ? (
              <button
                type="button"
                className="novel-summary-primary-action"
                onClick={handleStartCreateSummary}
              >
                新建总结
              </button>
            ) : null}
            {state === "ready" && !editing ? (
              <>
                <button type="button" onClick={handleStartEditSummary}>
                  编辑
                </button>
                <button
                  type="button"
                  className="novel-summary-danger-action"
                  onClick={handleOpenDeleteSummary}
                >
                  删除
                </button>
              </>
            ) : null}
            {editing ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCancelEditSummary}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="novel-summary-primary-action"
                  disabled={saving}
                  onClick={handleSaveSummary}
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {state === "loading" ? <NovelSummarySkeleton /> : null}
        {state === "error" ? (
          <div className="novel-summary-error" role="alert">
            <p>{message}</p>
            <button type="button" onClick={handleRetrySummary}>
              重新加载
            </button>
          </div>
        ) : null}
        {state === "empty" && !editing ? (
          <div className="novel-summary-empty">
            <strong>《{props.novel.name}》还没有小说总结</strong>
            <p>可以在这里保存整部小说当前唯一的滚动剧情总结。</p>
          </div>
        ) : null}
        {editing ? (
          <div className="novel-summary-editor">
            <div className="novel-summary-range-editor">
              <label>
                <span>起始章节</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={rangeDraft.startChapterNumber}
                  disabled={saving}
                  placeholder="0"
                  onChange={handleSummaryStartChapterChange}
                />
              </label>
              <label>
                <span>结束章节</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={rangeDraft.endChapterNumber}
                  disabled={saving}
                  placeholder="0"
                  onChange={handleSummaryEndChapterChange}
                />
              </label>
              <p>填 0 表示暂不记录；记录范围时起止章节都需要大于 0。</p>
            </div>
            <label className="novel-summary-content-editor">
              <span>总结正文</span>
              <textarea
                value={draft}
                rows={14}
                disabled={saving}
                placeholder="写下当前剧情主线、人物状态、伏笔进展和下一阶段方向"
                onChange={handleSummaryDraftChange}
              />
            </label>
          </div>
        ) : null}
        {state === "ready" && summary && !editing ? (
          <article className="novel-summary-viewer">
            <div className="novel-summary-meta">
              <span>最后更新</span>
              <time dateTime={summary.updated_at}>
                {formatUpdatedText(summary.updated_at)}
              </time>
              <span>覆盖范围</span>
              <strong>{formatNovelSummaryRange(summary)}</strong>
            </div>
            <div
              className={
                summary.content
                  ? "novel-summary-content"
                  : "novel-summary-content novel-summary-content-empty"
              }
            >
              {summary.content || "当前总结为空，可点击编辑补充内容。"}
            </div>
          </article>
        ) : null}
      </section>

      <Modal
        className="delete-novel-modal"
        title="删除小说总结"
        visible={deleteVisible}
        width={420}
        okText="确认删除"
        cancelText="取消"
        confirmLoading={deleting}
        maskClosable={!deleting}
        closable={!deleting}
        onOk={handleDeleteSummary}
        onCancel={handleCloseDeleteSummary}
      >
        <p>将删除《{props.novel.name}》当前保存的滚动剧情总结。</p>
      </Modal>
    </>
  );
}

// NovelSummarySkeleton 渲染小说总结加载中的占位内容。
function NovelSummarySkeleton() {
  return (
    <div className="novel-summary-skeleton" aria-label="小说总结加载中">
      <span />
      <span />
      <span />
    </div>
  );
}

// isNovelSummaryMissingError 判断错误是否表示小说总结尚未创建。
// 参数 error 表示捕获到的未知错误。
function isNovelSummaryMissingError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("小说总结不存在");
}
