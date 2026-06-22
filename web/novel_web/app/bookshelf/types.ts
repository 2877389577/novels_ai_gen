import type { NovelCreateParams } from "../api";
import type { AppTheme } from "../theme";

// CreateNovelFormValues 表示添加小说弹窗中的表单值。
export type CreateNovelFormValues = Omit<NovelCreateParams, "tags"> & {
  // tags 表示表单中已经拆分成标签块的小说标签列表。
  tags: string[];
};

// BookshelfPageProps 表示书架首页需要的外部回调。
export interface BookshelfPageProps {
  // currentTheme 表示全站当前使用的黑白主题。
  currentTheme: AppTheme;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
  // onNovelSelect 表示用户选择某本小说后进入详情页的回调。
  onNovelSelect: (novelId: number) => void;
  // onOpenBookshelf 表示用户切换到书架页时执行的回调。
  onOpenBookshelf: () => void;
  // onOpenInspiration 表示用户切换到灵感社页时执行的回调。
  onOpenInspiration: () => void;
  // onOpenSettings 表示用户进入设置中心时执行的回调。
  onOpenSettings: () => void;
  // onToggleTheme 表示用户切换全站黑白主题时执行的回调。
  onToggleTheme: () => void;
}

// BookshelfNavTab 表示书架顶部导航支持的主入口。
export type BookshelfNavTab = "bookshelf" | "inspiration";

// BookshelfState 表示书架首页的数据加载状态。
export type BookshelfState = "loading" | "ready" | "error";
