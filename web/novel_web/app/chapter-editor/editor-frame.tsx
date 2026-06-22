export function ChapterEditorSkeleton() {
  return (
    <div className="chapter-editor-paper chapter-editor-skeleton" aria-label="章节加载中">
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
export function ChapterEditorError(props: ChapterEditorErrorProps) {
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
