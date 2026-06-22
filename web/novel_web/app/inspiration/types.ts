import type { AppTheme } from "../theme";

// InspirationLoadState 表示灵感社页面局部数据加载状态。
export type InspirationLoadState = "loading" | "ready" | "error";

// PromptModalMode 表示提示词弹窗当前用途。
export type PromptModalMode = "create" | "edit" | "view";

// TypeModalMode 表示提示词类型弹窗当前用途。
export type TypeModalMode = "create" | "rename";

// InspirationPageProps 表示灵感社页面需要的外部状态和回调。
export interface InspirationPageProps {
  // currentTheme 表示全站当前使用的黑白主题。
  currentTheme: AppTheme;
  // onOpenBookshelf 表示用户切换到书架页时执行的回调。
  onOpenBookshelf: () => void;
  // onOpenInspiration 表示用户切换到灵感社页时执行的回调。
  onOpenInspiration: () => void;
  // onOpenSettings 表示用户进入设置中心时执行的回调。
  onOpenSettings: () => void;
  // onToggleTheme 表示用户切换全站黑白主题时执行的回调。
  onToggleTheme: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// PromptFormState 表示提示词新增或编辑弹窗中的表单状态。
export interface PromptFormState {
  // promptType 表示当前提示词所属类型。
  promptType: string;
  // description 表示提示词简介。
  description: string;
  // content 表示提示词正文。
  content: string;
}

// TypeModalState 表示提示词类型新增或重命名弹窗状态。
export interface TypeModalState {
  // visible 表示类型弹窗是否可见。
  visible: boolean;
  // mode 表示类型弹窗当前用途。
  mode: TypeModalMode;
  // originalName 表示重命名时的原类型名称。
  originalName: string;
  // name 表示类型输入框当前文本。
  name: string;
}

export const emptyPromptForm: PromptFormState = {
  promptType: "",
  description: "",
  content: "",
};

export const defaultTypeModalState: TypeModalState = {
  visible: false,
  mode: "create",
  originalName: "",
  name: "",
};
