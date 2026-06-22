import { IconDeleteStroked, IconEditStroked, IconRedoStroked } from "@douyinfe/semi-icons";
import { Button } from "@douyinfe/semi-ui-19";
import type {
  DialogueRenderConfig,
  RenderActionProps,
} from "@douyinfe/semi-ui-19/lib/es/aiChatDialogue/interface";
import type { ChapterAiMessage } from "./types";
import { handleChapterAiPendingMessageAction } from "./chapter-ai-utils";

// createChapterAiDialogueRenderConfig 创建章节 AI 对话消息操作区渲染配置。
// 参数 retry 表示用户点击重试按钮时需要执行的回调。
export function createChapterAiDialogueRenderConfig(
  retry: (message: ChapterAiMessage) => void,
): DialogueRenderConfig {
  return {
    renderDialogueAction(actionProps) {
      return (
        <ChapterAiDialogueAction actionProps={actionProps} retry={retry} />
      );
    },
  };
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
  if (message?.role !== "user") {
    return <div className={props.actionProps.className}>{copyNode}</div>;
  }

  return (
    <div className={props.actionProps.className}>
      {copyNode}
      {message.chapterAiRetryable === true ? (
        <Button
          aria-label="重试用户消息"
          className="semi-ai-chat-dialogue-action-btn"
          htmlType="button"
          icon={<IconRedoStroked aria-hidden="true" />}
          onClick={function retryChapterAiMessage(event) {
            event.preventDefault();
            event.stopPropagation();
            props.retry(message);
          }}
          theme="borderless"
          title="重试"
          type="tertiary"
        />
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
