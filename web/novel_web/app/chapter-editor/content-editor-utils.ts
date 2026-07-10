import type { ChapterCreateParams, ChapterDetailItem, ChapterUpdateParams } from "../api";
import { normalizeText } from "../novel-utils";
import { chapterSelectionAIActionHeight, chapterSelectionAIActionOffset, chapterSelectionAIActionViewportPadding, chapterSelectionAIActionWidth } from "./constants";
import type { ChapterFormValues, ChapterSelectionAIAction } from "./types";

export function getChapterSelectionAIAction(
  editor: HTMLDivElement | null,
): ChapterSelectionAIAction | null {
  if (!editor || typeof window === "undefined") {
    return null;
  }

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }
  if (!selectionBelongsToEditor(selection, editor)) {
    return null;
  }

  const content = selection.toString();
  if (!content.trim()) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = firstVisibleSelectionRect(range);
  if (!rect) {
    return null;
  }

  const topCandidate =
    rect.top - chapterSelectionAIActionHeight - chapterSelectionAIActionOffset;
  const top =
    topCandidate >= chapterSelectionAIActionViewportPadding
      ? topCandidate
      : rect.bottom + chapterSelectionAIActionOffset;
  const centeredLeft = rect.left + rect.width / 2 - chapterSelectionAIActionWidth / 2;
  return {
    content,
    top: clampToViewport(
      top,
      chapterSelectionAIActionViewportPadding,
      window.innerHeight -
        chapterSelectionAIActionHeight -
        chapterSelectionAIActionViewportPadding,
    ),
    left: clampToViewport(
      centeredLeft,
      chapterSelectionAIActionViewportPadding,
      window.innerWidth -
        chapterSelectionAIActionWidth -
        chapterSelectionAIActionViewportPadding,
    ),
  };
}

// selectionBelongsToEditor 判断当前浏览器选区是否完全位于正文编辑器内。
// 参数 selection 表示浏览器当前选区；参数 editor 表示章节正文段落编辑器。
export function selectionBelongsToEditor(selection: Selection, editor: HTMLDivElement): boolean {
  const anchorNode = selection.anchorNode;
  const focusNode = selection.focusNode;
  if (!anchorNode || !focusNode) {
    return false;
  }
  return editor.contains(anchorNode) && editor.contains(focusNode);
}

// firstVisibleSelectionRect 返回选区中第一个可用于定位的矩形。
// 参数 range 表示浏览器当前选区范围。
export function firstVisibleSelectionRect(range: Range): DOMRect | null {
  const boundingRect = range.getBoundingClientRect();
  if (boundingRect.width > 0 || boundingRect.height > 0) {
    return boundingRect;
  }

  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width > 0 || rect.height > 0) {
      return rect;
    }
  }
  return null;
}

// clampToViewport 将数值限制在指定视口范围内。
// 参数 value 表示原始坐标；参数 min 表示允许的最小值；参数 max 表示允许的最大值。
export function clampToViewport(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
}


export function chapterToFormValues(chapter: ChapterDetailItem): ChapterFormValues {
  return {
    title: normalizeText(chapter.title),
    content: normalizeChapterContentText(chapter.content),
  };
}

// normalizeChapterFormValues 清理章节表单数据。
// 参数 values 表示用户在章节编辑页输入的原始字段值。
export function normalizeChapterFormValues(
  values: ChapterFormValues,
): ChapterUpdateParams {
  return {
    title: normalizeText(values.title),
    content: normalizeChapterContentText(values.content),
  };
}

// normalizeChapterContentText 将章节正文转换为字符串并保留 Markdown 所需的原始空白。
// 参数 value 表示后端返回或编辑器提交的章节正文。
export function normalizeChapterContentText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// normalizeChapterCreateValues 生成创建章节时提交给后端的请求参数。
// 参数 values 表示已清理的章节标题和正文；参数 chapterNumber 表示后端返回的只读章节号。
export function normalizeChapterCreateValues(
  values: ChapterUpdateParams,
  chapterNumber: number | null,
): ChapterCreateParams {
  return {
    chapter_number: chapterNumber ?? 0,
    title: values.title,
    content: values.content,
    generate_summary: values.generate_summary,
  };
}

// formatChapterNumber 格式化只读章节号展示文本。
// 参数 chapterNumber 表示后端返回的章节号。
export function formatChapterNumber(chapterNumber: number | null): string {
  return chapterNumber === null ? "第 ... 章" : `第 ${chapterNumber} 章`;
}

// renderContentEditorText 将纯文本正文渲染成带首行缩进样式的段落节点。
// 参数 element 表示正文段落编辑器；参数 value 表示需要渲染的纯文本正文。
export function renderContentEditorText(element: HTMLDivElement | null, value: string) {
  if (!element) {
    return;
  }

  const normalizedValue = normalizeEditorPlainText(value);
  if (!normalizedValue) {
    element.replaceChildren();
    return;
  }

  element.replaceChildren(
    ...normalizedValue.split("\n").map(createContentParagraph),
  );
}

// createContentParagraph 创建一个正文段落节点。
// 参数 text 表示该段落保存的纯文本内容。
export function createContentParagraph(text: string): HTMLParagraphElement {
  const paragraph = document.createElement("p");
  paragraph.className = "chapter-content-paragraph";

  if (text) {
    paragraph.textContent = text;
  } else {
    paragraph.appendChild(document.createElement("br"));
  }

  return paragraph;
}

