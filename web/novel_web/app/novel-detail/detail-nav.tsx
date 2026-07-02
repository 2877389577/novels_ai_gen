import { useEffect, useId, useState } from "react";

import type { NovelDetailTab } from "./types";

const detailTabLabels: Record<NovelDetailTab, string> = {
  detail: "作品详情",
  summary: "总结",
  outline: "大纲",
  characters: "角色卡",
  relationshipGraph: "角色关系图",
  events: "事件管理",
};

// DetailNavProps 表示详情页顶部导航需要的回调。
interface DetailNavProps {
  // activeTab 表示当前选中的详情页顶部 Tab。
  activeTab: NovelDetailTab;
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onTabChange 表示用户切换详情页顶部 Tab 时执行的回调。
  onTabChange: (tab: NovelDetailTab) => void;
}

// DetailNav 渲染小说详情页顶部导航。
// 参数 props 表示详情页顶部导航需要的回调。
export function DetailNav(props: DetailNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuId = useId();

  // closeMobileMenuOnTabChange 在详情页签切换后收起移动端菜单。
  useEffect(
    function closeMobileMenuOnTabChange() {
      setMobileMenuOpen(false);
    },
    [props.activeTab],
  );

  // installDetailMenuEscapeHandler 允许用户按 Escape 收起详情页移动端菜单。
  useEffect(
    function installDetailMenuEscapeHandler() {
      if (!mobileMenuOpen) {
        return;
      }

      // handleEscapeKeydown 处理详情页移动端菜单打开时的键盘关闭动作。
      // 参数 event 表示浏览器键盘事件。
      function handleEscapeKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setMobileMenuOpen(false);
        }
      }

      window.addEventListener("keydown", handleEscapeKeydown);
      return function removeDetailMenuEscapeHandler() {
        window.removeEventListener("keydown", handleEscapeKeydown);
      };
    },
    [mobileMenuOpen],
  );

  // handleMobileMenuToggle 切换详情页移动端汉堡菜单展开状态。
  function handleMobileMenuToggle() {
    setMobileMenuOpen(function toggleMobileMenu(open) {
      return !open;
    });
  }

  // handleTabButtonClick 切换详情页签并收起移动端菜单。
  // 参数 tab 表示用户选择的目标详情页签。
  function handleTabButtonClick(tab: NovelDetailTab) {
    props.onTabChange(tab);
    setMobileMenuOpen(false);
  }

  // handleBackButtonClick 返回书架并收起移动端菜单。
  function handleBackButtonClick() {
    props.onBackToBookshelf();
    setMobileMenuOpen(false);
  }

  return (
    <header
      className={`detail-nav${mobileMenuOpen ? " detail-nav-menu-open" : ""}`}
    >
      <div className="detail-nav-inner">
        <button
          type="button"
          className="detail-brand"
          onClick={handleBackButtonClick}
        >
          <span className="detail-seal" aria-hidden="true">
            墨
          </span>
          <span>墨香墨苑</span>
        </button>

        <div className="detail-mobile-current" aria-live="polite">
          {detailTabLabels[props.activeTab]}
        </div>

        <button
          type="button"
          className="detail-menu-toggle"
          aria-controls={mobileMenuId}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "收起详情菜单" : "展开详情菜单"}
          onClick={handleMobileMenuToggle}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div
          className="detail-menu-panel"
          id={mobileMenuId}
        >
          <nav
            className="detail-links"
            aria-label="详情页内容导航"
            role="tablist"
          >
            <button
              type="button"
              aria-controls="detail-panel"
              aria-selected={props.activeTab === "detail"}
              role="tab"
              onClick={() => handleTabButtonClick("detail")}
            >
              作品详情
            </button>
            <button
              type="button"
              aria-controls="novel-summary-panel"
              aria-selected={props.activeTab === "summary"}
              role="tab"
              onClick={() => handleTabButtonClick("summary")}
            >
              总结
            </button>
            <button
              type="button"
              aria-controls="novel-outline-panel"
              aria-selected={props.activeTab === "outline"}
              role="tab"
              onClick={() => handleTabButtonClick("outline")}
            >
              大纲
            </button>
            <button
              type="button"
              aria-controls="character-card-panel"
              aria-selected={props.activeTab === "characters"}
              role="tab"
              onClick={() => handleTabButtonClick("characters")}
            >
              角色卡
            </button>
            <button
              type="button"
              aria-controls="relationship-graph-panel"
              aria-selected={props.activeTab === "relationshipGraph"}
              role="tab"
              onClick={() => handleTabButtonClick("relationshipGraph")}
            >
              角色关系图
            </button>
            <button
              type="button"
              aria-controls="event-graph-panel"
              aria-selected={props.activeTab === "events"}
              role="tab"
              onClick={() => handleTabButtonClick("events")}
            >
              事件管理
            </button>
          </nav>

          <button
            type="button"
            className="detail-back-button"
            onClick={handleBackButtonClick}
          >
            <span aria-hidden="true">←</span>
            <span>返回书架</span>
          </button>
        </div>
      </div>
    </header>
  );
}
