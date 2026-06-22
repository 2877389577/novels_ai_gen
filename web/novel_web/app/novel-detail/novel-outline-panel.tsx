import MarkdownRender from "@douyinfe/semi-ui-19/lib/es/markdownRender";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import { useCallback, useEffect, useState, type ChangeEvent } from "react";

import {
  UnauthorizedError,
  createNovelOutline,
  deleteNovelOutline,
  fetchNovelOutline,
  updateNovelOutline,
  type NovelItem,
  type NovelOutlineItem,
} from "../api";
import { formatUpdatedText } from "../novel-utils";
import { getErrorMessage } from "./detail-utils";

// NovelOutlinePanelState 表示小说大纲面板的数据加载状态。
type NovelOutlinePanelState = "loading" | "ready" | "empty" | "error";

// NovelOutlinePanelProps 表示小说大纲面板需要的小说数据和回调。
interface NovelOutlinePanelProps {
  // novel 表示当前大纲所属的小说数据。
  novel: NovelItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// NovelOutlinePanel 渲染小说大纲的查询、创建、编辑和删除界面。
// 参数 props 表示小说大纲面板需要的小说数据和回调。
export function NovelOutlinePanel(props: NovelOutlinePanelProps) {
  const [state, setState] = useState<NovelOutlinePanelState>("loading");
  const [message, setMessage] = useState("");
  const [outline, setOutline] = useState<NovelOutlineItem | null>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const onUnauthorized = props.onUnauthorized;

  // loadNovelOutline 从后端加载当前小说的大纲。
  // 参数 signal 表示可选的请求取消信号。
  const loadNovelOutline = useCallback(
    async function loadNovelOutline(signal?: AbortSignal) {
      setState("loading");
      setMessage("");
      setEditing(false);

      try {
        const data = await fetchNovelOutline(props.novel.id, signal);
        setOutline(data);
        setDraft(data.content);
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        if (isNovelOutlineMissingError(error)) {
          setOutline(null);
          setDraft("");
          setState("empty");
          return;
        }

        setOutline(null);
        setDraft("");
        setState("error");
        setMessage(getErrorMessage(error, "小说大纲加载失败，请稍后再试"));
      }
    },
    [onUnauthorized, props.novel.id],
  );

  // loadNovelOutlineOnChange 在小说变化时加载对应大纲。
  useEffect(
    function loadNovelOutlineOnChange() {
      const controller = new AbortController();
      void loadNovelOutline(controller.signal);

      return function cancelNovelOutlineLoad() {
        controller.abort();
      };
    },
    [loadNovelOutline],
  );

  // handleRetryOutline 处理大纲加载失败后的重试。
  function handleRetryOutline() {
    void loadNovelOutline();
  }

  // handleStartCreateOutline 进入新建小说大纲状态。
  function handleStartCreateOutline() {
    setDraft("");
    setEditing(true);
  }

  // handleStartEditOutline 进入编辑已有小说大纲状态。
  function handleStartEditOutline() {
    setDraft(outline?.content ?? "");
    setEditing(true);
  }

  // handleCancelEditOutline 取消当前大纲编辑。
  function handleCancelEditOutline() {
    if (saving) {
      return;
    }

    setDraft(outline?.content ?? "");
    setEditing(false);
  }

  // handleOutlineDraftChange 同步小说大纲正文草稿。
  // 参数 event 表示大纲正文输入框变更事件。
  function handleOutlineDraftChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setDraft(event.target.value);
  }

