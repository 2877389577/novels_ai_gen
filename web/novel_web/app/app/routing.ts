import { startTransition } from "react";
import { readAuthData } from "../api";
import type { SettingsSection } from "../settings";
import type { AppRoute, BrowserHistoryMode, GuardedRoute, SetAppRoute } from "./types";

// loginRoutePath 表示登录页浏览器路径。
export const loginRoutePath = "/login";
// bookshelfRoutePath 表示书架首页浏览器路径。
export const bookshelfRoutePath = "/";
// inspirationRoutePath 表示灵感社页面浏览器路径。
export const inspirationRoutePath = "/inspiration";
// settingsBaseRoutePath 表示设置中心根路径。
export const settingsBaseRoutePath = "/settings";
// logsRoutePath 表示旧日志页面入口路径。
const logsRoutePath = "/logs";
const novelDetailRoutePattern = /^\/novels\/([1-9]\d*)$/;
const chapterCreateRoutePattern = /^\/novels\/([1-9]\d*)\/chapters\/new$/;
const chapterEditRoutePattern =
  /^\/novels\/([1-9]\d*)\/chapters\/([1-9]\d*)$/;
const chapterSummaryRoutePattern =
  /^\/novels\/([1-9]\d*)\/chapters\/([1-9]\d*)\/summary$/;

// getInitialAppRoute 根据本地登录态和浏览器路径判断首次展示的页面。
export function getInitialAppRoute(): AppRoute {
  return resolveGuardedRoute(
    readAuthData() !== null,
    window.location.pathname,
  ).route;
}

// applyRouteGuard 根据当前浏览器路径和登录态同步前端页面。
// 参数 setRoute 表示更新页面路由状态的方法。
export function applyRouteGuard(setRoute: SetAppRoute) {
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
export function resolveGuardedRoute(
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

  const chapterSummaryRoute = parseChapterSummaryPath(pathname);
  if (chapterSummaryRoute !== null) {
    return {
      path: chapterSummaryRoutePath(
        chapterSummaryRoute.novelId,
        chapterSummaryRoute.chapterId,
      ),
      route: { view: "chapterSummary", ...chapterSummaryRoute },
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
export function isLoginRoute(pathname: string): boolean {
  return normalizeRoutePath(pathname) === loginRoutePath;
}

// isInspirationRoute 判断指定路径是否为灵感社页路径。
// 参数 pathname 表示需要判断的浏览器路径。
export function isInspirationRoute(pathname: string): boolean {
  return normalizeRoutePath(pathname) === inspirationRoutePath;
}

// isSettingsRoute 判断指定路径是否为设置中心根路径。
// 参数 pathname 表示需要判断的浏览器路径。
export function isSettingsRoute(pathname: string): boolean {
  return normalizeRoutePath(pathname) === settingsBaseRoutePath;
}

// isLogsRoute 判断指定路径是否为旧日志预览入口路径。
// 参数 pathname 表示需要判断的浏览器路径。
export function isLogsRoute(pathname: string): boolean {
  return normalizeRoutePath(pathname) === logsRoutePath;
}

// parseSettingsSectionPath 从浏览器路径中解析设置中心分区。
// 参数 pathname 表示浏览器地址栏中的路径。
export function parseSettingsSectionPath(pathname: string): SettingsSection | null {
  const normalizedPath = normalizeRoutePath(pathname);
  if (!normalizedPath.startsWith(`${settingsBaseRoutePath}/`)) {
    return null;
  }

  const section = normalizedPath.slice(settingsBaseRoutePath.length + 1);
  if (
    section === "config" ||
    section === "agents" ||
    section === "chapter-summary-agent" ||
    section === "agent-tools" ||
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
export function normalizeRoutePath(pathname: string): string {
  const normalizedPath = pathname || bookshelfRoutePath;
  if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
    return normalizedPath.slice(0, -1);
  }
  return normalizedPath;
}

// parseNovelDetailPath 从浏览器路径中解析小说详情页 ID。
// 参数 pathname 表示浏览器地址栏中的路径。
export function parseNovelDetailPath(pathname: string): number | null {
  const matched = normalizeRoutePath(pathname).match(novelDetailRoutePattern);
  if (!matched) {
    return null;
  }

  const novelId = Number(matched[1]);
  return Number.isSafeInteger(novelId) ? novelId : null;
}

// parseChapterEditorPath 从浏览器路径中解析章节编辑页参数。
// 参数 pathname 表示浏览器地址栏中的路径。
export function parseChapterEditorPath(
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

// parseChapterSummaryPath 从浏览器路径中解析章节概要页参数。
// 参数 pathname 表示浏览器地址栏中的路径。
export function parseChapterSummaryPath(
  pathname: string,
): { novelId: number; chapterId: number } | null {
  const matched = normalizeRoutePath(pathname).match(chapterSummaryRoutePattern);
  if (!matched) {
    return null;
  }

  const novelId = Number(matched[1]);
  const chapterId = Number(matched[2]);
  return Number.isSafeInteger(novelId) && Number.isSafeInteger(chapterId)
    ? { novelId, chapterId }
    : null;
}

// novelDetailRoutePath 生成小说详情页路径。
// 参数 novelId 表示小说主键 ID。
export function novelDetailRoutePath(novelId: number): string {
  return `/novels/${novelId}`;
}

// chapterCreateRoutePath 生成章节创建页路径。
// 参数 novelId 表示小说主键 ID。
export function chapterCreateRoutePath(novelId: number): string {
  return `/novels/${novelId}/chapters/new`;
}

// chapterEditRoutePath 生成章节编辑页路径。
// 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID。
export function chapterEditRoutePath(novelId: number, chapterId: number): string {
  return `/novels/${novelId}/chapters/${chapterId}`;
}

// chapterSummaryRoutePath 生成章节概要页路径。
// 参数 novelId 表示小说主键 ID；参数 chapterId 表示章节主键 ID。
export function chapterSummaryRoutePath(
  novelId: number,
  chapterId: number,
): string {
  return `/novels/${novelId}/chapters/${chapterId}/summary`;
}

// settingsSectionRoutePath 生成设置中心指定分区路径。
// 参数 section 表示需要打开的设置中心分区。
export function settingsSectionRoutePath(section: SettingsSection): string {
  return `${settingsBaseRoutePath}/${section}`;
}

// shouldResetWindowScroll 判断一次路由变化是否需要重置窗口滚动位置。
// 参数 previousRoute 表示切换前的页面路由；参数 nextRoute 表示切换后的页面路由。
export function shouldResetWindowScroll(
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
  if (
    previousRoute.view === "chapterSummary" &&
    nextRoute.view === "chapterSummary"
  ) {
    return previousRoute.chapterId !== nextRoute.chapterId;
  }
  return false;
}

// resetWindowScroll 将浏览器窗口滚动位置恢复到页面顶部。
export function resetWindowScroll() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

// navigateToRoute 使用 React Transition 切换前端页面。
// 参数 setRoute 表示更新页面路由状态的方法；参数 nextRoute 表示目标页面路由状态；参数 nextPath 表示目标浏览器路径；参数 mode 表示浏览器历史记录更新模式。
export function navigateToRoute(
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
export function updateBrowserPath(nextPath: string, mode: BrowserHistoryMode) {
  if (window.location.pathname === nextPath) {
    return;
  }

  if (mode === "push") {
    window.history.pushState(null, "", nextPath);
    return;
  }

  window.history.replaceState(null, "", nextPath);
}
