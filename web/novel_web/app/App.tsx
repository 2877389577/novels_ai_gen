import {
  startTransition,
  useCallback,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import { BookshelfPage } from "./bookshelf";
import { clearAuthData, readAuthData } from "./api";
import { LoginPage } from "./login";

// AppView 表示前端当前展示的页面。
type AppView = "login" | "bookshelf";

// SetAppView 表示更新当前页面状态的方法。
type SetAppView = Dispatch<SetStateAction<AppView>>;

// App 渲染小说创作应用的前端页面。
export function App() {
  const [view, setView] = useState<AppView>(getInitialAppView);

  // handleLoginSuccess 处理登录成功后的页面跳转。
  const handleLoginSuccess = useCallback(
    function handleLoginSuccess() {
      navigateToView(setView, "bookshelf", "/");
    },
    [],
  );

  // handleUnauthorized 处理登录态失效后的页面跳转。
  const handleUnauthorized = useCallback(
    function handleUnauthorized() {
      clearAuthData();
      navigateToView(setView, "login", "/login");
    },
    [],
  );

  return (
    <div className="app-root" data-view={view}>
      {view === "bookshelf" ? (
        <BookshelfPage onUnauthorized={handleUnauthorized} />
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}

// getInitialAppView 根据本地登录态判断首次展示的页面。
function getInitialAppView(): AppView {
  return readAuthData() ? "bookshelf" : "login";
}

// navigateToView 使用 React Transition 切换前端页面。
// 参数 setView 表示更新页面状态的方法；参数 nextView 表示目标页面；参数 nextPath 表示目标浏览器路径。
function navigateToView(setView: SetAppView, nextView: AppView, nextPath: string) {
  replaceBrowserPath(nextPath);
  startTransition(function updateAppView() {
    setView(nextView);
  });
}

// replaceBrowserPath 在不刷新页面的情况下更新浏览器路径。
// 参数 nextPath 表示需要写入浏览器地址栏的路径。
function replaceBrowserPath(nextPath: string) {
  if (window.location.pathname === nextPath) {
    return;
  }
  window.history.replaceState(null, "", nextPath);
}