  // handleSaveOutline 保存当前小说大纲草稿。
  async function handleSaveOutline() {
    setSaving(true);

    try {
      const payload = { content: draft };
      const data = outline
        ? await updateNovelOutline(props.novel.id, payload)
        : await createNovelOutline(props.novel.id, payload);
      setOutline(data);
      setDraft(data.content);
      setState("ready");
      setEditing(false);
      Toast.success("小说大纲已保存");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "小说大纲保存失败，请稍后再试"));
    } finally {
      setSaving(false);
    }
  }

  // handleOpenDeleteOutline 打开删除小说大纲确认弹窗。
  function handleOpenDeleteOutline() {
    if (!outline || saving) {
      return;
    }

    setDeleteVisible(true);
  }

  // handleCloseDeleteOutline 关闭删除小说大纲确认弹窗。
  function handleCloseDeleteOutline() {
    if (deleting) {
      return;
    }

    setDeleteVisible(false);
  }

  // handleDeleteOutline 确认删除当前小说大纲。
  async function handleDeleteOutline() {
    if (!outline) {
      setDeleteVisible(false);
      return;
    }

    setDeleting(true);

    try {
      await deleteNovelOutline(props.novel.id);
      setOutline(null);
      setDraft("");
      setEditing(false);
      setState("empty");
      setDeleteVisible(false);
      Toast.success("小说大纲已删除");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "小说大纲删除失败，请稍后再试"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section
        className="novel-outline-panel"
        id="novel-outline-panel"
        role="tabpanel"
        aria-label={`${props.novel.name}小说大纲`}
      >
        <div className="character-card-panel-header novel-outline-panel-header">
          <p className="detail-kicker">Story Outline</p>
          <div>
            <h1>作品大纲</h1>
            <p>集中保存这部小说的结构、卷章规划和关键转折。</p>
          </div>
          <div className="novel-outline-actions">
            {state === "empty" && !editing ? (
              <button
                type="button"
                className="novel-outline-primary-action"
                onClick={handleStartCreateOutline}
              >
                新建大纲
              </button>
            ) : null}
            {state === "ready" && !editing ? (
              <>
                <button type="button" onClick={handleStartEditOutline}>
                  编辑
                </button>
                <button
                  type="button"
                  className="novel-outline-danger-action"
                  onClick={handleOpenDeleteOutline}
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
                  onClick={handleCancelEditOutline}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="novel-outline-primary-action"
                  disabled={saving}
                  onClick={handleSaveOutline}
                >
                  {saving ? "保存中..." : "保存"}
                </button>
              </>
            ) : null}
          </div>
        </div>

        {state === "loading" ? <NovelOutlineSkeleton /> : null}
        {state === "error" ? (
          <div className="novel-outline-error" role="alert">
            <p>{message}</p>
            <button type="button" onClick={handleRetryOutline}>
              重新加载
            </button>
          </div>
        ) : null}
        {state === "empty" && !editing ? (
          <div className="novel-outline-empty">
            <strong>《{props.novel.name}》还没有小说大纲</strong>
            <p>可以在这里用 Markdown 记录卷章规划、主线推进和关键设定。</p>
          </div>
        ) : null}
        {editing ? (
          <div className="novel-outline-editor">
            <label className="novel-outline-content-editor">
              <span>大纲正文</span>
              <textarea
                value={draft}
                rows={18}
                disabled={saving}
                placeholder="支持 Markdown：用标题整理卷章，用列表记录剧情节点"
                onChange={handleOutlineDraftChange}
              />
            </label>
          </div>
        ) : null}
        {state === "ready" && outline && !editing ? (
          <article className="novel-outline-viewer">
            <div className="novel-outline-meta">
              <span>最后更新</span>
              <time dateTime={outline.updated_at}>
                {formatUpdatedText(outline.updated_at)}
              </time>
            </div>
            {outline.content ? (
              <MarkdownRender
                className="novel-outline-markdown"
                raw={outline.content}
                format="md"
              />
            ) : (
              <div className="novel-outline-content-empty">
                当前大纲为空，可点击编辑补充内容。
              </div>
            )}
          </article>
        ) : null}
      </section>

      <Modal
        className="delete-novel-modal"
        title="删除小说大纲"
        visible={deleteVisible}
        width={420}
        okText="确认删除"
        cancelText="取消"
        confirmLoading={deleting}
        maskClosable={!deleting}
        closable={!deleting}
        onOk={handleDeleteOutline}
        onCancel={handleCloseDeleteOutline}
      >
        <p>将删除《{props.novel.name}》当前保存的大纲。</p>
      </Modal>
    </>
  );
}

// NovelOutlineSkeleton 渲染小说大纲加载中的占位内容。
function NovelOutlineSkeleton() {
  return (
    <div className="novel-outline-skeleton" aria-label="小说大纲加载中">
      <span />
      <span />
      <span />
    </div>
  );
}

// isNovelOutlineMissingError 判断错误是否表示小说大纲尚未创建。
// 参数 error 表示捕获到的未知错误。
function isNovelOutlineMissingError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("小说大纲不存在");
}
