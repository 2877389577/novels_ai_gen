import {
  IconAlertTriangle,
  IconClose,
  IconDeleteStroked,
  IconEditStroked,
  IconRedoStroked,
  IconTick,
} from "@douyinfe/semi-icons";
import { Button } from "@douyinfe/semi-ui-19";
import type {
  DialogueRenderConfig,
  RenderActionProps,
  RenderContentProps,
} from "@douyinfe/semi-ui-19/lib/es/aiChatDialogue/interface";
import type { ChapterAiMessage } from "./types";
import { handleChapterAiPendingMessageAction } from "./chapter-ai-utils";

// createChapterAiDialogueRenderConfig 创建章节 AI 对话消息操作区渲染配置。
// 参数 retry 表示用户点击重试按钮时需要执行的回调；参数 approveApproval 表示用户批准工具执行时需要执行的回调；参数 rejectApproval 表示用户拒绝工具执行时需要执行的回调。
export function createChapterAiDialogueRenderConfig(
  retry: (message: ChapterAiMessage) => void,
  approveApproval: (message: ChapterAiMessage) => void,
  rejectApproval: (message: ChapterAiMessage) => void,
): DialogueRenderConfig {
  return {
    renderDialogueContent(contentProps) {
      return (
        <ChapterAiDialogueContent
          approveApproval={approveApproval}
          contentProps={contentProps}
          rejectApproval={rejectApproval}
        />
      );
    },
    renderDialogueAction(actionProps) {
      return (
        <ChapterAiDialogueAction actionProps={actionProps} retry={retry} />
      );
    },
  };
}

// ChapterAiDialogueContentProps 表示章节 AI 消息内容区需要的渲染参数。
interface ChapterAiDialogueContentProps {
  // contentProps 表示 Semi AIChatDialogue 传入的默认内容节点和样式类名。
  contentProps: RenderContentProps;
  // approveApproval 表示用户批准工具执行时需要执行的回调。
  approveApproval: (message: ChapterAiMessage) => void;
  // rejectApproval 表示用户拒绝工具执行时需要执行的回调。
  rejectApproval: (message: ChapterAiMessage) => void;
}

