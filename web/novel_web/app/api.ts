export const authStorageKey = "novels_ai_gen_auth";

// AuthData 表示登录接口成功返回的令牌数据。
export interface AuthData {
  // token 表示后续访问系统资源使用的 Bearer 令牌。
  token: string;
  // token_type 表示令牌类型，后端固定返回 Bearer。
  token_type: string;
  // expires_at 表示令牌过期时间。
  expires_at: string;
}

// ApiResponse 表示后端统一响应结构。
export interface ApiResponse<TData> {
  // code 表示业务响应码，成功时为 0。
  code: number;
  // message 表示后端返回的用户提示信息。
  message: string;
  // request_id 表示后端为本次请求生成的追踪标识。
  request_id?: string;
  // data 表示接口成功返回的数据内容。
  data?: TData;
}

// LogLevel 表示日志预览支持筛选的日志等级。
export type LogLevel = "debug" | "info" | "warn" | "error";

// LogEntry 表示日志流中的单条日志内容。
export interface LogEntry {
  // time 表示日志记录时间。
  time?: string;
  // level 表示日志等级。
  level?: string;
  // message 表示日志消息。
  message?: string;
  // request_id 表示日志关联的请求追踪标识。
  request_id?: string;
  // source 表示日志来源位置。
  source?: string;
  // attrs 表示除标准字段外的结构化日志属性。
  attrs?: Record<string, unknown>;
  // raw 表示原始日志行文本。
  raw: string;
}

// LogStreamMetaEvent 表示日志流开始时返回的元信息事件。
export interface LogStreamMetaEvent {
  // type 表示日志流事件类型。
  type: "meta";
  // request_id 表示日志流请求自身的追踪标识。
  request_id?: string;
  // path 表示当前读取或跟随的日志文件路径。
  path?: string;
  // follow 表示是否会继续跟随当天文件追加。
  follow?: boolean;
}

// LogStreamEntryEvent 表示日志流中的日志条目事件。
export interface LogStreamEntryEvent {
  // type 表示日志流事件类型。
  type: "entry";
  // entry 表示本次推送的日志条目。
  entry: LogEntry;
}

// LogStreamErrorEvent 表示日志流开始后的可展示错误事件。
export interface LogStreamErrorEvent {
  // type 表示日志流事件类型。
  type: "error";
  // message 表示可展示给用户的错误提示。
  message?: string;
}

// LogStreamEvent 表示日志流可能返回的事件集合。
export type LogStreamEvent =
  | LogStreamMetaEvent
  | LogStreamEntryEvent
  | LogStreamErrorEvent;

// NovelAgentStreamMetaEvent 表示小说写作 Agent 流开始或阶段变化事件。
export interface NovelAgentStreamMetaEvent {
  // type 表示小说写作 Agent 流事件类型。
  type: "meta";
  // run_id 表示本次 AI 对话后台运行任务 ID。
  run_id?: string;
  // stage 表示当前处理阶段。
  stage?: string;
  // task 表示顶层 Agent 选择的任务类型。
  task?: string;
  // message 表示状态说明。
  message?: string;
}

// NovelAgentStreamDeltaEvent 表示小说写作 Agent 返回的增量文本事件。
export interface NovelAgentStreamDeltaEvent {
  // type 表示小说写作 Agent 流事件类型。
  type: "delta";
  // run_id 表示本次 AI 对话后台运行任务 ID。
  run_id?: string;
  // task 表示顶层 Agent 选择的任务类型。
  task?: string;
  // reply_index 表示同一次请求中的可见助手回复段序号，从 1 开始。
  reply_index?: number;
  // content 表示模型生成的增量文本。
  content?: string;
}

// NovelAgentStreamReplyItem 表示小说写作 Agent 单段完整助手回复。
export interface NovelAgentStreamReplyItem {
  // reply_index 表示同一次请求中的可见助手回复段序号，从 1 开始。
  reply_index: number;
  // task 表示产生该回复段的任务来源。
  task?: string;
  // content 表示该回复段的完整文本。
  content: string;
}

// NovelAgentStreamDoneEvent 表示小说写作 Agent 流式生成完成事件。
export interface NovelAgentStreamDoneEvent {
  // type 表示小说写作 Agent 流事件类型。
  type: "done";
  // run_id 表示本次 AI 对话后台运行任务 ID。
  run_id?: string;
  // task 表示顶层 Agent 选择的任务类型。
  task?: string;
  // content 表示完整生成文本。
  content?: string;
  // replies 表示本轮请求按可见输出边界拆分后的助手回复列表。
  replies?: NovelAgentStreamReplyItem[];
  // conversation_id 表示本轮回复保存到的 Agent 会话 ID。
  conversation_id?: number;
  // conversation_title 表示本轮回复保存到的 Agent 会话标题。
  conversation_title?: string;
  // message 表示完成说明。
  message?: string;
}

// NovelAgentStreamApprovalRequiredEvent 表示小说写作 Agent 等待工具人工审核事件。
export interface NovelAgentStreamApprovalRequiredEvent {
  // type 表示小说写作 Agent 流事件类型。
  type: "approval_required";
  // run_id 表示本次 AI 对话后台运行任务 ID。
  run_id?: string;
  // checkpoint_id 表示恢复 Agent 执行所需的 checkpoint 标识。
  checkpoint_id: string;
  // interrupt_id 表示恢复 Agent 执行所需的中断点标识。
  interrupt_id: string;
  // tool_name 表示等待人工审核的工具名称。
  tool_name?: string;
  // tool_arguments 表示等待人工审核的工具调用参数 JSON 字符串。
  tool_arguments?: string;
  // message 表示可展示给用户的审核提示。
  message?: string;
}

// NovelAgentStreamErrorEvent 表示小说写作 Agent 流开始后的错误事件。
export interface NovelAgentStreamErrorEvent {
  // type 表示小说写作 Agent 流事件类型。
  type: "error";
  // run_id 表示本次 AI 对话后台运行任务 ID。
  run_id?: string;
  // request_id 表示本次流式请求的追踪标识，用于和后端日志关联。
  request_id?: string;
  // message 表示可展示给用户的错误提示。
  message?: string;
}

// NovelAgentStreamCancelledEvent 表示小说写作 Agent 被用户手动停止事件。
export interface NovelAgentStreamCancelledEvent {
  // type 表示小说写作 Agent 流事件类型。
  type: "cancelled";
  // run_id 表示本次 AI 对话后台运行任务 ID。
  run_id?: string;
  // request_id 表示本次流式请求的追踪标识，用于和后端日志关联。
  request_id?: string;
  // message 表示可展示给用户的取消提示。
  message?: string;
}

// NovelAgentStreamEvent 表示小说写作 Agent NDJSON 流事件集合。
export type NovelAgentStreamEvent =
  | NovelAgentStreamMetaEvent
  | NovelAgentStreamDeltaEvent
  | NovelAgentStreamApprovalRequiredEvent
  | NovelAgentStreamDoneEvent
  | NovelAgentStreamErrorEvent
  | NovelAgentStreamCancelledEvent;

// NovelAgentMessageRole 表示 Agent 历史消息角色。
export type NovelAgentMessageRole = "user" | "assistant";

// NovelAgentMessageItem 表示单条 Agent 历史消息。
export interface NovelAgentMessageItem {
  // id 表示 Agent 消息主键 ID。
  id: number;
  // conversation_id 表示消息所属 Agent 会话 ID。
  conversation_id: number;
  // novel_id 表示消息所属小说 ID。
  novel_id: number;
  // chapter_id 表示本轮消息关联的章节 ID，普通小说级对话可为空。
  chapter_id?: number;
  // role 表示消息角色，仅包含 user 或 assistant。
  role: NovelAgentMessageRole;
  // task 表示产生助手消息的任务类型，用户消息为空。
  task?: string;
  // content 表示消息正文。
  content: string;
  // created_at 表示创建时间。
  created_at: string;
}

// NovelAgentMessageListData 表示 Agent 历史消息列表响应数据。
export interface NovelAgentMessageListData {
  // items 表示最近的 Agent 历史消息列表，按时间正序排列。
  items: NovelAgentMessageItem[];
}

// NovelAgentConversationItem 表示小说下的单个 Agent 会话。
export interface NovelAgentConversationItem {
  // id 表示 Agent 会话主键 ID。
  id: number;
  // novel_id 表示会话所属小说 ID。
  novel_id: number;
  // title 表示 Agent 会话标题。
  title: string;
  // created_at 表示创建时间。
  created_at: string;
  // updated_at 表示更新时间。
  updated_at: string;
}

// NovelAgentConversationListData 表示小说 Agent 会话列表响应数据。
export interface NovelAgentConversationListData {
  // items 表示当前小说下的 Agent 会话列表，按更新时间倒序排列。
  items: NovelAgentConversationItem[];
}

// NovelAgentRunStatus 表示 AI 对话后台运行任务状态。
export type NovelAgentRunStatus =
  | "running"
  | "approval_required"
  | "completed"
  | "failed"
  | "cancelled";

// NovelAgentRunItem 表示一个 AI 对话后台运行任务快照。
export interface NovelAgentRunItem {
  // run_id 表示 AI 对话后台运行任务 ID。
  run_id: string;
  // status 表示 AI 对话后台运行任务状态。
  status: NovelAgentRunStatus;
  // novel_id 表示任务所属小说 ID。
  novel_id: number;
  // conversation_id 表示任务所属 Agent 会话 ID，新会话任务为空。
  conversation_id?: number;
  // chapter_id 表示任务关联章节 ID，普通小说级对话为空。
  chapter_id?: number;
  // chapter_number 表示任务关联章节号，普通小说级对话为空。
  chapter_number?: number;
  // message 表示任务对应的用户原始消息。
  message: string;
  // created_at 表示任务创建时间。
  created_at: string;
  // updated_at 表示任务最近更新时间。
  updated_at: string;
}

// NovelAgentRunListData 表示 AI 对话后台运行任务列表响应数据。
export interface NovelAgentRunListData {
  // items 表示当前小说仍在运行或等待人工审核的 AI 对话任务。
  items: NovelAgentRunItem[];
}

// NovelAgentRunStopData 表示停止 AI 对话后台运行任务响应数据。
export interface NovelAgentRunStopData {
  // stopped 表示是否已经向任务发出停止信号。
  stopped: boolean;
}

// NovelAgentDeleteConversationData 表示删除 Agent 会话后的响应数据。
export interface NovelAgentDeleteConversationData {
  // deleted 表示 Agent 会话是否已经删除。
  deleted: boolean;
}

// NovelAgentChatParams 表示小说写作 Agent 流式对话请求参数。
export interface NovelAgentChatParams {
  // message 表示用户输入的写作需求或问题。
  message: string;
  // novelId 表示当前请求关联的小说 ID，正式 AI 对话必须传入。
  novelId: number;
  // conversationId 表示本轮请求所属 Agent 会话 ID，未传表示开启新会话。
  conversationId?: number;
  // chapterId 表示当前请求关联的章节 ID，普通对话可为空。
  chapterId?: number;
  // chapterNumber 表示当前请求关联的章节号，即“第 x 章”中的 x，普通对话可为空。
  chapterNumber?: number;
  // signal 表示用于断开本次流监听的浏览器 AbortSignal，不会停止后台 AI 任务。
  signal?: AbortSignal;
}

