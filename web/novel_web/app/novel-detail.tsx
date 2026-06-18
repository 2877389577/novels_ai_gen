import { Form } from "@douyinfe/semi-ui-19/lib/es/form";
import type { FormApi } from "@douyinfe/semi-ui-19/lib/es/form";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import Upload from "@douyinfe/semi-ui-19/lib/es/upload";
import type { customRequestArgs } from "@douyinfe/semi-ui-19/lib/es/upload";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type UIEvent,
} from "react";

import {
  UnauthorizedError,
  createCharacter,
  deleteChapter,
  deleteCharacter,
  deleteNovel,
  fetchChapterList,
  fetchCharacterDetail,
  fetchCharacterList,
  fetchNovelDetail,
  fetchNovelWordCount,
  refreshImagePreview,
  updateCharacter,
  updateNovel,
  uploadImage,
  type ChapterSummaryItem,
  type CharacterCreateParams,
  type CharacterDetailItem,
  type CharacterSummaryItem,
  type ImageUploadData,
  type NovelItem,
  type NovelUpdateParams,
} from "./api";
import {
  defaultNovelStatus,
  formatUpdatedText,
  getCoverInitial,
  isPrivateObjectKey,
  normalizeNovelTags,
  normalizeNovelStatus,
  normalizeText,
  novelTagSeparators,
  novelStatusOptions,
  splitNovelTagInputValue,
  splitNovelTags,
} from "./novel-utils";
import { EventGraphPanel } from "./event-graph";
import { RelationshipGraphPanel } from "./relationship-graph";

const coverUploadMaxSizeKB = 20 * 1024;
const chapterPageSize = 50;
const characterPageSize = 40;

// EditNovelFormValues 表示编辑小说弹窗中的表单值。
type EditNovelFormValues = Omit<NovelUpdateParams, "tags"> & {
  // tags 表示表单中已经拆分成标签块的小说标签列表。
  tags: string[];
};