// readContentEditorText 从正文段落编辑器读取纯文本正文。
// 参数 element 表示正文段落编辑器。
export function readContentEditorText(element: HTMLDivElement | null): string {
  if (!element) {
    return "";
  }

  const lines = trimTrailingEmptyEditorLines(
    Array.from(element.childNodes).flatMap(readContentNodeLines),
  );
  if (lines.length === 0) {
    return normalizeEditorPlainText(element.textContent ?? "");
  }

  return normalizeEditorPlainText(lines.join("\n"));
}

// readContentNodeLines 从正文编辑器子节点读取一组文本行。
// 参数 node 表示正文编辑器内的子节点。
export function readContentNodeLines(node: ChildNode): string[] {
  if (node.nodeType === Node.TEXT_NODE) {
    return splitEditorTextLines(node.textContent ?? "");
  }

  if (!(node instanceof HTMLElement)) {
    return [];
  }

  if (node.tagName === "BR") {
    return [""];
  }

  const lines = splitEditorTextLines(readContentElementText(node));
  if (
    lines.length > 1 &&
    lines[lines.length - 1] === "" &&
    endsWithLineBreak(node)
  ) {
    return lines.slice(0, -1);
  }

  return lines;
}

// readContentElementText 从正文元素读取由真实文本和显式换行组成的纯文本。
// 参数 element 表示需要读取文本的正文元素。
export function readContentElementText(element: HTMLElement): string {
  let value = "";

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      value += child.textContent ?? "";
      continue;
    }

    if (!(child instanceof HTMLElement)) {
      continue;
    }

    if (child.tagName === "BR") {
      value += "\n";
      continue;
    }

    value += readContentElementText(child);
  }

  return value;
}

// endsWithLineBreak 判断元素末尾是否是浏览器用于占位的换行节点。
// 参数 element 表示需要检查末尾节点的正文元素。
export function endsWithLineBreak(element: HTMLElement): boolean {
  for (let index = element.childNodes.length - 1; index >= 0; index -= 1) {
    const child = element.childNodes[index];
    if (child.nodeType === Node.TEXT_NODE) {
      if (child.textContent) {
        return false;
      }
      continue;
    }

    if (!(child instanceof HTMLElement)) {
      continue;
    }

    return child.tagName === "BR" || endsWithLineBreak(child);
  }

  return false;
}

// splitEditorTextLines 将编辑器文本拆分为段落行。
// 参数 value 表示需要拆分的文本。
export function splitEditorTextLines(value: string): string[] {
  return normalizeEditorPlainText(value).split("\n");
}

// removeEmptyChapterContentLines 删除章节正文中只包含空白或不可见字符的空行。
// 参数 value 表示需要格式化的章节正文纯文本。
export function removeEmptyChapterContentLines(value: string): string {
  return splitEditorTextLines(value)
    .filter(function keepVisibleContentLine(line) {
      return Boolean(
        normalizeText(line.replace(/[\u200B-\u200D\u2060\uFEFF]/gu, "")),
      );
    })
    .join("\n");
}

// trimTrailingEmptyEditorLines 移除编辑器尾部由空白占位段落产生的空行。
// 参数 lines 表示从正文编辑器 DOM 中读取到的段落行。
export function trimTrailingEmptyEditorLines(lines: string[]): string[] {
  let endIndex = lines.length;

  while (endIndex > 0 && !normalizeText(lines[endIndex - 1])) {
    endIndex -= 1;
  }

  return lines.slice(0, endIndex);
}

// normalizeEditorPlainText 标准化正文编辑器读写的纯文本。
// 参数 value 表示需要标准化的正文文本。
export function normalizeEditorPlainText(value: string): string {
  return value.replace(/\r\n?/gu, "\n").replace(/\u00a0/gu, " ");
}

// ensureContentEditorHasParagraph 确保空编辑器获得焦点时存在可输入段落。
// 参数 element 表示正文段落编辑器。
export function ensureContentEditorHasParagraph(element: HTMLDivElement) {
  if (normalizeText(readContentEditorText(element))) {
    return;
  }

  const paragraph = createContentParagraph("");
  element.replaceChildren(paragraph);
  moveCaretToEnd(paragraph);
}

// getContentEditorTailNode 获取正文编辑器中适合放置光标的末尾节点。
// 参数 element 表示正文段落编辑器。
export function getContentEditorTailNode(element: HTMLDivElement): Node {
  return element.lastChild ?? element;
}

// moveCaretToEnd 将光标移动到指定节点末尾。
// 参数 node 表示需要放置光标的节点。
export function moveCaretToEnd(node: Node) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

// insertPlainTextAtSelection 在当前光标位置插入纯文本。
// 参数 text 表示从剪贴板读取的纯文本。
export function insertPlainTextAtSelection(text: string) {
  document.execCommand("insertText", false, normalizeEditorPlainText(text));
}

// countNonWhitespaceCharacters 统计文本中的非空白 Unicode 字符数量。
// 参数 value 表示需要统计的文本。
export function countNonWhitespaceCharacters(value: string): number {
  let count = 0;
  for (const char of value) {
    if (!/\s/u.test(char)) {
      count += 1;
    }
  }
  return count;
}

// isChapterNumberConflictError 判断错误是否由章节号重复导致。
// 参数 error 表示捕获到的未知错误。
export function isChapterNumberConflictError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("章节号");
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