// NovelAgentApprovalResumeParams 表示小说写作 Agent 工具人工审核恢复请求参数。
export interface NovelAgentApprovalResumeParams {
  // novelId 表示待恢复请求关联的小说 ID。
  novelId: number;
  // conversationId 表示待恢复请求所属 Agent 会话 ID，新会话恢复时可为空。
  conversationId?: number;
  // chapterId 表示待恢复请求关联的章节 ID，普通对话可为空。
  chapterId?: number;
  // chapterNumber 表示待恢复请求关联的章节号，普通对话可为空。
  chapterNumber?: number;
  // checkpointId 表示后端返回的 Eino ADK checkpoint 标识。
  checkpointId: string;
  // interruptId 表示本次人工审核对应的中断点标识。
  interruptId: string;
  // approved 表示用户是否允许执行该工具。
  approved: boolean;
  // reason 表示用户批准或拒绝时的补充原因。
  reason?: string;
  // signal 表示用于断开本次恢复流监听的浏览器 AbortSignal，不会停止后台 AI 任务。
  signal?: AbortSignal;
}

// PromptTypesData 表示提示词类型库列表和配置加载状态。
export interface PromptTypesData {
  // items 表示当前配置中的提示词类型列表。
  items: string[];
  // config_file 表示后端启动配置文件路径。
  config_file: string;
  // modified_at 表示配置文件最后修改时间。
  modified_at: string;
  // reloaded_at 表示配置文件最近热加载成功时间。
  reloaded_at: string;
}

// PromptTypeUpsertParams 表示新增或重命名提示词类型时提交的数据。
export interface PromptTypeUpsertParams {
  // name 表示提示词类型名称。
  name: string;
}

// PromptSummaryItem 表示提示词分页列表中的摘要信息，不包含正文。
export interface PromptSummaryItem {
  // id 表示提示词主键 ID。
  id: number;
  // prompt_type 表示提示词类型。
  prompt_type: string;
  // description 表示提示词简介。
  description: string;
  // created_at 表示创建时间。
  created_at: string;
  // updated_at 表示更新时间。
  updated_at: string;
}

// PromptItem 表示提示词详情信息，包含正文。
export interface PromptItem extends PromptSummaryItem {
  // content 表示提示词正文。
  content: string;
}

// PromptListData 表示提示词分页列表响应数据。
export interface PromptListData {
  // items 表示当前页提示词摘要列表。
  items: PromptSummaryItem[];
  // total 表示符合条件的提示词总数。
  total: number;
  // page 表示当前页码。
  page: number;
  // page_size 表示每页数量。
  page_size: number;
}

// PromptListParams 表示查询提示词分页列表时使用的参数。
export interface PromptListParams {
  // page 表示当前页码，从 1 开始。
  page: number;
  // pageSize 表示每页数量。
  pageSize: number;
  // promptType 表示按提示词类型筛选，空值表示全部类型。
  promptType?: string;
  // signal 表示用于取消请求的浏览器 AbortSignal。
  signal?: AbortSignal;
}

// PromptUpsertParams 表示创建或更新提示词时提交的数据。
export interface PromptUpsertParams {
  // prompt_type 表示提示词类型，必须存在于提示词类型库。
  prompt_type: string;
  // description 表示提示词简介，可以为空。
  description: string;
  // content 表示提示词正文，不能为空。
  content: string;
}

// PromptDeleteData 表示删除提示词接口返回的数据。
export interface PromptDeleteData {
  // deleted 表示提示词是否已经删除。
  deleted: boolean;
}

// NovelAgentStreamHandlers 表示小说写作 Agent 流读取过程中的回调集合。
export interface NovelAgentStreamHandlers {
  // onEvent 表示收到单个 Agent 流事件时执行的回调。
  onEvent: (event: NovelAgentStreamEvent) => void;
}

// LogStreamParams 表示日志流查询参数。
export interface LogStreamParams {
  // date 表示需要筛选的单日日期，格式为 YYYY-MM-DD。
  date: string;
  // levels 表示需要展示的日志等级集合，空数组表示全部等级。
  levels: LogLevel[];
  // keyword 表示需要匹配的关键词。
  keyword: string;
  // tail 表示首次返回的最近匹配行数。
  tail: number;
  // signal 表示用于取消日志流读取的浏览器 AbortSignal。
  signal?: AbortSignal;
}

// LogStreamHandlers 表示日志流读取过程中的回调集合。
export interface LogStreamHandlers {
  // onEvent 表示收到单个日志流事件时执行的回调。
  onEvent: (event: LogStreamEvent) => void;
}

// LogFileItem 表示日志目录中的单个日志文件。
export interface LogFileItem {
  // path 表示相对日志目录的文件路径，删除时按该值提交。
  path: string;
  // name 表示日志文件名。
  name: string;
  // size 表示日志文件大小，单位为字节。
  size: number;
  // modified_at 表示日志文件最后修改时间。
  modified_at: string;
  // active 表示该文件是否为当前正在写入的日志文件。
  active: boolean;
}

// LogFilesData 表示日志文件列表响应数据。
export interface LogFilesData {
  // items 表示日志目录中的普通日志文件列表。
  items: LogFileItem[];
}

// LogClearTodayData 表示清空今日日志后的响应数据。
export interface LogClearTodayData {
  // cleared 表示成功清空的日志文件数量。
  cleared: number;
  // skipped 表示因文件不存在而跳过的日志文件数量。
  skipped: number;
}

// LogDeleteFileFailure 表示单个日志文件删除失败的结果。
export interface LogDeleteFileFailure {
  // path 表示删除失败的日志文件相对路径。
  path: string;
  // reason 表示删除失败原因。
  reason: string;
}

// LogDeleteFilesData 表示批量删除日志文件后的响应数据。
export interface LogDeleteFilesData {
  // deleted 表示已经成功删除的日志文件相对路径列表。
  deleted: string[];
  // failed 表示删除失败的日志文件列表和原因。
  failed: LogDeleteFileFailure[];
}

// LogDeleteFilesParams 表示批量删除日志文件请求参数。
export interface LogDeleteFilesParams {
  // paths 表示需要删除的日志文件相对路径列表。
  paths: string[];
}

// ConfigFileData 表示后端配置文件文本和加载状态。
export interface ConfigFileData {
  // config_file 表示后端启动 -f 参数使用的实际配置文件路径。
  config_file: string;
  // content 表示配置文件当前文本内容。
  content: string;
  // modified_at 表示配置文件最后修改时间。
  modified_at: string;
  // reloaded_at 表示后端最近一次成功加载配置的时间。
  reloaded_at: string;
}

// ConfigFileUpdateParams 表示保存配置文件时提交给后端的参数。
export interface ConfigFileUpdateParams {
  // content 表示需要写入配置文件的完整 YAML 文本。
  content: string;
}

// AgentParameterDataType 表示智能体工具参数支持的数据类型。
export type AgentParameterDataType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "null";

// AgentParameterDefinition 表示子 Agent 作为工具时的单个参数定义。
export interface AgentParameterDefinition {
  // type 表示参数类型，空值由后端按 string 处理。
  type?: AgentParameterDataType | string;
  // description 表示参数用途说明。
  description?: string;
  // required 表示调用工具时该参数是否必填。
  required?: boolean;
  // enum 表示 string 参数允许的枚举值。
  enum?: string[] | null;
  // items 表示 array 参数的元素类型定义。
  items?: AgentParameterDefinition | null;
  // properties 表示 object 参数的子参数定义。
  properties?: Record<string, AgentParameterDefinition> | null;
}

// AgentMemoryConfig 表示小说写作 Agent 的持久记忆配置。
export interface AgentMemoryConfig {
  // recent_rounds 表示兼容旧配置的最近对话轮数。
  recent_rounds: number;
  // context_tokens 表示触发运行时上下文压缩的 Token 阈值。
  context_tokens?: number;
  // raw_history_tokens 表示长期摘要之外保留原文历史的 Token 预算。
  raw_history_tokens?: number;
}

// AgentRetryConfig 表示小说写作 Agent 的模型失败重试配置。
export interface AgentRetryConfig {
  // max_retries 表示单次模型调用失败后的最大重试次数，0 表示不重试。
  max_retries: number;
  // backoff_ms 表示模型失败后再次重试前等待的毫秒数。
  backoff_ms: number;
}

// AgentToolConfig 表示小说写作 Agent 普通工具注册表中的单个工具配置。
export interface AgentToolConfig {
  // name 表示工具固定名称，必须与后端实现的工具名称一致。
  name: string;
  // description 表示提供给模型的工具提示词或能力描述。
  description: string;
  // require_approval 表示执行该工具前是否需要用户人工审核。
  require_approval?: boolean;
}

// AgentDefinition 表示单个小说写作 Agent 的配置。
export interface AgentDefinition {
  // name 表示 Eino ADK Agent 名称，子 Agent 会同时作为 tool 名称。
  name: string;
  // enabled 表示子 Agent 是否启用，未返回时按启用处理。
  enabled?: boolean | null;
  // share_chat_history 表示子 Agent 是否共享父 Agent 的完整聊天历史，未返回时按关闭处理。
  share_chat_history?: boolean | null;
  // provider_id 表示该 Agent 使用的 AI 提供商 ID，保存时必须大于 0。
  provider_id: number;
  // model 表示该 Agent 使用的模型标识，保存时不能为空。
  model: string;
  // reasoning_effort 表示 GPT 类模型使用的推理强度。
  reasoning_effort?: string;
  // task 表示子 Agent 产生流式事件时返回给前端的任务标识。
  task: string;
  // description 表示 Agent 能力描述。
  description: string;
  // instruction 表示 Agent 系统提示词。
  instruction: string;
  // max_iterations 表示 Eino ADK Agent 最大生成循环次数。
  max_iterations: number;
  // tools 表示子 Agent 可使用的普通工具名称列表。
  tools: string[] | null;
  // parameters 表示子 Agent 作为工具被调用时的入参定义。
  parameters: Record<string, AgentParameterDefinition> | null;
}

// AgentConfig 表示小说写作多层 Agent 配置集合。
export interface AgentConfig {
  // tools 表示小说写作 Agent 可选择的普通工具注册表。
  tools: AgentToolConfig[];
  // supervisor 表示顶层 Agent 配置。
  supervisor: AgentDefinition;
  // agent 表示可被顶层 Agent 当成工具调用的子 Agent 配置列表。
  agent: AgentDefinition[];
  // memory 表示小说写作 Agent 的持久记忆配置。
  memory: AgentMemoryConfig;
  // retry 表示小说写作 Agent 的模型失败重试配置。
  retry: AgentRetryConfig;
}

// ChapterSummaryAgentConfig 表示后台章节概要独立 Agent 配置集合。
export interface ChapterSummaryAgentConfig {
  // agent 表示生成章节概要的单层 Agent 配置。
  agent: AgentDefinition;
  // retry 表示章节概要 Agent 的模型失败重试配置。
  retry: AgentRetryConfig;
}

// AgentConfigData 表示后端结构化智能体配置和加载状态。
export interface AgentConfigData {
  // config_file 表示后端启动 -f 参数使用的实际配置文件路径。
  config_file: string;
  // agent 表示当前结构化智能体配置。
  agent: AgentConfig;
  // modified_at 表示配置文件最后修改时间。
  modified_at: string;
  // reloaded_at 表示后端最近一次成功加载配置的时间。
  reloaded_at: string;
}

// ChapterSummaryAgentConfigData 表示后端结构化章节概要 Agent 配置和加载状态。
export interface ChapterSummaryAgentConfigData {
  // config_file 表示后端启动 -f 参数使用的实际配置文件路径。
  config_file: string;
  // chapter_summary_agent 表示当前章节概要 Agent 配置。
  chapter_summary_agent: ChapterSummaryAgentConfig;
  // modified_at 表示配置文件最后修改时间。
  modified_at: string;
  // reloaded_at 表示后端最近一次成功加载配置的时间。
  reloaded_at: string;
}

