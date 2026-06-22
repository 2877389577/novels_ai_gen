import Toast from "@douyinfe/semi-ui-19/lib/es/toast";

import type { NovelCreateParams, NovelItem } from "../api";
import {
  normalizeNovelTags,
  normalizeNovelStatus,
  normalizeText,
} from "../novel-utils";
import type { CreateNovelFormValues } from "./types";

// handleCoverAcceptInvalid 处理封面文件类型不符合要求的情况。
export function handleCoverAcceptInvalid() {
  Toast.error("仅支持 JPEG、PNG、WebP、GIF 图片");
}

// handleCoverExceed 处理封面上传数量超过限制的情况。
export function handleCoverExceed() {
  Toast.warning("只能上传一张封面");
}

// handleCoverSizeError 处理封面文件大小超过限制的情况。
export function handleCoverSizeError() {
  Toast.error("封面图片不能超过 20MB");
}

// countRecentlyUpdatedNovels 统计最近三十天内更新过的小说数量。
// 参数 novels 表示需要统计的小说列表。
export function countRecentlyUpdatedNovels(novels: NovelItem[]): number {
  const now = Date.now();
  const recentThreshold = 30 * 24 * 60 * 60 * 1000;
  let count = 0;

  for (const novel of novels) {
    const updatedAt = new Date(novel.updated_at).getTime();
    if (!Number.isNaN(updatedAt) && now - updatedAt <= recentThreshold) {
      count += 1;
    }
  }

  return count;
}

// normalizeCreateNovelValues 清理添加小说表单数据。
// 参数 values 表示 Semi 表单校验后返回的原始字段值；参数 coverObjectKey 表示封面图片上传后返回的对象 key。
export function normalizeCreateNovelValues(
  values: CreateNovelFormValues,
  coverObjectKey: string,
): NovelCreateParams {
  return {
    name: normalizeText(values.name),
    status: normalizeNovelStatus(values.status),
    author_name: normalizeText(values.author_name),
    description: normalizeText(values.description),
    tags: normalizeNovelTags(values.tags),
    cover_url: normalizeText(coverObjectKey),
  };
}

// validateNovelName 校验小说书名是否填写了非空白内容。
// 参数 value 表示书名输入框当前值。
export function validateNovelName(value: unknown): string {
  return normalizeText(value) ? "" : "请输入书名";
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
