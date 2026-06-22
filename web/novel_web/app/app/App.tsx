import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { clearAuthData } from "../api";
import { AppFooter } from "../app-footer";
import type { SettingsSection } from "../settings";
import {
  applyAppTheme,
  getNextAppTheme,
  persistAppTheme,
  readStoredAppTheme,
  type AppTheme,
} from "../theme";
import { renderRoute } from "./render-route";
import {
  applyRouteGuard,
  bookshelfRoutePath,
  chapterCreateRoutePath,
  chapterEditRoutePath,
  chapterSummaryRoutePath,
  getInitialAppRoute,
  inspirationRoutePath,
  loginRoutePath,
  navigateToRoute,
  novelDetailRoutePath,
  resetWindowScroll,
  settingsBaseRoutePath,
  settingsSectionRoutePath,
  shouldResetWindowScroll,
} from "./routing";
import type { AppRoute } from "./types";

// App 渲染小说创作应用的前端页面。
export function App() {
  const [route, setRoute] = useState<AppRoute>(getInitialAppRoute);
  const [theme, setTheme] = useState<AppTheme>(() => readStoredAppTheme());
  const [chapterEditorAiPanelOpen, setChapterEditorAiPanelOpen] =
    useState(false);
  const previousRouteRef = useRef<AppRoute | null>(null);
  const appFooterVisible =
    route.view !== "chapterEditor" || !chapterEditorAiPanelOpen;

  // syncAppTheme 将当前主题同步到页面根节点和浏览器本地存储。
  useLayoutEffect(
    function syncAppTheme() {
      applyAppTheme(theme);
      persistAppTheme(theme);
    },
    [theme],
  );

  // resetWindowScrollOnRouteChange 在页面级路由切换后重置窗口滚动位置。
  useLayoutEffect(
    function resetWindowScrollOnRouteChange() {
      const previousRoute = previousRouteRef.current;
      previousRouteRef.current = route;
      if (!previousRoute || !shouldResetWindowScroll(previousRoute, route)) {
        return;
      }

      resetWindowScroll();
    },
    [route],
  );

  // useManualHistoryScrollRestoration 关闭浏览器原生滚动恢复，避免 SPA 视图复用旧滚动位置。
  useEffect(function useManualHistoryScrollRestoration() {
    if (!("scrollRestoration" in window.history)) {
      return;
    }

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return function restoreHistoryScrollRestoration() {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  // resetChapterEditorAiPanelState 在离开章节编辑页后重置 AI 侧栏全局布局状态。
  useEffect(
    function resetChapterEditorAiPanelState() {
      if (route.view !== "chapterEditor") {
        setChapterEditorAiPanelOpen(false);
      }
    },
    [route.view],
  );

  // installRouteGuard 安装浏览器路由守卫，拦截未登录用户访问受保护路径。
  useEffect(
    function installRouteGuard() {
      applyRouteGuard(setRoute);

      // handleRouteChange 处理浏览器前进或后退导致的路径变化。
      function handleRouteChange() {
        applyRouteGuard(setRoute);
      }

      window.addEventListener("popstate", handleRouteChange);
      // removeRouteGuard 移除浏览器路由守卫监听。
      return function removeRouteGuard() {
        window.removeEventListener("popstate", handleRouteChange);
      };
    },
    [],
  );

  // handleLoginSuccess 处理登录成功后的页面跳转。
  const handleLoginSuccess = useCallback(
    function handleLoginSuccess() {
      navigateToRoute(
        setRoute,
        { view: "bookshelf" },
        bookshelfRoutePath,
        "replace",
      );
    },
    [],
  );

  // handleUnauthorized 处理登录态失效后的页面跳转。
  const handleUnauthorized = useCallback(
    function handleUnauthorized() {
      clearAuthData();
      navigateToRoute(setRoute, { view: "login" }, loginRoutePath, "replace");
    },
    [],
  );

  // handleNovelSelect 处理用户从书架选择小说进入详情页。
  const handleNovelSelect = useCallback(
    function handleNovelSelect(novelId: number) {
      navigateToRoute(
        setRoute,
        { view: "novelDetail", novelId },
        novelDetailRoutePath(novelId),
        "push",
      );
    },
    [],
  );

  // handleBackToBookshelf 处理从详情页返回书架。
  const handleBackToBookshelf = useCallback(
    function handleBackToBookshelf() {
      navigateToRoute(
        setRoute,
        { view: "bookshelf" },
        bookshelfRoutePath,
        "push",
      );
    },
    [],
  );

  // handleOpenSettings 处理从书架入口进入设置中心。
  const handleOpenSettings = useCallback(
    function handleOpenSettings() {
      navigateToRoute(
        setRoute,
        { view: "settings", section: "config" },
        settingsBaseRoutePath,
        "push",
      );
    },
    [],
  );

  // handleOpenBookshelf 处理顶部导航切换到书架页。
  const handleOpenBookshelf = useCallback(
    function handleOpenBookshelf() {
      navigateToRoute(
        setRoute,
        { view: "bookshelf" },
        bookshelfRoutePath,
        "push",
      );
    },
    [],
  );

  // handleOpenInspiration 处理顶部导航切换到灵感社页。
  const handleOpenInspiration = useCallback(
    function handleOpenInspiration() {
      navigateToRoute(
        setRoute,
        { view: "inspiration" },
        inspirationRoutePath,
        "push",
      );
    },
    [],
  );

  // handleToggleTheme 处理全站黑白主题切换。
  const handleToggleTheme = useCallback(function handleToggleTheme() {
    setTheme(function toggleTheme(currentTheme) {
      return getNextAppTheme(currentTheme);
    });
  }, []);

  // handleSettingsSectionChange 处理设置中心分区切换。
  // 参数 section 表示用户要切换到的设置分区。
  const handleSettingsSectionChange = useCallback(
    function handleSettingsSectionChange(section: SettingsSection) {
      navigateToRoute(
        setRoute,
        { view: "settings", section },
        settingsSectionRoutePath(section),
        "push",
      );
    },
    [],
  );

  // handleChapterCreate 处理进入章节创建页。
  const handleChapterCreate = useCallback(
    function handleChapterCreate(novelId: number) {
      navigateToRoute(
        setRoute,
        { view: "chapterEditor", novelId, chapterId: null },
        chapterCreateRoutePath(novelId),
        "push",
      );
    },
    [],
  );

  // handleChapterEdit 处理进入章节编辑页。
  const handleChapterEdit = useCallback(
    function handleChapterEdit(novelId: number, chapterId: number) {
      navigateToRoute(
        setRoute,
        { view: "chapterEditor", novelId, chapterId },
        chapterEditRoutePath(novelId, chapterId),
        "push",
      );
    },
    [],
  );

  // handleChapterSummaryOpen 处理进入章节概要页。
  // 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID。
  const handleChapterSummaryOpen = useCallback(
    function handleChapterSummaryOpen(novelId: number, chapterId: number) {
      navigateToRoute(
        setRoute,
        { view: "chapterSummary", novelId, chapterId },
        chapterSummaryRoutePath(novelId, chapterId),
        "push",
      );
    },
    [],
  );

  // handleChapterPersisted 处理新增章节首次保存后替换为编辑页路由。
  // 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID。
  const handleChapterPersisted = useCallback(
    function handleChapterPersisted(novelId: number, chapterId: number) {
      navigateToRoute(
        setRoute,
        { view: "chapterEditor", novelId, chapterId },
        chapterEditRoutePath(novelId, chapterId),
        "replace",
      );
    },
    [],
  );

  // handleBackToNovelDetail 处理从章节编辑页返回小说详情。
  const handleBackToNovelDetail = useCallback(
    function handleBackToNovelDetail(novelId: number) {
      navigateToRoute(
        setRoute,
        { view: "novelDetail", novelId },
        novelDetailRoutePath(novelId),
        "push",
      );
    },
    [],
  );

  // handleNovelDeleted 处理小说删除成功后的页面跳转。
  const handleNovelDeleted = useCallback(
    function handleNovelDeleted() {
      navigateToRoute(
        setRoute,
        { view: "bookshelf" },
        bookshelfRoutePath,
        "replace",
      );
    },
    [],
  );

  // handleChapterEditorAiPanelOpenChange 同步章节编辑页 AI 侧栏开关状态。
  // 参数 open 表示章节编辑页 AI 侧栏是否正在打开。
  const handleChapterEditorAiPanelOpenChange = useCallback(
    function handleChapterEditorAiPanelOpenChange(open: boolean) {
      setChapterEditorAiPanelOpen(open);
    },
    [],
  );

  return (
    <div className="app-root" data-theme={theme} data-view={route.view}>
      {renderRoute(route, {
        currentTheme: theme,
        onBackToBookshelf: handleBackToBookshelf,
        onBackToNovelDetail: handleBackToNovelDetail,
        onChapterCreate: handleChapterCreate,
        onChapterEdit: handleChapterEdit,
        onChapterEditorAiPanelOpenChange: handleChapterEditorAiPanelOpenChange,
        onChapterPersisted: handleChapterPersisted,
        onChapterSummaryOpen: handleChapterSummaryOpen,
        onLoginSuccess: handleLoginSuccess,
        onNovelDeleted: handleNovelDeleted,
        onNovelSelect: handleNovelSelect,
        onOpenBookshelf: handleOpenBookshelf,
        onOpenInspiration: handleOpenInspiration,
        onOpenSettings: handleOpenSettings,
        onSettingsSectionChange: handleSettingsSectionChange,
        onToggleTheme: handleToggleTheme,
        onUnauthorized: handleUnauthorized,
      })}
      {appFooterVisible ? <AppFooter /> : null}
    </div>
  );
}