// AgentConfigUpdateParams 表示保存结构化智能体配置时提交给后端的参数。
export interface AgentConfigUpdateParams {
  // agent 表示需要写入配置文件 ai.agent 子树的智能体配置。
  agent: AgentConfig;
}

// ChapterSummaryAgentConfigUpdateParams 表示保存章节概要 Agent 配置时提交给后端的参数。
export interface ChapterSummaryAgentConfigUpdateParams {
  // chapter_summary_agent 表示需要写入配置文件 ai.chapter_summary_agent 子树的配置。
  chapter_summary_agent: ChapterSummaryAgentConfig;
}

// SystemUpdateData 表示后端一键更新启动后的结果。
export interface SystemUpdateData {
  // branch 表示本次更新拉取的目标分支。
  branch: string;
  // commit_before 表示更新前当前仓库的 commit。
  commit_before: string;
  // commit_after 表示更新后当前仓库的 commit。
  commit_after: string;
  // restarting 表示是否已经启动后台重启脚本。
  restarting: boolean;
}

// AIProviderType 表示前端允许提交的 AI 提供商类型。
export type AIProviderType = "openai" | "claude" | "gemini";

// AIProviderAPIType 表示前端允许提交的 AI 接口类型。
export type AIProviderAPIType = "response" | "completions";

// AIProviderItem 表示 AI 提供商列表和详情中的单条记录。
export interface AIProviderItem {
  // id 表示 AI 提供商主键 ID。
  id: number;
  // name 表示 AI 提供商名称。
  name: string;
  // provider_type 表示 AI 提供商类型。
  provider_type: AIProviderType;
  // masked_api_key 表示 API Key 掩码，不包含明文密钥。
  masked_api_key: string;
  // base_url 表示 AI 提供商接口基础地址。
  base_url: string;
  // default_model 表示模型列表不可用时使用的默认模型标识。
  default_model: string;
  // priority 表示 AI 提供商排序优先级，0 最低，数值越大优先级越高。
  priority: number;
  // api_type 表示 AI 接口类型。
  api_type: AIProviderAPIType;
  // enabled 表示是否启用该 AI 提供商。
  enabled: boolean;
  // created_at 表示创建时间。
  created_at: string;
  // updated_at 表示更新时间。
  updated_at: string;
}

// AIProviderListData 表示 AI 提供商分页列表数据。
export interface AIProviderListData {
  // items 表示当前页 AI 提供商列表。
  items: AIProviderItem[];
  // total 表示符合条件的 AI 提供商总数。
  total: number;
  // page 表示当前页码。
  page: number;
  // page_size 表示每页数量。
  page_size: number;
}

// AIProviderListParams 表示查询 AI 提供商列表时使用的分页参数。
export interface AIProviderListParams {
  // page 表示当前页码，从 1 开始。
  page: number;
  // pageSize 表示每页数量。
  pageSize: number;
  // signal 表示用于取消请求的浏览器 AbortSignal。
  signal?: AbortSignal;
}

// AIProviderUpsertParams 表示创建或更新 AI 提供商时提交的参数。
export interface AIProviderUpsertParams {
  // name 表示 AI 提供商名称。
  name: string;
  // provider_type 表示 AI 提供商类型。
  provider_type: AIProviderType;
  // api_key 表示 AI 提供商 API Key，更新时为空表示保留旧密钥。
  api_key: string;
  // base_url 表示 AI 提供商接口基础地址。
  base_url: string;
  // default_model 表示模型列表不可用时使用的默认模型标识。
  default_model: string;
  // priority 表示 AI 提供商排序优先级，0 最低，数值越大优先级越高。
  priority: number;
  // api_type 表示 AI 接口类型。
  api_type: AIProviderAPIType;
  // enabled 表示是否启用该 AI 提供商。
  enabled: boolean;
}

// AIProviderModelItem 表示 AI 提供商官方模型列表中的单个模型。
export interface AIProviderModelItem {
  // id 表示模型标识。
  id: string;
  // display_name 表示模型展示名称。
  display_name: string;
  // owned_by 表示模型归属方。
  owned_by: string;
  // created_at 表示模型创建时间。
  created_at: string;
  // supported_generation_methods 表示模型支持的生成能力。
  supported_generation_methods: string[];
}

// AIProviderModelListData 表示 AI 提供商官方模型列表数据。
export interface AIProviderModelListData {
  // items 表示模型列表。
  items: AIProviderModelItem[];
}

// AIProviderModelListParams 表示查询官方模型列表时提交的参数。
export interface AIProviderModelListParams {
  // provider_type 表示 AI 提供商类型。
  provider_type: AIProviderType;
  // api_key 表示用于请求官方模型列表接口的 API Key。
  api_key: string;
  // base_url 表示 AI 提供商接口基础地址。
  base_url: string;
}

// AIProviderDeleteData 表示删除 AI 提供商接口返回的数据。
export interface AIProviderDeleteData {
  // deleted 表示 AI 提供商是否已删除。
  deleted: boolean;
}

// NovelStatus 表示小说状态，只允许连载中或已完结。
export type NovelStatus = "连载中" | "已完结";

// NovelItem 表示书架中的小说条目。
export interface NovelItem {
  // id 表示小说主键 ID。
  id: number;
  // name 表示小说名。
  name: string;
  // status 表示小说状态，只允许连载中或已完结。
  status: NovelStatus;
  // author_name 表示作者名。
  author_name: string;
  // description 表示小说简介。
  description: string;
  // tags 表示英文逗号分隔的标签文本。
  tags: string;
  // cover_url 表示小说封面链接或私有对象存储 key。
  cover_url: string;
  // created_at 表示小说创建时间。
  created_at: string;
  // updated_at 表示小说更新时间。
  updated_at: string;
}

// NovelListData 表示小说列表分页数据。
export interface NovelListData {
  // items 表示当前页小说列表。
  items: NovelItem[];
  // total 表示符合条件的小说总数。
  total: number;
  // page 表示当前页码。
  page: number;
  // page_size 表示每页数量。
  page_size: number;
}

// NovelListParams 表示查询小说列表时使用的分页参数。
export interface NovelListParams {
  // page 表示当前页码，从 1 开始。
  page: number;
  // pageSize 表示每页数量。
  pageSize: number;
  // signal 表示用于取消请求的浏览器 AbortSignal。
  signal?: AbortSignal;
}

// NovelCreateParams 表示创建小说时提交给后端的参数。
export interface NovelCreateParams {
  // name 表示小说名，不能为空。
  name: string;
  // status 表示小说状态，只允许连载中或已完结。
  status: NovelStatus;
  // author_name 表示作者名，可以为空。
  author_name: string;
  // description 表示小说简介，可以为空。
  description: string;
  // tags 表示英文逗号分隔的标签文本，可以为空。
  tags: string;
  // cover_url 表示小说封面链接或私有对象存储 key，可以为空。
  cover_url: string;
}

// NovelUpdateParams 表示更新小说时提交给后端的参数。
export interface NovelUpdateParams {
  // name 表示小说名，不能为空。
  name: string;
  // status 表示小说状态，只允许连载中或已完结。
  status: NovelStatus;
  // author_name 表示作者名，可以为空。
  author_name: string;
  // description 表示小说简介，可以为空。
  description: string;
  // tags 表示英文逗号分隔的标签文本，可以为空。
  tags: string;
  // cover_url 表示小说封面链接或私有对象存储 key，可以为空。
  cover_url: string;
}

// NovelDeleteData 表示删除小说接口返回的数据。
export interface NovelDeleteData {
  // deleted 表示后端是否已经删除该小说。
  deleted: boolean;
}

// NovelWordCountData 表示小说总字数接口返回的数据。
export interface NovelWordCountData {
  // novel_id 表示小说主键 ID。
  novel_id: number;
  // word_count 表示小说所有章节累计后的总字数。
  word_count: number;
}

// NovelSummaryItem 表示小说滚动总结详情数据。
export interface NovelSummaryItem {
  // id 表示小说总结主键 ID。
  id: number;
  // novel_id 表示总结所属小说 ID。
  novel_id: number;
  // content 表示小说滚动剧情总结内容。
  content: string;
  // start_chapter_number 表示当前总结覆盖的起始章节号，0 表示未知或未记录。
  start_chapter_number: number;
  // end_chapter_number 表示当前总结覆盖的结束章节号，0 表示未知或未记录。
  end_chapter_number: number;
  // created_at 表示创建时间。
  created_at: string;
  // updated_at 表示更新时间。
  updated_at: string;
}

// NovelSummarySaveParams 表示创建或更新小说总结时提交的数据。
export interface NovelSummarySaveParams {
  // content 表示需要保存的小说滚动剧情总结内容，允许为空字符串。
  content: string;
  // start_chapter_number 表示当前总结覆盖的起始章节号，0 表示未知或未记录。
  start_chapter_number: number;
  // end_chapter_number 表示当前总结覆盖的结束章节号，0 表示未知或未记录。
  end_chapter_number: number;
}

// NovelSummaryDeleteData 表示删除小说总结接口返回的数据。
export interface NovelSummaryDeleteData {
  // deleted 表示后端是否已经删除小说总结。
  deleted: boolean;
}

// NovelOutlineItem 表示小说大纲详情数据。
export interface NovelOutlineItem {
  // id 表示小说大纲主键 ID。
  id: number;
  // novel_id 表示大纲所属小说 ID。
  novel_id: number;
  // content 表示小说大纲正文。
  content: string;
  // created_at 表示创建时间。
  created_at: string;
  // updated_at 表示更新时间。
  updated_at: string;
}

// NovelOutlineSaveParams 表示创建或更新小说大纲时提交的数据。
export interface NovelOutlineSaveParams {
  // content 表示需要保存的小说大纲正文，允许为空字符串。
  content: string;
}

// NovelOutlineDeleteData 表示删除小说大纲接口返回的数据。
export interface NovelOutlineDeleteData {
  // deleted 表示后端是否已经删除小说大纲。
  deleted: boolean;
}

// ChapterSummaryItem 表示章节列表中的章节摘要数据，不包含正文。
export interface ChapterSummaryItem {
  // id 表示章节主键 ID。
  id: number;
  // novel_id 表示章节所属小说 ID。
  novel_id: number;
  // chapter_number 表示章节号，即“第 x 章”中的 x。
  chapter_number: number;
  // title 表示章节名。
  title: string;
  // word_count 表示章节正文的非空白字符数量。
  word_count: number;
  // created_at 表示章节创建时间。
  created_at: string;
  // updated_at 表示章节更新时间。
  updated_at: string;
}

// ChapterDetailItem 表示章节详情数据，包含正文。
export interface ChapterDetailItem {
  // id 表示章节主键 ID。
  id: number;
  // novel_id 表示章节所属小说 ID。
  novel_id: number;
  // chapter_number 表示章节号，即“第 x 章”中的 x。
  chapter_number: number;
  // title 表示章节名。
  title: string;
  // content 表示章节正文。
  content: string;
  // summary 表示章节概要。
  summary: string;
  // word_count 表示章节正文的非空白字符数量。
  word_count: number;
  // created_at 表示章节创建时间。
  created_at: string;
  // updated_at 表示章节更新时间。
  updated_at: string;
}

// ChapterSummaryDetailItem 表示单章概要详情数据。
export interface ChapterSummaryDetailItem {
  // id 表示章节主键 ID。
  id: number;
  // novel_id 表示章节所属小说 ID。
  novel_id: number;
  // chapter_number 表示章节号，即“第 x 章”中的 x。
  chapter_number: number;
  // title 表示章节名。
  title: string;
  // summary 表示章节概要，允许为空字符串。
  summary: string;
  // updated_at 表示更新时间。
  updated_at: string;
}

