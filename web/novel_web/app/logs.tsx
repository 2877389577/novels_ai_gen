import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type UIEvent,
} from "react";

import {
  UnauthorizedError,
  streamLogs,
  type LogEntry,
  type LogLevel,
  type LogStreamMetaEvent,
} from "./api";

const allLogLevels: LogLevel[] = ["debug", "info", "warn", "error"];
const maxLogEntries = 2000;

// LogsPageProps 表示日志预览页需要的外部回调。
interface LogsPageProps {
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// LogsPage 渲染文件日志实时预览页面。
// 参数 props 表示日志预览页需要的外部回调。
export function LogsPage(props: LogsPageProps) {
  const [date, setDate] = useState(getTodayText);
  const [keyword, setKeyword] = useState("");
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [paused, setPaused] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [meta, setMeta] = useState<LogStreamMetaEvent | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [autoFollow, setAutoFollow] = useState(true);
  const listRef = useRef<HTMLDivElement | null>(null);

  const streamLevels = useMemo(
    // calculateStreamLevels 计算实际提交给后端的日志等级集合。
    function calculateStreamLevels() {
      return selectedLevels.length === allLogLevels.length ? [] : selectedLevels;
    },
    [selectedLevels],
  );

  useEffect(
    // connectLogStream 连接日志流并在依赖变化时自动重连。
    function connectLogStream() {
      if (paused) {
        setConnecting(false);
        return;
      }

      const controller = new AbortController();
      setConnecting(true);
      setErrorMessage("");
      setMeta(null);

      void streamLogs(
        {
          date,
          keyword,
          levels: streamLevels,
          tail: 300,
          signal: controller.signal,
        },
        {
          // onEvent 处理后端推送的单个日志流事件。
          onEvent(event) {
            if (event.type === "meta") {
              setMeta(event);
              return;
            }
            if (event.type === "error") {
              setErrorMessage(event.message || "日志流读取失败");
              return;
            }
            setEntries(function appendEntry(currentEntries) {
              const nextEntries = [...currentEntries, event.entry];
              return nextEntries.slice(-maxLogEntries);
            });
          },
        },
      )
        // handleStreamError 处理日志流连接或读取失败。
        .catch(function handleStreamError(error) {
          if (isAbortError(error)) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            props.onUnauthorized();
            return;
          }
          const message = getErrorMessage(error, "日志流连接失败，请稍后再试");
          setErrorMessage(message);
          Toast.error(message);
        })
        // finishStream 在日志流结束后更新连接状态。
        .finally(function finishStream() {
          if (!controller.signal.aborted) {
            setConnecting(false);
          }
        });

      // disconnectLogStream 取消当前日志流连接。
      return function disconnectLogStream() {
        controller.abort();
      };
    },
    [date, keyword, paused, props.onUnauthorized, streamLevels],
  );

  useEffect(
    // followLatestEntry 在自动跟随开启时滚动到最新日志。
    function followLatestEntry() {
      if (!autoFollow || !listRef.current) {
        return;
      }
      listRef.current.scrollTop = listRef.current.scrollHeight;
    },
    [autoFollow, entries],
  );

