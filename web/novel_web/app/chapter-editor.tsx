import { Form } from "@douyinfe/semi-ui-19/lib/es/form";
import type { FormApi } from "@douyinfe/semi-ui-19/lib/es/form";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  UnauthorizedError,
  createChapter,
  fetchChapterDetail,
  updateChapter,
  type ChapterCreateParams,
  type ChapterDetailItem,
  type ChapterUpdateParams,
} from "./api";
import { normalizeText } from "./novel-utils";

const emptyChapterFormValues: ChapterFormValues = {
  title: "",
  content: "",
};

// ChapterFormValues 表示章节编辑页表单值。
type ChapterFormValues = ChapterCreateParams & {
  // content 表示章节正文，可以为空。
  content: string;
};

// ChapterEditorPageProps 表示章节编辑页需要的外部参数和回调。
interface ChapterEditorPageProps {
  // novelId 表示当前章节所属小说主键 ID。
  novelId: number;
  // chapterId 表示当前需要编辑的章节主键 ID，创建章节时为空。
  chapterId: number | null;
  // onBackToNovelDetail 表示返回小说详情页时执行的回调。
  onBackToNovelDetail: (novelId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ChapterEditorState 表示章节编辑页的数据加载状态。
type ChapterEditorState = "loading" | "ready" | "error";

// ChapterEditorPage 渲染章节创建和编辑共用页面。
// 参数 props 表示章节编辑页需要的外部参数和回调。
export function ChapterEditorPage(props: ChapterEditorPageProps) {
  const isEditMode = props.chapterId !== null;
  const [state, setState] = useState<ChapterEditorState>(
    isEditMode ? "loading" : "ready",
  );
  const [message, setMessage] = useState("");
  const [chapter, setChapter] = useState<ChapterDetailItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [contentValue, setContentValue] = useState("");
  const formApiRef = useRef<FormApi<ChapterFormValues> | null>(null);
  const onUnauthorized = props.onUnauthorized;
  const liveWordCount = useMemo(
    function calculateLiveWordCount() {
      return countNonWhitespaceCharacters(contentValue);
    },
    [contentValue],
  );

  // handleGetFormApi 保存 Semi 表单 API，供保存按钮触发表单校验。
  // 参数 formApi 表示 Semi Form 暴露的表单操作对象。
  const handleGetFormApi = useCallback(function handleGetFormApi(
    formApi: FormApi<ChapterFormValues>,
  ) {
    formApiRef.current = formApi;
  }, []);

  // loadChapterDetail 在编辑模式下加载章节详情。
  // 参数 signal 表示可选的请求取消信号。
  const loadChapterDetail = useCallback(
    async function loadChapterDetail(signal?: AbortSignal) {
      if (props.chapterId === null) {
        setChapter(null);
        setContentValue("");
        setState("ready");
        return;
      }

      setState("loading");
      setMessage("");

      try {
        const data = await fetchChapterDetail(
          props.novelId,
          props.chapterId,
          signal,
        );
        setChapter(data);
        setContentValue(data.content);
        setState("ready");
        formApiRef.current?.setValues(chapterToFormValues(data), {
          isOverride: true,
        });
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
          error instanceof Error ? error.message : "章节详情加载失败，请稍后再试",
        );
      }
    },
    [onUnauthorized, props.chapterId, props.novelId],
  );

  // loadChapterWhenRouteChanges 在路由参数变化时同步章节数据。
  useEffect(
    function loadChapterWhenRouteChanges() {
      if (props.chapterId === null) {
        setChapter(null);
        setContentValue("");
        setState("ready");
        setMessage("");
        formApiRef.current?.setValues(emptyChapterFormValues, {
          isOverride: true,
        });
        return;
      }

      const controller = new AbortController();
      void loadChapterDetail(controller.signal);

      return function cancelChapterDetailLoad() {
        controller.abort();
      };
    },
    [loadChapterDetail, props.chapterId],
  );

  // handleBack 处理返回小说详情页。
  function handleBack() {
    if (submitting) {
      return;
    }

    props.onBackToNovelDetail(props.novelId);
  }

  // handleRetry 处理章节详情加载失败后的重试。
  function handleRetry() {
    void loadChapterDetail();
  }

  // handleContentChange 同步正文输入，用于实时统计当前字数。
  // 参数 value 表示正文输入框当前值。
  function handleContentChange(value: unknown) {
    setContentValue(typeof value === "string" ? value : "");
  }

  // handleSubmit 校验章节表单并提交创建或更新请求。
  async function handleSubmit() {
    const formApi = formApiRef.current;
    if (!formApi || submitting || state !== "ready") {
      return;
    }

    let values: ChapterFormValues;
    try {
      values = (await formApi.validate()) as ChapterFormValues;
    } catch {
      return;
    }

    setSubmitting(true);

    try {
      if (props.chapterId === null) {
        await createChapter(props.novelId, normalizeChapterFormValues(values));
        Toast.success("章节已创建");
      } else {
        await updateChapter(
          props.novelId,
          props.chapterId,
          normalizeChapterFormValues(values),
        );
        Toast.success("章节已保存");
      }

      props.onBackToNovelDetail(props.novelId);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "章节保存失败，请稍后再试"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="chapter-editor-page">
      <header className="chapter-editor-nav">
        <button type="button" className="chapter-editor-back" onClick={handleBack}>
          <span aria-hidden="true">←</span>
          <span>返回作品详情</span>
        </button>
        <div className="chapter-editor-title">
          <p>{isEditMode ? "Edit Chapter" : "New Chapter"}</p>
          <h1>{isEditMode ? "修改章节" : "新增章节"}</h1>
        </div>
      </header>

      <section className="chapter-editor-shell" aria-labelledby="chapter-editor-title">
        {state === "loading" ? <ChapterEditorSkeleton /> : null}
        {state === "error" ? (
          <ChapterEditorError
            message={message}
            onBack={handleBack}
            onRetry={handleRetry}
          />
        ) : null}
        {state === "ready" ? (
          <article className="chapter-editor-panel">
            <div className="chapter-editor-heading">
              <div>
                <p className="chapter-editor-kicker">
                  {chapter ? `第 ${chapter.chapter_number} 章` : "即将落笔"}
                </p>
                <h2 id="chapter-editor-title">
                  {chapter?.title || "写下新的篇章"}
                </h2>
              </div>
              <div className="chapter-word-counter" aria-live="polite">
                <span>{liveWordCount.toLocaleString("zh-CN")}</span>
                <small>当前字数</small>
              </div>
            </div>

            <Form<ChapterFormValues>
              className="chapter-editor-form"
              initValues={chapter ? chapterToFormValues(chapter) : emptyChapterFormValues}
              layout="vertical"
              autoScrollToError
              getFormApi={handleGetFormApi}
            >
              <Form.Input
                field="title"
                label="章节名"
                placeholder="例如：第一章 风起青萍"
                trigger="blur"
                rules={[{ required: true, message: "请输入章节名" }]}
                validator={validateChapterTitle}
              />
              <Form.TextArea
                field="content"
                label="正文"
                placeholder="从这里开始写下这一章。"
                autosize={{ minRows: 18, maxRows: 32 }}
                trigger="blur"
                onChange={handleContentChange}
              />
            </Form>

            <div className="chapter-editor-actions">
              <button
                type="button"
                className="chapter-editor-save"
                disabled={submitting}
                onClick={handleSubmit}
              >
                {submitting ? "保存中..." : "保存章节"}
              </button>
              <button
                type="button"
                className="chapter-editor-cancel"
                disabled={submitting}
                onClick={handleBack}
              >
                取消
              </button>
            </div>
          </article>
        ) : null}
      </section>
    </main>
  );
}

// ChapterEditorSkeleton 渲染章节编辑页加载中的占位内容。
function ChapterEditorSkeleton() {
  return (
    <div className="chapter-editor-panel chapter-editor-skeleton" aria-label="章节加载中">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

// ChapterEditorErrorProps 表示章节编辑页错误状态需要展示的数据和回调。
interface ChapterEditorErrorProps {
  // message 表示章节加载失败时展示的错误提示。
  message: string;
  // onBack 表示返回小说详情页时执行的回调。
  onBack: () => void;
  // onRetry 表示点击重试按钮时执行的回调。
  onRetry: () => void;
}

// ChapterEditorError 渲染章节编辑页错误状态。
// 参数 props 表示章节编辑页错误状态需要展示的数据和回调。
function ChapterEditorError(props: ChapterEditorErrorProps) {
  return (
    <div className="chapter-editor-error" role="alert">
      <p>{props.message}</p>
      <div>
        <button type="button" onClick={props.onRetry}>
          重新加载
        </button>
        <button type="button" onClick={props.onBack}>
          返回详情
        </button>
      </div>
    </div>
  );
}

// chapterToFormValues 将章节详情转换成表单初始值。
// 参数 chapter 表示后端返回的章节详情数据。
function chapterToFormValues(chapter: ChapterDetailItem): ChapterFormValues {
  return {
    title: normalizeText(chapter.title),
    content: normalizeText(chapter.content),
  };
}

// normalizeChapterFormValues 清理章节表单数据。
// 参数 values 表示 Semi 表单校验后返回的原始字段值。
function normalizeChapterFormValues(
  values: ChapterFormValues,
): ChapterUpdateParams {
  return {
    title: normalizeText(values.title),
    content: normalizeText(values.content),
  };
}

// validateChapterTitle 校验章节名是否填写了非空白内容。
// 参数 value 表示章节名输入框当前值。
function validateChapterTitle(value: unknown): string {
  return normalizeText(value) ? "" : "请输入章节名";
}

// countNonWhitespaceCharacters 统计文本中的非空白 Unicode 字符数量。
// 参数 value 表示需要统计的文本。
function countNonWhitespaceCharacters(value: string): number {
  let count = 0;
  for (const char of value) {
    if (!/\s/u.test(char)) {
      count += 1;
    }
  }
  return count;
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
