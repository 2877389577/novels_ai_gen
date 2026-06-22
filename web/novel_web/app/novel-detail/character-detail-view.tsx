import type { CharacterDetailItem } from "../api";
import { normalizeText, splitNovelTags } from "../novel-utils";
import { CharacterPortrait, CharacterTagList } from "./character-card-list";

// CharacterDetailViewProps 表示角色卡详情展示需要的数据。
interface CharacterDetailViewProps {
  // character 表示当前展示的角色卡详情。
  character: CharacterDetailItem;
  // onUnauthorized 表示登录态失效时通知应用层返回登录页的回调。
  onUnauthorized: () => void;
}

// CharacterDetailView 渲染角色卡详情展示页。
// 参数 props 表示角色卡详情展示需要的数据。
export function CharacterDetailView(props: CharacterDetailViewProps) {
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
