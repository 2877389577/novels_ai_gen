import type { NovelDetailTab } from "./types";

// DetailNavProps 表示详情页顶部导航需要的回调。
interface DetailNavProps {
  // activeTab 表示当前选中的详情页顶部 Tab。
  activeTab: NovelDetailTab;
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onTabChange 表示用户切换详情页顶部 Tab 时执行的回调。
  onTabChange: (tab: NovelDetailTab) => void;
}

// DetailNav 渲染小说详情页顶部导航。
// 参数 props 表示详情页顶部导航需要的回调。
export function DetailNav(props: DetailNavProps) {
  return (
    <header className="detail-nav">
      <div className="detail-nav-inner">
        <button
          type="button"
          className="detail-brand"
          onClick={props.onBackToBookshelf}
        >
          <span className="detail-seal" aria-hidden="true">
            墨
          </span>
          <span>墨香墨苑</span>
        </button>

        <nav
          className="detail-links"
          aria-label="详情页内容导航"
          role="tablist"
        >
          <button
            type="button"
            aria-controls="detail-panel"
            aria-selected={props.activeTab === "detail"}
            role="tab"
            onClick={() => props.onTabChange("detail")}
          >
            作品详情
          </button>
          <button
            type="button"
            aria-controls="novel-summary-panel"
            aria-selected={props.activeTab === "summary"}
            role="tab"
            onClick={() => props.onTabChange("summary")}
          >
            总结
          </button>
          <button
            type="button"
            aria-controls="novel-outline-panel"
            aria-selected={props.activeTab === "outline"}
            role="tab"
            onClick={() => props.onTabChange("outline")}
          >
            大纲
          </button>
          <button
            type="button"
            aria-controls="character-card-panel"
            aria-selected={props.activeTab === "characters"}
            role="tab"
            onClick={() => props.onTabChange("characters")}
          >
            角色卡
          </button>
          <button
            type="button"
            aria-controls="relationship-graph-panel"
            aria-selected={props.activeTab === "relationshipGraph"}
            role="tab"
            onClick={() => props.onTabChange("relationshipGraph")}
          >
            角色关系图
          </button>
          <button
            type="button"
            aria-controls="event-graph-panel"
            aria-selected={props.activeTab === "events"}
            role="tab"
            onClick={() => props.onTabChange("events")}
          >
            事件管理
          </button>
        </nav>

        <button
          type="button"
          className="detail-back-button"
          onClick={props.onBackToBookshelf}
        >
          <span aria-hidden="true">←</span>
          <span>返回书架</span>
        </button>
      </div>
    </header>
  );
}
