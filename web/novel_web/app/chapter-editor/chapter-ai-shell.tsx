import {
  IconArrowUp,
  IconClose,
  IconDelete,
  IconPlus,
  IconStop,
} from "@douyinfe/semi-icons";
import { AIChatDialogue, Select } from "@douyinfe/semi-ui-19";
import { chapterAiAssistantRoleConfig } from "./constants";
import { useChapterAIContext } from "./chapter-ai-context";

// ChapterAiAssistantShell 渲染章节 AI 助手侧栏的组合式 UI。
export function ChapterAiAssistantShell() {
  return (
    <aside
      aria-label="AI 写作助手"
      className="chapter-ai-assistant-panel"
      id="chapter-ai-assistant-panel"
    >
      <div className="chapter-ai-assistant-card">
        <ChapterAiAssistantHeader />
        <ChapterAiConversationBar />
        <ChapterAiDialogueArea />
        <ChapterAiComposer />
      </div>
    </aside>
  );
}

// ChapterAiAssistantHeader 渲染章节 AI 助手标题和侧栏操作按钮。
function ChapterAiAssistantHeader() {
  const { state, actions, meta } = useChapterAIContext();

  return (
    <header className="chapter-ai-assistant-header">
      <div>
        <p>AI Assistant</p>
        <h2>写作助手</h2>
      </div>
      <div className="chapter-ai-assistant-actions">
        <button
          aria-label="删除当前 AI 会话"
          className="chapter-ai-assistant-clear"
          disabled={
            state.conversationLoading ||
            state.historyLoading ||
            state.conversationDeleting ||
            state.assistantSending ||
            meta.selectedConversationID === null
          }
          onClick={actions.deleteConversation}
          title="删除会话"
          type="button"
        >
          <IconDelete aria-hidden="true" />
        </button>
        <button
          aria-label="关闭 AI 写作助手"
          className="chapter-ai-assistant-close"
          onClick={actions.close}
          type="button"
        >
          <IconClose aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

// ChapterAiConversationBar 渲染 AI 会话选择和新会话入口。
function ChapterAiConversationBar() {
  const { state, actions, meta } = useChapterAIContext();

  return (
    <div className="chapter-ai-conversation-bar">
      <span
        className="chapter-ai-conversation-label"
        id="chapter-ai-conversation-label"
      >
        会话
      </span>
      <Select<string>
        aria-labelledby="chapter-ai-conversation-label"
        className="chapter-ai-conversation-select"
        disabled={
          state.conversationLoading ||
          state.assistantSending ||
          state.conversations.length === 0
        }
        loading={state.conversationLoading}
        onChange={actions.changeConversation}
        optionList={state.conversationSelectOptions}
        placeholder={meta.conversationSelectPlaceholder}
        size="small"
        value={
          meta.selectedConversationID === null
            ? undefined
            : String(meta.selectedConversationID)
        }
      />
      <button
        aria-label="开启新 AI 会话"
        className="chapter-ai-new-conversation"
        disabled={state.conversationLoading || state.assistantSending}
        onClick={actions.startNewConversation}
        title="新会话"
        type="button"
      >
        <IconPlus aria-hidden="true" />
        <span>新会话</span>
      </button>
    </div>
  );
}

// ChapterAiDialogueArea 渲染章节 AI 对话消息列表。
function ChapterAiDialogueArea() {
  const { state, meta } = useChapterAIContext();

  return (
    <div className="chapter-ai-dialogue-wrap">
      <AIChatDialogue
        align="leftRight"
        chats={state.chats}
        className="chapter-ai-dialogue"
        dialogueRenderConfig={meta.dialogueRenderConfig}
        mode="bubble"
        roleConfig={chapterAiAssistantRoleConfig}
        style={{ height: "100%" }}
      />
    </div>
  );
}

// ChapterAiComposer 渲染章节 AI 输入框和发送/中断按钮。
function ChapterAiComposer() {
  const { state, actions, meta } = useChapterAIContext();

  return (
    <form className="chapter-ai-composer" onSubmit={actions.submitForm}>
      <div className="chapter-ai-input-shell">
        <textarea
          ref={meta.assistantInputRef}
          aria-label="AI 对话输入"
          className="chapter-ai-input"
          disabled={state.assistantSending}
          onChange={actions.changeInput}
          onKeyDown={actions.handleInputKeyDown}
          placeholder="输入你的问题或写作目标..."
          rows={1}
          value={state.inputValue}
        />
        <div className="chapter-ai-input-actions">
          <button
            aria-label={state.assistantSending ? "中断 AI 回复" : "发送给 AI 写作助手"}
            className={
              state.assistantSending
                ? "chapter-ai-send chapter-ai-send-stop"
                : "chapter-ai-send"
            }
            onClick={state.assistantSending ? actions.cancel : undefined}
            title={state.assistantSending ? "中断" : "发送"}
            type={state.assistantSending ? "button" : "submit"}
          >
            {state.assistantSending ? (
              <IconStop aria-hidden="true" />
            ) : (
              <IconArrowUp aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