// NovelDetailPageProps 表示小说详情页需要的外部参数和回调。
interface NovelDetailPageProps {
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
type NovelDetailState = "loading" | "ready" | "error";

// NovelWordCountState 表示小说总字数统计的加载状态。
type NovelWordCountState = "loading" | "ready" | "error";

// NovelDetailTab 表示小说详情页顶部 Tab 当前展示的内容。
type NovelDetailTab = "detail" | "characters" | "relationshipGraph" | "events";

// NovelDetailPage 渲染小说详情页。
// 参数 props 表示小说详情页需要的外部参数和回调。
export function NovelDetailPage(props: NovelDetailPageProps) {
  const [state, setState] = useState<NovelDetailState>("loading");
  const [message, setMessage] = useState("");
  const [novel, setNovel] = useState<NovelItem | null>(null);
  const [wordCountState, setWordCountState] =
    useState<NovelWordCountState>("loading");
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<NovelDetailTab>("detail");
  const onUnauthorized = props.onUnauthorized;

  // loadNovelDetail 从后端加载小说详情数据。
  // 参数 signal 表示可选的请求取消信号。
  const loadNovelDetail = useCallback(
    async function loadNovelDetail(signal?: AbortSignal) {
      setState("loading");
      setMessage("");

      try {
        const data = await fetchNovelDetail(props.novelId, signal);
        setNovel(data);
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        setState("error");
        setMessage(
          error instanceof Error ? error.message : "小说详情加载失败，请稍后再试",
        );
      }
    },
    [onUnauthorized, props.novelId],
  );

  // loadNovelWordCount 从后端聚合接口加载小说总字数。
  // 参数 signal 表示可选的请求取消信号。
  const loadNovelWordCount = useCallback(
    async function loadNovelWordCount(signal?: AbortSignal) {
      setWordCountState("loading");
      setWordCount(null);

      try {
        const data = await fetchNovelWordCount(props.novelId, signal);
        setWordCount(data.word_count);
        setWordCountState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        setWordCount(null);
        setWordCountState("error");
      }
    },
    [onUnauthorized, props.novelId],
  );

  // loadNovelDetailOnChange 在小说 ID 变化时加载详情。
  useEffect(
    function loadNovelDetailOnChange() {
      const controller = new AbortController();
      void loadNovelDetail(controller.signal);

      return function cancelNovelDetailLoad() {
        controller.abort();
      };
    },
    [loadNovelDetail],
  );

  // loadNovelWordCountOnChange 在小说 ID 变化时统计总字数。
  useEffect(
    function loadNovelWordCountOnChange() {
      const controller = new AbortController();
      void loadNovelWordCount(controller.signal);

      return function cancelNovelWordCountLoad() {
        controller.abort();
      };
    },
    [loadNovelWordCount],
  );

  // resetActiveTabOnNovelChange 在切换小说时默认回到作品详情页签。
  useEffect(
    function resetActiveTabOnNovelChange() {
      setActiveTab("detail");
    },
    [props.novelId],
  );

  // handleRetry 处理详情加载失败后的重试。
  function handleRetry() {
    void loadNovelDetail();
    void loadNovelWordCount();
  }

  // handleOpenEditModal 打开编辑小说弹窗。
  function handleOpenEditModal() {
    setEditVisible(true);
  }

  // handleCloseEditModal 关闭编辑小说弹窗。
  function handleCloseEditModal() {
    setEditVisible(false);
  }

  // handleNovelUpdated 处理小说更新成功后的详情刷新。
  // 参数 data 表示后端返回的最新小说数据。
  function handleNovelUpdated(data: NovelItem) {
    setNovel(data);
  }

  // handleChapterDeleted 处理章节删除后对小说总字数的同步扣减。
  // 参数 chapter 表示已经删除的章节摘要数据。
  function handleChapterDeleted(chapter: ChapterSummaryItem) {
    setWordCount(function subtractDeletedChapterWordCount(currentWordCount) {
      if (currentWordCount === null) {
        return currentWordCount;
      }

      return Math.max(0, currentWordCount - normalizeWordCount(chapter.word_count));
    });
  }

  // handleOpenDeleteModal 打开删除确认弹窗。
  function handleOpenDeleteModal() {
    setDeleteVisible(true);
  }

  // handleCloseDeleteModal 关闭删除确认弹窗。
  function handleCloseDeleteModal() {
    setDeleteVisible(false);
  }

  // handleTabChange 处理详情页顶部 Tab 切换。
  // 参数 nextTab 表示用户选择的目标 Tab。
  function handleTabChange(nextTab: NovelDetailTab) {
    setActiveTab(nextTab);
  }

  return (
    <main className="novel-detail-page">
      <DetailNav
        activeTab={activeTab}
        onBackToBookshelf={props.onBackToBookshelf}
        onTabChange={handleTabChange}
      />

      <section
        className={
          activeTab === "relationshipGraph" || activeTab === "events"
            ? "novel-detail-content novel-detail-content-relationship"
            : "novel-detail-content"
        }
        aria-label="小说详情内容"
      >
        {state === "loading" ? <NovelDetailSkeleton /> : null}
        {state === "error" ? (
          <NovelDetailError
            message={message}
            onBackToBookshelf={props.onBackToBookshelf}
            onRetry={handleRetry}
          />
        ) : null}
        {state === "ready" && novel ? (
          activeTab === "detail" ? (
            <div className="detail-tab-panel" id="detail-panel" role="tabpanel">
              <NovelDetailHero
                novel={novel}
                wordCountText={formatNovelWordCountText(
                  wordCountState,
                  wordCount,
                )}
                onBackToBookshelf={props.onBackToBookshelf}
                onDelete={handleOpenDeleteModal}
                onEdit={handleOpenEditModal}
                onUnauthorized={props.onUnauthorized}
              />
              <ChapterListPanel
                novelId={props.novelId}
                onChapterCreate={props.onChapterCreate}
                onChapterDeleted={handleChapterDeleted}
                onChapterEdit={props.onChapterEdit}
                onUnauthorized={props.onUnauthorized}
              />
            </div>
          ) : activeTab === "characters" ? (
            <CharacterCardPanel
              novel={novel}
              onUnauthorized={props.onUnauthorized}
            />
          ) : activeTab === "relationshipGraph" ? (
            <RelationshipGraphPanel
              novel={novel}
              onUnauthorized={props.onUnauthorized}
            />
          ) : (
            <EventGraphPanel
              novel={novel}
              onUnauthorized={props.onUnauthorized}
            />
          )
        ) : null}
      </section>

      {novel ? (
        <>
          <EditNovelModal
            novel={novel}
            visible={editVisible}
            onCancel={handleCloseEditModal}
            onUpdated={handleNovelUpdated}
            onUnauthorized={props.onUnauthorized}
          />
          <DeleteNovelConfirmModal
            novel={novel}
            visible={deleteVisible}
            onCancel={handleCloseDeleteModal}
            onDeleted={props.onDeleted}
            onUnauthorized={props.onUnauthorized}
          />
        </>
      ) : null}
    </main>
  );
}

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
function DetailNav(props: DetailNavProps) {
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

        <nav className="detail-links" aria-label="详情页内容导航" role="tablist">
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

// CharacterListState 表示角色卡列表的数据加载状态。
type CharacterListState = "loading" | "ready" | "error";

// CharacterPanelMode 表示角色卡 Tab 内部当前展示的视图。
type CharacterPanelMode = "list" | "create" | "view" | "edit";

// CharacterDetailState 表示角色卡详情的数据加载状态。
type CharacterDetailState = "loading" | "ready" | "error";

// CharacterFormValues 表示角色卡详情页编辑表单中的字段值。
type CharacterFormValues = Omit<
  CharacterCreateParams,
  "portrait_url" | "tags"
> & {
  // tags 表示表单中已经拆分成标签块的角色标签列表。
  tags: string[];
};

// CharacterCardPanelProps 表示角色卡列表区域需要展示的数据。
interface CharacterCardPanelProps {
  // novel 表示当前角色卡所属的小说数据。
  novel: NovelItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// CharacterCardPanel 渲染角色卡 Tab 的列表入口。
// 参数 props 表示角色卡列表区域需要展示的数据。
function CharacterCardPanel(props: CharacterCardPanelProps) {
  const [state, setState] = useState<CharacterListState>("loading");
  const [message, setMessage] = useState("");
  const [characters, setCharacters] = useState<CharacterSummaryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState<CharacterPanelMode>("list");
  const [selectedCharacterId, setSelectedCharacterId] = useState<number | null>(
    null,
  );
  const onUnauthorized = props.onUnauthorized;

  // loadCharacterList 从后端加载当前小说的角色卡摘要列表。
  // 参数 signal 表示可选的请求取消信号。
  const loadCharacterList = useCallback(
    async function loadCharacterList(signal?: AbortSignal) {
      setState("loading");
      setMessage("");

      try {
        const data = await fetchCharacterList(props.novel.id, {
          page: 1,
          pageSize: characterPageSize,
          signal,
        });
        setCharacters(data.items);
        setTotal(data.total);
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        setCharacters([]);
        setTotal(0);
        setState("error");
        setMessage(getErrorMessage(error, "角色卡列表加载失败，请稍后再试"));
      }
    },
    [onUnauthorized, props.novel.id],
  );

  // loadCharactersOnNovelChange 在角色卡 Tab 展示或小说变化时加载角色卡列表。
  useEffect(
    function loadCharactersOnNovelChange() {
      const controller = new AbortController();
      setMode("list");
      setSelectedCharacterId(null);
      void loadCharacterList(controller.signal);

      return function cancelCharacterListLoad() {
        controller.abort();
      };
    },
    [loadCharacterList],
  );

  // handleRetry 处理角色卡列表加载失败后的重试。
  function handleRetry() {
    void loadCharacterList();
  }

  // handleStartCreate 进入角色卡创建视图。
  function handleStartCreate() {
    setSelectedCharacterId(null);
    setMode("create");
  }

  // handleSelectCharacter 进入指定角色卡详情视图。
  // 参数 character 表示用户选择的角色卡摘要。
  function handleSelectCharacter(character: CharacterSummaryItem) {
    setSelectedCharacterId(character.id);
    setMode("view");
  }

  // handleBackToCharacterList 返回角色卡列表并刷新摘要。
  function handleBackToCharacterList() {
    setSelectedCharacterId(null);
    setMode("list");
    void loadCharacterList();
  }

  // handleCharacterCreated 处理角色卡创建成功后的跳转。
  // 参数 character 表示后端返回的新角色卡详情。
  function handleCharacterCreated(character: CharacterDetailItem) {
    setSelectedCharacterId(character.id);
    setMode("view");
    void loadCharacterList();
  }

  // handleCharacterUpdated 处理角色卡更新成功后的跳转。
  // 参数 character 表示后端返回的最新角色卡详情。
  function handleCharacterUpdated(character: CharacterDetailItem) {
    setSelectedCharacterId(character.id);
    setMode("view");
    void loadCharacterList();
  }

  // handleCharacterDeleted 处理角色卡删除成功后的列表刷新。
  function handleCharacterDeleted() {
    setSelectedCharacterId(null);
    setMode("list");
    void loadCharacterList();
  }

  if (mode !== "list") {
    return (
      <CharacterDetailPanel
        characterId={selectedCharacterId}
        mode={mode}
        novel={props.novel}
        onBackToList={handleBackToCharacterList}
        onCreated={handleCharacterCreated}
        onDeleted={handleCharacterDeleted}
        onEdit={() => setMode("edit")}
        onUpdated={handleCharacterUpdated}
        onUnauthorized={props.onUnauthorized}
        onView={() => setMode("view")}
      />
    );
  }

  return (
    <section
      className="character-card-panel"
      id="character-card-panel"
      role="tabpanel"
      aria-label={`${props.novel.name}角色卡`}
    >
      <div className="character-card-panel-header">
        <p className="detail-kicker">Character Cards</p>
        <div>
          <h1>人物志</h1>
          <p>笔墨凝神，千面皆缘。</p>
        </div>
        <div className="character-card-actions">
          <button type="button" disabled>
            筛选
          </button>
          <button type="button" onClick={handleStartCreate}>
            <span aria-hidden="true">＋</span>
            <span>新建人物</span>
          </button>
        </div>
      </div>

      {state === "loading" ? <CharacterCardSkeleton /> : null}
      {state === "error" ? (
        <div className="character-card-error" role="alert">
          <p>{message}</p>
          <button type="button" onClick={handleRetry}>
            重新加载
          </button>
        </div>
      ) : null}
      {state === "ready" && characters.length === 0 ? (
        <CharacterCardEmpty
          novelName={props.novel.name}
          onCreate={handleStartCreate}
        />
      ) : null}
      {state === "ready" && characters.length > 0 ? (
        <>
          <div className="character-grid" aria-label="角色卡列表">
            <CreateCharacterCard onCreate={handleStartCreate} />
            {characters.map((character) => (
              <CharacterCard
                character={character}
                key={character.id}
                onSelect={handleSelectCharacter}
                onUnauthorized={props.onUnauthorized}
              />
            ))}
          </div>
          <p className="character-card-count">
            已收录 {characters.length.toLocaleString("zh-CN")} /{" "}
            {total.toLocaleString("zh-CN")} 位角色
          </p>
        </>
      ) : null}
    </section>
  );
}

// CharacterCardEmptyProps 表示角色卡空态需要展示的数据。
interface CharacterCardEmptyProps {
  // novelName 表示当前角色卡所属小说名称。
  novelName: string;
  // onCreate 表示进入角色卡创建视图时执行的回调。
  onCreate: () => void;
}

// CharacterCardEmpty 渲染没有角色卡时的空态。
// 参数 props 表示角色卡空态需要展示的数据。
function CharacterCardEmpty(props: CharacterCardEmptyProps) {
  return (
    <div className="character-grid" aria-label="角色卡空态">
      <CreateCharacterCard onCreate={props.onCreate} />
      <div className="character-card-empty">
        <div className="detail-corner detail-corner-left-top" />
        <div className="detail-corner detail-corner-right-top" />
        <div className="detail-corner detail-corner-left-bottom" />
        <div className="detail-corner detail-corner-right-bottom" />
        <span aria-hidden="true">角</span>
        <strong>《{props.novelName}》还没有角色资料</strong>
        <p>后续可以在这里保存角色头像、身份、性格、关系和剧情备忘。</p>
      </div>
    </div>
  );
}

// CreateCharacterCardProps 表示创建角色卡入口需要的回调。
interface CreateCharacterCardProps {
  // onCreate 表示点击创建入口时执行的回调。
  onCreate: () => void;
}

// CreateCharacterCard 渲染创建角色卡的入口。
// 参数 props 表示创建角色卡入口需要的回调。
function CreateCharacterCard(props: CreateCharacterCardProps) {
  return (
    <button
      type="button"
      className="character-create-card"
      aria-label="创建角色卡"
      onClick={props.onCreate}
    >
      <span className="character-create-icon" aria-hidden="true">
        ＋
      </span>
      <strong>凝墨造魂</strong>
      <small>创建一个新角色</small>
      <span className="character-corner character-corner-left-top" />
      <span className="character-corner character-corner-right-top" />
      <span className="character-corner character-corner-left-bottom" />
      <span className="character-corner character-corner-right-bottom" />
    </button>
  );
}

// CharacterCardProps 表示单张角色卡需要展示的数据。
interface CharacterCardProps {
  // character 表示当前需要渲染的角色卡摘要。
  character: CharacterSummaryItem;
  // onSelect 表示进入角色卡详情视图时执行的回调。
  onSelect: (character: CharacterSummaryItem) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// CharacterCard 渲染单张角色卡片。
// 参数 props 表示单张角色卡需要展示的数据。
function CharacterCard(props: CharacterCardProps) {
  const tags = splitNovelTags(props.character.tags, 3);
  const summary = getCharacterSummaryText(props.character);
  const gender = normalizeText(props.character.gender) || "性别未定";

  return (
    <button
      type="button"
      className="character-card"
      onClick={() => props.onSelect(props.character)}
    >
      <div className="character-card-portrait">
        <CharacterPortrait
          character={props.character}
          onUnauthorized={props.onUnauthorized}
        />
        <div className="character-card-shade" aria-hidden="true" />
        <div className="character-card-title">
          <h2>{props.character.name || "未命名角色"}</h2>
          <CharacterTagList tags={tags} />
        </div>
      </div>
      <div className="character-card-body">
        <p>{summary}</p>
        <div className="character-card-meta">
          <span>{gender}</span>
          <span className="character-card-edit-hint" aria-hidden="true">
            ›
          </span>
        </div>
      </div>
    </button>
  );
}

// CharacterPortraitSource 表示可用于渲染角色肖像的最小角色数据。
interface CharacterPortraitSource {
  // name 表示角色姓名，用于图片替代文本和占位首字。
  name: string;
  // portrait_url 表示角色肖像图链接或私有对象存储 key。
  portrait_url: string;
}

// CharacterPortraitProps 表示角色肖像需要展示的数据。
interface CharacterPortraitProps {
  // character 表示当前肖像所属角色卡摘要。
  character: CharacterPortraitSource;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// CharacterPortrait 渲染角色肖像或占位图。
// 参数 props 表示角色肖像需要展示的数据。
function CharacterPortrait(props: CharacterPortraitProps) {
  const [resolvedPortraitURL, setResolvedPortraitURL] = useState("");
  const rawPortraitURL = normalizeText(props.character.portrait_url);
  const portraitURL = isPrivateObjectKey(rawPortraitURL)
    ? resolvedPortraitURL
    : rawPortraitURL;

  // resolvePrivatePortraitURL 在角色肖像字段为对象 key 时刷新私有图片预览链接。
  useEffect(
    function resolvePrivatePortraitURL() {
      if (!rawPortraitURL || !isPrivateObjectKey(rawPortraitURL)) {
        setResolvedPortraitURL("");
        return;
      }

      const controller = new AbortController();
      setResolvedPortraitURL("");

      void refreshImagePreview(rawPortraitURL, controller.signal)
        .then(function handlePreviewLoaded(data) {
          setResolvedPortraitURL(data.preview_url);
        })
        .catch(function handlePreviewError(error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            props.onUnauthorized();
          }
        });

      return function cancelPreviewLoad() {
        controller.abort();
      };
    },
    [rawPortraitURL, props.onUnauthorized],
  );

  if (portraitURL) {
    return <img src={portraitURL} alt={`${props.character.name}肖像`} />;
  }

  return (
    <div className="character-portrait-placeholder" aria-hidden="true">
      <span>{getCoverInitial(props.character.name)}</span>
    </div>
  );
}

// CharacterDetailPanelProps 表示角色卡详情页需要的数据和回调。
interface CharacterDetailPanelProps {
  // characterId 表示当前展示的角色卡主键 ID，创建模式为空。
  characterId: number | null;
  // mode 表示角色卡详情页当前模式。
  mode: Exclude<CharacterPanelMode, "list">;
  // novel 表示当前角色卡所属小说数据。
  novel: NovelItem;
  // onBackToList 表示返回角色卡列表时执行的回调。
  onBackToList: () => void;
  // onCreated 表示角色卡创建成功后执行的回调。
  onCreated: (character: CharacterDetailItem) => void;
  // onDeleted 表示角色卡删除成功后执行的回调。
  onDeleted: () => void;
  // onEdit 表示进入角色卡编辑模式时执行的回调。
  onEdit: () => void;
  // onUpdated 表示角色卡更新成功后执行的回调。
  onUpdated: (character: CharacterDetailItem) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
  // onView 表示从编辑模式返回详情查看模式时执行的回调。
  onView: () => void;
}

// CharacterDetailPanel 渲染角色卡详情、创建和编辑页面。
// 参数 props 表示角色卡详情页需要的数据和回调。
function CharacterDetailPanel(props: CharacterDetailPanelProps) {
  const [state, setState] = useState<CharacterDetailState>(
    props.mode === "create" ? "ready" : "loading",
  );
  const [message, setMessage] = useState("");
  const [character, setCharacter] = useState<CharacterDetailItem | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const onUnauthorized = props.onUnauthorized;

  // loadCharacterDetail 从后端加载角色卡详情。
  // 参数 signal 表示可选的请求取消信号。
  const loadCharacterDetail = useCallback(
    async function loadCharacterDetail(signal?: AbortSignal) {
      if (props.mode === "create" || props.characterId === null) {
        setCharacter(null);
        setState("ready");
        setMessage("");
        return;
      }

      setState("loading");
      setMessage("");

      try {
        const data = await fetchCharacterDetail(
          props.novel.id,
          props.characterId,
          signal,
        );
        setCharacter(data);
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        setCharacter(null);
        setState("error");
        setMessage(getErrorMessage(error, "角色卡详情加载失败，请稍后再试"));
      }
    },
    [onUnauthorized, props.characterId, props.mode, props.novel.id],
  );

  // loadCharacterDetailOnChange 在角色卡 ID 或模式变化时加载详情。
  useEffect(
    function loadCharacterDetailOnChange() {
      const controller = new AbortController();
      void loadCharacterDetail(controller.signal);

      return function cancelCharacterDetailLoad() {
        controller.abort();
      };
    },
    [loadCharacterDetail],
  );

  // handleRetry 处理角色卡详情加载失败后的重试。
  function handleRetry() {
    void loadCharacterDetail();
  }

  // handleOpenDeleteConfirm 打开角色卡删除确认弹窗。
  function handleOpenDeleteConfirm() {
    setDeleteVisible(true);
  }

  // handleCloseDeleteConfirm 关闭角色卡删除确认弹窗。
  function handleCloseDeleteConfirm() {
    if (deleting) {
      return;
    }
    setDeleteVisible(false);
  }

  // handleDeleteCharacter 确认删除当前角色卡。
  async function handleDeleteCharacter() {
    if (!character) {
      return;
    }

    setDeleting(true);

    try {
      await deleteCharacter(props.novel.id, character.id);
      Toast.success("角色卡已删除");
      props.onDeleted();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "角色卡删除失败，请稍后再试"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section
      className="character-detail-panel"
      id="character-card-panel"
      role="tabpanel"
      aria-label={`${props.novel.name}角色卡详情`}
    >
      <div className="character-detail-toolbar">
        <button
          type="button"
          className="character-detail-back"
          onClick={props.onBackToList}
        >
          <span aria-hidden="true">←</span>
          <span>返回人物列表</span>
        </button>
        {state === "ready" && character && props.mode === "view" ? (
          <div className="character-detail-actions">
            <button type="button" onClick={props.onEdit}>
              <span aria-hidden="true">✎</span>
              <span>编辑</span>
            </button>
            <button
              type="button"
              className="character-detail-delete"
              onClick={handleOpenDeleteConfirm}
            >
              <span aria-hidden="true">×</span>
              <span>删除</span>
            </button>
          </div>
        ) : null}
      </div>

      {state === "loading" ? <CharacterDetailSkeleton /> : null}
      {state === "error" ? (
        <div className="character-detail-error" role="alert">
          <p>{message}</p>
          <button type="button" onClick={handleRetry}>
            重新加载
          </button>
        </div>
      ) : null}
      {state === "ready" && props.mode === "view" && character ? (
        <CharacterDetailView
          character={character}
          onUnauthorized={props.onUnauthorized}
        />
      ) : null}
      {state === "ready" && props.mode !== "view" ? (
        <CharacterDetailForm
          character={props.mode === "edit" ? character : null}
          mode={props.mode}
          novelId={props.novel.id}
          onCancel={
            props.mode === "edit" && character
              ? props.onView
              : props.onBackToList
          }
          onCreated={props.onCreated}
          onUpdated={props.onUpdated}
          onUnauthorized={props.onUnauthorized}
        />
      ) : null}

      <Modal
        className="delete-novel-modal delete-character-modal"
        title="删除角色卡"
        visible={deleteVisible}
        width={420}
        okText="确认删除"
        cancelText="取消"
        confirmLoading={deleting}
        maskClosable={!deleting}
        closable={!deleting}
        onOk={handleDeleteCharacter}
        onCancel={handleCloseDeleteConfirm}
      >
        <p>
          将删除角色“{character?.name || "未命名角色"}”。删除后无法恢复，请确认是否继续。
        </p>
      </Modal>
    </section>
  );
}

// CharacterDetailViewProps 表示角色卡详情展示需要的数据。
interface CharacterDetailViewProps {
  // character 表示当前展示的角色卡详情。
  character: CharacterDetailItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// CharacterDetailView 渲染角色卡详情展示页。
// 参数 props 表示角色卡详情展示需要的数据。
function CharacterDetailView(props: CharacterDetailViewProps) {
  const tags = splitNovelTags(props.character.tags, Number.POSITIVE_INFINITY);
  const gender = normalizeText(props.character.gender) || "性别未定";

  return (
    <article className="character-detail-scroll">
      <div className="character-detail-left">
        <div className="character-detail-portrait-frame">
          <div className="character-detail-portrait">
            <CharacterPortrait
              character={props.character}
              onUnauthorized={props.onUnauthorized}
            />
          </div>
          <div className="character-detail-inner-border" aria-hidden="true" />
        </div>
        <div className="character-detail-name-tag">
          <div>{props.character.name || "未命名角色"}</div>
          <span>{gender}</span>
        </div>
      </div>

      <div className="character-detail-main">
        <CharacterTagList tags={tags} />
        <div className="character-detail-sections">
          <CharacterTextSection
            icon="身"
            title="身世背景"
            value={props.character.background}
          />
          <CharacterTextSection
            icon="性"
            title="性格特征"
            value={props.character.personality}
          />
          <CharacterTextSection
            icon="能"
            title="功法能力"
            value={props.character.ability}
          />
          <CharacterTextSection
            icon="愿"
            title="核心目标"
            value={props.character.goal}
            isLast
          />
        </div>
      </div>
    </article>
  );
}

// CharacterTextSectionProps 表示角色卡详情文本段落需要展示的数据。
interface CharacterTextSectionProps {
  // icon 表示段落标题前的装饰文字。
  icon: string;
  // isLast 表示当前段落是否是最后一段。
  isLast?: boolean;
  // title 表示段落标题。
  title: string;
  // value 表示段落正文内容。
  value: string;
}

// CharacterTextSection 渲染角色详情中的单个文本段落。
// 参数 props 表示角色卡详情文本段落需要展示的数据。
function CharacterTextSection(props: CharacterTextSectionProps) {
  return (
    <section
      className={
        props.isLast
          ? "character-detail-section character-detail-section-last"
          : "character-detail-section"
      }
    >
      <h2>
        <span aria-hidden="true">{props.icon}</span>
        {props.title}
      </h2>
      <p>{normalizeText(props.value) || "尚未记录。"}</p>
    </section>
  );
}

// CharacterDetailFormProps 表示角色卡创建和编辑表单需要的数据与回调。
interface CharacterDetailFormProps {
  // character 表示正在编辑的角色卡详情，创建模式为空。
  character: CharacterDetailItem | null;
  // mode 表示当前表单模式。
  mode: "create" | "edit";
  // novelId 表示角色卡所属小说主键 ID。
  novelId: number;
  // onCancel 表示取消创建或编辑时执行的回调。
  onCancel: () => void;
  // onCreated 表示角色卡创建成功后执行的回调。
  onCreated: (character: CharacterDetailItem) => void;
  // onUpdated 表示角色卡更新成功后执行的回调。
  onUpdated: (character: CharacterDetailItem) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// CharacterDetailForm 渲染角色卡创建和编辑表单。
// 参数 props 表示角色卡创建和编辑表单需要的数据与回调。
function CharacterDetailForm(props: CharacterDetailFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [portraitUploading, setPortraitUploading] = useState(false);
  const [portraitValue, setPortraitValue] = useState(
    normalizeText(props.character?.portrait_url),
  );
  const [resolvedPortraitURL, setResolvedPortraitURL] = useState("");
  const [uploadedPortrait, setUploadedPortrait] =
    useState<ImageUploadData | null>(null);
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const formApiRef = useRef<FormApi<CharacterFormValues> | null>(null);
  const normalizedPortraitValue = normalizeText(portraitValue);
  const portraitPreviewURL = isPrivateObjectKey(normalizedPortraitValue)
    ? resolvedPortraitURL
    : normalizedPortraitValue;
  const initialValues = props.character
    ? characterToFormValues(props.character)
    : createEmptyCharacterFormValues();
  const previewName = normalizeText(props.character?.name) || "新角色";

  // handleGetCharacterFormApi 保存 Semi 表单 API，供保存按钮触发表单校验。
  // 参数 formApi 表示 Semi Form 暴露的表单操作对象。
  const handleGetCharacterFormApi = useCallback(
    function handleGetCharacterFormApi(
      formApi: FormApi<CharacterFormValues>,
    ) {
      formApiRef.current = formApi;
    },
    [],
  );

  // syncCharacterFormValues 在表单模式或角色数据变化时同步初始值。
  useEffect(
    function syncCharacterFormValues() {
      const values = props.character
        ? characterToFormValues(props.character)
        : createEmptyCharacterFormValues();
      formApiRef.current?.setValues(values, { isOverride: true });
      setPortraitValue(normalizeText(props.character?.portrait_url));
      setUploadedPortrait(null);
      setUploadResetKey((currentKey) => currentKey + 1);
    },
    [props.character, props.mode],
  );

  // resolveCharacterPortraitPreview 在表单中刷新私有肖像预览链接。
  useEffect(
    function resolveCharacterPortraitPreview() {
      if (
        !normalizedPortraitValue ||
        !isPrivateObjectKey(normalizedPortraitValue)
      ) {
        setResolvedPortraitURL("");
        return;
      }

      const controller = new AbortController();
      setResolvedPortraitURL("");

      void refreshImagePreview(normalizedPortraitValue, controller.signal)
        .then(function handlePreviewLoaded(data) {
          setResolvedPortraitURL(data.preview_url);
        })
        .catch(function handlePreviewError(error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            props.onUnauthorized();
          }
        });

      return function cancelPreviewLoad() {
        controller.abort();
      };
    },
    [normalizedPortraitValue, props.onUnauthorized],
  );

  // handlePortraitUpload 处理角色肖像上传。
  // 参数 options 表示 Semi Upload 传入的自定义上传参数。
  const handlePortraitUpload = useCallback(
    function handlePortraitUpload(options: customRequestArgs) {
      setPortraitUploading(true);

      void uploadImage(options.fileInstance, "character")
        .then(function handlePortraitUploaded(data) {
          setUploadedPortrait(data);
          setPortraitValue(data.object_key);
          options.onSuccess(data);
          Toast.success("肖像已上传");
        })
        .catch(function handlePortraitUploadError(error) {
          options.onError({
            status: error instanceof UnauthorizedError ? 401 : 500,
          });

          if (error instanceof UnauthorizedError) {
            props.onUnauthorized();
            return;
          }

          Toast.error(getErrorMessage(error, "肖像上传失败，请稍后再试"));
        })
        .finally(function finishPortraitUpload() {
          setPortraitUploading(false);
        });
    },
    [props.onUnauthorized],
  );

  // handlePortraitRemove 处理移除角色肖像。
  function handlePortraitRemove() {
    setUploadedPortrait(null);
    setPortraitValue("");
  }

  // handleCancel 处理表单取消动作。
  function handleCancel() {
    if (submitting || portraitUploading) {
      return;
    }
    props.onCancel();
  }

  // handleSubmit 校验角色卡表单并提交创建或更新请求。
  async function handleSubmit() {
    if (portraitUploading) {
      Toast.warning("肖像正在上传，请稍候");
      return;
    }

    const formApi = formApiRef.current;
    if (!formApi) {
      return;
    }

    let values: CharacterFormValues;
    try {
      values = (await formApi.validate()) as CharacterFormValues;
    } catch {
      return;
    }

    setSubmitting(true);

    try {
      const params = normalizeCharacterFormValues(
        values,
        normalizedPortraitValue,
      );
      if (props.mode === "create") {
        const data = await createCharacter(props.novelId, params);
        Toast.success("角色卡已创建");
        props.onCreated(data);
        return;
      }

      if (!props.character) {
        return;
      }

      const data = await updateCharacter(
        props.novelId,
        props.character.id,
        params,
      );
      Toast.success("角色卡已更新");
      props.onUpdated(data);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "角色卡保存失败，请稍后再试"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form<CharacterFormValues>
      className="character-detail-form"
      initValues={initialValues}
      layout="vertical"
      autoScrollToError
      getFormApi={handleGetCharacterFormApi}
    >
      <article className="character-detail-scroll character-detail-scroll-editing">
        <div className="character-detail-left">
          <div className="character-detail-portrait-frame">
            <div className="character-detail-portrait character-detail-portrait-edit">
              {portraitPreviewURL ? (
                <img src={portraitPreviewURL} alt={`${previewName}肖像预览`} />
              ) : (
                <div className="character-portrait-placeholder" aria-hidden="true">
                  <span>{getCoverInitial(previewName)}</span>
                </div>
              )}
            </div>
            <div className="character-detail-inner-border" aria-hidden="true" />
          </div>
          <Upload
            key={uploadResetKey}
            className="character-portrait-upload"
            action="/api/v1/uploads/images"
            accept="image/jpeg,image/png,image/webp,image/gif"
            data={{ usage: "character" }}
            draggable
            dragMainText="角色肖像"
            dragSubText="JPEG / PNG / WebP / GIF，20MB 内"
            listType="picture"
            limit={1}
            maxSize={coverUploadMaxSizeKB}
            name="file"
            picHeight={148}
            picWidth={104}
            showReplace
            showRetry={false}
            disabled={submitting || portraitUploading}
            customRequest={handlePortraitUpload}
            onAcceptInvalid={handleCharacterPortraitAcceptInvalid}
            onExceed={handleCharacterPortraitExceed}
            onRemove={handlePortraitRemove}
            onSizeError={handleCharacterPortraitSizeError}
          >
            <button
              type="button"
              className="character-portrait-upload-trigger"
              disabled={submitting || portraitUploading}
            >
              <span aria-hidden="true">＋</span>
              <span>{uploadedPortrait ? "更换肖像" : "上传肖像"}</span>
            </button>
          </Upload>
          {normalizedPortraitValue ? (
            <button
              type="button"
              className="character-portrait-remove"
              disabled={submitting || portraitUploading}
              onClick={handlePortraitRemove}
            >
              移除肖像
            </button>
          ) : null}
        </div>

        <div className="character-detail-main">
          <div className="character-form-heading">
            <p className="detail-kicker">
              {props.mode === "create" ? "New Character" : "Edit Character"}
            </p>
            <h1>{props.mode === "create" ? "凝墨造魂" : "修订人物志"}</h1>
          </div>

          <div className="character-form-grid">
            <Form.Input
              field="name"
              label="姓名"
              placeholder="例如：李长风"
              trigger="blur"
              rules={[{ required: true, message: "请输入角色姓名" }]}
              validator={validateCharacterName}
            />
            <Form.Input
              field="gender"
              label="性别"
              placeholder="例如：男、女、未知"
              trigger="blur"
            />
          </div>
          <Form.TagInput
            field="tags"
            label="标签"
            placeholder="输入标签后按逗号或回车"
            addOnBlur
            allowDuplicates={false}
            className="novel-tags-input character-tags-input"
            separator={novelTagSeparators}
            showClear
            split={splitNovelTagInputValue}
            trigger="change"
          />

          <div className="character-form-sections">
            <Form.TextArea
              field="background"
              label="身世背景"
              placeholder="记录出身、经历、重要过往"
              autosize={{ minRows: 4, maxRows: 8 }}
              trigger="blur"
            />
            <Form.TextArea
              field="personality"
              label="性格特征"
              placeholder="记录处事方式、情绪底色和弱点"
              autosize={{ minRows: 4, maxRows: 8 }}
              trigger="blur"
            />
            <Form.TextArea
              field="ability"
              label="功法能力"
              placeholder="记录能力、武器、限制和成长空间"
              autosize={{ minRows: 4, maxRows: 8 }}
              trigger="blur"
            />
            <Form.TextArea
              field="goal"
              label="核心目标"
              placeholder="记录角色当前想要达成的目的"
              autosize={{ minRows: 4, maxRows: 8 }}
              trigger="blur"
            />
          </div>

          <div className="character-form-actions">
            <button
              type="button"
              className="character-form-cancel"
              disabled={submitting || portraitUploading}
              onClick={handleCancel}
            >
              取消
            </button>
            <button
              type="button"
              className="character-form-save"
              disabled={submitting || portraitUploading}
              onClick={handleSubmit}
            >
              {submitting ? "保存中..." : "保存修改"}
            </button>
          </div>
        </div>
      </article>
    </Form>
  );
}

// CharacterTagListProps 表示角色标签列表需要展示的数据。
interface CharacterTagListProps {
  // tags 表示需要展示的角色标签列表。
  tags: string[];
}

// CharacterTagList 渲染角色标签列表。
// 参数 props 表示角色标签列表需要展示的数据。
function CharacterTagList(props: CharacterTagListProps) {
  const tags = props.tags.length > 0 ? props.tags : ["未分类"];

  return (
    <div className="character-card-tags">
      {tags.map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}

// CharacterCardSkeleton 渲染角色卡列表加载中的占位内容。
function CharacterCardSkeleton() {
  return (
    <div className="character-grid" aria-label="角色卡列表加载中">
      {[0, 1, 2, 3].map(renderCharacterSkeletonCard)}
    </div>
  );
}

// renderCharacterSkeletonCard 渲染单张角色卡占位内容。
// 参数 index 表示当前占位卡片的位置。
function renderCharacterSkeletonCard(index: number) {
  return (
    <article className="character-card character-card-skeleton" key={index}>
      <div className="character-card-portrait" />
      <div className="character-card-body">
        <span />
        <span />
        <span />
      </div>
    </article>
  );
}

// CharacterDetailSkeleton 渲染角色卡详情加载中的占位内容。
function CharacterDetailSkeleton() {
  return (
    <div className="character-detail-skeleton" aria-label="角色卡详情加载中">
      <span />
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

// NovelDetailHeroProps 表示小说详情主体需要展示的数据和回调。
interface NovelDetailHeroProps {
  // novel 表示当前详情页展示的小说数据。
  novel: NovelItem;
  // wordCountText 表示小说所有章节累计后的总字数展示文本。
  wordCountText: string;
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onDelete 表示点击删除作品按钮时执行的回调。
  onDelete: () => void;
  // onEdit 表示点击编辑作品按钮时执行的回调。
  onEdit: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// NovelDetailHero 渲染小说详情页主体区域。
// 参数 props 表示小说详情主体需要展示的数据和回调。
function NovelDetailHero(props: NovelDetailHeroProps) {
  const tags = splitNovelTags(props.novel.tags, 8);
  const updatedText = formatUpdatedText(props.novel.updated_at);

  return (
    <div className="novel-detail-hero">
      <DetailCover novel={props.novel} onUnauthorized={props.onUnauthorized} />

      <article className="novel-detail-panel">
        <div className="detail-header-line" aria-hidden="true" />
        <div className="detail-title-block">
          <p className="detail-kicker">My Works</p>
          <h1 id="novel-title">{props.novel.name}</h1>
          <div className="detail-author-row">
            <span>文 / {props.novel.author_name || "未署名作者"}</span>
            <span className="detail-dot" aria-hidden="true" />
            <span>{props.wordCountText}</span>
          </div>
          <p className="detail-updated">{updatedText}</p>
        </div>

        <DetailTagList tags={tags} />

        <section className="detail-synopsis" aria-labelledby="synopsis-title">
          <div className="detail-corner detail-corner-left-top" />
          <div className="detail-corner detail-corner-right-top" />
          <div className="detail-corner detail-corner-left-bottom" />
          <div className="detail-corner detail-corner-right-bottom" />
          <h2 id="synopsis-title">
            <span aria-hidden="true">✦</span>
            内容简介
          </h2>
          <p>{props.novel.description || "这部作品还没有写下简介。"}</p>
        </section>

        <div className="detail-actions">
          <button
            type="button"
            className="detail-primary-button"
            onClick={props.onEdit}
          >
            <span aria-hidden="true">✎</span>
            <span>编辑作品</span>
          </button>
          <button
            type="button"
            className="detail-ghost-button"
            onClick={props.onDelete}
          >
            <span aria-hidden="true">×</span>
            <span>删除作品</span>
          </button>
        </div>
      </article>

      <div className="detail-watermark" aria-hidden="true">
        {getCoverInitial(props.novel.name)}
      </div>
    </div>
  );
}

// DetailCoverProps 表示详情页封面需要展示的数据。
interface DetailCoverProps {
  // novel 表示当前封面对应的小说数据。
  novel: NovelItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// DetailCover 渲染详情页封面和状态签。
// 参数 props 表示详情页封面需要展示的数据。
function DetailCover(props: DetailCoverProps) {
  const [resolvedCoverURL, setResolvedCoverURL] = useState("");
  const rawCoverURL = normalizeText(props.novel.cover_url);
  const status = normalizeNovelStatus(props.novel.status);
  const coverURL = isPrivateObjectKey(rawCoverURL)
    ? resolvedCoverURL
    : rawCoverURL;

  // resolvePrivateCoverURL 在封面字段为对象 key 时刷新私有图片预览链接。
  useEffect(
    function resolvePrivateCoverURL() {
      if (!rawCoverURL || !isPrivateObjectKey(rawCoverURL)) {
        setResolvedCoverURL("");
        return;
      }

      const controller = new AbortController();
      setResolvedCoverURL("");

      void refreshImagePreview(rawCoverURL, controller.signal)
        .then(function handlePreviewLoaded(data) {
          setResolvedCoverURL(data.preview_url);
        })
        .catch(function handlePreviewError(error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            props.onUnauthorized();
          }
        });

      return function cancelPreviewLoad() {
        controller.abort();
      };
    },
    [rawCoverURL, props.onUnauthorized],
  );

  return (
    <aside className="detail-cover-wrap" aria-label={`${props.novel.name}封面`}>
      <div className="detail-cover-frame" aria-hidden="true" />
      <div className="detail-cover-paper">
        {coverURL ? (
          <img src={coverURL} alt={`${props.novel.name}封面`} />
        ) : (
          <div className="detail-cover-placeholder" aria-hidden="true">
            <span>{getCoverInitial(props.novel.name)}</span>
          </div>
        )}
      </div>
      <div className={`detail-status-ribbon ${getDetailStatusClassName(status)}`}>
        <span>{status}</span>
      </div>
    </aside>
  );
}

// DetailTagListProps 表示详情页标签列表需要展示的数据。
interface DetailTagListProps {
  // tags 表示需要展示的小说标签列表。
  tags: string[];
}

// DetailTagList 渲染详情页标签列表。
// 参数 props 表示详情页标签列表需要展示的数据。
function DetailTagList(props: DetailTagListProps) {
  const tags = props.tags.length > 0 ? props.tags : ["未分类"];

  return <div className="detail-tags">{tags.map(renderDetailTag)}</div>;
}

// renderDetailTag 渲染详情页单个标签。
// 参数 tag 表示需要渲染的标签文本。
function renderDetailTag(tag: string) {
  return (
    <span className="detail-tag" key={tag}>
      {tag}
    </span>
  );
}

// NovelDetailSkeleton 渲染详情页加载中的占位内容。
function NovelDetailSkeleton() {
  return (
    <div className="novel-detail-hero detail-skeleton" aria-label="详情加载中">
      <div className="detail-cover-wrap">
        <div className="detail-cover-paper" />
      </div>
      <div className="novel-detail-panel">
        <span />
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

// NovelDetailErrorProps 表示详情页错误状态需要展示的数据和回调。
interface NovelDetailErrorProps {
  // message 表示详情加载失败时展示的错误提示。
  message: string;
  // onBackToBookshelf 表示返回书架页时执行的回调。
  onBackToBookshelf: () => void;
  // onRetry 表示点击重试按钮时执行的回调。
  onRetry: () => void;
}

// NovelDetailError 渲染详情页错误状态。
// 参数 props 表示详情页错误状态需要展示的数据和回调。
function NovelDetailError(props: NovelDetailErrorProps) {
  return (
    <div className="detail-error" role="alert">
      <p>{props.message}</p>
      <div>
        <button type="button" onClick={props.onRetry}>
          重新加载
        </button>
        <button type="button" onClick={props.onBackToBookshelf}>
          返回书架
        </button>
      </div>
    </div>
  );
}

// ChapterListState 表示章节列表的数据加载状态。
type ChapterListState = "loading" | "ready" | "error";

// ChapterListPanelProps 表示章节列表区域需要的数据和回调。
interface ChapterListPanelProps {
  // novelId 表示当前章节列表所属小说 ID。
  novelId: number;
  // onChapterCreate 表示进入章节创建页时执行的回调。
  onChapterCreate: (novelId: number) => void;
  // onChapterDeleted 表示章节删除成功后通知父层同步派生数据的回调。
  onChapterDeleted: (chapter: ChapterSummaryItem) => void;
  // onChapterEdit 表示进入章节编辑页时执行的回调。
  onChapterEdit: (novelId: number, chapterId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// ChapterListPanel 渲染小说详情页下方的章节列表。
// 参数 props 表示章节列表区域需要的数据和回调。
function ChapterListPanel(props: ChapterListPanelProps) {
  const [state, setState] = useState<ChapterListState>("loading");
  const [message, setMessage] = useState("");
  const [chapters, setChapters] = useState<ChapterSummaryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChapterSummaryItem | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const hasMore = chapters.length < total;
  const onUnauthorized = props.onUnauthorized;

  // loadChapterPage 从后端加载章节列表页。
  // 参数 pageToLoad 表示需要加载的页码；参数 mode 表示加载方式；参数 signal 表示可选的请求取消信号。
  const loadChapterPage = useCallback(
    async function loadChapterPage(
      pageToLoad: number,
      mode: "reset" | "append",
      signal?: AbortSignal,
    ) {
      if (mode === "reset") {
        setState("loading");
        setMessage("");
      } else {
        setLoadingMore(true);
      }

      try {
        const data = await fetchChapterList(props.novelId, {
          page: pageToLoad,
          pageSize: chapterPageSize,
          signal,
        });
        setChapters(function updateChapters(currentChapters) {
          return mode === "reset"
            ? data.items
            : appendUniqueChapters(currentChapters, data.items);
        });
        setTotal(data.total);
        setPage(data.page);
        setState("ready");
      } catch (error) {
        if (signal?.aborted) {
          return;
        }

        if (error instanceof UnauthorizedError) {
          onUnauthorized();
          return;
        }

        if (mode === "reset") {
          setState("error");
          setMessage(
            error instanceof Error ? error.message : "章节列表加载失败，请稍后再试",
          );
          return;
        }

        Toast.error(getErrorMessage(error, "更多章节加载失败，请稍后再试"));
      } finally {
        if (mode === "append") {
          setLoadingMore(false);
        }
      }
    },
    [onUnauthorized, props.novelId],
  );

  // loadChaptersOnNovelChange 在小说 ID 变化时重新加载章节列表。
  useEffect(
    function loadChaptersOnNovelChange() {
      const controller = new AbortController();
      void loadChapterPage(1, "reset", controller.signal);

      return function cancelChapterListLoad() {
        controller.abort();
      };
    },
    [loadChapterPage],
  );

  // handleCreateChapter 进入章节创建页。
  function handleCreateChapter() {
    props.onChapterCreate(props.novelId);
  }

  // handleRetry 处理章节列表加载失败后的重试。
  function handleRetry() {
    void loadChapterPage(1, "reset");
  }

  // handleScroll 在滚动接近底部时继续加载章节。
  // 参数 event 表示章节列表滚动事件。
  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    const distanceToBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;
    if (
      distanceToBottom > 96 ||
      state !== "ready" ||
      loadingMore ||
      !hasMore
    ) {
      return;
    }

    void loadChapterPage(page + 1, "append");
  }

  // handleChapterSelect 进入指定章节编辑页。
  // 参数 chapter 表示用户选择的章节摘要数据。
  function handleChapterSelect(chapter: ChapterSummaryItem) {
    props.onChapterEdit(props.novelId, chapter.id);
  }

  // handleChapterKeyDown 处理章节行键盘选择。
  // 参数 event 表示 React 键盘事件；参数 chapter 表示当前章节摘要数据。
  function handleChapterKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    chapter: ChapterSummaryItem,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleChapterSelect(chapter);
  }

  // handleOpenDeleteConfirm 打开删除章节确认弹窗。
  // 参数 event 表示删除按钮点击事件；参数 chapter 表示需要删除的章节摘要数据。
  function handleOpenDeleteConfirm(
    event: MouseEvent<HTMLButtonElement>,
    chapter: ChapterSummaryItem,
  ) {
    event.stopPropagation();
    setDeleteTarget(chapter);
  }

  // handleCloseDeleteConfirm 关闭删除章节确认弹窗。
  function handleCloseDeleteConfirm() {
    if (deleting) {
      return;
    }

    setDeleteTarget(null);
  }

  // handleDeleteChapter 确认删除当前章节。
  async function handleDeleteChapter() {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      await deleteChapter(props.novelId, deleteTarget.id);
      Toast.success("章节已删除");
      setChapters(function removeDeletedChapter(currentChapters) {
        return currentChapters.filter(
          (chapter) => chapter.id !== deleteTarget.id,
        );
      });
      props.onChapterDeleted(deleteTarget);
      setTotal((currentTotal) => Math.max(0, currentTotal - 1));
      setDeleteTarget(null);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "章节删除失败，请稍后再试"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="chapter-list-panel" aria-labelledby="chapter-list-title">
      <div className="chapter-list-header">
        <div>
          <p className="chapter-list-kicker">Chapters</p>
          <h2 id="chapter-list-title">章节目录</h2>
          <span>{total} 章</span>
        </div>
        <button
          type="button"
          className="chapter-create-button"
          onClick={handleCreateChapter}
        >
          <span>新增章节</span>
        </button>
      </div>

      {state === "loading" ? <ChapterListSkeleton /> : null}
      {state === "error" ? (
        <div className="chapter-list-error" role="alert">
          <p>{message}</p>
          <button type="button" onClick={handleRetry}>
            重新加载
          </button>
        </div>
      ) : null}
      {state === "ready" && chapters.length === 0 ? (
        <div className="chapter-list-empty">
          <p>这一卷还没有章节，第一笔可以从这里落下。</p>
          <button type="button" onClick={handleCreateChapter}>
            新增章节
          </button>
        </div>
      ) : null}
      {state === "ready" && chapters.length > 0 ? (
        <div
          className="chapter-scroll-list"
          aria-label="章节列表"
          onScroll={handleScroll}
        >
          {chapters.map((chapter) => (
            <ChapterRow
              chapter={chapter}
              key={chapter.id}
              onDelete={handleOpenDeleteConfirm}
              onKeyDown={handleChapterKeyDown}
              onSelect={handleChapterSelect}
            />
          ))}
          {loadingMore ? <div className="chapter-list-more">加载更多章节...</div> : null}
          {!hasMore ? <div className="chapter-list-end">已到目录尽头</div> : null}
        </div>
      ) : null}

      <Modal
        className="delete-novel-modal delete-chapter-modal"
        title="删除章节"
        visible={deleteTarget !== null}
        width={420}
        okText="确认删除"
        cancelText="取消"
        confirmLoading={deleting}
        maskClosable={!deleting}
        closable={!deleting}
        onOk={handleDeleteChapter}
        onCancel={handleCloseDeleteConfirm}
      >
        <p>
          将删除《{deleteTarget?.title || "该章节"}》。删除后无法恢复，请确认是否继续。
        </p>
      </Modal>
    </section>
  );
}

// ChapterRowProps 表示章节行需要展示的数据和回调。
interface ChapterRowProps {
  // chapter 表示当前章节摘要数据。
  chapter: ChapterSummaryItem;
  // onDelete 表示点击删除章节按钮时执行的回调。
  onDelete: (
    event: MouseEvent<HTMLButtonElement>,
    chapter: ChapterSummaryItem,
  ) => void;
  // onKeyDown 表示章节行键盘选择时执行的回调。
  onKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
    chapter: ChapterSummaryItem,
  ) => void;
  // onSelect 表示选择章节行时执行的回调。
  onSelect: (chapter: ChapterSummaryItem) => void;
}

// ChapterRow 渲染章节列表中的单行章节。
// 参数 props 表示章节行需要展示的数据和回调。
function ChapterRow(props: ChapterRowProps) {
  return (
    <div
      className="chapter-row"
      role="button"
      tabIndex={0}
      onClick={() => props.onSelect(props.chapter)}
      onKeyDown={(event) => props.onKeyDown(event, props.chapter)}
    >
      <div className="chapter-row-number">
        第 {props.chapter.chapter_number} 章
      </div>
      <div className="chapter-row-main">
        <strong>{props.chapter.title}</strong>
        <span>{formatUpdatedText(props.chapter.updated_at)}</span>
      </div>
      <div className="chapter-row-meta">
        <span>{formatChapterWordCount(props.chapter.word_count)}</span>
        <button
          type="button"
          className="chapter-delete-button"
          onClick={(event) => props.onDelete(event, props.chapter)}
        >
          删除
        </button>
      </div>
    </div>
  );
}

// ChapterListSkeleton 渲染章节列表加载中的占位内容。
function ChapterListSkeleton() {
  return (
    <div className="chapter-list-skeleton" aria-label="章节列表加载中">
      {[0, 1, 2].map(renderChapterSkeletonRow)}
    </div>
  );
}

// renderChapterSkeletonRow 渲染单行章节占位内容。
// 参数 index 表示当前占位行的位置。
function renderChapterSkeletonRow(index: number) {
  return (
    <div className="chapter-row chapter-row-skeleton" key={index}>
      <span />
      <span />
      <span />
    </div>
  );
}

// appendUniqueChapters 将新章节追加到已有列表中并去重。
// 参数 currentChapters 表示当前已经加载的章节列表；参数 nextChapters 表示下一页章节列表。
function appendUniqueChapters(
  currentChapters: ChapterSummaryItem[],
  nextChapters: ChapterSummaryItem[],
): ChapterSummaryItem[] {
  const existingIds = new Set(currentChapters.map((chapter) => chapter.id));
  const mergedChapters = [...currentChapters];
  for (const chapter of nextChapters) {
    if (!existingIds.has(chapter.id)) {
      mergedChapters.push(chapter);
    }
  }
  return mergedChapters;
}

// formatNovelWordCountText 根据加载状态格式化小说总字数展示文本。
// 参数 state 表示总字数加载状态；参数 wordCount 表示已经统计出的总字数。
function formatNovelWordCountText(
  state: NovelWordCountState,
  wordCount: number | null,
): string {
  if (state === "loading") {
    return "统计中...";
  }
  if (state === "error") {
    return "字数加载失败";
  }
  return formatChapterWordCount(wordCount ?? 0);
}

// formatChapterWordCount 格式化章节字数展示文本。
// 参数 wordCount 表示章节正文的非空白字符数量。
function formatChapterWordCount(wordCount: number): string {
  return `${normalizeWordCount(wordCount).toLocaleString("zh-CN")} 字`;
}

// normalizeWordCount 标准化字数，避免异常值影响展示和累计。
// 参数 wordCount 表示后端返回的章节字数。
function normalizeWordCount(wordCount: number): number {
  return Number.isFinite(wordCount) ? Math.max(0, wordCount) : 0;
}

// getCharacterSummaryText 获取角色卡列表中的摘要文本。
// 参数 character 表示当前需要展示的角色卡摘要。
function getCharacterSummaryText(character: CharacterSummaryItem): string {
  return (
    normalizeText(character.background) || "尚未添加详细设定，仅有名字。"
  );
}

// createEmptyCharacterFormValues 创建空白角色卡表单初始值。
function createEmptyCharacterFormValues(): CharacterFormValues {
  return {
    name: "",
    gender: "",
    tags: [],
    background: "",
    personality: "",
    ability: "",
    goal: "",
  };
}

// characterToFormValues 将角色卡详情转换成编辑表单初始值。
// 参数 character 表示需要编辑的角色卡详情数据。
function characterToFormValues(
  character: CharacterDetailItem,
): CharacterFormValues {
  return {
    name: normalizeText(character.name),
    gender: normalizeText(character.gender),
    tags: splitNovelTags(character.tags, Number.POSITIVE_INFINITY),
    background: normalizeText(character.background),
    personality: normalizeText(character.personality),
    ability: normalizeText(character.ability),
    goal: normalizeText(character.goal),
  };
}

// normalizeCharacterFormValues 清理角色卡表单数据。
// 参数 values 表示 Semi 表单校验后返回的原始字段值；参数 portraitValue 表示角色肖像链接或对象 key。
function normalizeCharacterFormValues(
  values: CharacterFormValues,
  portraitValue: string,
): CharacterCreateParams {
  return {
    portrait_url: normalizeText(portraitValue),
    name: normalizeText(values.name),
    gender: normalizeText(values.gender),
    tags: normalizeNovelTags(values.tags),
    background: normalizeText(values.background),
    personality: normalizeText(values.personality),
    ability: normalizeText(values.ability),
    goal: normalizeText(values.goal),
  };
}

// validateCharacterName 校验角色姓名是否填写了非空白内容。
// 参数 value 表示角色姓名输入框当前值。
function validateCharacterName(value: unknown): string {
  return normalizeText(value) ? "" : "请输入角色姓名";
}

// handleCharacterPortraitAcceptInvalid 处理角色肖像文件类型不符合要求的情况。
function handleCharacterPortraitAcceptInvalid() {
  Toast.error("仅支持 JPEG、PNG、WebP、GIF 图片");
}

// handleCharacterPortraitExceed 处理角色肖像上传数量超过限制的情况。
function handleCharacterPortraitExceed() {
  Toast.warning("只能上传一张角色肖像");
}

// handleCharacterPortraitSizeError 处理角色肖像文件大小超过限制的情况。
function handleCharacterPortraitSizeError() {
  Toast.error("角色肖像不能超过 20MB");
}

// EditNovelModalProps 表示编辑小说弹窗需要的数据和回调。
interface EditNovelModalProps {
  // novel 表示当前需要编辑的小说数据。
  novel: NovelItem;
  // visible 表示编辑小说弹窗是否可见。
  visible: boolean;
  // onCancel 表示取消或关闭编辑小说弹窗时执行的回调。
  onCancel: () => void;
  // onUpdated 表示小说更新成功后执行的回调。
  onUpdated: (novel: NovelItem) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// EditNovelModal 渲染编辑小说弹窗和表单。
// 参数 props 表示编辑小说弹窗需要的数据和回调。
function EditNovelModal(props: EditNovelModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverValue, setCoverValue] = useState(normalizeText(props.novel.cover_url));
  const [resolvedCoverURL, setResolvedCoverURL] = useState("");
  const [uploadedCover, setUploadedCover] = useState<ImageUploadData | null>(
    null,
  );
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const formApiRef = useRef<FormApi<EditNovelFormValues> | null>(null);
  const normalizedCoverValue = normalizeText(coverValue);
  const coverPreviewURL = isPrivateObjectKey(normalizedCoverValue)
    ? resolvedCoverURL
    : normalizedCoverValue;

  // handleGetFormApi 保存 Semi 表单 API，供弹窗确认按钮触发表单校验。
  // 参数 formApi 表示 Semi Form 暴露的表单操作对象。
  const handleGetFormApi = useCallback(
    function handleGetFormApi(formApi: FormApi<EditNovelFormValues>) {
      formApiRef.current = formApi;
      formApi.setValues(novelToFormValues(props.novel), { isOverride: true });
    },
    [props.novel],
  );

  // syncFormWhenOpen 在弹窗打开时同步最新小说数据。
  useEffect(
    function syncFormWhenOpen() {
      if (!props.visible) {
        return;
      }

      const values = novelToFormValues(props.novel);
      formApiRef.current?.setValues(values, { isOverride: true });
      setCoverValue(values.cover_url);
      setUploadedCover(null);
      setUploadResetKey((currentKey) => currentKey + 1);
    },
    [props.novel, props.visible],
  );

  // resolveEditCoverPreview 在编辑弹窗中刷新私有封面预览链接。
  useEffect(
    function resolveEditCoverPreview() {
      if (
        !props.visible ||
        !normalizedCoverValue ||
        !isPrivateObjectKey(normalizedCoverValue)
      ) {
        setResolvedCoverURL("");
        return;
      }

      const controller = new AbortController();
      setResolvedCoverURL("");

      void refreshImagePreview(normalizedCoverValue, controller.signal)
        .then(function handlePreviewLoaded(data) {
          setResolvedCoverURL(data.preview_url);
        })
        .catch(function handlePreviewError(error) {
          if (controller.signal.aborted) {
            return;
          }
          if (error instanceof UnauthorizedError) {
            props.onUnauthorized();
          }
        });

      return function cancelPreviewLoad() {
        controller.abort();
      };
    },
    [normalizedCoverValue, props.onUnauthorized, props.visible],
  );

  // handleCancel 处理编辑小说弹窗关闭。
  function handleCancel() {
    if (submitting || coverUploading) {
      return;
    }

    props.onCancel();
  }

  // handleCoverUpload 处理编辑弹窗中的封面上传。
  // 参数 options 表示 Semi Upload 传入的自定义上传参数。
  const handleCoverUpload = useCallback(
    function handleCoverUpload(options: customRequestArgs) {
      setCoverUploading(true);

      void uploadImage(options.fileInstance, "cover")
        .then(function handleCoverUploaded(data) {
          setUploadedCover(data);
          setCoverValue(data.object_key);
          options.onSuccess(data);
          Toast.success("封面已上传");
        })
        .catch(function handleCoverUploadError(error) {
          options.onError({
            status: error instanceof UnauthorizedError ? 401 : 500,
          });

          if (error instanceof UnauthorizedError) {
            props.onUnauthorized();
            return;
          }

          Toast.error(getErrorMessage(error, "封面上传失败，请稍后再试"));
        })
        .finally(function finishCoverUpload() {
          setCoverUploading(false);
        });
    },
    [props.onUnauthorized],
  );

  // handleCoverRemove 处理用户移除封面。
  function handleCoverRemove() {
    setUploadedCover(null);
    setCoverValue("");
  }

  // handleSubmit 校验编辑表单并提交更新请求。
  async function handleSubmit() {
    if (coverUploading) {
      Toast.warning("封面正在上传，请稍候");
      return;
    }

    const formApi = formApiRef.current;
    if (!formApi) {
      return;
    }

    let values: EditNovelFormValues;
    try {
      values = (await formApi.validate()) as EditNovelFormValues;
    } catch {
      return;
    }

    setSubmitting(true);

    try {
      const data = await updateNovel(
        props.novel.id,
        normalizeUpdateNovelValues(values, normalizedCoverValue),
      );
      Toast.success("小说已更新");
      props.onUpdated(data);
      props.onCancel();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "小说更新失败，请稍后再试"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      className="create-novel-modal edit-novel-modal"
      title="编辑小说"
      visible={props.visible}
      width={640}
      okText="保存修改"
      cancelText="取消"
      confirmLoading={submitting || coverUploading}
      maskClosable={!submitting && !coverUploading}
      closable={!submitting && !coverUploading}
      keepDOM
      onOk={handleSubmit}
      onCancel={handleCancel}
    >
      <Form<EditNovelFormValues>
        className="create-novel-form edit-novel-form"
        initValues={novelToFormValues(props.novel)}
        layout="vertical"
        autoScrollToError
        getFormApi={handleGetFormApi}
      >
        <Form.Input
          field="name"
          label="书名"
          placeholder="例如：长夜行灯"
          trigger="blur"
          rules={[{ required: true, message: "请输入书名" }]}
          validator={validateNovelName}
        />
        <Form.Select
          field="status"
          label="状态"
          placeholder="选择作品状态"
          optionList={novelStatusOptions}
          trigger="change"
          rules={[{ required: true, message: "请选择状态" }]}
        />
        <Form.Input
          field="author_name"
          label="作者"
          placeholder="留空时显示未署名作者"
          trigger="blur"
        />
        <Form.TextArea
          field="description"
          label="简介"
          placeholder="写下这部小说的核心气质、世界观或一句灵感"
          autosize={{ minRows: 3, maxRows: 5 }}
          trigger="blur"
        />
        <Form.TagInput
          field="tags"
          label="标签"
          placeholder="输入标签后按逗号或回车"
          addOnBlur
          allowDuplicates={false}
          className="novel-tags-input"
          separator={novelTagSeparators}
          showClear
          split={splitNovelTagInputValue}
          trigger="change"
        />

        <div className="cover-upload-field">
          <span className="cover-upload-label">封面</span>
          <div className="edit-cover-preview">
            {coverPreviewURL ? (
              <img src={coverPreviewURL} alt={`${props.novel.name}当前封面`} />
            ) : (
              <span>暂无封面</span>
            )}
          </div>
          <Upload
            key={uploadResetKey}
            className="cover-upload"
            action="/api/v1/uploads/images"
            accept="image/jpeg,image/png,image/webp,image/gif"
            data={{ usage: "cover" }}
            draggable
            dragMainText="封面图片"
            dragSubText="JPEG / PNG / WebP / GIF，20MB 内"
            listType="picture"
            limit={1}
            maxSize={coverUploadMaxSizeKB}
            name="file"
            picHeight={148}
            picWidth={104}
            showReplace
            showRetry={false}
            disabled={submitting || coverUploading}
            customRequest={handleCoverUpload}
            onAcceptInvalid={handleCoverAcceptInvalid}
            onExceed={handleCoverExceed}
            onRemove={handleCoverRemove}
            onSizeError={handleCoverSizeError}
          >
            <button
              type="button"
              className="cover-upload-trigger"
              disabled={submitting || coverUploading}
            >
              <span aria-hidden="true">＋</span>
              <span>{uploadedCover ? "更换封面" : "选择封面"}</span>
            </button>
          </Upload>
          {normalizedCoverValue ? (
            <button
              type="button"
              className="edit-cover-remove"
              disabled={submitting || coverUploading}
              onClick={handleCoverRemove}
            >
              移除封面
            </button>
          ) : null}
        </div>
      </Form>
    </Modal>
  );
}

// DeleteNovelConfirmModalProps 表示删除小说确认弹窗需要的数据和回调。
interface DeleteNovelConfirmModalProps {
  // novel 表示当前需要删除的小说数据。
  novel: NovelItem;
  // visible 表示删除确认弹窗是否可见。
  visible: boolean;
  // onCancel 表示取消删除时执行的回调。
  onCancel: () => void;
  // onDeleted 表示删除成功后执行的回调。
  onDeleted: () => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// DeleteNovelConfirmModal 渲染删除小说二次确认弹窗。
// 参数 props 表示删除小说确认弹窗需要的数据和回调。
function DeleteNovelConfirmModal(props: DeleteNovelConfirmModalProps) {
  const [deleting, setDeleting] = useState(false);

  // handleCancel 处理删除确认弹窗取消动作。
  function handleCancel() {
    if (deleting) {
      return;
    }

    props.onCancel();
  }

  // handleDelete 确认删除当前小说。
  async function handleDelete() {
    setDeleting(true);

    try {
      await deleteNovel(props.novel.id);
      Toast.success("小说已删除");
      props.onDeleted();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "小说删除失败，请稍后再试"));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      className="delete-novel-modal"
      title="删除作品"
      visible={props.visible}
      width={420}
      okText="确认删除"
      cancelText="取消"
      confirmLoading={deleting}
      maskClosable={!deleting}
      closable={!deleting}
      onOk={handleDelete}
      onCancel={handleCancel}
    >
      <p>
        将删除《{props.novel.name}》。删除后无法恢复，请确认是否继续。
      </p>
    </Modal>
  );
}

// handleCoverAcceptInvalid 处理封面文件类型不符合要求的情况。
function handleCoverAcceptInvalid() {
  Toast.error("仅支持 JPEG、PNG、WebP、GIF 图片");
}

// handleCoverExceed 处理封面上传数量超过限制的情况。
function handleCoverExceed() {
  Toast.warning("只能上传一张封面");
}

// handleCoverSizeError 处理封面文件大小超过限制的情况。
function handleCoverSizeError() {
  Toast.error("封面图片不能超过 20MB");
}

// novelToFormValues 将小说数据转换成编辑表单初始值。
// 参数 novel 表示需要编辑的小说数据。
function novelToFormValues(novel: NovelItem): EditNovelFormValues {
  return {
    name: normalizeText(novel.name),
    status: normalizeNovelStatus(novel.status || defaultNovelStatus),
    author_name: normalizeText(novel.author_name),
    description: normalizeText(novel.description),
    tags: splitNovelTags(novel.tags, Number.POSITIVE_INFINITY),
    cover_url: normalizeText(novel.cover_url),
  };
}

// normalizeUpdateNovelValues 清理编辑小说表单数据。
// 参数 values 表示 Semi 表单校验后返回的原始字段值；参数 coverValue 表示编辑后的封面链接或对象 key。
function normalizeUpdateNovelValues(
  values: EditNovelFormValues,
  coverValue: string,
): NovelUpdateParams {
  return {
    name: normalizeText(values.name),
    status: normalizeNovelStatus(values.status),
    author_name: normalizeText(values.author_name),
    description: normalizeText(values.description),
    tags: normalizeNovelTags(values.tags),
    cover_url: normalizeText(coverValue),
  };
}

// validateNovelName 校验小说书名是否填写了非空白内容。
// 参数 value 表示书名输入框当前值。
function validateNovelName(value: unknown): string {
  return normalizeText(value) ? "" : "请输入书名";
}

// getDetailStatusClassName 获取详情页状态竖签的样式类名。
// 参数 status 表示已经标准化后的小说状态。
function getDetailStatusClassName(status: string): string {
  return status === "已完结"
    ? "detail-status-ribbon-finished"
    : "detail-status-ribbon-ongoing";
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
