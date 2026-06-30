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
  type MouseEvent,
} from "react";

import {
  UnauthorizedError,
  createCharacter,
  deleteCharacter,
  fetchCharacterDetail,
  fetchCharacterList,
  refreshImagePreview,
  updateCharacter,
  uploadImage,
  type CharacterCreateParams,
  type CharacterDetailItem,
  type CharacterSummaryItem,
  type ImageUploadData,
  type NovelItem,
} from "../api";
import {
  formatUpdatedText,
  getCoverInitial,
  isPrivateObjectKey,
  normalizeNovelTags,
  normalizeText,
  novelTagSeparators,
  splitNovelTagInputValue,
  splitNovelTags,
} from "../novel-utils";
import { getErrorMessage } from "./detail-utils";
import {
  CharacterCard,
  CharacterCardEmpty,
  CharacterCardSkeleton,
  CharacterDetailSkeleton,
  CreateCharacterCard,
} from "./character-card-list";
import { CharacterDetailView } from "./character-detail-view";

const coverUploadMaxSizeKB = 20 * 1024;
const characterPageSize = 40;
const characterGenderOptions: Array<{
  // label 表示性别选项展示给用户的文本。
  label: string;
  // value 表示提交给后端的角色性别值。
  value: string;
}> = [
  { label: "男", value: "男" },
  { label: "女", value: "女" },
];

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
export function CharacterCardPanel(props: CharacterCardPanelProps) {
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
          将删除角色“{character?.name || "未命名角色"}
          ”。删除后无法恢复，请确认是否继续。
        </p>
      </Modal>
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
    function handleGetCharacterFormApi(formApi: FormApi<CharacterFormValues>) {
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
                <div
                  className="character-portrait-placeholder"
                  aria-hidden="true"
                >
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
            <Form.Select
              field="gender"
              label="性别"
              placeholder="选择角色性别"
              optionList={characterGenderOptions}
              trigger="change"
              rules={[{ required: true, message: "请选择角色性别" }]}
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