// ChapterAiDialogueContent 渲染章节 AI 消息内容，并在需要时追加工具人工审核面板。
// 参数 props 表示章节 AI 消息内容区需要的渲染参数。
function ChapterAiDialogueContent(props: ChapterAiDialogueContentProps) {
  const message = props.contentProps.message as ChapterAiMessage | undefined;
  const approval = message?.chapterAiApproval;

  return (
    <div className={props.contentProps.className}>
      {props.contentProps.defaultContent}
      {shouldRenderChapterAiLoading(message) ? (
        <span className="semi-ai-chat-dialogue-content-loading">
          <span className="semi-ai-chat-dialogue-content-loading-item" />
          <span className="semi-ai-chat-dialogue-content-loading-item" />
          <span className="semi-ai-chat-dialogue-content-loading-item" />
          <span className="semi-ai-chat-dialogue-content-loading-text">
            加载中
          </span>
        </span>
      ) : null}
      {message && approval ? (
        <div className="chapter-ai-approval-panel">
          <div className="chapter-ai-approval-meta">
            <span>{approval.message || "工具执行需要人工审核"}</span>
            <strong>{approval.toolName || "未命名工具"}</strong>
          </div>
          {approval.toolArguments ? (
            <pre className="chapter-ai-approval-args">
              {formatToolArguments(approval.toolArguments)}
            </pre>
          ) : null}
          <div className="chapter-ai-approval-actions">
            <Button
              disabled={approval.status === "submitting"}
              htmlType="button"
              icon={<IconClose aria-hidden="true" />}
              loading={approval.status === "submitting"}
              onClick={function rejectToolApproval(event) {
                event.preventDefault();
                event.stopPropagation();
                props.rejectApproval(message);
              }}
              size="small"
              theme="outline"
              type="danger"
            >
              拒绝
            </Button>
            <Button
              disabled={approval.status === "submitting"}
              htmlType="button"
              icon={<IconTick aria-hidden="true" />}
              loading={approval.status === "submitting"}
              onClick={function approveToolApproval(event) {
                event.preventDefault();
                event.stopPropagation();
                props.approveApproval(message);
              }}
              size="small"
              theme="solid"
              type="primary"
            >
              批准
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// shouldRenderChapterAiLoading 判断自定义内容渲染中是否需要补回 Semi 默认加载动画。
// 参数 message 表示当前需要渲染的章节 AI 消息。
function shouldRenderChapterAiLoading(
  message: ChapterAiMessage | undefined,
): boolean {
  if (!message || message.chapterAiApproval) {
    return false;
  }
  const status = typeof message.status === "string" ? message.status : "";
  if (!["queued", "in_progress", "incomplete"].includes(status)) {
    return false;
  }
  const content = typeof message.content === "string" ? message.content : "";
  const outputText = readChapterAiOutputText(message);
  return content.length === 0 && outputText.length === 0;
}

// shouldRenderChapterAiFailure 判断自定义内容渲染中是否需要显示用户消息失败标识。
// 参数 message 表示当前需要渲染的章节 AI 消息。
function shouldRenderChapterAiFailure(
  message: ChapterAiMessage | undefined,
): message is ChapterAiMessage {
  return message?.role === "user" && message.status === "failed";
}

// readChapterAiOutputText 读取 Semi 消息对象中可能存在的输出文本字段。
// 参数 message 表示当前需要渲染的章节 AI 消息。
function readChapterAiOutputText(message: ChapterAiMessage): string {
  const value = (message as { output_text?: unknown }).output_text;
  return typeof value === "string" ? value : "";
}

// formatToolArguments 将工具参数压缩为适合消息气泡展示的摘要文本。
// 参数 argumentsInJSON 表示后端返回的工具调用参数 JSON 字符串。
function formatToolArguments(argumentsInJSON: string): string {
  const trimmedArguments = argumentsInJSON.trim();
  if (!trimmedArguments) {
    return "";
  }
  try {
    return JSON.stringify(JSON.parse(trimmedArguments), null, 2);
  } catch {
    return trimmedArguments;
  }
}

// ChapterAiDialogueActionProps 表示章节 AI 消息操作区需要的渲染参数。
interface ChapterAiDialogueActionProps {
  // actionProps 表示 Semi AIChatDialogue 传入的默认操作节点和样式类名。
  actionProps: RenderActionProps;
  // retry 表示用户点击重试按钮时需要执行的回调。
  retry: (message: ChapterAiMessage) => void;
}

// ChapterAiDialogueAction 渲染章节 AI 对话消息操作区，按消息角色保留允许的操作按钮。
// 参数 props 表示章节 AI 消息操作区需要的渲染参数。
function ChapterAiDialogueAction(props: ChapterAiDialogueActionProps) {
  const copyNode = props.actionProps.defaultActionsObj?.copyNode ?? null;
  const message = props.actionProps.message as ChapterAiMessage | undefined;
  const failed = shouldRenderChapterAiFailure(message);
  const actionClassName = failed
    ? `${props.actionProps.className} chapter-ai-dialogue-action-failed`
    : props.actionProps.className;
  if (message?.role !== "user") {
    return <div className={props.actionProps.className}>{copyNode}</div>;
  }

  return (
    <div className={actionClassName}>
      {copyNode}
      {failed ? (
        <span
          aria-label={message.chapterAiFailureMessage || "消息发送失败"}
          className="chapter-ai-failure-indicator"
          title={message.chapterAiFailureMessage || "消息发送失败"}
        >
          <IconAlertTriangle aria-hidden="true" />
          <span>发送失败</span>
        </span>
      ) : null}
      {message.chapterAiRetryable === true && message.status === "failed" ? (
        <Button
          aria-label="将失败消息重新填入输入框"
          className="semi-ai-chat-dialogue-action-btn chapter-ai-retry-action"
          htmlType="button"
          icon={<IconRedoStroked aria-hidden="true" />}
          onClick={function retryChapterAiMessage(event) {
            event.preventDefault();
            event.stopPropagation();
            props.retry(message);
          }}
          size="small"
          theme="outline"
          title="重试"
          type="danger"
        >
          重试
        </Button>
      ) : null}
      <Button
        aria-label="修改用户消息"
        className="semi-ai-chat-dialogue-action-btn"
        htmlType="button"
        icon={<IconEditStroked aria-hidden="true" />}
        onClick={handleChapterAiPendingMessageAction}
        theme="borderless"
        title="修改"
        type="tertiary"
      />
      <Button
        aria-label="删除用户消息"
        className="semi-ai-chat-dialogue-action-btn"
        htmlType="button"
        icon={<IconDeleteStroked aria-hidden="true" />}
        onClick={handleChapterAiPendingMessageAction}
        theme="borderless"
        title="删除"
        type="tertiary"
      />
    </div>
  );
}