// ChapterListData 表示章节列表分页数据。
export interface ChapterListData {
  // items 表示当前页章节摘要列表。
  items: ChapterSummaryItem[];
  // total 表示符合条件的章节总数。
  total: number;
  // page 表示当前页码。
  page: number;
  // page_size 表示每页数量。
  page_size: number;
}

// NextChapterNumberData 表示后端返回的下一章节号数据。
export interface NextChapterNumberData {
  // novel_id 表示小说主键 ID。
  novel_id: number;
  // next_chapter_number 表示建议创建下一章时使用的章节号。
  next_chapter_number: number;
}

// ChapterListParams 表示查询章节列表时使用的分页参数。
export interface ChapterListParams {
  // page 表示当前页码，从 1 开始。
  page: number;
  // pageSize 表示每页数量。
  pageSize: number;
  // signal 表示用于取消请求的浏览器 AbortSignal。
  signal?: AbortSignal;
}

// ChapterCreateParams 表示创建章节时提交给后端的参数。
export interface ChapterCreateParams {
  // chapter_number 表示章节号，必须由后端建议接口返回后提交。
  chapter_number: number;
  // title 表示章节名，不能为空。
  title: string;
  // content 表示章节正文，可以为空。
  content: string;
  // generate_summary 表示本次创建成功后是否触发后台章节概要生成，通常只由手动保存传入。
  generate_summary?: boolean;
}

// ChapterUpdateParams 表示更新章节时提交给后端的参数。
export interface ChapterUpdateParams {
  // title 表示章节名，不能为空。
  title: string;
  // content 表示章节正文，可以为空。
  content: string;
  // generate_summary 表示本次更新成功后是否触发后台章节概要生成，自动保存应保持 false。
  generate_summary?: boolean;
}

// ChapterSummarySaveParams 表示保存章节概要时提交给后端的参数。
export interface ChapterSummarySaveParams {
  // summary 表示需要保存的章节概要，允许为空字符串并保留原始空格和换行。
  summary: string;
}

// ChapterSummaryDeleteData 表示删除章节概要接口返回的数据。
export interface ChapterSummaryDeleteData {
  // deleted 表示后端是否已经清空该章节概要。
  deleted: boolean;
}

// ChapterDeleteData 表示删除章节接口返回的数据。
export interface ChapterDeleteData {
  // deleted 表示后端是否已经删除该章节。
  deleted: boolean;
}

// CharacterSummaryItem 表示角色卡列表中的角色摘要数据。
export interface CharacterSummaryItem {
  // id 表示角色卡主键 ID。
  id: number;
  // novel_id 表示角色卡所属小说 ID。
  novel_id: number;
  // portrait_url 表示角色肖像图链接或私有对象存储 key。
  portrait_url: string;
  // name 表示角色姓名。
  name: string;
  // gender 表示角色性别。
  gender: string;
  // tags 表示英文逗号分隔的角色标签文本。
  tags: string;
  // background 表示角色背景摘要，后端列表接口未返回时为空。
  background?: string;
  // created_at 表示角色卡创建时间。
  created_at: string;
  // updated_at 表示角色卡更新时间。
  updated_at: string;
}

// CharacterDetailItem 表示角色卡详情数据。
export interface CharacterDetailItem {
  // id 表示角色卡主键 ID。
  id: number;
  // novel_id 表示角色卡所属小说 ID。
  novel_id: number;
  // portrait_url 表示角色肖像图链接或私有对象存储 key。
  portrait_url: string;
  // name 表示角色姓名。
  name: string;
  // gender 表示角色性别。
  gender: string;
  // tags 表示英文逗号分隔的角色标签文本。
  tags: string;
  // background 表示角色背景。
  background: string;
  // personality 表示角色性格。
  personality: string;
  // ability 表示角色能力。
  ability: string;
  // goal 表示角色目的。
  goal: string;
  // created_at 表示角色卡创建时间。
  created_at: string;
  // updated_at 表示角色卡更新时间。
  updated_at: string;
}

// CharacterListData 表示角色卡列表分页数据。
export interface CharacterListData {
  // items 表示当前页角色卡摘要列表。
  items: CharacterSummaryItem[];
  // total 表示符合条件的角色卡总数。
  total: number;
  // page 表示当前页码。
  page: number;
  // page_size 表示每页数量。
  page_size: number;
}

// CharacterListParams 表示查询角色卡列表时使用的分页参数。
export interface CharacterListParams {
  // page 表示当前页码，从 1 开始。
  page: number;
  // pageSize 表示每页数量。
  pageSize: number;
  // signal 表示用于取消请求的浏览器 AbortSignal。
  signal?: AbortSignal;
}

// CharacterCreateParams 表示创建角色卡时提交给后端的参数。
export interface CharacterCreateParams {
  // portrait_url 表示角色肖像图链接或私有对象存储 key，可以为空。
  portrait_url: string;
  // name 表示角色姓名，不能为空。
  name: string;
  // gender 表示角色性别，可以为空。
  gender: string;
  // tags 表示英文逗号分隔的角色标签文本，可以为空。
  tags: string;
  // background 表示角色背景，可以为空。
  background: string;
  // personality 表示角色性格，可以为空。
  personality: string;
  // ability 表示角色能力，可以为空。
  ability: string;
  // goal 表示角色目的，可以为空。
  goal: string;
}

// CharacterUpdateParams 表示更新角色卡时提交给后端的参数。
export interface CharacterUpdateParams {
  // portrait_url 表示角色肖像图链接或私有对象存储 key，可以为空。
  portrait_url: string;
  // name 表示角色姓名，不能为空。
  name: string;
  // gender 表示角色性别，可以为空。
  gender: string;
  // tags 表示英文逗号分隔的角色标签文本，可以为空。
  tags: string;
  // background 表示角色背景，可以为空。
  background: string;
  // personality 表示角色性格，可以为空。
  personality: string;
  // ability 表示角色能力，可以为空。
  ability: string;
  // goal 表示角色目的，可以为空。
  goal: string;
}

// CharacterDeleteData 表示删除角色卡接口返回的数据。
export interface CharacterDeleteData {
  // deleted 表示后端是否已经删除该角色卡。
  deleted: boolean;
}

// RelationshipGraphViewport 表示角色关系图画布视口状态。
export interface RelationshipGraphViewport {
  // x 表示画布视口 X 坐标。
  x: number;
  // y 表示画布视口 Y 坐标。
  y: number;
  // zoom 表示画布视口缩放比例。
  zoom: number;
}

// RelationshipGraphNodeItem 表示角色关系图中的角色节点。
export interface RelationshipGraphNodeItem {
  // character_id 表示画布节点引用的角色卡 ID。
  character_id: number;
  // position_x 表示节点在画布中的 X 坐标。
  position_x: number;
  // position_y 表示节点在画布中的 Y 坐标。
  position_y: number;
}

// RelationshipGraphEdgeItem 表示角色关系图中的无方向关系线。
export interface RelationshipGraphEdgeItem {
  // id 表示关系线稳定 ID，由两个角色 ID 计算得到。
  id: string;
  // character_a_id 表示无方向关系线中较小的角色卡 ID。
  character_a_id: number;
  // character_b_id 表示无方向关系线中较大的角色卡 ID。
  character_b_id: number;
  // source_handle 表示较小角色卡端使用的连接点 ID。
  source_handle?: string;
  // target_handle 表示较大角色卡端使用的连接点 ID。
  target_handle?: string;
  // note 表示关系线备注，用于描述两个角色之间的关系。
  note: string;
}

// RelationshipGraphData 表示角色关系图完整快照数据。
export interface RelationshipGraphData {
  // novel_id 表示小说主键 ID。
  novel_id: number;
  // viewport 表示画布视口状态。
  viewport: RelationshipGraphViewport;
  // nodes 表示当前画布中的角色节点列表。
  nodes: RelationshipGraphNodeItem[];
  // edges 表示当前画布中的无方向关系线列表。
  edges: RelationshipGraphEdgeItem[];
  // updated_at 表示关系图最后更新时间，尚未保存时可能为空。
  updated_at?: string | null;
}

// RelationshipGraphSaveParams 表示保存角色关系图时提交的整图快照。
export interface RelationshipGraphSaveParams {
  // viewport 表示画布视口状态。
  viewport: RelationshipGraphViewport;
  // nodes 表示当前画布中的角色节点列表。
  nodes: RelationshipGraphNodeItem[];
  // edges 表示当前画布中的无方向关系线列表。
  edges: RelationshipGraphEdgeItem[];
}

// EventGraphViewport 表示事件图画布视口状态。
export interface EventGraphViewport {
  // x 表示画布视口 X 坐标。
  x: number;
  // y 表示画布视口 Y 坐标。
  y: number;
  // zoom 表示画布视口缩放比例。
  zoom: number;
}

// EventParticipantItem 表示事件详情中的参与者摘要。
export interface EventParticipantItem {
  // id 表示角色卡主键 ID。
  id: number;
  // novel_id 表示角色卡所属小说 ID。
  novel_id: number;
  // name 表示角色姓名。
  name: string;
  // gender 表示角色性别。
  gender: string;
  // tags 表示英文逗号分隔的角色标签文本。
  tags: string;
}

// NovelEventItem 表示小说事件详情数据。
export interface NovelEventItem {
  // id 表示事件主键 ID。
  id: number;
  // novel_id 表示所属小说 ID。
  novel_id: number;
  // name 表示事件名称。
  name: string;
  // cause 表示事件起因。
  cause: string;
  // process 表示事件经过。
  process: string;
  // result 表示事件结果。
  result: string;
  // impact 表示事件造成的影响。
  impact: string;
  // location 表示事件发生地点。
  location: string;
  // position_x 表示事件节点在画布中的 X 坐标。
  position_x: number;
  // position_y 表示事件节点在画布中的 Y 坐标。
  position_y: number;
  // participants 表示事件参与者摘要列表。
  participants: EventParticipantItem[];
  // created_at 表示事件创建时间。
  created_at: string;
  // updated_at 表示事件更新时间。
  updated_at: string;
}

// EventListData 表示事件列表分页数据。
export interface EventListData {
  // items 表示当前页事件列表。
  items: NovelEventItem[];
  // total 表示符合条件的事件总数。
  total: number;
  // page 表示当前页码。
  page: number;
  // page_size 表示每页数量。
  page_size: number;
}

// EventRelationItem 表示事件图中的有向关系线。
export interface EventRelationItem {
  // id 表示事件关系线主键 ID。
  id: number;
  // source_event_id 表示前置事件 ID。
  source_event_id: number;
  // target_event_id 表示后续事件 ID。
  target_event_id: number;
  // note 表示关系线备注。
  note: string;
  // created_at 表示关系线创建时间。
  created_at: string;
  // updated_at 表示关系线更新时间。
  updated_at: string;
}

// EventGraphData 表示事件图完整数据。
export interface EventGraphData {
  // novel_id 表示小说主键 ID。
  novel_id: number;
  // viewport 表示事件图画布视口状态。
  viewport: EventGraphViewport;
  // nodes 表示事件图中的事件节点列表。
  nodes: NovelEventItem[];
  // edges 表示事件图中的有向关系线列表。
  edges: EventRelationItem[];
  // updated_at 表示事件图布局最后更新时间，尚未保存时可能为空。
  updated_at?: string | null;
}

// EventListParams 表示查询事件列表时使用的分页参数。
export interface EventListParams {
  // page 表示当前页码，从 1 开始。
  page: number;
  // pageSize 表示每页数量。
  pageSize: number;
  // signal 表示用于取消请求的浏览器 AbortSignal。
  signal?: AbortSignal;
}

