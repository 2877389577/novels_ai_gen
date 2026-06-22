import type { PromptItem, PromptUpsertParams } from "../api";
import type { PromptFormState, PromptModalMode } from "./types";

// toPromptFormState 将提示词详情转换为弹窗表单状态。
// 参数 prompt 表示后端返回的提示词详情。
export function toPromptFormState(prompt: PromptItem): PromptFormState {
  return {
    promptType: prompt.prompt_type,
    description: prompt.description,
    content: prompt.content,
  };
}

// normalizePromptForm 清理提示词弹窗表单值。
// 参数 form 表示当前提示词弹窗表单状态。
export function normalizePromptForm(form: PromptFormState): PromptUpsertParams {
  return {
    prompt_type: form.promptType.trim(),
    description: form.description.trim(),
    content: form.content.trim(),
  };
}

// getPromptModalTitle 获取提示词弹窗标题。
// 参数 mode 表示提示词弹窗当前用途。
export function getPromptModalTitle(mode: PromptModalMode): string {
  if (mode === "create") {
    return "新增提示词";
  }
  if (mode === "edit") {
    return "编辑提示词";
  }
  return "查看提示词";
}

// formatPromptDescription 格式化提示词简介展示文本。
// 参数 description 表示提示词简介原文。
export function formatPromptDescription(description: string): string {
  const normalizedDescription = description.trim();
  return normalizedDescription || "未填写简介";
}

// formatTime 将后端时间字符串格式化为本地可读文本。
// 参数 value 表示后端返回的时间字符串。
export function formatTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) {
    return value || "未知时间";
  }
  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
export function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
