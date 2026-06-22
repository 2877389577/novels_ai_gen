import { useEffect, useState } from "react";
import {
  UnauthorizedError,
  refreshImagePreview,
  type CharacterSummaryItem,
} from "../api";
import {
  getCoverInitial,
  isPrivateObjectKey,
  normalizeText,
  splitNovelTags,
} from "../novel-utils";

// CharacterCardEmptyProps 表示角色卡空态需要展示的数据。
interface CharacterCardEmptyProps {
  // novelName 表示当前角色卡所属小说名称。
  novelName: string;
  // onCreate 表示进入角色卡创建视图时执行的回调。
  onCreate: () => void;
}

// CharacterCardEmpty 渲染没有角色卡时的空态。
// 参数 props 表示角色卡空态需要展示的数据。
export function CharacterCardEmpty(props: CharacterCardEmptyProps) {
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
export function CreateCharacterCard(props: CreateCharacterCardProps) {
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
export function CharacterCard(props: CharacterCardProps) {
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
export function CharacterPortrait(props: CharacterPortraitProps) {
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

// CharacterTagListProps 表示角色标签列表需要展示的数据。
interface CharacterTagListProps {
  // tags 表示需要展示的角色标签列表。
  tags: string[];
}

// CharacterTagList 渲染角色标签列表。
// 参数 props 表示角色标签列表需要展示的数据。
export function CharacterTagList(props: CharacterTagListProps) {
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
export function CharacterCardSkeleton() {
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
export function CharacterDetailSkeleton() {
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

// getCharacterSummaryText 获取角色卡列表中的摘要文本。
// 参数 character 表示当前需要展示的角色卡摘要。
function getCharacterSummaryText(character: CharacterSummaryItem): string {
  return normalizeText(character.background) || "尚未添加详细设定，仅有名字。";
}