  // handleDateChange 处理日志日期筛选变化。
  // 参数 event 表示日期输入框变化事件。
  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    setEntries([]);
    setDate(event.target.value || getTodayText());
    setAutoFollow(true);
  }

  // handleKeywordChange 处理关键词筛选变化。
  // 参数 event 表示关键词输入框变化事件。
  function handleKeywordChange(event: ChangeEvent<HTMLInputElement>) {
    setEntries([]);
    setKeyword(event.target.value);
    setAutoFollow(true);
  }

  // handleClearClick 清空当前页面中已经展示的日志条目。
  function handleClearClick() {
    setEntries([]);
    setAutoFollow(true);
  }

  // handlePauseToggle 切换日志流暂停或继续状态。
  function handlePauseToggle() {
    // togglePaused 根据当前暂停状态切换下一状态。
    setPaused(function togglePaused(currentPaused) {
      return !currentPaused;
    });
  }

  // handleAllLevelsClick 切换为全部日志等级。
  function handleAllLevelsClick() {
    setEntries([]);
    setSelectedLevels([]);
    setAutoFollow(true);
  }

  // handleLevelChange 处理单个日志等级筛选变化。
  // 参数 level 表示被切换的日志等级。
  const handleLevelChange = useCallback(function handleLevelChange(
    level: LogLevel,
  ) {
    setEntries([]);
    setAutoFollow(true);
    // updateLevels 根据用户点击的等级更新筛选集合。
    setSelectedLevels(function updateLevels(currentLevels) {
      const activeLevels =
        currentLevels.length === 0 ? allLogLevels : currentLevels;
      if (activeLevels.includes(level)) {
        // keepOtherLevel 保留未被本次点击取消的日志等级。
        const nextLevels = activeLevels.filter(function keepOtherLevel(item) {
          return item !== level;
        });
        return nextLevels.length === allLogLevels.length ? [] : nextLevels;
      }
      const nextLevels = [...activeLevels, level].sort(compareLevelOrder);
      return nextLevels.length === allLogLevels.length ? [] : nextLevels;
    });
  }, []);

  // handleListScroll 处理用户滚动日志列表后的自动跟随状态。
  // 参数 event 表示日志列表滚动事件。
  function handleListScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const distanceToBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    setAutoFollow(distanceToBottom < 36);
  }

  const statusText = getConnectionStatus(paused, connecting, meta);
  const levelSummary = getLevelSummary(selectedLevels);

  return (
    <main className="logs-page">
      <header className="settings-nav logs-nav">
        <button
          type="button"
          className="settings-brand"
          onClick={props.onBackToBookshelf}
        >
          <span className="settings-seal" aria-hidden="true">
            墨
          </span>
          <span>墨香墨苑</span>
        </button>

        <button
          type="button"
          className="settings-back-button"
          onClick={props.onBackToBookshelf}
        >
          <span aria-hidden="true">←</span>
          <span>返回书架</span>
        </button>
      </header>

      <section className="logs-shell" aria-labelledby="logs-title">
        <div className="logs-heading">
          <div>
            <p className="settings-kicker">Logs</p>
            <h1 id="logs-title">日志预览</h1>
          </div>
          <div className="logs-status" title={meta?.path || ""}>
            <span>{statusText}</span>
            <span>{levelSummary}</span>
          </div>
        </div>

        <section className="logs-filter-bar" aria-label="日志筛选">
          <label>
            <span>日期</span>
            <input type="date" value={date} onChange={handleDateChange} />
          </label>
          <label className="logs-keyword-field">
            <span>关键词</span>
            <input
              type="search"
              value={keyword}
              placeholder="消息、RequestID 或原始行"
              onChange={handleKeywordChange}
            />
          </label>
          <fieldset>
            <legend>等级</legend>
            <button
              type="button"
              className="logs-level-all"
              aria-pressed={selectedLevels.length === 0}
              onClick={handleAllLevelsClick}
            >
              全部
            </button>
            {allLogLevels.map((level) => (
              <label key={level}>
                <input
                  type="checkbox"
                  checked={isLevelChecked(level, selectedLevels)}
                  onChange={() => handleLevelChange(level)}
                />
                <span>{level.toUpperCase()}</span>
              </label>
            ))}
          </fieldset>
          <div className="logs-actions">
            <button type="button" onClick={handlePauseToggle}>
              {paused ? "继续" : "暂停"}
            </button>
            <button type="button" onClick={handleClearClick}>
              清空
            </button>
          </div>
        </section>

        {errorMessage ? (
          <p className="logs-error-message" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div
          ref={listRef}
          className="logs-list"
          aria-label="日志列表"
          onScroll={handleListScroll}
        >
          {entries.length === 0 ? (
            <div className="logs-empty">
              {connecting ? "正在读取日志..." : "暂无匹配日志"}
            </div>
          ) : (
            entries.map(renderLogEntry)
          )}
        </div>
      </section>
    </main>
  );
}

// renderLogEntry 渲染单条日志内容。
// 参数 entry 表示需要展示的日志条目；参数 index 表示日志条目在当前列表中的位置。
function renderLogEntry(entry: LogEntry, index: number) {
  const raw = entry.raw || "";
  const attrsText = entry.attrs ? JSON.stringify(entry.attrs) : "";
  return (
    <article className="logs-entry" key={`${entry.time}-${index}-${raw}`}>
      <span className="logs-entry-time">{formatLogTime(entry.time)}</span>
      <span className={`logs-entry-level logs-entry-level-${entry.level || ""}`}>
        {(entry.level || "raw").toUpperCase()}
      </span>
      <span className="logs-entry-request-id" title={entry.request_id || ""}>
        {entry.request_id || "-"}
      </span>
      <div className="logs-entry-message">
        <span>{entry.message || raw}</span>
        <details>
          <summary>原始</summary>
          <pre>{raw}</pre>
          {attrsText ? <pre>{attrsText}</pre> : null}
          <button type="button" onClick={() => copyLogRaw(raw)}>
            复制
          </button>
        </details>
      </div>
    </article>
  );
}

// copyLogRaw 复制原始日志文本到剪贴板。
// 参数 raw 表示需要复制的原始日志文本。
function copyLogRaw(raw: string) {
  if (!raw) {
    Toast.info("没有可复制的原始日志");
    return;
  }
  void navigator.clipboard
    .writeText(raw)
    // handleCopied 处理原始日志复制成功。
    .then(function handleCopied() {
      Toast.success("原始日志已复制");
    })
    // handleCopyFailed 处理原始日志复制失败。
    .catch(function handleCopyFailed() {
      Toast.error("复制失败，请手动选择文本");
    });
}

// getTodayText 返回当前本地日期文本。
function getTodayText(): string {
  const now = new Date();
  const offsetNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetNow.toISOString().slice(0, 10);
}

// isLevelChecked 判断指定日志等级在筛选器中是否被选中。
// 参数 level 表示需要判断的日志等级；参数 selectedLevels 表示当前显式选择的等级集合，空数组表示全部。
function isLevelChecked(level: LogLevel, selectedLevels: LogLevel[]): boolean {
  return selectedLevels.length === 0 || selectedLevels.includes(level);
}

// compareLevelOrder 按固定日志等级顺序排序。
// 参数 left 表示左侧日志等级；参数 right 表示右侧日志等级。
function compareLevelOrder(left: LogLevel, right: LogLevel): number {
  return allLogLevels.indexOf(left) - allLogLevels.indexOf(right);
}

// getConnectionStatus 获取日志流连接状态展示文本。
// 参数 paused 表示日志流是否暂停；参数 connecting 表示日志流是否正在连接；参数 meta 表示日志流元信息。
function getConnectionStatus(
  paused: boolean,
  connecting: boolean,
  meta: LogStreamMetaEvent | null,
): string {
  if (paused) {
    return "已暂停";
  }
  if (connecting && !meta) {
    return "连接中";
  }
  if (meta?.follow) {
    return "实时跟随";
  }
  return "历史日志";
}

// getLevelSummary 获取日志等级筛选摘要。
// 参数 selectedLevels 表示当前显式选择的日志等级集合，空数组表示全部。
function getLevelSummary(selectedLevels: LogLevel[]): string {
  if (selectedLevels.length === 0) {
    return "全部等级";
  }
  return selectedLevels.map((level) => level.toUpperCase()).join(" / ");
}

// formatLogTime 格式化日志时间。
// 参数 value 表示日志中携带的时间文本。
function formatLogTime(value?: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString();
}

// getErrorMessage 从未知错误中提取用户提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底提示。
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// isAbortError 判断错误是否来自请求取消。
// 参数 error 表示捕获到的未知错误。
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
