import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import { fetchConfigFile, updateConfigFile, UnauthorizedError, type ConfigFileData } from "../api";
import type { ConfigSettingsPanelProps } from "./types";
import { formatTime, getErrorMessage, isAbortError } from "./settings-utils";

// ConfigSettingsPanel 渲染配置文件管理面板。
// 参数 props 表示配置管理面板需要的外部回调。
export function ConfigSettingsPanel(props: ConfigSettingsPanelProps) {
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

// AgentToolsSettingsPanel 渲染智能体普通工具注册表管理面板。
