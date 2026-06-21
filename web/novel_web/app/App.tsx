import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { BookshelfPage } from "./bookshelf";
import { ChapterEditorPage } from "./chapter-editor";
import { clearAuthData, readAuthData } from "./api";
import { AppFooter } from "./app-footer";
import { InspirationPage } from "./inspiration";
import { LoginPage } from "./login";
import { NovelDetailPage } from "./novel-detail";
import { SettingsPage, type SettingsSection } from "./settings";
import {
  applyAppTheme,
  getNextAppTheme,
  persistAppTheme,
  readStoredAppTheme,
  type AppTheme,
} from "./theme";

// AppRoute 表示前端当前浏览器路径对应的页面状态。
type AppRoute =
  | {
      // view 表示当前展示登录页。
      view: "login";
    }
  | {
      // view 表示当前展示书架页。
      view: "bookshelf";
    }
  | {
      // view 表示当前展示灵感社提示词库页。
      view: "inspiration";
    }
  | {
      // view 表示当前展示设置中心。
      view: "settings";
      // section 表示设置中心当前激活的功能分区。
      section: SettingsSection;
    }
  | {
      // view 表示当前展示小说详情页。
      view: "novelDetail";
      // novelId 表示详情页需要加载的小说主键 ID。
      novelId: number;
    }
  | {
      // view 表示当前展示章节编辑页。
      view: "chapterEditor";
      // novelId 表示当前章节所属小说主键 ID。
      novelId: number;
      // chapterId 表示当前需要编辑的章节主键 ID，创建章节时为空。
      chapterId: number | null;
    };

// SetAppRoute 表示更新当前页面路由状态的方法。
type SetAppRoute = Dispatch<SetStateAction<AppRoute>>;

// BrowserHistoryMode 表示更新浏览器路径时使用的历史记录模式。
type BrowserHistoryMode = "push" | "replace";

// GuardedRoute 表示路由守卫处理后的页面状态和路径。
interface GuardedRoute {
  // route 表示路由守卫允许展示的页面状态。
  route: AppRoute;
  // path 表示路由守卫允许停留的浏览器路径。
  path: string;
}

const loginRoutePath = "/login";
const bookshelfRoutePath = "/";
const inspirationRoutePath = "/inspiration";
const settingsBaseRoutePath = "/settings";
const logsRoutePath = "/logs";
const novelDetailRoutePattern = /^\/novels\/([1-9]\d*)$/;
const chapterCreateRoutePattern = /^\/novels\/([1-9]\d*)\/chapters\/new$/;
const chapterEditRoutePattern =
  /^\/novels\/([1-9]\d*)\/chapters\/([1-9]\d*)$/;

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

// RouteHandlers 表示不同页面之间跳转需要的回调集合。
interface RouteHandlers {
  // currentTheme 表示全站当前使用的黑白主题。
  currentTheme: AppTheme;
  // onBackToBookshelf 表示详情页返回书架时执行的回调。
  onBackToBookshelf: () => void;
  // onBackToNovelDetail 表示章节编辑页返回小说详情时执行的回调。
  onBackToNovelDetail: (novelId: number) => void;
  // onChapterCreate 表示进入章节创建页时执行的回调。
  onChapterCreate: (novelId: number) => void;
  // onChapterEdit 表示进入章节编辑页时执行的回调。
  onChapterEdit: (novelId: number, chapterId: number) => void;
  // onChapterEditorAiPanelOpenChange 表示章节编辑页 AI 侧栏开关状态变化时执行的回调。
  onChapterEditorAiPanelOpenChange: (open: boolean) => void;
  // onChapterPersisted 表示新增章节首次保存成功后执行的路由替换回调。
  onChapterPersisted: (novelId: number, chapterId: number) => void;
  // onLoginSuccess 表示登录成功后执行的回调。
  onLoginSuccess: () => void;
  // onNovelDeleted 表示详情页删除小说成功后执行的回调。
  onNovelDeleted: () => void;
  // onNovelSelect 表示书架页选择小说时执行的回调。
  onNovelSelect: (novelId: number) => void;
  // onOpenBookshelf 表示顶部导航切换到书架页时执行的回调。
  onOpenBookshelf: () => void;
  // onOpenInspiration 表示顶部导航切换到灵感社页时执行的回调。
  onOpenInspiration: () => void;
  // onOpenSettings 表示打开设置中心时执行的回调。
  onOpenSettings: () => void;
  // onSettingsSectionChange 表示设置中心切换功能分区时执行的回调。
  onSettingsSectionChange: (section: SettingsSection) => void;
  // onToggleTheme 表示用户切换全站黑白主题时执行的回调。
  onToggleTheme: () => void;
  // onUnauthorized 表示登录态失效时执行的回调。
  onUnauthorized: () => void;
}

