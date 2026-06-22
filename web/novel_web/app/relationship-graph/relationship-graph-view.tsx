import { getCoverInitial } from "../novel-utils";
import type { CharacterSummaryItem } from "../api";

// CharacterMiniAvatar 渲染左侧角色卡小头像。
// 参数 props 表示需要展示的角色摘要和肖像地址。
export function CharacterMiniAvatar(props: {
  // character 表示需要展示头像的角色卡摘要。
  character: CharacterSummaryItem;
  // portraitURL 表示角色肖像可预览地址。
  portraitURL: string;
}) {
  return (
    <span className="relationship-character-avatar">
      {props.portraitURL ? (
        <img src={props.portraitURL} alt={`${props.character.name}肖像`} />
      ) : (
        <span>{getCoverInitial(props.character.name)}</span>
      )}
    </span>
  );
}

// RelationshipGraphSkeleton 渲染角色关系图加载态。
export function RelationshipGraphSkeleton() {
  return (
    <div className="relationship-graph-skeleton" aria-label="角色关系图加载中">
      <div />
      <div />
    </div>
  );
}
