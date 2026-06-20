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
} from "react";

import {
  UnauthorizedError,
  createNovel,
  fetchNovelList,
  refreshImagePreview,
  uploadImage,
  type ImageUploadData,
  type NovelCreateParams,
  type NovelItem,
  type NovelListData,
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
import type { AppTheme } from "./theme";

const bookshelfPageSize = 20;
const coverUploadMaxSizeKB = 20 * 1024;
const coverToneClasses = [
  "book-cover-tone-jade",
  "book-cover-tone-cinnabar",
  "book-cover-tone-ink",
  "book-cover-tone-gold",
];
const emptyCreateNovelFormValues: CreateNovelFormValues = {
  name: "",
  status: defaultNovelStatus,
  author_name: "",
  description: "",
  tags: [],
  cover_url: "",
};

// CreateNovelFormValues 表示添加小说弹窗中的表单值。
type CreateNovelFormValues = Omit<NovelCreateParams, "tags"> & {
  // tags 表示表单中已经拆分成标签块的小说标签列表。
  tags: string[];
};

// BookshelfPageProps 表示书架首页需要的外部回调。
interface BookshelfPageProps {
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
type BookshelfState = "loading" | "ready" | "error";

// BookshelfPage 渲染小说书架首页。
// 参数 props 表示书架首页需要的外部回调。
export function BookshelfPage(props: BookshelfPageProps) {
  const [state, setState] = useState<BookshelfState>("loading");
  const [message, setMessage] = useState("");
  const [listData, setListData] = useState<NovelListData | null>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const onUnauthorized = props.onUnauthorized;

  // loadBookshelf 从后端加载小说书架数据。
  // 参数 signal 表示可选的请求取消信号。
  const loadBookshelf = useCallback(
    async function loadBookshelf(signal?: AbortSignal) {
      setState("loading");
      setMessage("");

      try {
        const data = await fetchNovelList({
          page: 1,
          pageSize: bookshelfPageSize,
          signal,
        });
        setListData(data);
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
          error instanceof Error ? error.message : "书架加载失败，请稍后再试",
        );
      }
    },
    [onUnauthorized],
  );

  // loadBookshelfOnMount 在书架页面挂载时加载小说列表。
  useEffect(
    function loadBookshelfOnMount() {
      const controller = new AbortController();
      void loadBookshelf(controller.signal);

      return function cancelBookshelfLoad() {
        controller.abort();
      };
    },
    [loadBookshelf],
  );

  const novels = listData?.items ?? [];
  const totalCount = listData?.total ?? 0;
  const updatedCount = countRecentlyUpdatedNovels(novels);

  // handleRetry 处理书架加载失败后的重试动作。
  function handleRetry() {
    void loadBookshelf();
  }

  // handleOpenCreateModal 打开添加小说弹窗。
  function handleOpenCreateModal() {
    setCreateModalVisible(true);
  }

  // handleCloseCreateModal 关闭添加小说弹窗。
  function handleCloseCreateModal() {
    setCreateModalVisible(false);
  }

  // handleNovelCreated 处理小说创建成功后的书架刷新。
  async function handleNovelCreated() {
    await loadBookshelf();
  }

  return (
    <main className="bookshelf-page">
      <BookshelfHeader
        activeTab="bookshelf"
        currentTheme={props.currentTheme}
        summaryItems={[`${totalCount} 部作品`, `${updatedCount} 部近日更新`]}
        onOpenBookshelf={props.onOpenBookshelf}
        onOpenInspiration={props.onOpenInspiration}
        onOpenSettings={props.onOpenSettings}
        onToggleTheme={props.onToggleTheme}
      />

      <section className="bookshelf-content" aria-labelledby="bookshelf-title">
        <header className="bookshelf-title-block">
          <p className="bookshelf-kicker">Library</p>
          <h1 id="bookshelf-title">藏书阁</h1>
          <p>
            安放正在生长的卷册，回看灵感的枝叶，也为下一次落笔留出安静的位置。
          </p>
        </header>

        {state === "loading" ? <BookshelfSkeleton /> : null}
        {state === "error" ? (
          <BookshelfError message={message} onRetry={handleRetry} />
        ) : null}
        {state === "ready" ? (
          <NovelGrid
            novels={novels}
            onCreateClick={handleOpenCreateModal}
            onNovelSelect={props.onNovelSelect}
            onUnauthorized={onUnauthorized}
          />
        ) : null}
      </section>

      <CreateNovelModal
        visible={createModalVisible}
        onCancel={handleCloseCreateModal}
        onCreated={handleNovelCreated}
        onUnauthorized={onUnauthorized}
      />
    </main>
  );
}

// BookshelfHeaderProps 表示书架顶部导航需要的外部状态和回调。
export interface BookshelfHeaderProps {
  // activeTab 表示当前激活的顶部导航入口。
  activeTab: BookshelfNavTab;
  // currentTheme 表示全站当前使用的黑白主题。
  currentTheme: AppTheme;
  // summaryItems 表示小屏幕导航下方展示的页面摘要文本。
  summaryItems: string[];
  // onOpenBookshelf 表示用户切换到书架页时执行的回调。
  onOpenBookshelf: () => void;
  // onOpenInspiration 表示用户切换到灵感社页时执行的回调。
  onOpenInspiration: () => void;
  // onOpenSettings 表示用户进入设置中心时执行的回调。
  onOpenSettings: () => void;
  // onToggleTheme 表示用户切换全站黑白主题时执行的回调。
  onToggleTheme: () => void;
}

// BookshelfHeader 渲染书架首页顶部导航。
// 参数 props 表示书架顶部导航需要的外部状态和回调。
export function BookshelfHeader(props: BookshelfHeaderProps) {
  return (
    <header className="bookshelf-nav">
      <div className="bookshelf-nav-inner">
        <div className="bookshelf-brand" aria-label="墨香墨苑">
          <div className="bookshelf-seal" aria-hidden="true">
            墨
          </div>
          <span>墨香墨苑</span>
        </div>

        <nav className="bookshelf-links" aria-label="主导航">
          <button
            type="button"
            aria-current={props.activeTab === "bookshelf" ? "page" : undefined}
            onClick={props.onOpenBookshelf}
          >
            藏书阁
          </button>
          <button
            type="button"
            aria-current={
              props.activeTab === "inspiration" ? "page" : undefined
            }
            onClick={props.onOpenInspiration}
          >
            灵感社
          </button>
        </nav>

        <div className="bookshelf-actions">
          <button type="button" aria-label="搜索">
            ⌕
          </button>
          <button
            type="button"
            aria-label={props.currentTheme === "dark" ? "切换白色主题" : "切换黑色主题"}
            aria-pressed={props.currentTheme === "dark"}
            title={props.currentTheme === "dark" ? "切换白色主题" : "切换黑色主题"}
            onClick={props.onToggleTheme}
          >
            {props.currentTheme === "dark" ? "☾" : "☼"}
          </button>
          <BookshelfUserMenu onOpenSettings={props.onOpenSettings} />
        </div>
      </div>

      <div className="bookshelf-summary" aria-label="页面摘要">
        {props.summaryItems.map(renderSummaryItem)}
      </div>
    </header>
  );
}

// BookshelfUserMenuProps 表示书架头像菜单需要的外部回调。
interface BookshelfUserMenuProps {
  // onOpenSettings 表示用户进入设置中心时执行的回调。
  onOpenSettings: () => void;
}

// BookshelfUserMenu 渲染书架右上角头像和悬浮菜单。
// 参数 props 表示头像菜单需要的外部回调。
function BookshelfUserMenu(props: BookshelfUserMenuProps) {
  return (
    <div className="bookshelf-user-menu">
      <button
        type="button"
        className="bookshelf-avatar"
        aria-haspopup="menu"
        aria-label="作者菜单"
      >
        <span>书</span>
      </button>

      <div className="bookshelf-user-dropdown" role="menu" aria-label="作者菜单">
        <button
          type="button"
          role="menuitem"
          className="bookshelf-user-menu-item"
          onClick={props.onOpenSettings}
        >
          <span aria-hidden="true">⚙</span>
          <span>设置</span>
        </button>
      </div>
    </div>
  );
}

// NovelGridProps 表示小说网格需要展示的数据。
interface NovelGridProps {
  // novels 表示当前书架中的小说列表。
  novels: NovelItem[];
  // onCreateClick 表示点击创建小说入口时执行的回调。
  onCreateClick: () => void;
  // onNovelSelect 表示用户选择某本小说后进入详情页的回调。
  onNovelSelect: (novelId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// NovelGrid 渲染小说卡片网格和新建入口。
// 参数 props 表示小说网格需要展示的数据。
function NovelGrid(props: NovelGridProps) {
  if (props.novels.length === 0) {
    return (
      <div className="bookshelf-empty">
        <CreateBookButton onClick={props.onCreateClick} />
        <p>书架还空着，第一卷可以从这里开始。</p>
      </div>
    );
  }

  return (
    <div className="book-grid">
      {props.novels.map((novel, index) =>
        renderNovelCard(
          novel,
          index,
          props.onNovelSelect,
          props.onUnauthorized,
        ),
      )}
      <CreateBookButton onClick={props.onCreateClick} />
    </div>
  );
}

// NovelCardProps 表示小说卡片需要展示的数据。
interface NovelCardProps {
  // novel 表示当前卡片展示的小说条目。
  novel: NovelItem;
  // index 表示当前小说在列表中的位置。
  index: number;
  // onSelect 表示用户选择当前小说时执行的回调。
  onSelect: (novelId: number) => void;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// NovelCard 渲染单本小说的封面与元信息。
// 参数 props 表示小说卡片需要展示的数据。
function NovelCard(props: NovelCardProps) {
  const tags = splitNovelTags(props.novel.tags);
  const updatedText = formatUpdatedText(props.novel.updated_at);
  const status = normalizeNovelStatus(props.novel.status);

  // handleSelect 处理小说卡片点击。
  function handleSelect() {
    props.onSelect(props.novel.id);
  }

  // handleKeyDown 处理小说卡片键盘选择。
  // 参数 event 表示 React 键盘事件。
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleSelect();
  }

  return (
    <article
      className="book-card"
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
    >
      <BookCover
        novel={props.novel}
        index={props.index}
        onUnauthorized={props.onUnauthorized}
      />

      <div className="book-meta">
        <h2>{props.novel.name}</h2>
        <p>{props.novel.author_name || "未署名作者"}</p>
        <div className="book-status-row">
          <span className={`book-status ${getBookStatusClassName(status)}`}>
            {status}
          </span>
          <span>{updatedText}</span>
        </div>
        {tags.length > 0 ? <TagList tags={tags} /> : null}
      </div>
    </article>
  );
}

// BookCoverProps 表示小说封面需要展示的数据。
interface BookCoverProps {
  // novel 表示当前封面对应的小说条目。
  novel: NovelItem;
  // index 表示当前小说在列表中的位置。
  index: number;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// BookCover 渲染小说封面或无封面时的书卷占位图。
// 参数 props 表示小说封面需要展示的数据。
function BookCover(props: BookCoverProps) {
  const toneClass = getCoverToneClass(props.index);
  const [resolvedCoverURL, setResolvedCoverURL] = useState("");
  const rawCoverURL = normalizeText(props.novel.cover_url);
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
    <div className={`book-cover ${toneClass}`}>
      <div className="book-binding" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      {coverURL ? (
        <img src={coverURL} alt={`${props.novel.name}封面`} />
      ) : (
        <div className="book-cover-placeholder" aria-hidden="true">
          <span>{getCoverInitial(props.novel.name)}</span>
        </div>
      )}
      <div className="book-cover-shade" aria-hidden="true" />
    </div>
  );
}

// TagListProps 表示标签列表需要展示的数据。
interface TagListProps {
  // tags 表示需要展示的小说标签列表。
  tags: string[];
}

// TagList 渲染小说标签列表。
// 参数 props 表示标签列表需要展示的数据。
function TagList(props: TagListProps) {
  return <div className="book-tags">{props.tags.map(renderTag)}</div>;
}

// BookshelfSkeleton 渲染书架加载中的占位内容。
function BookshelfSkeleton() {
  return (
    <div className="book-grid" aria-label="书架加载中">
      {[0, 1, 2].map(renderSkeletonCard)}
    </div>
  );
}

// BookshelfErrorProps 表示书架错误状态需要展示的数据。
interface BookshelfErrorProps {
  // message 表示加载失败时展示的错误提示。
  message: string;
  // onRetry 表示点击重试按钮时执行的回调。
  onRetry: () => void;
}

// BookshelfError 渲染书架加载失败状态。
// 参数 props 表示书架错误状态需要展示的数据。
function BookshelfError(props: BookshelfErrorProps) {
  return (
    <div className="bookshelf-error" role="alert">
      <p>{props.message}</p>
      <button type="button" onClick={props.onRetry}>
        重新加载
      </button>
    </div>
  );
}

// CreateBookButtonProps 表示开启新卷按钮需要的外部回调。
interface CreateBookButtonProps {
  // onClick 表示点击开启新卷按钮时执行的回调。
  onClick: () => void;
}

// CreateBookButton 渲染开启新卷按钮。
// 参数 props 表示开启新卷按钮需要的外部回调。
function CreateBookButton(props: CreateBookButtonProps) {
  return (
    <button
      type="button"
      className="create-book-button"
      aria-label="开启新卷"
      onClick={props.onClick}
    >
      <span className="create-book-symbol" aria-hidden="true">
        ＋
      </span>
      <span className="create-book-text">开启新卷</span>
    </button>
  );
}

// CreateNovelModalProps 表示添加小说弹窗需要的外部状态和回调。
interface CreateNovelModalProps {
  // visible 表示添加小说弹窗是否可见。
  visible: boolean;
  // onCancel 表示取消或关闭添加小说弹窗时执行的回调。
  onCancel: () => void;
  // onCreated 表示小说创建成功后刷新书架的回调。
  onCreated: () => Promise<void>;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// CreateNovelModal 渲染添加小说弹窗和创建表单。
// 参数 props 表示添加小说弹窗需要的外部状态和回调。
function CreateNovelModal(props: CreateNovelModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [uploadedCover, setUploadedCover] = useState<ImageUploadData | null>(
    null,
  );
  const [uploadResetKey, setUploadResetKey] = useState(0);
  const formApiRef = useRef<FormApi<CreateNovelFormValues> | null>(null);

  // handleGetFormApi 保存 Semi 表单 API，供弹窗确认按钮触发表单校验。
  // 参数 formApi 表示 Semi Form 暴露的表单操作对象。
  const handleGetFormApi = useCallback(function handleGetFormApi(
    formApi: FormApi<CreateNovelFormValues>,
  ) {
    formApiRef.current = formApi;
  }, []);

  // resetCreateForm 重置添加小说表单和封面上传状态。
  function resetCreateForm() {
    formApiRef.current?.reset();
    setUploadedCover(null);
    setUploadResetKey((currentKey) => currentKey + 1);
  }

  // handleCancel 处理添加小说弹窗关闭并重置表单。
  function handleCancel() {
    if (submitting || coverUploading) {
      return;
    }

    resetCreateForm();
    props.onCancel();
  }

  // handleCoverUpload 处理封面图片上传。
  // 参数 options 表示 Semi Upload 传入的自定义上传参数。
  const handleCoverUpload = useCallback(
    function handleCoverUpload(options: customRequestArgs) {
      setCoverUploading(true);

      void uploadImage(options.fileInstance, "cover")
        .then(function handleCoverUploaded(data) {
          setUploadedCover(data);
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

  // handleCoverRemove 处理用户移除已上传封面。
  function handleCoverRemove() {
    setUploadedCover(null);
  }

  // handleSubmit 校验添加小说表单并提交创建请求。
  async function handleSubmit() {
    if (coverUploading) {
      Toast.warning("封面正在上传，请稍候");
      return;
    }

    const formApi = formApiRef.current;
    if (!formApi) {
      return;
    }

    let values: CreateNovelFormValues;
    try {
      values = (await formApi.validate()) as CreateNovelFormValues;
    } catch {
      return;
    }

    setSubmitting(true);

    try {
      await createNovel(
        normalizeCreateNovelValues(values, uploadedCover?.object_key ?? ""),
      );
      Toast.success("小说已创建");
      resetCreateForm();
      props.onCancel();
      await props.onCreated();
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        props.onUnauthorized();
        return;
      }

      Toast.error(getErrorMessage(error, "小说创建失败，请稍后再试"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      className="create-novel-modal"
      title="添加小说"
      visible={props.visible}
      width={640}
      okText="创建小说"
      cancelText="取消"
      confirmLoading={submitting || coverUploading}
      maskClosable={!submitting && !coverUploading}
      closable={!submitting && !coverUploading}
      keepDOM
      onOk={handleSubmit}
      onCancel={handleCancel}
    >
      <Form<CreateNovelFormValues>
        className="create-novel-form"
        initValues={emptyCreateNovelFormValues}
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
        </div>
      </Form>
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

// countRecentlyUpdatedNovels 统计最近三十天内更新过的小说数量。
// 参数 novels 表示需要统计的小说列表。
function countRecentlyUpdatedNovels(novels: NovelItem[]): number {
  const now = Date.now();
  const recentThreshold = 30 * 24 * 60 * 60 * 1000;
  let count = 0;

  for (const novel of novels) {
    const updatedAt = new Date(novel.updated_at).getTime();
    if (!Number.isNaN(updatedAt) && now - updatedAt <= recentThreshold) {
      count += 1;
    }
  }

  return count;
}

// renderNovelCard 渲染小说列表中的单个小说卡片。
// 参数 novel 表示当前需要渲染的小说；参数 index 表示小说在列表中的位置；参数 onNovelSelect 表示用户选择小说时执行的回调；参数 onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
function renderNovelCard(
  novel: NovelItem,
  index: number,
  onNovelSelect: (novelId: number) => void,
  onUnauthorized: () => void,
) {
  return (
    <NovelCard
      key={novel.id}
      novel={novel}
      index={index}
      onSelect={onNovelSelect}
      onUnauthorized={onUnauthorized}
    />
  );
}

// renderTag 渲染单个小说标签。
// 参数 tag 表示需要渲染的标签文本。
function renderTag(tag: string) {
  return <span key={tag}>{tag}</span>;
}

// renderSummaryItem 渲染顶部导航在小屏幕下展示的单条摘要。
// 参数 item 表示摘要文本。
function renderSummaryItem(item: string) {
  return <span key={item}>{item}</span>;
}

// renderSkeletonCard 渲染加载占位卡片。
// 参数 index 表示当前占位卡片的位置。
function renderSkeletonCard(index: number) {
  return (
    <article className="book-card book-card-skeleton" key={index}>
      <div className="book-cover" />
      <div className="book-meta">
        <span />
        <span />
        <span />
      </div>
    </article>
  );
}

// getCoverToneClass 根据小说位置选择封面配色。
// 参数 index 表示当前小说在列表中的位置。
function getCoverToneClass(index: number): string {
  return coverToneClasses[index % coverToneClasses.length];
}

// getBookStatusClassName 获取书架卡片状态标签的样式类名。
// 参数 status 表示已经标准化后的小说状态。
function getBookStatusClassName(status: string): string {
  return status === "已完结" ? "book-status-finished" : "book-status-ongoing";
}

// normalizeCreateNovelValues 清理添加小说表单数据。
// 参数 values 表示 Semi 表单校验后返回的原始字段值；参数 coverObjectKey 表示封面图片上传后返回的对象 key。
function normalizeCreateNovelValues(
  values: CreateNovelFormValues,
  coverObjectKey: string,
): NovelCreateParams {
  return {
    name: normalizeText(values.name),
    status: normalizeNovelStatus(values.status),
    author_name: normalizeText(values.author_name),
    description: normalizeText(values.description),
    tags: normalizeNovelTags(values.tags),
    cover_url: normalizeText(coverObjectKey),
  };
}

// validateNovelName 校验小说书名是否填写了非空白内容。
// 参数 value 表示书名输入框当前值。
function validateNovelName(value: unknown): string {
  return normalizeText(value) ? "" : "请输入书名";
}

// getErrorMessage 获取可展示给用户的错误提示。
// 参数 error 表示捕获到的未知错误；参数 fallback 表示兜底错误提示。
function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
