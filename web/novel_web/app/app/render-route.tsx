import { BookshelfPage } from "../bookshelf";
import { ChapterEditorPage } from "../chapter-editor";
import { ChapterSummaryPage } from "../chapter-summary";
import { InspirationPage } from "../inspiration";
import { LoginPage } from "../login";
import { NovelDetailPage } from "../novel-detail";
import { SettingsPage } from "../settings";
import type { AppRoute, RouteHandlers } from "./types";

// renderRoute 根据当前路由状态组合对应页面组件。
// 参数 route 表示当前页面路由状态；参数 handlers 表示页面间跳转回调集合。
export function renderRoute(route: AppRoute, handlers: RouteHandlers) {
  switch (route.view) {
    case "bookshelf":
      return (
        <BookshelfPage
          currentTheme={handlers.currentTheme}
          onNovelSelect={handlers.onNovelSelect}
          onOpenBookshelf={handlers.onOpenBookshelf}
          onOpenInspiration={handlers.onOpenInspiration}
          onOpenSettings={handlers.onOpenSettings}
          onToggleTheme={handlers.onToggleTheme}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "inspiration":
      return (
        <InspirationPage
          currentTheme={handlers.currentTheme}
          onOpenBookshelf={handlers.onOpenBookshelf}
          onOpenInspiration={handlers.onOpenInspiration}
          onOpenSettings={handlers.onOpenSettings}
          onToggleTheme={handlers.onToggleTheme}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "settings":
      return (
        <SettingsPage
          section={route.section}
          onBackToBookshelf={handlers.onBackToBookshelf}
          onSectionChange={handlers.onSettingsSectionChange}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "novelDetail":
      return (
        <NovelDetailPage
          novelId={route.novelId}
          onBackToBookshelf={handlers.onBackToBookshelf}
          onChapterCreate={handlers.onChapterCreate}
          onChapterEdit={handlers.onChapterEdit}
          onChapterSummaryOpen={handlers.onChapterSummaryOpen}
          onDeleted={handlers.onNovelDeleted}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "chapterEditor":
      return (
        <ChapterEditorPage
          novelId={route.novelId}
          chapterId={route.chapterId}
          onBackToNovelDetail={handlers.onBackToNovelDetail}
          onAiPanelOpenChange={handlers.onChapterEditorAiPanelOpenChange}
          onChapterPersisted={handlers.onChapterPersisted}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    case "chapterSummary":
      return (
        <ChapterSummaryPage
          novelId={route.novelId}
          chapterId={route.chapterId}
          onBackToNovelDetail={handlers.onBackToNovelDetail}
          onUnauthorized={handlers.onUnauthorized}
        />
      );
    default:
      return <LoginPage onLoginSuccess={handlers.onLoginSuccess} />;
  }
}
