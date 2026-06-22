import type { NovelWordCountState } from "./types";

// formatNovelWordCountText 根据加载状态格式化小说总字数展示文本。
// 参数 state 表示小说总字数接口当前加载状态；参数 wordCount 表示后端返回的总字数。
export function formatNovelWordCountText(
  state: NovelWordCountState,
  wordCount: number | null,
): string {
  if (state === "loading") {
    return "统计中";
  }
  if (state === "error") {
    return "字数暂不可用";
  }
  return formatChapterWordCount(wordCount ?? 0);
}

// formatChapterWordCount 格式化章节字数展示文本。
// 参数 wordCount 表示章节或小说累计字数。
export function formatChapterWordCount(wordCount: number): string {
  return `${normalizeWordCount(wordCount).toLocaleString("zh-CN")} 字`;
}

// normalizeWordCount 标准化字数，避免异常值影响展示和累计。
// 参数 wordCount 表示后端返回或本地累计的原始字数。
export function normalizeWordCount(wordCount: number): number {
  return Number.isFinite(wordCount) && wordCount > 0
    ? Math.floor(wordCount)
    : 0;
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
