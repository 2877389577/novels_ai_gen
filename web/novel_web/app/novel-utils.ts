import type { NovelStatus } from "./api";

const novelTagSeparatorPattern = /[,，]+/;

// defaultNovelStatus 表示前端展示和表单使用的默认小说状态。
export const defaultNovelStatus: NovelStatus = "连载中";

// novelTagSeparators 表示标签输入框支持的分隔符。
export const novelTagSeparators = [",", "，"];

// novelStatusOptions 表示小说状态下拉框可选项。
export const novelStatusOptions: Array<{
  // label 表示下拉选项展示给用户的文本。
  label: NovelStatus;
  // value 表示提交给后端的小说状态值。
  value: NovelStatus;
}> = [
  { label: "连载中", value: "连载中" },
  { label: "已完结", value: "已完结" },
];

// normalizeNovelStatus 将未知状态收敛成前端可展示和可提交的合法状态。
// 参数 value 表示后端返回或表单读取到的原始状态。
export function normalizeNovelStatus(value: unknown): NovelStatus {
  return value === "已完结" ? "已完结" : defaultNovelStatus;
}

// splitNovelTags 将后端返回的逗号分隔标签拆成展示列表。
// 参数 tags 表示后端返回的标签文本或表单中的标签数组；参数 limit 表示最多返回的标签数量。
export function splitNovelTags(tags: unknown, limit = 3): string[] {
  const normalizedTags = toTagSourceList(tags).reduce<string[]>(
    appendNormalizedTags,
    [],
  );
  return normalizedTags.slice(0, limit);
}

// normalizeNovelTags 将标签值标准化成后端需要的英文逗号分隔字符串。
// 参数 tags 表示后端返回的标签文本或表单中的标签数组。
export function normalizeNovelTags(tags: unknown): string {
  return splitNovelTags(tags, Number.POSITIVE_INFINITY).join(",");
}

// splitNovelTagInputValue 将标签输入框中的文本拆分成标签数组。
// 参数 originString 表示 Semi TagInput 传入的原始输入文本。
export function splitNovelTagInputValue(originString: string): string[] {
  return splitNovelTags(originString, Number.POSITIVE_INFINITY);
}

// toTagSourceList 将未知标签值转换成待拆分的字符串列表。
// 参数 tags 表示后端返回的标签文本或表单中的标签数组。
function toTagSourceList(tags: unknown): string[] {
  if (Array.isArray(tags)) {
    return tags.filter(isStringValue);
  }
  if (typeof tags === "string") {
    return [tags];
  }
  return [];
}

// appendNormalizedTags 将单段标签文本拆分、清理并追加到标签列表中。
// 参数 result 表示已经清理好的标签列表；参数 source 表示待拆分的标签文本。
function appendNormalizedTags(result: string[], source: string): string[] {
  for (const tag of source.split(novelTagSeparatorPattern)) {
    const normalizedTag = normalizeText(tag);
    if (normalizedTag && !result.includes(normalizedTag)) {
      result.push(normalizedTag);
    }
  }

  return result;
}

// isStringValue 判断未知值是否为字符串。
// 参数 value 表示需要判断的未知值。
function isStringValue(value: unknown): value is string {
  return typeof value === "string";
}

// formatUpdatedText 将更新时间格式化成书架展示文本。
// 参数 updatedAt 表示后端返回的更新时间。
export function formatUpdatedText(updatedAt: string): string {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) {
    return "尚未更新";
  }

  return `${date.getMonth() + 1}月${date.getDate()}日更新`;
}

// getCoverInitial 获取封面占位图中展示的单字。
// 参数 name 表示小说名称。
export function getCoverInitial(name: string): string {
  const normalizedName = name.trim();
  return normalizedName ? normalizedName.slice(0, 1) : "卷";
}

// isPrivateObjectKey 判断封面字段是否为私有对象存储 key。
// 参数 value 表示后端返回的封面字段值。
export function isPrivateObjectKey(value: string): boolean {
  return value !== "" && !isDirectCoverURL(value) && isSafeObjectKey(value);
}

// isDirectCoverURL 判断封面字段是否可以直接作为图片地址展示。
// 参数 value 表示后端返回的封面字段值。
export function isDirectCoverURL(value: string): boolean {
  const normalizedValue = value.toLowerCase();
  return (
    normalizedValue.startsWith("http://") ||
    normalizedValue.startsWith("https://") ||
    normalizedValue.startsWith("data:") ||
    normalizedValue.startsWith("blob:")
  );
}

// isSafeObjectKey 判断对象 key 是否满足前端刷新预览的基础安全规则。
// 参数 value 表示需要判断的对象 key。
export function isSafeObjectKey(value: string): boolean {
  return (
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("..") &&
    (value.startsWith("covers/") || value.startsWith("characters/"))
  );
}

// normalizeText 将未知文本值转换为去除两端空白后的字符串。
// 参数 value 表示需要清理的文本值。
export function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
