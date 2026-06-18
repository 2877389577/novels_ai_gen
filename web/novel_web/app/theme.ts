// AppTheme 表示前端支持的黑白主题。
export type AppTheme = "light" | "dark";

const appThemeStorageKey = "novels_ai_gen:app-theme:v1";
const defaultAppTheme: AppTheme = "light";

// readStoredAppTheme 从浏览器本地存储读取用户保存的主题。
export function readStoredAppTheme(): AppTheme {
  try {
    const theme = window.localStorage.getItem(appThemeStorageKey);
    return isAppTheme(theme) ? theme : defaultAppTheme;
  } catch {
    return defaultAppTheme;
  }
}

// persistAppTheme 将用户选择的主题保存到浏览器本地存储。
// 参数 theme 表示需要持久化的当前主题。
export function persistAppTheme(theme: AppTheme) {
  try {
    window.localStorage.setItem(appThemeStorageKey, theme);
  } catch {
    // 浏览器可能禁用本地存储，主题切换仍然可以在当前页面生效。
  }
}

// applyAppTheme 将当前主题写入页面根节点，供 CSS 变量读取。
// 参数 theme 表示需要应用到页面上的当前主题。
export function applyAppTheme(theme: AppTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme =
    theme === "dark" ? "dark" : "light";
}

// getNextAppTheme 获取当前主题切换后的目标主题。
// 参数 theme 表示切换前的当前主题。
export function getNextAppTheme(theme: AppTheme): AppTheme {
  return theme === "dark" ? "light" : "dark";
}

// isAppTheme 判断未知文本是否为前端支持的主题值。
// 参数 value 表示从本地存储读取到的原始主题值。
function isAppTheme(value: string | null): value is AppTheme {
  return value === "light" || value === "dark";
}