// EventCreateParams 表示创建事件时提交给后端的参数。
export interface EventCreateParams {
  // name 表示事件名称，不能为空。
  name: string;
  // cause 表示事件起因，可以为空。
  cause: string;
  // process 表示事件经过，可以为空。
  process: string;
  // result 表示事件结果，可以为空。
  result: string;
  // impact 表示事件造成的影响，可以为空。
  impact: string;
  // location 表示事件发生地点，可以为空。
  location: string;
  // participant_ids 表示参与事件的角色卡 ID 列表。
  participant_ids: number[];
  // position_x 表示事件节点初始画布 X 坐标。
  position_x: number;
  // position_y 表示事件节点初始画布 Y 坐标。
  position_y: number;
}

// EventUpdateParams 表示更新事件时提交给后端的参数。
export type EventUpdateParams = EventCreateParams;

// EventLayoutNodeItem 表示保存事件图布局时提交的节点坐标。
export interface EventLayoutNodeItem {
  // event_id 表示需要保存坐标的事件 ID。
  event_id: number;
  // position_x 表示事件节点在画布中的 X 坐标。
  position_x: number;
  // position_y 表示事件节点在画布中的 Y 坐标。
  position_y: number;
}

// EventLayoutParams 表示保存事件图布局时提交给后端的数据。
export interface EventLayoutParams {
  // viewport 表示事件图画布视口状态。
  viewport: EventGraphViewport;
  // nodes 表示需要保存坐标的事件节点列表。
  nodes: EventLayoutNodeItem[];
}

// EventRelationCreateParams 表示创建事件关系线时提交给后端的数据。
export interface EventRelationCreateParams {
  // source_event_id 表示前置事件 ID。
  source_event_id: number;
  // target_event_id 表示后续事件 ID。
  target_event_id: number;
  // note 表示关系线备注，可以为空。
  note: string;
}

// EventRelationUpdateParams 表示更新事件关系线时提交给后端的数据。
export interface EventRelationUpdateParams {
  // note 表示关系线备注，可以为空。
  note: string;
}

// EventDeleteData 表示删除事件接口返回的数据。
export interface EventDeleteData {
  // deleted 表示后端是否已经删除该事件。
  deleted: boolean;
  // deleted_relation_count 表示随事件一并删除的关系线数量。
  deleted_relation_count: number;
}

// EventRelationDeleteData 表示删除事件关系线接口返回的数据。
export interface EventRelationDeleteData {
  // deleted 表示后端是否已经删除该事件关系线。
  deleted: boolean;
}

// ImageUploadUsage 表示图片上传用途。
export type ImageUploadUsage = "cover" | "character";

// ImageUploadData 表示图片上传成功后返回的数据。
export interface ImageUploadData {
  // object_key 表示图片保存在对象存储中的对象 key。
  object_key: string;
  // preview_url 表示可直接预览私有图片的预签名链接。
  preview_url: string;
  // preview_expires_at 表示预签名预览链接过期时间。
  preview_expires_at: string;
  // content_type 表示后端根据文件内容探测出的 MIME 类型。
  content_type: string;
  // size 表示上传文件大小，单位为字节。
  size: number;
  // original_filename 表示用户上传文件的原始文件名。
  original_filename: string;
}

// ImagePreviewData 表示刷新私有图片预览链接后返回的数据。
export interface ImagePreviewData {
  // object_key 表示图片保存在对象存储中的对象 key。
  object_key: string;
  // preview_url 表示可直接预览私有图片的预签名链接。
  preview_url: string;
  // preview_expires_at 表示预签名预览链接过期时间。
  preview_expires_at: string;
}

// UnauthorizedError 表示前端检测到登录态不存在或已失效。
export class UnauthorizedError extends Error {
  // constructor 创建未授权错误。
  // 参数 message 表示需要展示给用户的错误提示。
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

// loginWithPassword 调用后端登录接口并返回令牌数据。
// 参数 password 表示用户输入的系统登录密码。
export async function loginWithPassword(password: string): Promise<AuthData> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  });

  const payload = await parseApiResponse<AuthData>(response);

  if (!response.ok || !payload?.data?.token) {
    throw new Error(payload?.message || "登录失败，请稍后再试");
  }

  return payload.data;
}

// persistAuthData 将登录令牌保存到浏览器本地存储中。
// 参数 data 表示登录接口返回的令牌数据。
export function persistAuthData(data: AuthData) {
  window.localStorage.setItem(authStorageKey, JSON.stringify(data));
}

// clearAuthData 清理浏览器本地保存的登录令牌。
export function clearAuthData() {
  window.localStorage.removeItem(authStorageKey);
}

// readAuthData 从浏览器本地存储读取未过期的登录令牌。
export function readAuthData(): AuthData | null {
  const rawValue = window.localStorage.getItem(authStorageKey);
  if (!rawValue) {
    return null;
  }

  const value = parseStoredAuthData(rawValue);
  if (!value || isExpiredAuthData(value)) {
    clearAuthData();
    return null;
  }

  return value;
}

// fetchConfigFile 查询后端当前启动配置文件的文本内容。
// 参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchConfigFile(
  signal?: AbortSignal,
): Promise<ConfigFileData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/config/file", {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<ConfigFileData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "配置文件加载失败，请稍后再试");
  }

  return payload.data;
}

// updateConfigFile 保存后端当前启动配置文件的完整文本。
// 参数 params 表示配置文件保存请求参数。
export async function updateConfigFile(
  params: ConfigFileUpdateParams,
): Promise<ConfigFileData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/config/file", {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<ConfigFileData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "配置文件保存失败，请稍后再试");
  }

  return payload.data;
}

// fetchAgentConfig 查询后端当前结构化智能体配置。
// 参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchAgentConfig(
  signal?: AbortSignal,
): Promise<AgentConfigData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/config/agent", {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<AgentConfigData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "智能体配置加载失败，请稍后再试");
  }

  return payload.data;
}

// updateAgentConfig 保存后端当前结构化智能体配置。
// 参数 params 表示智能体配置保存请求参数。
export async function updateAgentConfig(
  params: AgentConfigUpdateParams,
): Promise<AgentConfigData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/config/agent", {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<AgentConfigData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "智能体配置保存失败，请稍后再试");
  }

  return payload.data;
}

// fetchChapterSummaryAgentConfig 查询后端当前结构化章节概要 Agent 配置。
// 参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchChapterSummaryAgentConfig(
  signal?: AbortSignal,
): Promise<ChapterSummaryAgentConfigData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/config/chapter-summary-agent", {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<ChapterSummaryAgentConfigData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节概要 Agent 配置加载失败，请稍后再试");
  }

  return payload.data;
}

// updateChapterSummaryAgentConfig 保存后端当前结构化章节概要 Agent 配置。
// 参数 params 表示章节概要 Agent 配置保存请求参数。
export async function updateChapterSummaryAgentConfig(
  params: ChapterSummaryAgentConfigUpdateParams,
): Promise<ChapterSummaryAgentConfigData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/config/chapter-summary-agent", {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<ChapterSummaryAgentConfigData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节概要 Agent 配置保存失败，请稍后再试");
  }

  return payload.data;
}

// triggerSystemUpdate 请求后端从 GitHub 拉取最新代码并重启服务。
export async function triggerSystemUpdate(): Promise<SystemUpdateData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/system/update", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
  });
  const payload = await parseApiResponse<SystemUpdateData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "系统更新失败，请稍后再试");
  }

  return payload.data;
}

// fetchAIProviders 查询 AI 提供商分页列表。
// 参数 params 表示 AI 提供商列表分页查询参数。
export async function fetchAIProviders(
  params: AIProviderListParams,
): Promise<AIProviderListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  const response = await fetch(
    `/api/v1/ai/providers?${searchParams.toString()}`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal: params.signal,
    },
  );
  const payload = await parseApiResponse<AIProviderListData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 提供商加载失败，请稍后再试");
  }

  return payload.data;
}

// createAIProvider 调用后端接口创建 AI 提供商并返回新记录。
// 参数 params 表示创建 AI 提供商时需要提交的表单数据。
export async function createAIProvider(
  params: AIProviderUpsertParams,
): Promise<AIProviderItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/ai/providers", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<AIProviderItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 提供商创建失败，请稍后再试");
  }

  return payload.data;
}

// updateAIProvider 调用后端接口更新 AI 提供商并返回更新后的记录。
// 参数 id 表示 AI 提供商主键 ID；参数 params 表示更新 AI 提供商时需要提交的表单数据。
export async function updateAIProvider(
  id: number,
  params: AIProviderUpsertParams,
): Promise<AIProviderItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/ai/providers/${id}`, {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<AIProviderItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 提供商更新失败，请稍后再试");
  }

  return payload.data;
}

// fetchAIProviderModels 调用后端接口按官方协议查询 AI 提供商模型列表。
// 参数 params 表示查询模型列表时需要提交的提供商类型、API Key 和 Base URL。
export async function fetchAIProviderModels(
  params: AIProviderModelListParams,
): Promise<AIProviderModelListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/ai/providers/models", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<AIProviderModelListData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 模型列表获取失败，请稍后再试");
  }

  return payload.data;
}

// fetchAIProviderModelsByProviderID 使用已保存 AI 提供商配置查询官方模型列表。
// 参数 providerId 表示 AI 提供商主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchAIProviderModelsByProviderID(
  providerId: number,
  signal?: AbortSignal,
): Promise<AIProviderModelListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/ai/providers/${providerId}/models`, {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<AIProviderModelListData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 模型列表获取失败，请稍后再试");
  }

  return payload.data;
}

// deleteAIProvider 调用后端接口删除指定 AI 提供商。
// 参数 id 表示 AI 提供商主键 ID。
export async function deleteAIProvider(
  id: number,
): Promise<AIProviderDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/ai/providers/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
  });
  const payload = await parseApiResponse<AIProviderDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 提供商删除失败，请稍后再试");
  }

  return payload.data;
}

// streamLogs 读取后端文件日志 NDJSON 实时流。
// 参数 params 表示日志流筛选和取消参数；参数 handlers 表示日志流事件回调集合。
export async function streamLogs(
  params: LogStreamParams,
  handlers: LogStreamHandlers,
): Promise<void> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({
    date: params.date,
    keyword: params.keyword,
    tail: String(params.tail),
  });
  if (params.levels.length > 0) {
    searchParams.set("levels", params.levels.join(","));
  }

  const response = await fetch(`/api/v1/logs/stream?${searchParams.toString()}`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal: params.signal,
  });

  if (response.status === 401) {
    const payload = await parseApiResponse<unknown>(response);
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok) {
    const payload = await parseApiResponse<unknown>(response);
    throw new Error(payload?.message || "日志流连接失败，请稍后再试");
  }

  if (!response.body) {
    throw new Error("当前浏览器不支持日志流读取");
  }

  await readLogStream(response.body, handlers);
}

// streamNovelAgentChat 连接小说写作 Agent 流式对话接口。
// 参数 params 表示 Agent 流式对话参数；参数 handlers 表示流事件回调集合。
export async function streamNovelAgentChat(
  params: NovelAgentChatParams,
  handlers: NovelAgentStreamHandlers,
): Promise<void> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }
  if (!Number.isSafeInteger(params.novelId) || params.novelId <= 0) {
    throw new Error("当前小说信息缺失，请刷新后重试");
  }
  if (
    params.chapterId !== undefined &&
    (!Number.isSafeInteger(params.chapterId) || params.chapterId <= 0)
  ) {
    throw new Error("当前章节 ID 缺失，请刷新后重试");
  }
  if (
    params.chapterNumber !== undefined &&
    (!Number.isSafeInteger(params.chapterNumber) || params.chapterNumber <= 0)
  ) {
    throw new Error("当前章节号缺失，请刷新后重试");
  }

  const response = await fetch("/api/v1/ai/agents/chat/stream", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: params.message,
      novel_id: params.novelId,
      conversation_id: params.conversationId,
      ...(params.chapterId !== undefined
        ? { chapter_id: params.chapterId }
        : {}),
      ...(params.chapterNumber !== undefined
        ? { chapter_number: params.chapterNumber }
        : {}),
    }),
    signal: params.signal,
  });

  if (response.status === 401) {
    const payload = await parseApiResponse<unknown>(response);
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok) {
    const payload = await parseApiResponse<unknown>(response);
    throw new Error(payload?.message || "AI 写作助手连接失败，请稍后再试");
  }

  if (!response.body) {
    throw new Error("当前浏览器不支持 AI 流式读取");
  }

  await readNovelAgentStream(response.body, handlers);
}

