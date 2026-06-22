import type { RoleConfig } from "@douyinfe/semi-ui-19/lib/es/aiChatDialogue/interface";
import type { ChapterAiMessage, ChapterFormValues } from "./types";

export const chapterEditorScrollbarHiddenClass = "chapter-editor-scrollbar-hidden";
// chapterAiInputMaxHeight 表示 AI 输入框自动增高上限，约等于 6 行正文。
export const chapterAiInputMaxHeight = 22 * 6;
export const chapterAutoSaveIntervalMs = 5000;
export const chapterSelectionAIActionWidth = 112;
export const chapterSelectionAIActionHeight = 36;
export const chapterSelectionAIActionOffset = 10;
export const chapterSelectionAIActionViewportPadding = 8;

export const emptyChapterFormValues: ChapterFormValues = {
  title: "",
  content: "",
};

export const chapterAiAssistantMessages: ChapterAiMessage[] = [];

export const chapterAiAssistantRoleConfig: RoleConfig = {
  assistant: {
    name: "写作助手",
    avatar: "/images/AI头像.jpg",
    color: "var(--semi-color-primary)",
  },
  system: {
    name: "系统",
  },
  user: {
    name: "你",
    avatar: "/images/用户头像.jpg",
  },
};
