import type { Message } from "@douyinfe/semi-ui-19/lib/es/aiChatDialogue/interface";

// ChapterFormValues 表示章节编辑页中可由用户编辑的字段。
export interface ChapterFormValues {
  // title 表示章节名，不能为空。
  title: string;
  // content 表示章节正文，可以为空。
  content: string;
}

// ChapterAiRetryPayload 表示章节 AI 用户消息失败后可复用的原始发送参数。
export interface ChapterAiRetryPayload {
  // conversationId 表示重试时必须复用的 Agent 会话 ID，未保存的新会话为空。
  conversationId?: number;
  // message 表示原始请求发送给 AI 的用户原文。
  message: string;
}

// ChapterAiApprovalStatus 表示章节 AI 工具人工审核的前端提交状态。
export type ChapterAiApprovalStatus = "waiting" | "submitting";

// ChapterAiApprovalState 表示章节 AI 当前等待用户审核的工具调用信息。
export interface ChapterAiApprovalState {
  // checkpointId 表示后端恢复 Agent 执行所需的 checkpoint 标识。
  checkpointId: string;
  // interruptId 表示后端恢复 Agent 执行所需的中断点标识。
  interruptId: string;
  // toolName 表示等待人工审核的工具名称。
  toolName?: string;
  // toolArguments 表示等待人工审核的工具调用参数 JSON 字符串。
  toolArguments?: string;
  // message 表示后端返回的审批提示文案。
  message?: string;
  // status 表示用户是否正在提交批准或拒绝结果。
  status: ChapterAiApprovalStatus;
  // requestContext 表示恢复本轮 Agent 时复用的章节上下文。
  requestContext: ChapterAiRequestContext;
  // retryPayload 表示恢复本轮 Agent 时复用的原始用户请求。
  retryPayload: ChapterAiRetryPayload;
}

// ChapterAiApprovalDecision 表示用户对一次工具人工审核的选择。
export interface ChapterAiApprovalDecision {
  // checkpointId 表示后端恢复 Agent 执行所需的 checkpoint 标识。
  checkpointId: string;
  // interruptId 表示后端恢复 Agent 执行所需的中断点标识。
  interruptId: string;
  // approved 表示用户是否允许执行该工具。
  approved: boolean;
  // existingContent 表示恢复流继续追加前已经展示在助手消息中的文本。
  existingContent: string;
}

// ChapterAiMessage 表示章节 AI 对话在前端本地增强后的消息。
export interface ChapterAiMessage extends Message {
  // chapterAiConversationID 表示消息所属 Agent 会话 ID，本地新会话草稿可为空。
  chapterAiConversationID?: number;
  // chapterAiPairID 表示同一轮用户消息与助手消息的配对 ID。
  chapterAiPairID?: string;
  // chapterAiSourceID 表示助手消息流式更新时使用的基础消息 ID。
  chapterAiSourceID?: string;
  // chapterAiReplyIndex 表示同一次 AI 请求中的助手回复段序号，从 1 开始。
  chapterAiReplyIndex?: number;
  // chapterAiRetryable 表示该用户消息是否允许展示重试按钮。
  chapterAiRetryable?: boolean;
  // chapterAiRetryPayload 表示该用户消息重试时复用的原始发送参数。
  chapterAiRetryPayload?: ChapterAiRetryPayload;
  // chapterAiLoading 表示该消息是前端本地生成的临时加载占位消息。
  chapterAiLoading?: boolean;
  // chapterAiApproval 表示该助手消息当前等待用户审核的工具调用信息。
  chapterAiApproval?: ChapterAiApprovalState;
}

// ChapterAiRequestContext 表示发送 AI 请求前准备好的可选章节上下文。
export interface ChapterAiRequestContext {
  // chapterId 表示章节数据库主键 ID；小说级普通对话可为空。
  chapterId?: number;
  // chapterNumber 表示章节号，即“第 x 章”中的 x；小说级普通对话可为空。
  chapterNumber?: number;
}