// resumeNovelAgentChatApproval 连接小说写作 Agent 工具人工审核恢复接口。
// 参数 params 表示 Agent 工具人工审核恢复参数；参数 handlers 表示流事件回调集合。
export async function resumeNovelAgentChatApproval(
  params: NovelAgentApprovalResumeParams,
  handlers: NovelAgentStreamHandlers,
): Promise<void> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }
  if (!Number.isSafeInteger(params.novelId) || params.novelId <= 0) {
    throw new Error("当前小说信息缺失，请刷新后重试");
  }
  if (
    params.chapterId !== undefined &&
    (!Number.isSafeInteger(params.chapterId) || params.chapterId <= 0)
  ) {
    throw new Error("当前章节 ID 缺失，请刷新后重试");
  }
  if (
    params.chapterNumber !== undefined &&
    (!Number.isSafeInteger(params.chapterNumber) || params.chapterNumber <= 0)
  ) {
    throw new Error("当前章节号缺失，请刷新后重试");
  }
  if (!params.checkpointId.trim() || !params.interruptId.trim()) {
    throw new Error("人工审核记录缺失，请重新发起 AI 请求");
  }

  const response = await fetch("/api/v1/ai/agents/chat/approval/resume", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      novel_id: params.novelId,
      conversation_id: params.conversationId,
      checkpoint_id: params.checkpointId,
      interrupt_id: params.interruptId,
      approved: params.approved,
      reason: params.reason?.trim() || undefined,
      ...(params.chapterId !== undefined
        ? { chapter_id: params.chapterId }
        : {}),
      ...(params.chapterNumber !== undefined
        ? { chapter_number: params.chapterNumber }
        : {}),
    }),
    signal: params.signal,
  });

  if (response.status === 401) {
    const payload = await parseApiResponse<unknown>(response);
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok) {
    const payload = await parseApiResponse<unknown>(response);
    throw new Error(payload?.message || "AI 写作助手恢复失败，请稍后再试");
  }

  if (!response.body) {
    throw new Error("当前浏览器不支持 AI 流式读取");
  }

  await readNovelAgentStream(response.body, handlers);
}

// streamNovelAgentRun 重新订阅小说写作 Agent 后台运行任务。
// 参数 runId 表示 AI 对话后台运行任务 ID；参数 handlers 表示流事件回调集合；参数 signal 表示用于断开本次流监听的浏览器 AbortSignal。
export async function streamNovelAgentRun(
  runId: string,
  handlers: NovelAgentStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("AI 对话任务不存在或已结束");
  }

  const response = await fetch(
    `/api/v1/ai/agents/chat/runs/${encodeURIComponent(normalizedRunId)}/stream`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );

  if (response.status === 401) {
    const payload = await parseApiResponse<unknown>(response);
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok) {
    const payload = await parseApiResponse<unknown>(response);
    throw new Error(payload?.message || "AI 写作助手连接失败，请稍后再试");
  }

  if (!response.body) {
    throw new Error("当前浏览器不支持 AI 流式读取");
  }

  await readNovelAgentStream(response.body, handlers);
}

// fetchPromptTypes 查询配置文件中的提示词类型库。
// 参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchPromptTypes(
  signal?: AbortSignal,
): Promise<PromptTypesData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/ai/prompt-types", {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<PromptTypesData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "提示词类型加载失败，请稍后再试");
  }
  return payload.data;
}

// createPromptType 调用后端接口新增提示词类型。
// 参数 name 表示需要新增的提示词类型名称。
export async function createPromptType(name: string): Promise<PromptTypesData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/ai/prompt-types", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name } satisfies PromptTypeUpsertParams),
  });
  const payload = await parseApiResponse<PromptTypesData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "提示词类型创建失败，请稍后再试");
  }
  return payload.data;
}

// renamePromptType 调用后端接口重命名提示词类型。
// 参数 oldName 表示原提示词类型名称；参数 name 表示新的提示词类型名称。
export async function renamePromptType(
  oldName: string,
  name: string,
): Promise<PromptTypesData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({ name: oldName });
  const response = await fetch(
    `/api/v1/ai/prompt-types?${searchParams.toString()}`,
    {
      method: "PUT",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name } satisfies PromptTypeUpsertParams),
    },
  );
  const payload = await parseApiResponse<PromptTypesData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "提示词类型重命名失败，请稍后再试");
  }
  return payload.data;
}

// deletePromptType 调用后端接口删除提示词类型。
// 参数 name 表示需要删除的提示词类型名称。
export async function deletePromptType(name: string): Promise<PromptTypesData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({ name });
  const response = await fetch(
    `/api/v1/ai/prompt-types?${searchParams.toString()}`,
    {
      method: "DELETE",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
    },
  );
  const payload = await parseApiResponse<PromptTypesData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "提示词类型删除失败，请稍后再试");
  }
  return payload.data;
}

// fetchPrompts 查询提示词分页列表，列表项不包含提示词正文。
// 参数 params 表示提示词分页查询参数。
export async function fetchPrompts(
  params: PromptListParams,
): Promise<PromptListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  if (params.promptType) {
    searchParams.set("prompt_type", params.promptType);
  }

  const response = await fetch(
    `/api/v1/ai/prompts?${searchParams.toString()}`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal: params.signal,
    },
  );
  const payload = await parseApiResponse<PromptListData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "提示词列表加载失败，请稍后再试");
  }
  return payload.data;
}

// fetchPromptDetail 查询指定提示词详情。
// 参数 id 表示提示词主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchPromptDetail(
  id: number,
  signal?: AbortSignal,
): Promise<PromptItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/ai/prompts/${id}`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<PromptItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "提示词详情加载失败，请稍后再试");
  }
  return payload.data;
}

// createPrompt 调用后端接口创建提示词。
// 参数 params 表示提示词创建表单数据。
export async function createPrompt(
  params: PromptUpsertParams,
): Promise<PromptItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/ai/prompts", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<PromptItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "提示词创建失败，请稍后再试");
  }
  return payload.data;
}

// updatePrompt 调用后端接口更新提示词。
// 参数 id 表示提示词主键 ID；参数 params 表示提示词更新表单数据。
export async function updatePrompt(
  id: number,
  params: PromptUpsertParams,
): Promise<PromptItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/ai/prompts/${id}`, {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<PromptItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "提示词更新失败，请稍后再试");
  }
  return payload.data;
}

// deletePrompt 调用后端接口删除指定提示词。
// 参数 id 表示提示词主键 ID。
export async function deletePrompt(id: number): Promise<PromptDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/ai/prompts/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
  });
  const payload = await parseApiResponse<PromptDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "提示词删除失败，请稍后再试");
  }
  return payload.data;
}

// fetchNovelAgentConversations 查询指定小说下的 Agent 会话列表。
// 参数 novelId 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchNovelAgentConversations(
  novelId: number,
  signal?: AbortSignal,
): Promise<NovelAgentConversationListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/agent-conversations`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<NovelAgentConversationListData>(response);
  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 会话列表加载失败，请稍后再试");
  }
  return payload.data;
}

// fetchNovelAgentRuns 查询当前小说仍在运行或等待人工审核的 AI 对话任务。
// 参数 novelId 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchNovelAgentRuns(
  novelId: number,
  signal?: AbortSignal,
): Promise<NovelAgentRunListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/agent-runs`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<NovelAgentRunListData>(response);
  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 对话任务加载失败，请稍后再试");
  }
  return payload.data;
}

// stopNovelAgentRun 手动停止指定 AI 对话后台运行任务。
// 参数 runId 表示 AI 对话后台运行任务 ID；参数 signal 表示用于取消停止请求的浏览器 AbortSignal。
export async function stopNovelAgentRun(
  runId: string,
  signal?: AbortSignal,
): Promise<NovelAgentRunStopData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }
  const normalizedRunId = runId.trim();
  if (!normalizedRunId) {
    throw new Error("AI 对话任务不存在或已结束");
  }

  const response = await fetch(
    `/api/v1/ai/agents/chat/runs/${encodeURIComponent(normalizedRunId)}/stop`,
    {
      method: "POST",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );
  const payload = await parseApiResponse<NovelAgentRunStopData>(response);
  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "停止 AI 对话失败，请稍后再试");
  }
  return payload.data;
}

// fetchNovelAgentConversationMessages 查询指定 Agent 会话最近的历史消息。
// 参数 novelId 表示小说主键 ID；参数 conversationId 表示 Agent 会话主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchNovelAgentConversationMessages(
  novelId: number,
  conversationId: number,
  signal?: AbortSignal,
): Promise<NovelAgentMessageListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/agent-conversations/${conversationId}/messages`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );
  const payload = await parseApiResponse<NovelAgentMessageListData>(response);
  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 历史消息加载失败，请稍后再试");
  }
  return payload.data;
}

// deleteNovelAgentConversation 删除指定 Agent 会话及其历史消息。
// 参数 novelId 表示小说主键 ID；参数 conversationId 表示 Agent 会话主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function deleteNovelAgentConversation(
  novelId: number,
  conversationId: number,
  signal?: AbortSignal,
): Promise<NovelAgentDeleteConversationData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/agent-conversations/${conversationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );
  const payload = await parseApiResponse<NovelAgentDeleteConversationData>(response);
  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 会话删除失败，请稍后再试");
  }
  return payload.data;
}

// fetchNovelAgentMessages 查询指定小说最近的 Agent 历史消息。
// 参数 novelId 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchNovelAgentMessages(
  novelId: number,
  signal?: AbortSignal,
): Promise<NovelAgentMessageListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/agent-messages`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<NovelAgentMessageListData>(response);
  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }
  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "AI 历史消息加载失败，请稍后再试");
  }
  return payload.data;
}

// fetchLogFiles 查询后端日志目录中的普通日志文件。
// 参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchLogFiles(signal?: AbortSignal): Promise<LogFilesData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/logs/files", {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<LogFilesData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "日志文件列表加载失败，请稍后再试");
  }

  return payload.data;
}

// clearTodayLogs 请求后端清空今日日志文件内容。
export async function clearTodayLogs(): Promise<LogClearTodayData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/logs/clear-today", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
  });
  const payload = await parseApiResponse<LogClearTodayData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "今日日志清空失败，请稍后再试");
  }

  return payload.data;
}

// deleteLogFiles 请求后端批量删除日志文件。
// 参数 params 表示需要删除的日志文件相对路径列表。
export async function deleteLogFiles(
  params: LogDeleteFilesParams,
): Promise<LogDeleteFilesData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/logs/files", {
    method: "DELETE",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<LogDeleteFilesData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "日志文件删除失败，请稍后再试");
  }

  return payload.data;
}

// fetchNovelList 查询当前用户可访问的小说列表。
// 参数 params 表示小说列表分页查询参数。
export async function fetchNovelList(
  params: NovelListParams,
): Promise<NovelListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  const response = await fetch(`/api/v1/novels?${searchParams.toString()}`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal: params.signal,
  });
  const payload = await parseApiResponse<NovelListData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "书架加载失败，请稍后再试");
  }

  return payload.data;
}

