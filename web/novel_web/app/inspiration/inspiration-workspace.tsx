import type { PromptSummaryItem } from "../api";
import { formatPromptDescription, formatTime } from "./inspiration-utils";
import type { InspirationLoadState, PromptModalMode } from "./types";

// TypePanelProps 表示提示词类型面板需要的数据和回调。
interface TypePanelProps {
  // promptTypes 表示当前可用的提示词类型列表。
  promptTypes: string[];
  // selectedPromptType 表示当前选中的提示词类型，空字符串表示全部类型。
  selectedPromptType: string;
  // totalPrompts 表示当前筛选条件下提示词总数。
  totalPrompts: number;
  // typeState 表示提示词类型列表加载状态。
  typeState: InspirationLoadState;
  // onCreate 表示点击新增类型时执行的回调。
  onCreate: () => void;
  // onSelectAll 表示选择全部类型时执行的回调。
  onSelectAll: () => void;
  // onSelectType 表示选择指定类型时执行的回调。
  onSelectType: (promptType: string) => void;
  // onRename 表示请求重命名类型时执行的回调。
  onRename: (promptType: string) => void;
  // onDelete 表示请求删除类型时执行的回调。
  onDelete: (promptType: string) => void;
}

// TypePanel 渲染提示词类型筛选和类型操作区域。
// 参数 props 表示提示词类型面板需要的数据和回调。
export function TypePanel(props: TypePanelProps) {
  return (
    <aside className="inspiration-type-panel">
      <div className="inspiration-panel-heading">
        <div>
          <h2>提示词类型</h2>
          <p>类型来自配置文件，适合作为筛选和推荐入口。</p>
        </div>
        <button
          type="button"
          className="settings-primary-button"
          onClick={props.onCreate}
        >
          新增类型
        </button>
      </div>

      <div className="inspiration-type-list">
        <button
          type="button"
          className={
            props.selectedPromptType
              ? "inspiration-type-filter"
              : "inspiration-type-filter inspiration-type-filter-active"
          }
          onClick={props.onSelectAll}
        >
          <span>全部类型</span>
          <em>{props.totalPrompts}</em>
        </button>

        {props.typeState === "loading" ? (
          <p className="inspiration-muted">类型加载中...</p>
        ) : null}

        {props.promptTypes.map((promptType) => (
          <div className="inspiration-type-row" key={promptType}>
            <button
              type="button"
              className={
                props.selectedPromptType === promptType
                  ? "inspiration-type-filter inspiration-type-filter-active"
                  : "inspiration-type-filter"
              }
              onClick={function handlePromptTypeFilterClick() {
                props.onSelectType(promptType);
              }}
            >
              <span>{promptType}</span>
            </button>
            <div className="inspiration-type-actions">
              <button
                type="button"
                onClick={function handleRenameTypeClick() {
                  props.onRename(promptType);
                }}
              >
                改名
              </button>
              <button
                type="button"
                onClick={function handleRemoveTypeClick() {
                  props.onDelete(promptType);
                }}
              >
                删除
              </button>
            </div>
          </div>
        ))}

        {props.typeState === "ready" && props.promptTypes.length === 0 ? (
          <p className="inspiration-empty-hint">
            还没有提示词类型，请先创建类型后再新增提示词。
          </p>
        ) : null}
      </div>
    </aside>
  );
}

// PromptPanelProps 表示提示词列表面板需要的数据和回调。
interface PromptPanelProps {
  // selectedPromptType 表示当前筛选的提示词类型。
  selectedPromptType: string;
  // promptTypes 表示当前可用的提示词类型列表。
  promptTypes: string[];
  // promptState 表示提示词列表加载状态。
  promptState: InspirationLoadState;
  // prompts 表示当前页提示词摘要列表。
  prompts: PromptSummaryItem[];
  // deletingPromptID 表示正在删除的提示词 ID。
  deletingPromptID: number | null;
  // currentPage 表示当前页码。
  currentPage: number;
  // totalPages 表示提示词分页总页数。
  totalPages: number;
  // onCreate 表示点击新增提示词时执行的回调。
  onCreate: () => void;
  // onOpenPrompt 表示查看或编辑提示词时执行的回调。
  onOpenPrompt: (prompt: PromptSummaryItem, mode: PromptModalMode) => void;
  // onDeletePrompt 表示删除提示词时执行的回调。
  onDeletePrompt: (prompt: PromptSummaryItem) => void;
  // onPreviousPage 表示切换到上一页时执行的回调。
  onPreviousPage: () => void;
  // onNextPage 表示切换到下一页时执行的回调。
  onNextPage: () => void;
}

// PromptPanel 渲染提示词列表、空状态和分页区域。
// 参数 props 表示提示词列表面板需要的数据和回调。
export function PromptPanel(props: PromptPanelProps) {
  return (
    <section className="inspiration-prompt-panel">
      <div className="inspiration-panel-heading">
        <div>
          <h2>提示词库</h2>
          <p>
            {props.selectedPromptType
              ? `当前筛选：${props.selectedPromptType}`
              : "当前展示全部提示词"}
          </p>
        </div>
        <button
          type="button"
          className="settings-primary-button"
          disabled={props.promptTypes.length === 0}
          title={
            props.promptTypes.length === 0 ? "请先创建提示词类型" : undefined
          }
          onClick={props.onCreate}
        >
          新增提示词
        </button>
      </div>

      {props.promptState === "loading" ? (
        <div className="inspiration-prompt-skeleton" aria-label="提示词加载中">
          <span />
          <span />
          <span />
        </div>
      ) : null}

      {props.promptState === "ready" && props.prompts.length === 0 ? (
        <div className="inspiration-empty">
          <p>
            {props.promptTypes.length === 0
              ? "先创建提示词类型，就能开始沉淀提示词。"
              : "当前筛选下还没有提示词。"}
          </p>
        </div>
      ) : null}

      {props.promptState === "ready" && props.prompts.length > 0 ? (
        <div className="inspiration-prompt-list">
          {props.prompts.map((prompt) => (
            <article className="inspiration-prompt-card" key={prompt.id}>
              <div className="inspiration-prompt-card-main">
                <span>{prompt.prompt_type}</span>
                <h3>{formatPromptDescription(prompt.description)}</h3>
                <p>更新于 {formatTime(prompt.updated_at)}</p>
              </div>
              <div className="inspiration-prompt-card-actions">
                <button
                  type="button"
                  className="settings-secondary-button"
                  onClick={function handleViewPromptClick() {
                    props.onOpenPrompt(prompt, "view");
                  }}
                >
                  查看
                </button>
                <button
                  type="button"
                  className="settings-secondary-button"
                  onClick={function handleEditPromptClick() {
                    props.onOpenPrompt(prompt, "edit");
                  }}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="settings-secondary-button inspiration-danger-button"
                  disabled={props.deletingPromptID === prompt.id}
                  onClick={function handleRemovePromptClick() {
                    props.onDeletePrompt(prompt);
                  }}
                >
                  {props.deletingPromptID === prompt.id ? "删除中..." : "删除"}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="inspiration-pagination">
        <span>
          第 {Math.min(props.currentPage, props.totalPages)} /{" "}
          {props.totalPages} 页
        </span>
        <div>
          <button
            type="button"
            className="settings-secondary-button"
            disabled={props.currentPage <= 1 || props.promptState === "loading"}
            onClick={props.onPreviousPage}
          >
            上一页
          </button>
          <button
            type="button"
            className="settings-secondary-button"
            disabled={
              props.currentPage >= props.totalPages ||
              props.promptState === "loading"
            }
            onClick={props.onNextPage}
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}