// renderRoute 根据当前路由状态渲染页面组件。
// 参数 route 表示当前页面路由状态；参数 handlers 表示页面间跳转回调集合。
function renderRoute(route: AppRoute, handlers: RouteHandlers) {
  switch (route.view) {
    case "bookshelf":
      return (
        <BookshelfPage
          currentTheme={handlers.currentTheme}
          onNovelSelect={handlers.onNovelSelect}
          onOpenBookshelf={handlers.onOpenBookshelf}
          onOpenInspiration={handlers.onOpenInspiration}
          onOpenSettings={handlers.onOpenSettings}
          onToggleTheme={handlers.onToggleTheme}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "inspiration":
      return (
        <InspirationPage
          currentTheme={handlers.currentTheme}
          onOpenBookshelf={handlers.onOpenBookshelf}
          onOpenInspiration={handlers.onOpenInspiration}
          onOpenSettings={handlers.onOpenSettings}
          onToggleTheme={handlers.onToggleTheme}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "settings":
      return (
        <SettingsPage
          section={route.section}
          onBackToBookshelf={handlers.onBackToBookshelf}
          onSectionChange={handlers.onSettingsSectionChange}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "novelDetail":
      return (
        <NovelDetailPage
          novelId={route.novelId}
          onBackToBookshelf={handlers.onBackToBookshelf}
          onChapterCreate={handlers.onChapterCreate}
          onChapterEdit={handlers.onChapterEdit}
          onDeleted={handlers.onNovelDeleted}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "chapterEditor":
      return (
        <ChapterEditorPage
          novelId={route.novelId}
          chapterId={route.chapterId}
          onBackToNovelDetail={handlers.onBackToNovelDetail}
          onAiPanelOpenChange={handlers.onChapterEditorAiPanelOpenChange}
          onChapterPersisted={handlers.onChapterPersisted}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    default:
      return <LoginPage onLoginSuccess={handlers.onLoginSuccess} />;
  }
}

// getInitialAppRoute 根据本地登录态和浏览器路径判断首次展示的页面。
function getInitialAppRoute(): AppRoute {
  return resolveGuardedRoute(
    readAuthData() !== null,
    window.location.pathname,
  ).route;
}

// applyRouteGuard 根据当前浏览器路径和登录态同步前端页面。
// 参数 setRoute 表示更新页面路由状态的方法。
function applyRouteGuard(setRoute: SetAppRoute) {
  const isAuthenticated = readAuthData() !== null;
  const nextRoute = resolveGuardedRoute(
    isAuthenticated,
    window.location.pathname,
  );

  updateBrowserPath(nextRoute.path, "replace");
  // updateGuardedView 切换到路由守卫允许展示的页面。
  startTransition(function updateGuardedView() {
    setRoute(nextRoute.route);
  });
}

// resolveGuardedRoute 计算当前登录态允许停留的页面和浏览器路径。
// 参数 isAuthenticated 表示用户是否已经登录；参数 pathname 表示当前浏览器路径。
function resolveGuardedRoute(
  isAuthenticated: boolean,
  pathname: string,
): GuardedRoute {
  if (!isAuthenticated) {
    return {
      path: loginRoutePath,
      route: { view: "login" },
    };
  }

  if (isLoginRoute(pathname)) {
    return {
      path: bookshelfRoutePath,
      route: { view: "bookshelf" },
    };
  }

  if (isInspirationRoute(pathname)) {
    return {
      path: inspirationRoutePath,
      route: { view: "inspiration" },
    };
  }

  if (isSettingsRoute(pathname)) {
    return {
      path: normalizeRoutePath(pathname),
      route: { view: "settings", section: "config" },
    };
  }

  const settingsSection = parseSettingsSectionPath(pathname);
  if (settingsSection !== null) {
    return {
      path: settingsSectionRoutePath(settingsSection),
      route: { view: "settings", section: settingsSection },
    };
  }

  if (isLogsRoute(pathname)) {
    return {
      path: settingsSectionRoutePath("logs"),
      route: { view: "settings", section: "logs" },
    };
  }

  const novelId = parseNovelDetailPath(pathname);
  if (novelId !== null) {
    return {
      path: novelDetailRoutePath(novelId),
      route: { view: "novelDetail", novelId },
    };
  }

  const chapterEditorRoute = parseChapterEditorPath(pathname);
  if (chapterEditorRoute !== null) {
    return {
      path:
        chapterEditorRoute.chapterId === null
          ? chapterCreateRoutePath(chapterEditorRoute.novelId)
          : chapterEditRoutePath(
              chapterEditorRoute.novelId,
              chapterEditorRoute.chapterId,
            ),
      route: { view: "chapterEditor", ...chapterEditorRoute },
    };
  }

  return {
    path: bookshelfRoutePath,
    route: { view: "bookshelf" },
  };
}

// isLoginRoute 判断指定路径是否为登录页路径。
// 参数 pathname 表示需要判断的浏览器路径。
function isLoginRoute(pathname: string): boolean {
  return normalizeRoutePath(pathname) === loginRoutePath;
}

// isInspirationRoute 判断指定路径是否为灵感社页路径。
// 参数 pathname 表示需要判断的浏览器路径。
function isInspirationRoute(pathname: string): boolean {
  return normalizeRoutePath(pathname) === inspirationRoutePath;
}

// isSettingsRoute 判断指定路径是否为设置中心根路径。
// 参数 pathname 表示需要判断的浏览器路径。
function isSettingsRoute(pathname: string): boolean {
  return normalizeRoutePath(pathname) === settingsBaseRoutePath;
}

// isLogsRoute 判断指定路径是否为旧日志预览入口路径。
// 参数 pathname 表示需要判断的浏览器路径。
function isLogsRoute(pathname: string): boolean {
  return normalizeRoutePath(pathname) === logsRoutePath;
}

// parseSettingsSectionPath 从浏览器路径中解析设置中心分区。
// 参数 pathname 表示浏览器地址栏中的路径。
function parseSettingsSectionPath(pathname: string): SettingsSection | null {
  const normalizedPath = normalizeRoutePath(pathname);
  if (!normalizedPath.startsWith(`${settingsBaseRoutePath}/`)) {
    return null;
  }

  const section = normalizedPath.slice(settingsBaseRoutePath.length + 1);
  if (
    section === "config" ||
    section === "agents" ||
    section === "logs" ||
    section === "system" ||
    section === "ai-providers"
  ) {
    return section;
  }
  return null;
}

// normalizeRoutePath 标准化浏览器路径，避免空路径造成守卫判断偏差。
// 参数 pathname 表示浏览器地址栏中的路径。
function normalizeRoutePath(pathname: string): string {
  const normalizedPath = pathname || bookshelfRoutePath;
  if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
    return normalizedPath.slice(0, -1);
  }
  return normalizedPath;
}

// parseNovelDetailPath 从浏览器路径中解析小说详情页 ID。
// 参数 pathname 表示浏览器地址栏中的路径。
function parseNovelDetailPath(pathname: string): number | null {
  const matched = normalizeRoutePath(pathname).match(novelDetailRoutePattern);
  if (!matched) {
    return null;
  }

  const novelId = Number(matched[1]);
  return Number.isSafeInteger(novelId) ? novelId : null;
}

// parseChapterEditorPath 从浏览器路径中解析章节编辑页参数。
// 参数 pathname 表示浏览器地址栏中的路径。
function parseChapterEditorPath(
  pathname: string,
): { novelId: number; chapterId: number | null } | null {
  const normalizedPath = normalizeRoutePath(pathname);
  const createMatched = normalizedPath.match(chapterCreateRoutePattern);
  if (createMatched) {
    const novelId = Number(createMatched[1]);
    return Number.isSafeInteger(novelId) ? { novelId, chapterId: null } : null;
  }

  const editMatched = normalizedPath.match(chapterEditRoutePattern);
  if (!editMatched) {
    return null;
  }

  const novelId = Number(editMatched[1]);
  const chapterId = Number(editMatched[2]);
  return Number.isSafeInteger(novelId) && Number.isSafeInteger(chapterId)
    ? { novelId, chapterId }
    : null;
}

// novelDetailRoutePath 生成小说详情页路径。
// 参数 novelId 表示小说主键 ID。
function novelDetailRoutePath(novelId: number): string {
  return `/novels/${novelId}`;
}

// chapterCreateRoutePath 生成章节创建页路径。
// 参数 novelId 表示小说主键 ID。
function chapterCreateRoutePath(novelId: number): string {
  return `/novels/${novelId}/chapters/new`;
}

// chapterEditRoutePath 生成章节编辑页路径。
// 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID。
function chapterEditRoutePath(novelId: number, chapterId: number): string {
  return `/novels/${novelId}/chapters/${chapterId}`;
}

// settingsSectionRoutePath 生成设置中心指定分区路径。
// 参数 section 表示需要打开的设置中心分区。
function settingsSectionRoutePath(section: SettingsSection): string {
  return `${settingsBaseRoutePath}/${section}`;
}

// shouldResetWindowScroll 判断一次路由变化是否需要重置窗口滚动位置。
// 参数 previousRoute 表示切换前的页面路由；参数 nextRoute 表示切换后的页面路由。
function shouldResetWindowScroll(
  previousRoute: AppRoute,
  nextRoute: AppRoute,
): boolean {
  if (previousRoute.view !== nextRoute.view) {
    return true;
  }
  if (previousRoute.view === "novelDetail" && nextRoute.view === "novelDetail") {
    return previousRoute.novelId !== nextRoute.novelId;
  }
  if (previousRoute.view === "settings" && nextRoute.view === "settings") {
    return previousRoute.section !== nextRoute.section;
  }
  if (
    previousRoute.view === "chapterEditor" &&
    nextRoute.view === "chapterEditor"
  ) {
    if (previousRoute.chapterId === null || nextRoute.chapterId === null) {
      return false;
    }
    return previousRoute.chapterId !== nextRoute.chapterId;
  }
  return false;
}

// resetWindowScroll 将浏览器窗口滚动位置恢复到页面顶部。
function resetWindowScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

// navigateToRoute 使用 React Transition 切换前端页面。
// 参数 setRoute 表示更新页面路由状态的方法；参数 nextRoute 表示目标页面路由状态；参数 nextPath 表示目标浏览器路径；参数 mode 表示浏览器历史记录更新模式。
function navigateToRoute(
  setRoute: SetAppRoute,
  nextRoute: AppRoute,
  nextPath: string,
  mode: BrowserHistoryMode,
) {
  updateBrowserPath(nextPath, mode);
  startTransition(function updateAppView() {
    setRoute(nextRoute);
  });
}

// updateBrowserPath 在不刷新页面的情况下更新浏览器路径。
// 参数 nextPath 表示需要写入浏览器地址栏的路径；参数 mode 表示浏览器历史记录更新模式。
function updateBrowserPath(nextPath: string, mode: BrowserHistoryMode) {
  if (window.location.pathname === nextPath) {
    return;
  }

  if (mode === "push") {
    window.history.pushState(null, "", nextPath);
    return;
  }

  window.history.replaceState(null, "", nextPath);
}
