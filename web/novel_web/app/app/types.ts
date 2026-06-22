import type { Dispatch, SetStateAction } from "react";
import type { SettingsSection } from "../settings";
import type { AppTheme } from "../theme";

// AppRoute 表示前端当前浏览器路径对应的页面状态。
export type AppRoute =
  | {
      // view 表示当前展示登录页。
      view: "login";
    }
  | {
      // view 表示当前展示书架页。
      view: "bookshelf";
    }
  | {
      // view 表示当前展示灵感社提示词库页。
      view: "inspiration";
    }
  | {
      // view 表示当前展示设置中心。
      view: "settings";
      // section 表示设置中心当前激活的功能分区。
      section: SettingsSection;
    }
  | {
      // view 表示当前展示小说详情页。
      view: "novelDetail";
      // novelId 表示详情页需要加载的小说主键 ID。
      novelId: number;
    }
  | {
      // view 表示当前展示章节编辑页。
      view: "chapterEditor";
      // novelId 表示当前章节所属小说主键 ID。
      novelId: number;
      // chapterId 表示当前需要编辑的章节主键 ID，创建章节时为空。
      chapterId: number | null;
    }
  | {
      // view 表示当前展示章节概要页。
      view: "chapterSummary";
      // novelId 表示当前章节所属小说主键 ID。
      novelId: number;
      // chapterId 表示当前需要查看或编辑概要的章节主键 ID。
      chapterId: number;
    };

// SetAppRoute 表示更新当前页面路由状态的方法。
export type SetAppRoute = Dispatch<SetStateAction<AppRoute>>;

// BrowserHistoryMode 表示更新浏览器路径时使用的历史记录模式。
export type BrowserHistoryMode = "push" | "replace";

// GuardedRoute 表示路由守卫处理后的页面状态和路径。
export interface GuardedRoute {
  // route 表示路由守卫允许展示的页面状态。
  route: AppRoute;
  // path 表示路由守卫允许停留的浏览器路径。
  path: string;
}


export interface RouteHandlers {
  // currentTheme 表示全站当前使用的黑白主题。
  currentTheme: AppTheme;
  // onBackToBookshelf 表示详情页返回书架时执行的回调。
  onBackToBookshelf: () => void;
  // onBackToNovelDetail 表示章节编辑页返回小说详情时执行的回调。
  onBackToNovelDetail: (novelId: number) => void;
  // onChapterCreate 表示进入章节创建页时执行的回调。
  onChapterCreate: (novelId: number) => void;
  // onChapterEdit 表示进入章节编辑页时执行的回调。
  onChapterEdit: (novelId: number, chapterId: number) => void;
  // onChapterSummaryOpen 表示进入章节概要页时执行的回调。
  onChapterSummaryOpen: (novelId: number, chapterId: number) => void;
  // onAgentPanelOpenChange 表示页面级 AI 侧栏开关状态变化时执行的回调。
  onAgentPanelOpenChange: (open: boolean) => void;
  // onChapterPersisted 表示新增章节首次保存成功后执行的路由替换回调。
  onChapterPersisted: (novelId: number, chapterId: number) => void;
  // onLoginSuccess 表示登录成功后执行的回调。
  onLoginSuccess: () => void;
  // onNovelDeleted 表示详情页删除小说成功后执行的回调。
  onNovelDeleted: () => void;
  // onNovelSelect 表示书架页选择小说时执行的回调。
  onNovelSelect: (novelId: number) => void;
  // onOpenBookshelf 表示顶部导航切换到书架页时执行的回调。
  onOpenBookshelf: () => void;
  // onOpenInspiration 表示顶部导航切换到灵感社页时执行的回调。
  onOpenInspiration: () => void;
  // onOpenSettings 表示打开设置中心时执行的回调。
  onOpenSettings: () => void;
  // onSettingsSectionChange 表示设置中心切换功能分区时执行的回调。
  onSettingsSectionChange: (section: SettingsSection) => void;
  // onToggleTheme 表示用户切换全站黑白主题时执行的回调。
  onToggleTheme: () => void;
  // onUnauthorized 表示登录态失效时执行的回调。
  onUnauthorized: () => void;
}

