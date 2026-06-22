import { ChapterSummaryProvider } from "./chapter-summary-context";
import { ChapterSummaryFrame } from "./chapter-summary-frame";

// ChapterSummaryPageProps 表示章节概要页需要的路由参数和回调。
interface ChapterSummaryPageProps {
  // novelId 表示当前章节所属小说主键 ID。
  novelId: number;
  // chapterId 表示当前需要查看或编辑概要的章节主键 ID。
  chapterId: number;
  // onBackToNovelDetail 表示返回小说详情页时执行的回调。
  onBackToNovelDetail: (novelId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ChapterSummaryPage 组合章节概要页的数据 provider 和展示框架。
// 参数 props 表示章节概要页需要的路由参数和回调。
export function ChapterSummaryPage(props: ChapterSummaryPageProps) {
  return (
    <ChapterSummaryProvider
      novelId={props.novelId}
      chapterId={props.chapterId}
      onBackToNovelDetail={props.onBackToNovelDetail}
      onUnauthorized={props.onUnauthorized}
    >
      <ChapterSummaryFrame />
    </ChapterSummaryProvider>
  );
}
