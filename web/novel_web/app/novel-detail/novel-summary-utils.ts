import type { NovelSummaryItem } from "../api";

// NovelSummaryRangeDraft 表示小说总结覆盖章节范围编辑草稿。
export interface NovelSummaryRangeDraft {
  // startChapterNumber 表示起始章节号输入框文本，空值保存时按 0 处理。
  startChapterNumber: string;
  // endChapterNumber 表示结束章节号输入框文本，空值保存时按 0 处理。
  endChapterNumber: string;
}

// NovelSummaryParsedRange 表示小说总结覆盖章节范围草稿解析结果。
interface NovelSummaryParsedRange {
  // valid 表示当前范围草稿是否可提交给后端。
  valid: boolean;
  // startChapterNumber 表示解析后的起始章节号。
  startChapterNumber: number;
  // endChapterNumber 表示解析后的结束章节号。
  endChapterNumber: number;
  // message 表示范围无效时展示给用户的提示。
  message: string;
}

// createEmptyNovelSummaryRangeDraft 创建空白的小说总结章节范围草稿。
export function createEmptyNovelSummaryRangeDraft(): NovelSummaryRangeDraft {
  return {
    startChapterNumber: "0",
    endChapterNumber: "0",
  };
}

// novelSummaryToRangeDraft 将小说总结详情转换为章节范围编辑草稿。
// 参数 summary 表示后端返回的小说滚动总结详情。
export function novelSummaryToRangeDraft(
  summary: NovelSummaryItem,
): NovelSummaryRangeDraft {
  return {
    startChapterNumber: String(
      normalizeNovelSummaryChapterNumber(summary.start_chapter_number),
    ),
    endChapterNumber: String(
      normalizeNovelSummaryChapterNumber(summary.end_chapter_number),
    ),
  };
}

// parseNovelSummaryRangeDraft 解析并校验小说总结章节范围草稿。
// 参数 rangeDraft 表示用户当前输入的章节范围文本。
export function parseNovelSummaryRangeDraft(
  rangeDraft: NovelSummaryRangeDraft,
): NovelSummaryParsedRange {
  const startChapterNumber = parseNovelSummaryChapterNumber(
    rangeDraft.startChapterNumber,
  );
  const endChapterNumber = parseNovelSummaryChapterNumber(
    rangeDraft.endChapterNumber,
  );

  if (startChapterNumber === null || endChapterNumber === null) {
    return invalidNovelSummaryRange("章节范围只能填写非负整数");
  }
  if (startChapterNumber === 0 && endChapterNumber === 0) {
    return validNovelSummaryRange(0, 0);
  }
  if (startChapterNumber === 0 || endChapterNumber === 0) {
    return invalidNovelSummaryRange("记录范围时起止章节都需要大于 0");
  }
  if (startChapterNumber > endChapterNumber) {
    return invalidNovelSummaryRange("起始章节不能大于结束章节");
  }
  return validNovelSummaryRange(startChapterNumber, endChapterNumber);
}

// parseNovelSummaryChapterNumber 将章节号输入文本解析为非负整数。
// 参数 value 表示章节号输入框中的原始文本。
function parseNovelSummaryChapterNumber(value: string): number | null {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return 0;
  }

  const chapterNumber = Number(normalizedValue);
  if (!Number.isInteger(chapterNumber) || chapterNumber < 0) {
    return null;
  }
  return chapterNumber;
}

// validNovelSummaryRange 创建有效的小说总结章节范围解析结果。
// 参数 startChapterNumber 表示解析后的起始章节号；参数 endChapterNumber 表示解析后的结束章节号。
function validNovelSummaryRange(
  startChapterNumber: number,
  endChapterNumber: number,
): NovelSummaryParsedRange {
  return {
    valid: true,
    startChapterNumber,
    endChapterNumber,
    message: "",
  };
}

// invalidNovelSummaryRange 创建无效的小说总结章节范围解析结果。
// 参数 message 表示需要展示给用户的错误提示。
function invalidNovelSummaryRange(message: string): NovelSummaryParsedRange {
  return {
    valid: false,
    startChapterNumber: 0,
    endChapterNumber: 0,
    message,
  };
}

// formatNovelSummaryRange 格式化小说总结覆盖章节范围。
// 参数 summary 表示后端返回的小说滚动总结详情。
export function formatNovelSummaryRange(summary: NovelSummaryItem): string {
  const startChapterNumber = normalizeNovelSummaryChapterNumber(
    summary.start_chapter_number,
  );
  const endChapterNumber = normalizeNovelSummaryChapterNumber(
    summary.end_chapter_number,
  );

  if (startChapterNumber === 0 && endChapterNumber === 0) {
    return "未记录";
  }
  if (startChapterNumber === 0 || endChapterNumber === 0) {
    return "范围异常";
  }
  if (startChapterNumber > endChapterNumber) {
    return "范围异常";
  }
  if (startChapterNumber === endChapterNumber) {
    return `第 ${startChapterNumber} 章`;
  }
  return `第 ${startChapterNumber} 章 至 第 ${endChapterNumber} 章`;
}

// normalizeNovelSummaryChapterNumber 标准化后端返回的小说总结章节号。
// 参数 chapterNumber 表示后端返回的章节号。
function normalizeNovelSummaryChapterNumber(chapterNumber: number): number {
  return Number.isInteger(chapterNumber) && chapterNumber > 0
    ? chapterNumber
    : 0;
}
