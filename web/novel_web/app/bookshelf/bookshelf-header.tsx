import { useEffect, useId, useState } from "react";

import type { AppTheme } from "../theme";
import type { BookshelfNavTab } from "./types";

// BookshelfHeaderProps 表示书架顶部导航需要的外部状态和回调。
export interface BookshelfHeaderProps {
  // activeTab 表示当前激活的顶部导航入口。
  activeTab: BookshelfNavTab;
  // currentTheme 表示全站当前使用的黑白主题。
  currentTheme: AppTheme;
  // summaryItems 表示小屏幕导航下方展示的页面摘要文本。
  summaryItems: string[];
  // onOpenBookshelf 表示用户切换到书架页时执行的回调。
  onOpenBookshelf: () => void;
  // onOpenInspiration 表示用户切换到灵感社页时执行的回调。
  onOpenInspiration: () => void;
  // onOpenSettings 表示用户进入设置中心时执行的回调。
  onOpenSettings: () => void;
  // onToggleTheme 表示用户切换全站黑白主题时执行的回调。
  onToggleTheme: () => void;
}

// BookshelfHeader 渲染书架首页顶部导航。
// 参数 props 表示书架顶部导航需要的外部状态和回调。
export function BookshelfHeader(props: BookshelfHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuId = useId();

  // closeMobileMenuOnRouteChange 在顶部导航切换页面后收起移动端菜单。
  useEffect(
    function closeMobileMenuOnRouteChange() {
      setMobileMenuOpen(false);
    },
    [props.activeTab],
  );

  // installMobileMenuEscapeHandler 允许用户按 Escape 收起移动端菜单。
  useEffect(
    function installMobileMenuEscapeHandler() {
      if (!mobileMenuOpen) {
        return;
      }

      // handleEscapeKeydown 处理移动端菜单打开时的键盘关闭动作。
      // 参数 event 表示浏览器键盘事件。
      function handleEscapeKeydown(event: KeyboardEvent) {
        if (event.key === "Escape") {
          setMobileMenuOpen(false);
        }
      }

      window.addEventListener("keydown", handleEscapeKeydown);
      return function removeMobileMenuEscapeHandler() {
        window.removeEventListener("keydown", handleEscapeKeydown);
      };
    },
    [mobileMenuOpen],
  );

  // handleMobileMenuToggle 切换移动端汉堡菜单展开状态。
  function handleMobileMenuToggle() {
    setMobileMenuOpen(function toggleMobileMenu(open) {
      return !open;
    });
  }

  // handleOpenBookshelf 打开书架页并收起移动端菜单。
  function handleOpenBookshelf() {
    props.onOpenBookshelf();
    setMobileMenuOpen(false);
  }

  // handleOpenInspiration 打开灵感社页并收起移动端菜单。
  function handleOpenInspiration() {
    props.onOpenInspiration();
    setMobileMenuOpen(false);
  }

  // handleOpenSettings 打开设置中心并收起移动端菜单。
  function handleOpenSettings() {
    props.onOpenSettings();
    setMobileMenuOpen(false);
  }

  // handleToggleTheme 切换主题并保持菜单状态方便用户确认变化。
  function handleToggleTheme() {
    props.onToggleTheme();
  }

  return (
    <header
      className={`bookshelf-nav${
        mobileMenuOpen ? " bookshelf-nav-menu-open" : ""
      }`}
    >
      <div className="bookshelf-nav-inner">
        <div className="bookshelf-brand" aria-label="墨香墨苑">
          <div className="bookshelf-seal" aria-hidden="true">
            墨
          </div>
          <span>墨香墨苑</span>
        </div>

        <button
          type="button"
          className="bookshelf-menu-toggle"
          aria-controls={mobileMenuId}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? "收起主菜单" : "展开主菜单"}
          onClick={handleMobileMenuToggle}
        >
          <span aria-hidden="true" />
          <span aria-hidden="true" />
          <span aria-hidden="true" />
        </button>

        <div
          className="bookshelf-menu-panel"
          id={mobileMenuId}
        >
          <nav className="bookshelf-links" aria-label="主导航">
            <button
              type="button"
              aria-current={
                props.activeTab === "bookshelf" ? "page" : undefined
              }
              onClick={handleOpenBookshelf}
            >
              藏书阁
            </button>
            <button
              type="button"
              aria-current={
                props.activeTab === "inspiration" ? "page" : undefined
              }
              onClick={handleOpenInspiration}
            >
              灵感社
            </button>
          </nav>

          <div className="bookshelf-actions">
            <button type="button" aria-label="搜索">
              ⌕
            </button>
            <button
              type="button"
              aria-label={
                props.currentTheme === "dark"
                  ? "切换白色主题"
                  : "切换黑色主题"
              }
              aria-pressed={props.currentTheme === "dark"}
              title={
                props.currentTheme === "dark" ? "切换白色主题" : "切换黑色主题"
              }
              onClick={handleToggleTheme}
            >
              {props.currentTheme === "dark" ? "☾" : "☼"}
            </button>
            <BookshelfUserMenu onOpenSettings={handleOpenSettings} />
            <button
              type="button"
              className="bookshelf-mobile-settings"
              onClick={handleOpenSettings}
            >
              <span aria-hidden="true">⚙</span>
              <span>设置中心</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bookshelf-summary" aria-label="页面摘要">
        {props.summaryItems.map(renderSummaryItem)}
      </div>
    </header>
  );
}

// BookshelfUserMenuProps 表示书架头像菜单需要的外部回调。
interface BookshelfUserMenuProps {
  // onOpenSettings 表示用户进入设置中心时执行的回调。
  onOpenSettings: () => void;
}

// BookshelfUserMenu 渲染书架右上角头像和悬浮菜单。
// 参数 props 表示头像菜单需要的外部回调。
function BookshelfUserMenu(props: BookshelfUserMenuProps) {
  return (
    <div className="bookshelf-user-menu">
      <button
        type="button"
        className="bookshelf-avatar"
        aria-haspopup="menu"
        aria-label="作者菜单"
      >
        <span>书</span>
      </button>

      <div
        className="bookshelf-user-dropdown"
        role="menu"
        aria-label="作者菜单"
      >
        <button
          type="button"
          role="menuitem"
          className="bookshelf-user-menu-item"
          onClick={props.onOpenSettings}
        >
          <span aria-hidden="true">⚙</span>
          <span>设置</span>
        </button>
      </div>
    </div>
  );
}

// renderSummaryItem 渲染顶部导航在小屏幕下展示的单条摘要。
// 参数 item 表示摘要文本。
function renderSummaryItem(item: string) {
  return <span key={item}>{item}</span>;
}
