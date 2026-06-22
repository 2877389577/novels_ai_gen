import { useState } from "react";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import { triggerSystemUpdate, UnauthorizedError } from "../api";
import type { SystemSettingsPanelProps } from "./types";
import { getErrorMessage } from "./settings-utils";

// SystemSettingsPanel 渲染系统更新面板。
// 参数 props 表示系统更新面板需要的外部回调。
export function SystemSettingsPanel(props: SystemSettingsPanelProps) {
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