// fetchNovelDetail 查询指定小说的详情数据。
// 参数 id 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchNovelDetail(
  id: number,
  signal?: AbortSignal,
): Promise<NovelItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${id}`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<NovelItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说详情加载失败，请稍后再试");
  }

  return payload.data;
}

// fetchNovelWordCount 查询指定小说所有章节累计后的总字数。
// 参数 id 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchNovelWordCount(
  id: number,
  signal?: AbortSignal,
): Promise<NovelWordCountData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${id}/word-count`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<NovelWordCountData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说字数加载失败，请稍后再试");
  }

  return payload.data;
}

// createNovel 调用后端接口创建小说并返回新小说数据。
// 参数 params 表示创建小说时需要提交的表单数据。
export async function createNovel(
  params: NovelCreateParams,
): Promise<NovelItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch("/api/v1/novels", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<NovelItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说创建失败，请稍后再试");
  }

  return payload.data;
}

// updateNovel 调用后端接口更新小说并返回更新后的小说数据。
// 参数 id 表示小说主键 ID；参数 params 表示更新小说时需要提交的表单数据。
export async function updateNovel(
  id: number,
  params: NovelUpdateParams,
): Promise<NovelItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${id}`, {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<NovelItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说更新失败，请稍后再试");
  }

  return payload.data;
}

// deleteNovel 调用后端接口删除指定小说。
// 参数 id 表示小说主键 ID。
export async function deleteNovel(id: number): Promise<NovelDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
  });
  const payload = await parseApiResponse<NovelDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说删除失败，请稍后再试");
  }

  return payload.data;
}

// fetchNovelSummary 查询指定小说的滚动总结。
// 参数 novelId 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchNovelSummary(
  novelId: number,
  signal?: AbortSignal,
): Promise<NovelSummaryItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/summary`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<NovelSummaryItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说总结加载失败，请稍后再试");
  }

  return payload.data;
}

// createNovelSummary 为指定小说创建滚动总结。
// 参数 novelId 表示小说主键 ID；参数 params 表示需要创建的小说总结内容和覆盖章节范围。
export async function createNovelSummary(
  novelId: number,
  params: NovelSummarySaveParams,
): Promise<NovelSummaryItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/summary`, {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<NovelSummaryItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说总结保存失败，请稍后再试");
  }

  return payload.data;
}

// updateNovelSummary 更新指定小说的滚动总结。
// 参数 novelId 表示小说主键 ID；参数 params 表示需要覆盖保存的小说总结内容和覆盖章节范围。
export async function updateNovelSummary(
  novelId: number,
  params: NovelSummarySaveParams,
): Promise<NovelSummaryItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/summary`, {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<NovelSummaryItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说总结保存失败，请稍后再试");
  }

  return payload.data;
}

// deleteNovelSummary 删除指定小说的滚动总结。
// 参数 novelId 表示小说主键 ID。
export async function deleteNovelSummary(
  novelId: number,
): Promise<NovelSummaryDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/summary`, {
    method: "DELETE",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
  });
  const payload = await parseApiResponse<NovelSummaryDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说总结删除失败，请稍后再试");
  }

  return payload.data;
}

// fetchNovelOutline 查询指定小说的大纲。
// 参数 novelId 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchNovelOutline(
  novelId: number,
  signal?: AbortSignal,
): Promise<NovelOutlineItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/outline`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<NovelOutlineItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说大纲加载失败，请稍后再试");
  }

  return payload.data;
}

// createNovelOutline 为指定小说创建大纲。
// 参数 novelId 表示小说主键 ID；参数 params 表示需要创建的小说大纲正文。
export async function createNovelOutline(
  novelId: number,
  params: NovelOutlineSaveParams,
): Promise<NovelOutlineItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/outline`, {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<NovelOutlineItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说大纲保存失败，请稍后再试");
  }

  return payload.data;
}

// updateNovelOutline 更新指定小说的大纲。
// 参数 novelId 表示小说主键 ID；参数 params 表示需要覆盖保存的小说大纲正文。
export async function updateNovelOutline(
  novelId: number,
  params: NovelOutlineSaveParams,
): Promise<NovelOutlineItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/outline`, {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<NovelOutlineItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说大纲保存失败，请稍后再试");
  }

  return payload.data;
}

// deleteNovelOutline 删除指定小说的大纲。
// 参数 novelId 表示小说主键 ID。
export async function deleteNovelOutline(
  novelId: number,
): Promise<NovelOutlineDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/outline`, {
    method: "DELETE",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
  });
  const payload = await parseApiResponse<NovelOutlineDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "小说大纲删除失败，请稍后再试");
  }

  return payload.data;
}

// fetchChapterList 查询指定小说的章节摘要列表。
// 参数 novelId 表示小说主键 ID；参数 params 表示章节列表分页查询参数。
export async function fetchChapterList(
  novelId: number,
  params: ChapterListParams,
): Promise<ChapterListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  const response = await fetch(
    `/api/v1/novels/${novelId}/chapters?${searchParams.toString()}`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal: params.signal,
    },
  );
  const payload = await parseApiResponse<ChapterListData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节列表加载失败，请稍后再试");
  }

  return payload.data;
}

// fetchChapterDetail 查询指定章节详情。
// 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchChapterDetail(
  novelId: number,
  chapterId: number,
  signal?: AbortSignal,
): Promise<ChapterDetailItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/chapters/${chapterId}`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );
  const payload = await parseApiResponse<ChapterDetailItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节详情加载失败，请稍后再试");
  }

  return payload.data;
}

// fetchChapterSummary 查询指定章节概要详情。
// 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchChapterSummary(
  novelId: number,
  chapterId: number,
  signal?: AbortSignal,
): Promise<ChapterSummaryDetailItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/chapters/${chapterId}/summary`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );
  const payload = await parseApiResponse<ChapterSummaryDetailItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节概要加载失败，请稍后再试");
  }

  return payload.data;
}

// saveChapterSummary 调用后端接口创建或更新章节概要。
// 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID；参数 params 表示需要保存的章节概要数据。
export async function saveChapterSummary(
  novelId: number,
  chapterId: number,
  params: ChapterSummarySaveParams,
): Promise<ChapterSummaryDetailItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/chapters/${chapterId}/summary`,
    {
      method: "PUT",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    },
  );
  const payload = await parseApiResponse<ChapterSummaryDetailItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节概要保存失败，请稍后再试");
  }

  return payload.data;
}

// deleteChapterSummary 调用后端接口清空指定章节概要。
// 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID。
export async function deleteChapterSummary(
  novelId: number,
  chapterId: number,
): Promise<ChapterSummaryDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/chapters/${chapterId}/summary`,
    {
      method: "DELETE",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
    },
  );
  const payload = await parseApiResponse<ChapterSummaryDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节概要删除失败，请稍后再试");
  }

  return payload.data;
}

// fetchNextChapterNumber 查询指定小说下一章建议使用的章节号。
// 参数 novelId 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchNextChapterNumber(
  novelId: number,
  signal?: AbortSignal,
): Promise<NextChapterNumberData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/next-chapter-number`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );
  const payload = await parseApiResponse<NextChapterNumberData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "下一章节号加载失败，请稍后再试");
  }

  return payload.data;
}

// createChapter 调用后端接口创建章节并返回新章节数据。
// 参数 novelId 表示小说主键 ID；参数 params 表示创建章节时需要提交的表单数据。
export async function createChapter(
  novelId: number,
  params: ChapterCreateParams,
): Promise<ChapterDetailItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/chapters`, {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<ChapterDetailItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节创建失败，请稍后再试");
  }

  return payload.data;
}

// updateChapter 调用后端接口更新章节并返回更新后的章节数据。
// 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID；参数 params 表示更新章节时需要提交的表单数据。
export async function updateChapter(
  novelId: number,
  chapterId: number,
  params: ChapterUpdateParams,
): Promise<ChapterDetailItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/chapters/${chapterId}`,
    {
      method: "PUT",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    },
  );
  const payload = await parseApiResponse<ChapterDetailItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节更新失败，请稍后再试");
  }

  return payload.data;
}

// deleteChapter 调用后端接口删除指定章节。
// 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID。
export async function deleteChapter(
  novelId: number,
  chapterId: number,
): Promise<ChapterDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/chapters/${chapterId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
    },
  );
  const payload = await parseApiResponse<ChapterDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "章节删除失败，请稍后再试");
  }

  return payload.data;
}

// fetchCharacterList 查询指定小说的角色卡摘要列表。
// 参数 novelId 表示小说主键 ID；参数 params 表示角色卡列表分页查询参数。
export async function fetchCharacterList(
  novelId: number,
  params: CharacterListParams,
): Promise<CharacterListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  const response = await fetch(
    `/api/v1/novels/${novelId}/characters?${searchParams.toString()}`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal: params.signal,
    },
  );
  const payload = await parseApiResponse<CharacterListData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "角色卡列表加载失败，请稍后再试");
  }

  return payload.data;
}

// fetchCharacterDetail 查询指定角色卡详情。
// 参数 novelId 表示小说主键 ID；参数 characterId 表示角色卡主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchCharacterDetail(
  novelId: number,
  characterId: number,
  signal?: AbortSignal,
): Promise<CharacterDetailItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/characters/${characterId}`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );
  const payload = await parseApiResponse<CharacterDetailItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "角色卡详情加载失败，请稍后再试");
  }

  return payload.data;
}

// createCharacter 调用后端接口创建角色卡并返回新角色数据。
// 参数 novelId 表示小说主键 ID；参数 params 表示创建角色卡时需要提交的表单数据。
export async function createCharacter(
  novelId: number,
  params: CharacterCreateParams,
): Promise<CharacterDetailItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/characters`, {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<CharacterDetailItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "角色卡创建失败，请稍后再试");
  }

  return payload.data;
}

// updateCharacter 调用后端接口更新角色卡并返回更新后的角色数据。
// 参数 novelId 表示小说主键 ID；参数 characterId 表示角色卡主键 ID；参数 params 表示更新角色卡时需要提交的表单数据。
export async function updateCharacter(
  novelId: number,
  characterId: number,
  params: CharacterUpdateParams,
): Promise<CharacterDetailItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/characters/${characterId}`,
    {
      method: "PUT",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    },
  );
  const payload = await parseApiResponse<CharacterDetailItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "角色卡更新失败，请稍后再试");
  }

  return payload.data;
}

// deleteCharacter 调用后端接口删除指定角色卡。
// 参数 novelId 表示小说主键 ID；参数 characterId 表示角色卡主键 ID。
export async function deleteCharacter(
  novelId: number,
  characterId: number,
): Promise<CharacterDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/characters/${characterId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
    },
  );
  const payload = await parseApiResponse<CharacterDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "角色卡删除失败，请稍后再试");
  }

  return payload.data;
}

// fetchRelationshipGraph 查询指定小说的角色关系图快照。
// 参数 novelId 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchRelationshipGraph(
  novelId: number,
  signal?: AbortSignal,
): Promise<RelationshipGraphData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/relationship-graph`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );
  const payload = await parseApiResponse<RelationshipGraphData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "角色关系图加载失败，请稍后再试");
  }

  return payload.data;
}

