import {
  startTransition,
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { BookshelfPage } from "./bookshelf";
import { ChapterEditorPage } from "./chapter-editor";
import { clearAuthData, readAuthData } from "./api";
import { AppFooter } from "./app-footer";
import { LoginPage } from "./login";
import { NovelDetailPage } from "./novel-detail";
import { SettingsPage } from "./settings";

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
      // view 表示当前展示配置管理页。
      view: "settings";
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
const settingsRoutePath = "/settings";
const novelDetailRoutePattern = /^\/novels\/([1-9]\d*)$/;
const chapterCreateRoutePattern = /^\/novels\/([1-9]\d*)\/chapters\/new$/;
const chapterEditRoutePattern =
  /^\/novels\/([1-9]\d*)\/chapters\/([1-9]\d*)$/;

// App 渲染小说创作应用的前端页面。
export function App() {
  const [route, setRoute] = useState<AppRoute>(getInitialAppRoute);

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

  // handleOpenSettings 处理从书架头像菜单进入配置管理页。
  const handleOpenSettings = useCallback(
    function handleOpenSettings() {
      navigateToRoute(
        setRoute,
        { view: "settings" },
        settingsRoutePath,
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

  return (
    <div className="app-root" data-view={route.view}>
      {renderRoute(route, {
        onBackToBookshelf: handleBackToBookshelf,
        onBackToNovelDetail: handleBackToNovelDetail,
        onChapterCreate: handleChapterCreate,
        onChapterEdit: handleChapterEdit,
        onLoginSuccess: handleLoginSuccess,
        onNovelDeleted: handleNovelDeleted,
        onNovelSelect: handleNovelSelect,
        onOpenSettings: handleOpenSettings,
        onUnauthorized: handleUnauthorized,
      })}
      <AppFooter />
    </div>
  );
}

// RouteHandlers 表示不同页面之间跳转需要的回调集合。
interface RouteHandlers {
  // onBackToBookshelf 表示详情页返回书架时执行的回调。
  onBackToBookshelf: () => void;
  // onBackToNovelDetail 表示章节编辑页返回小说详情时执行的回调。
  onBackToNovelDetail: (novelId: number) => void;
  // onChapterCreate 表示进入章节创建页时执行的回调。
  onChapterCreate: (novelId: number) => void;
  // onChapterEdit 表示进入章节编辑页时执行的回调。
  onChapterEdit: (novelId: number, chapterId: number) => void;
  // onLoginSuccess 表示登录成功后执行的回调。
  onLoginSuccess: () => void;
  // onNovelDeleted 表示详情页删除小说成功后执行的回调。
  onNovelDeleted: () => void;
  // onNovelSelect 表示书架页选择小说时执行的回调。
  onNovelSelect: (novelId: number) => void;
  // onOpenSettings 表示打开配置管理页时执行的回调。
  onOpenSettings: () => void;
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
          onNovelSelect={handlers.onNovelSelect}
          onOpenSettings={handlers.onOpenSettings}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "settings":
      return (
        <SettingsPage
          onBackToBookshelf={handlers.onBackToBookshelf}
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

  if (isSettingsRoute(pathname)) {
    return {
      path: settingsRoutePath,
      route: { view: "settings" },
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

// isSettingsRoute 判断指定路径是否为配置管理页路径。
// 参数 pathname 表示需要判断的浏览器路径。
function isSettingsRoute(pathname: string): boolean {
  return normalizeRoutePath(pathname) === settingsRoutePath;
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
