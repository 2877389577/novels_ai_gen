import type { SettingsPageProps } from "./types";
import { LogsPanel } from "../logs";
import { ConfigSettingsPanel } from "./config-panel";
import { AgentSettingsPanel } from "./agent-settings-panel";
import { AgentToolsSettingsPanel } from "./agent-tools-panel";
import { AIProviderSettingsPanel } from "./ai-provider-panel";
import { SystemSettingsPanel } from "./system-panel";

// SettingsPage 渲染聚合配置、日志和系统更新的设置中心。
// 参数 props 表示设置中心页面需要的外部状态和回调。
export function SettingsPage(props: SettingsPageProps) {
  // handleConfigSectionClick 切换到配置管理分区。
  function handleConfigSectionClick() {
    props.onSectionChange("config");
  }

  // handleAgentsSectionClick 切换到智能体设置分区。
  function handleAgentsSectionClick() {
    props.onSectionChange("agents");
  }

  // handleAgentToolsSectionClick 切换到智能体工具分区。
  function handleAgentToolsSectionClick() {
    props.onSectionChange("agent-tools");
  }

  // handleLogsSectionClick 切换到日志预览分区。
  function handleLogsSectionClick() {
    props.onSectionChange("logs");
  }

  // handleSystemSectionClick 切换到系统更新分区。
  function handleSystemSectionClick() {
    props.onSectionChange("system");
  }

  // handleAIProvidersSectionClick 切换到 AI 提供商分区。
  function handleAIProvidersSectionClick() {
    props.onSectionChange("ai-providers");
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
              aria-current={props.section === "agents" ? "page" : undefined}
              onClick={handleAgentsSectionClick}
            >
              <span aria-hidden="true">AI</span>
              <span>智能体设置</span>
            </button>
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={props.section === "agent-tools" ? "page" : undefined}
              onClick={handleAgentToolsSectionClick}
            >
              <span aria-hidden="true">TO</span>
              <span>智能体工具</span>
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
            <button
              type="button"
              className="settings-sidebar-button"
              aria-current={
                props.section === "ai-providers" ? "page" : undefined
              }
              onClick={handleAIProvidersSectionClick}
            >
              <span aria-hidden="true">AI</span>
              <span>AI 提供商</span>
            </button>
          </nav>
        </aside>

        <div className="settings-content">
          {props.section === "config" ? (
            <ConfigSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "agents" ? (
            <AgentSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "agent-tools" ? (
            <AgentToolsSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "logs" ? (
            <LogsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "system" ? (
            <SystemSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
          {props.section === "ai-providers" ? (
            <AIProviderSettingsPanel onUnauthorized={props.onUnauthorized} />
          ) : null}
        </div>
      </section>
    </main>
  );
}