// ChapterAiStreamRequest 表示一次章节 AI 流式请求所需的本地上下文。
export interface ChapterAiStreamRequest {
  // runId 表示需要重新订阅的后端 AI 对话运行任务 ID，新请求为空。
  runId?: string;
  // pairID 表示当前用户消息和助手消息共用的配对 ID。
  pairID: string;
  // assistantMessageID 表示当前助手消息的基础 ID。
  assistantMessageID: string;
  // requestContext 表示本次发送给后端的可选章节上下文。
  requestContext: ChapterAiRequestContext;
  // retryPayload 表示本次请求使用的原始 AI 调用参数。
  retryPayload: ChapterAiRetryPayload;
  // approvalDecision 表示本次流式请求是否用于恢复一次工具人工审核。
  approvalDecision?: ChapterAiApprovalDecision;
}

// ChapterAiReplyDraft 表示一次流式请求中单段助手回复的本地草稿。
export interface ChapterAiReplyDraft {
  // messageID 表示该段助手回复在前端列表中的基础消息 ID。
  messageID: string;
  // content 表示该段助手回复当前已收到的文本。
  content: string;
}

// ChapterAiPrefillMessage 表示一次从正文选区填入 AI 输入框的请求。
export interface ChapterAiPrefillMessage {
  // id 表示预填请求的唯一标识，用于避免重复消费。
  id: number;
  // content 表示需要填入 AI 输入框的正文选中文本。
  content: string;
}

// ChapterSelectionAIAction 表示正文选区 AI 操作按钮的展示状态。
export interface ChapterSelectionAIAction {
  // content 表示当前正文选中的纯文本内容。
  content: string;
  // top 表示按钮相对视口顶部的定位。
  top: number;
  // left 表示按钮相对视口左侧的定位。
  left: number;
}

// ChapterSaveSnapshot 表示最近一次成功保存到后端的章节内容快照。
export interface ChapterSaveSnapshot {
  // chapterId 表示最近一次成功保存的章节主键 ID，新增章节未落库时为空。
  chapterId: number | null;
  // title 表示最近一次成功保存的章节名。
  title: string;
  // content 表示最近一次成功保存的章节正文。
  content: string;
}

// ChapterSaveOptions 表示执行章节保存时的行为选项。
export interface ChapterSaveOptions {
  // force 表示是否即使当前存在保存请求也等待并确保本次保存完成。
  force: boolean;
  // showTitleError 表示标题为空时是否展示表单错误和提示。
  showTitleError?: boolean;
  // generateSummary 表示保存成功后是否请求后端触发后台章节概要生成。
  generateSummary?: boolean;
}

// ChapterEditorPageProps 表示章节编辑页需要的外部参数和回调。
export interface ChapterEditorPageProps {
  // novelId 表示当前章节所属小说主键 ID。
  novelId: number;
  // chapterId 表示当前需要编辑的章节主键 ID，创建章节时为空。
  chapterId: number | null;
  // onBackToNovelDetail 表示返回小说详情页时执行的回调。
  onBackToNovelDetail: (novelId: number) => void;
  // onAiPanelOpenChange 表示 AI 侧栏打开状态变化时通知应用层的回调。
  onAiPanelOpenChange: (open: boolean) => void;
  // onChapterPersisted 表示新增章节首次保存成功后执行的路由替换回调。
  onChapterPersisted: (novelId: number, chapterId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ChapterEditorState 表示章节编辑页的数据加载状态。
export type ChapterEditorState = "loading" | "ready" | "error";

// ChapterAiAssistantPanelProps 表示章节 AI 助手侧栏需要的回调。
export interface ChapterAiAssistantPanelProps {
  // novelId 表示当前章节所属小说主键 ID。
  novelId: number;
  // prepareRequestContext 表示发送 AI 前准备可选章节上下文的方法。
  prepareRequestContext: () => Promise<ChapterAiRequestContext | null>;
  // prepareRequestErrorMessage 表示准备请求上下文失败时展示的兜底错误文案。
  prepareRequestErrorMessage?: string;
  // prefillMessage 表示需要填入 AI 输入框的一次性正文选中文本。
  prefillMessage: ChapterAiPrefillMessage | null;
  // onClose 表示关闭章节 AI 助手侧栏时执行的回调。
  onClose: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}