// saveRelationshipGraph 保存指定小说的完整角色关系图快照。
// 参数 novelId 表示小说主键 ID；参数 params 表示当前需要保存的关系图快照。
export async function saveRelationshipGraph(
  novelId: number,
  params: RelationshipGraphSaveParams,
): Promise<RelationshipGraphData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/relationship-graph`,
    {
      method: "PUT",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    },
  );
  const payload = await parseApiResponse<RelationshipGraphData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "角色关系图保存失败，请稍后再试");
  }

  return payload.data;
}

// fetchEventGraph 查询指定小说的事件图数据。
// 参数 novelId 表示小说主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchEventGraph(
  novelId: number,
  signal?: AbortSignal,
): Promise<EventGraphData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/event-graph`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<EventGraphData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件图加载失败，请稍后再试");
  }

  return payload.data;
}

// saveEventGraphLayout 保存指定小说的事件图布局。
// 参数 novelId 表示小说主键 ID；参数 params 表示需要保存的事件图视口和节点坐标。
export async function saveEventGraphLayout(
  novelId: number,
  params: EventLayoutParams,
): Promise<EventGraphData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/event-graph/layout`, {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<EventGraphData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件图布局保存失败，请稍后再试");
  }

  return payload.data;
}

// fetchEventList 查询指定小说的事件列表。
// 参数 novelId 表示小说主键 ID；参数 params 表示事件列表分页查询参数。
export async function fetchEventList(
  novelId: number,
  params: EventListParams,
): Promise<EventListData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({
    page: String(params.page),
    page_size: String(params.pageSize),
  });
  const response = await fetch(
    `/api/v1/novels/${novelId}/events?${searchParams.toString()}`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal: params.signal,
    },
  );
  const payload = await parseApiResponse<EventListData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件列表加载失败，请稍后再试");
  }

  return payload.data;
}

// fetchEventDetail 查询指定小说事件详情。
// 参数 novelId 表示小说主键 ID；参数 eventId 表示事件主键 ID；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function fetchEventDetail(
  novelId: number,
  eventId: number,
  signal?: AbortSignal,
): Promise<NovelEventItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/events/${eventId}`, {
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    signal,
  });
  const payload = await parseApiResponse<NovelEventItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件详情加载失败，请稍后再试");
  }

  return payload.data;
}

// createEvent 调用后端接口创建事件并返回新事件数据。
// 参数 novelId 表示小说主键 ID；参数 params 表示创建事件时需要提交的表单数据。
export async function createEvent(
  novelId: number,
  params: EventCreateParams,
): Promise<NovelEventItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/events`, {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<NovelEventItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件创建失败，请稍后再试");
  }

  return payload.data;
}

// updateEvent 调用后端接口更新事件并返回更新后的事件数据。
// 参数 novelId 表示小说主键 ID；参数 eventId 表示事件主键 ID；参数 params 表示更新事件时需要提交的表单数据。
export async function updateEvent(
  novelId: number,
  eventId: number,
  params: EventUpdateParams,
): Promise<NovelEventItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/events/${eventId}`, {
    method: "PUT",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<NovelEventItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件更新失败，请稍后再试");
  }

  return payload.data;
}

// deleteEvent 调用后端接口删除指定事件。
// 参数 novelId 表示小说主键 ID；参数 eventId 表示事件主键 ID。
export async function deleteEvent(
  novelId: number,
  eventId: number,
): Promise<EventDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/events/${eventId}`, {
    method: "DELETE",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
  });
  const payload = await parseApiResponse<EventDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件删除失败，请稍后再试");
  }

  return payload.data;
}

// createEventRelation 调用后端接口创建事件关系线。
// 参数 novelId 表示小说主键 ID；参数 params 表示创建关系线时需要提交的数据。
export async function createEventRelation(
  novelId: number,
  params: EventRelationCreateParams,
): Promise<EventRelationItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(`/api/v1/novels/${novelId}/event-relations`, {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });
  const payload = await parseApiResponse<EventRelationItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件关系线创建失败，请稍后再试");
  }

  return payload.data;
}

// updateEventRelation 调用后端接口更新事件关系线备注。
// 参数 novelId 表示小说主键 ID；参数 relationId 表示关系线主键 ID；参数 params 表示更新关系线时需要提交的数据。
export async function updateEventRelation(
  novelId: number,
  relationId: number,
  params: EventRelationUpdateParams,
): Promise<EventRelationItem> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/event-relations/${relationId}`,
    {
      method: "PUT",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    },
  );
  const payload = await parseApiResponse<EventRelationItem>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件关系线更新失败，请稍后再试");
  }

  return payload.data;
}

// deleteEventRelation 调用后端接口删除指定事件关系线。
// 参数 novelId 表示小说主键 ID；参数 relationId 表示关系线主键 ID。
export async function deleteEventRelation(
  novelId: number,
  relationId: number,
): Promise<EventRelationDeleteData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const response = await fetch(
    `/api/v1/novels/${novelId}/event-relations/${relationId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
    },
  );
  const payload = await parseApiResponse<EventRelationDeleteData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "事件关系线删除失败，请稍后再试");
  }

  return payload.data;
}

// uploadImage 调用后端接口上传图片并返回对象 key 和预览链接。
// 参数 file 表示用户选择的图片文件；参数 usage 表示图片用途。
export async function uploadImage(
  file: File,
  usage: ImageUploadUsage,
): Promise<ImageUploadData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("usage", usage);

  const response = await fetch("/api/v1/uploads/images", {
    method: "POST",
    headers: {
      Authorization: formatAuthorizationHeader(authData),
    },
    body: formData,
  });
  const payload = await parseApiResponse<ImageUploadData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "图片上传失败，请稍后再试");
  }

  return payload.data;
}

// refreshImagePreview 调用后端接口刷新私有图片的预签名预览链接。
// 参数 objectKey 表示图片对象 key；参数 signal 表示用于取消请求的浏览器 AbortSignal。
export async function refreshImagePreview(
  objectKey: string,
  signal?: AbortSignal,
): Promise<ImagePreviewData> {
  const authData = readAuthData();
  if (!authData) {
    throw new UnauthorizedError("登录已过期，请重新登录");
  }

  const searchParams = new URLSearchParams({
    object_key: objectKey,
  });
  const response = await fetch(
    `/api/v1/uploads/preview?${searchParams.toString()}`,
    {
      headers: {
        Authorization: formatAuthorizationHeader(authData),
      },
      signal,
    },
  );
  const payload = await parseApiResponse<ImagePreviewData>(response);

  if (response.status === 401) {
    clearAuthData();
    throw new UnauthorizedError(payload?.message || "登录已过期，请重新登录");
  }

  if (!response.ok || !payload?.data) {
    throw new Error(payload?.message || "封面预览加载失败，请稍后再试");
  }

  return payload.data;
}

// readLogStream 从浏览器 ReadableStream 中按行读取日志事件。
// 参数 body 表示 fetch 返回的响应体流；参数 handlers 表示日志流事件回调集合。
async function readLogStream(
  body: ReadableStream<Uint8Array>,
  handlers: LogStreamHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });
      buffer = consumeLogStreamBuffer(buffer, handlers);
    }

    buffer += decoder.decode();
    consumeLogStreamBuffer(`${buffer}\n`, handlers);
  } finally {
    reader.releaseLock();
  }
}

// consumeLogStreamBuffer 消费缓冲区中的完整 NDJSON 行并返回剩余半行。
// 参数 buffer 表示当前缓冲文本；参数 handlers 表示日志流事件回调集合。
function consumeLogStreamBuffer(
  buffer: string,
  handlers: LogStreamHandlers,
): string {
  const lines = buffer.split(/\r?\n/);
  const rest = lines.pop() ?? "";

  for (const line of lines) {
    const event = parseLogStreamEvent(line);
    if (event) {
      handlers.onEvent(event);
    }
  }

  return rest;
}

// parseLogStreamEvent 将单行 NDJSON 文本解析为日志流事件。
// 参数 line 表示后端返回的一行 NDJSON 文本。
function parseLogStreamEvent(line: string): LogStreamEvent | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return null;
  }

  try {
    const event = JSON.parse(trimmedLine) as LogStreamEvent;
    if (event.type === "meta" || event.type === "error") {
      return event;
    }
    if (event.type === "entry" && event.entry) {
      return event;
    }
  } catch {
    return null;
  }

  return null;
}

// readNovelAgentStream 从浏览器 ReadableStream 中按行读取 Agent 事件。
// 参数 body 表示 fetch 返回的响应体流；参数 handlers 表示 Agent 流事件回调集合。
async function readNovelAgentStream(
  body: ReadableStream<Uint8Array>,
  handlers: NovelAgentStreamHandlers,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) {
        break;
      }

      buffer += decoder.decode(result.value, { stream: true });
      buffer = consumeNovelAgentStreamBuffer(buffer, handlers);
    }

    buffer += decoder.decode();
    consumeNovelAgentStreamBuffer(`${buffer}\n`, handlers);
  } finally {
    reader.releaseLock();
  }
}

// consumeNovelAgentStreamBuffer 消费缓冲区中的完整 Agent NDJSON 行并返回剩余半行。
// 参数 buffer 表示当前缓冲文本；参数 handlers 表示 Agent 流事件回调集合。
function consumeNovelAgentStreamBuffer(
  buffer: string,
  handlers: NovelAgentStreamHandlers,
): string {
  const lines = buffer.split(/\r?\n/);
  const rest = lines.pop() ?? "";

  for (const line of lines) {
    const event = parseNovelAgentStreamEvent(line);
    if (event) {
      handlers.onEvent(event);
    }
  }

  return rest;
}

// parseNovelAgentStreamEvent 将单行 NDJSON 文本解析为 Agent 流事件。
// 参数 line 表示后端返回的一行 NDJSON 文本。
function parseNovelAgentStreamEvent(line: string): NovelAgentStreamEvent | null {
  const trimmedLine = line.trim();
  if (!trimmedLine) {
    return null;
  }

  try {
    const event = JSON.parse(trimmedLine) as NovelAgentStreamEvent;
    if (
      event.type === "meta" ||
      event.type === "delta" ||
      event.type === "approval_required" ||
      event.type === "done" ||
      event.type === "error" ||
      event.type === "cancelled"
    ) {
      return event;
    }
  } catch {
    return null;
  }

  return null;
}

// parseStoredAuthData 解析本地存储中的登录令牌。
// 参数 rawValue 表示 localStorage 中的原始字符串。
function parseStoredAuthData(rawValue: string): AuthData | null {
  try {
    const value = JSON.parse(rawValue) as unknown;
    if (isAuthData(value)) {
      return value;
    }
  } catch {
    return null;
  }
  return null;
}

// isAuthData 判断未知数据是否符合登录令牌结构。
// 参数 value 表示需要判断的未知数据。
function isAuthData(value: unknown): value is AuthData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const data = value as Record<string, unknown>;
  return (
    typeof data.token === "string" &&
    typeof data.token_type === "string" &&
    typeof data.expires_at === "string"
  );
}

// isExpiredAuthData 判断登录令牌是否已经过期。
// 参数 data 表示本地保存的登录令牌。
function isExpiredAuthData(data: AuthData): boolean {
  const expiresAt = new Date(data.expires_at).getTime();
  if (Number.isNaN(expiresAt)) {
    return true;
  }
  return Date.now() >= expiresAt;
}

// formatAuthorizationHeader 生成后端鉴权需要的 Authorization 请求头。
// 参数 data 表示登录接口返回的令牌数据。
function formatAuthorizationHeader(data: AuthData): string {
  const tokenType = data.token_type.trim() || "Bearer";
  return `${tokenType} ${data.token}`;
}

// parseApiResponse 解析后端统一响应结构。
// 参数 response 表示 fetch 返回的 HTTP 响应对象。
async function parseApiResponse<TData>(
  response: Response,
): Promise<ApiResponse<TData> | null> {
  return (await response.json().catch(() => null)) as ApiResponse<TData> | null;
}
