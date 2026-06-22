import type { NovelUpdateParams } from "../api";

// EditNovelFormValues 表示编辑小说弹窗中的表单值。
export type EditNovelFormValues = Omit<NovelUpdateParams, "tags"> & {
  // tags 表示表单中已经拆分成标签块的小说标签列表。
  tags: string[];
};

// NovelDetailPageProps 表示小说详情页需要的外部参数和回调。
export interface NovelDetailPageProps {
  // novelId 表示当前详情页需要加载的小说主键 ID。
  novelId: number;
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onChapterCreate 表示进入章节创建页时执行的回调。
  onChapterCreate: (novelId: number) => void;
  // onChapterEdit 表示进入章节编辑页时执行的回调。
  onChapterEdit: (novelId: number, chapterId: number) => void;
  // onDeleted 表示小说删除成功后执行的回调。
  onDeleted: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// NovelDetailState 表示小说详情页的数据加载状态。
export type NovelDetailState = "loading" | "ready" | "error";

// NovelWordCountState 表示小说总字数统计的加载状态。
export type NovelWordCountState = "loading" | "ready" | "error";

// NovelDetailTab 表示小说详情页顶部 Tab 当前展示的内容。
export type NovelDetailTab =
  | "detail"
  | "summary"
  | "outline"
  | "characters"
  | "relationshipGraph"
  | "events";
