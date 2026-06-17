import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";

import {
  fetchConfigFile,
  triggerSystemUpdate,
  updateConfigFile,
  UnauthorizedError,
  type ConfigFileData,
} from "./api";
import { LogsPanel } from "./logs";

// SettingsSection 表示设置中心支持切换的功能分区。
export type SettingsSection = "config" | "logs" | "system";

// SettingsPageProps 表示设置中心页面需要的外部状态和回调。
interface SettingsPageProps {
  // section 表示设置中心当前激活的功能分区。
  section: SettingsSection;
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onSectionChange 表示设置中心切换功能分区时执行的回调。
  onSectionChange: (section: SettingsSection) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ConfigSettingsPanelProps 表示配置管理面板需要的外部回调。
interface ConfigSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// SystemSettingsPanelProps 表示系统更新面板需要的外部回调。
interface SystemSettingsPanelProps {
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// SettingsPage 渲染聚合配置、日志和系统更新的设置中心。
// 参数 props 表示设置中心页面需要的外部状态和回调。
export function SettingsPage(props: SettingsPageProps) {
  // handleConfigSectionClick 切换到配置管理分区。
  function handleConfigSectionClick() {
    props.onSectionChange("config");
  }

  // handleLogsSectionClick 切换到日志预览分区。
  function handleLogsSectionClick() {
    props.onSectionChange("logs");
  }

  // handleSystemSectionClick 切换到系统更新分区。
  function handleSystemSectionClick() {
    props.onSectionChange("system");
  }

  return (
    <main className="settings-page">
      <header className="settings-nav">
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

      <section className="settings-center-shell" aria-label="设置中心">
        <aside className="settings-sidebar" aria-label="设置菜单">
          <div className="settings-sidebar-heading">
            <p className="settings-kicker">Settings</p>
            <h1>设置</h1>
          </div>
          <nav className="settings-sidebar-nav" aria-label="设置分区">
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={props.section === "config" ? "page" : undefined}
              onClick={handleConfigSectionClick}
            >
              <span aria-hidden="true">⚙</span>
              <span>配置管理</span>
            </button>
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={props.section === "logs" ? "page" : undefined}
              onClick={handleLogsSectionClick}
            >
              <span aria-hidden="true">☰</span>
              <span>日志预览</span>
            </button>
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={props.section === "system" ? "page" : undefined}
              onClick={handleSystemSectionClick}
            >
              <span aria-hidden="true">↻</span>
              <span>系统更新</span>
            </button>
          </nav>
        </aside>

        <div className="settings-content">
          {props.section === "config" ? (
            <ConfigSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "logs" ? (
            <LogsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "system" ? (
            <SystemSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
        </div>
      </section>
    </main>
  );
}

// ConfigSettingsPanel 渲染配置文件管理面板。
// 参数 props 表示配置管理面板需要的外部回调。
function ConfigSettingsPanel(props: ConfigSettingsPanelProps) {
  const [configData, setConfigData] = useState<ConfigFileData | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const dirty = useMemo(
    function calculateDirty() {
      return configData !== null && content !== configData.content;
    },
    [configData, content],
  );

  const loadConfig = useCallback(
    // loadConfig 读取后端配置文件内容。
    // 参数 signal 表示用于取消请求的浏览器 AbortSignal；参数 showSuccess 表示重新加载成功时是否展示提示。
    async function loadConfig(signal?: AbortSignal, showSuccess = false) {
      setLoading(true);
      setErrorMessage("");

      try {
        const data = await fetchConfigFile(signal);
        setConfigData(data);
        setContent(data.content);
        if (showSuccess) {
          Toast.success("配置文件已重新加载");
        }
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }
        if (error instanceof UnauthorizedError) {
          props.onUnauthorized();
          return;
        }
        const message = getErrorMessage(error, "配置文件加载失败，请稍后再试");
        setErrorMessage(message);
        Toast.error(message);
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [props.onUnauthorized],
  );

  useEffect(
    function loadConfigOnMount() {
      const controller = new AbortController();
      void loadConfig(controller.signal);

      // cancelConfigLoad 取消卸载中的配置文件加载请求。
      return function cancelConfigLoad() {
        controller.abort();
      };
    },
    [loadConfig],
  );

  // handleContentChange 处理配置文本编辑变化。
  // 参数 event 表示配置编辑器的输入变化事件。
  function handleContentChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setContent(event.target.value);
  }

  // handleReloadClick 处理重新加载配置文件按钮点击。
  function handleReloadClick() {
    if (!dirty) {
      void loadConfig(undefined, true);
      return;
    }

    Modal.confirm({
      title: "重新加载配置文件",
      content: "当前未保存的修改会被磁盘上的配置文件内容覆盖。",
      okText: "重新加载",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmReload() {
        void loadConfig(undefined, true);
      },
    });
  }

  // handleSaveClick 处理保存配置文件按钮点击。
  function handleSaveClick() {
    if (!dirty) {
      Toast.info("配置文件没有变化");
      return;
    }

    Modal.confirm({
      title: "保存配置文件",
      content:
        "保存后会写入后端启动时使用的配置文件，auth.password 会立即用于下一次登录。",
      okText: "保存",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmSave() {
        void saveConfig();
      },
    });
  }

  // saveConfig 保存当前编辑器中的配置文件文本。
  async function saveConfig() {
    setSaving(true);
    setErrorMessage("");

    try {
      const data = await updateConfigFile({ content });
      setConfigData(data);
      setContent(data.content);
      Toast.success("配置文件已保存");
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }
      const message = getErrorMessage(error, "配置文件保存失败，请稍后再试");
      setErrorMessage(message);
      Toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const modifiedAtText = formatTime(configData?.modified_at);
  const reloadedAtText = formatTime(configData?.reloaded_at);

  return (
    <article
      className="settings-panel settings-editor-panel"
      aria-labelledby="settings-config-title"
    >
      <div className="settings-corner settings-corner-left-top" />
      <div className="settings-corner settings-corner-right-top" />
      <div className="settings-corner settings-corner-left-bottom" />
      <div className="settings-corner settings-corner-right-bottom" />

      <div className="settings-editor-heading">
        <div>
          <p className="settings-kicker">Config</p>
          <h1 id="settings-config-title">配置管理</h1>
        </div>
        <div className="settings-editor-actions">
          <button
            type="button"
            className="settings-secondary-button"
            disabled={loading || saving}
            onClick={handleReloadClick}
          >
            重新加载
          </button>
          <button
            type="button"
            className="settings-primary-button"
            disabled={loading || saving || !dirty}
            onClick={handleSaveClick}
          >
            {saving ? "保存中..." : "保存配置"}
          </button>
        </div>
      </div>

      <div className="settings-file-meta" aria-label="配置文件状态">
        <span title={configData?.config_file || ""}>
          文件：{configData?.config_file || "加载中..."}
        </span>
        <span>修改：{modifiedAtText}</span>
        <span>加载：{reloadedAtText}</span>
      </div>

      {errorMessage ? (
        <p className="settings-error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <label className="settings-editor-label" htmlFor="config-content">
        配置文件内容
      </label>
      <textarea
        id="config-content"
        className="settings-config-editor"
        value={content}
        spellCheck={false}
        disabled={loading || saving}
        placeholder={loading ? "正在加载配置文件..." : "请输入 YAML 配置"}
        onChange={handleContentChange}
      />

      <p className="settings-editor-note">
        保存成功后仅登录密码会立即热更新；数据库、HTTP 服务、对象存储等连接型配置需要重启后生效。
      </p>
    </article>
  );
}

// SystemSettingsPanel 渲染系统更新面板。
// 参数 props 表示系统更新面板需要的外部回调。
function SystemSettingsPanel(props: SystemSettingsPanelProps) {
  const [systemUpdating, setSystemUpdating] = useState(false);

  // handleSystemUpdateClick 打开系统一键更新确认框。
  function handleSystemUpdateClick() {
    if (systemUpdating) {
      return;
    }

    Modal.confirm({
      title: "更新系统",
      content: "确认后会从 GitHub 拉取最新代码并重启服务，页面会短暂不可用。",
      okText: "更新",
      cancelText: "取消",
      className: "settings-confirm-modal",
      onOk: function confirmSystemUpdate() {
        void updateSystem();
      },
    });
  }

  // updateSystem 请求后端执行一键更新并在成功后回到登录页。
  async function updateSystem() {
    setSystemUpdating(true);
    let shouldResetUpdating = true;

    try {
      await triggerSystemUpdate();
      Toast.success("更新已开始，服务即将重启");
      shouldResetUpdating = false;
      props.onUnauthorized();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        shouldResetUpdating = false;
        props.onUnauthorized();
        return;
      }
      Toast.error(getErrorMessage(error, "系统更新失败，请稍后再试"));
    } finally {
      if (shouldResetUpdating) {
        setSystemUpdating(false);
      }
    }
  }

  return (
    <article
      className="settings-panel settings-system-panel"
      aria-labelledby="settings-system-title"
    >
      <div className="settings-corner settings-corner-left-top" />
      <div className="settings-corner settings-corner-right-top" />
      <div className="settings-corner settings-corner-left-bottom" />
      <div className="settings-corner settings-corner-right-bottom" />

      <div className="settings-system-heading">
        <p className="settings-kicker">System</p>
        <h1 id="settings-system-title">系统更新</h1>
      </div>

      <div className="settings-system-card">
        <div>
          <h2>一键更新</h2>
          <p>拉取最新代码并重启服务，更新开始后会返回登录页。</p>
        </div>
        <button
          type="button"
          className="settings-primary-button"
          disabled={systemUpdating}
          onClick={handleSystemUpdateClick}
        >
          {systemUpdating ? "更新中..." : "开始更新"}
        </button>
      </div>
    </article>
  );
}

// formatTime 将接口返回的时间文本转换为本地展示文本。
// 参数 value 表示接口返回的 ISO 时间文本。
function formatTime(value?: string): string {
  if (!value) {
    return "未知";
  }

  const time = new Date(value);
  if (Number.isNaN(time.getTime())) {
    return "未知";
  }
  return time.toLocaleString();
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
