import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import { useEffect, useState } from "react";

import {
  UnauthorizedError,
  refreshImagePreview,
  type CharacterSummaryItem,
  type EventParticipantItem,
  type NovelEventItem,
} from "../api";
import {
  formatUpdatedText,
  getCoverInitial,
  isPrivateObjectKey,
  normalizeText,
  splitNovelTags,
} from "../novel-utils";
import type { EventDrawerMode, EventFormValues } from "./types";

// EventDrawerProps 表示事件右侧抽屉需要的数据。
interface EventDrawerProps {
  // mode 表示抽屉当前模式。
  mode: EventDrawerMode;
  // event 表示当前查看或编辑的事件数据。
  event: NovelEventItem | null;
  // characters 表示当前小说的角色卡列表。
  characters: CharacterSummaryItem[];
  // characterPortraitURLs 表示角色卡 ID 到肖像预览地址的映射。
  characterPortraitURLs: Record<number, string>;
  // formValues 表示事件表单值。
  formValues: EventFormValues;
  // detailLoading 表示事件详情是否正在加载。
  detailLoading: boolean;
  // submitting 表示事件表单是否正在提交。
  submitting: boolean;
  // onCancel 表示关闭抽屉时执行的回调。
  onCancel: () => void;
  // onEdit 表示切换到编辑模式时执行的回调。
  onEdit?: () => void;
  // onDelete 表示删除当前事件时执行的回调。
  onDelete?: () => void;
  // onSubmit 表示提交事件表单时执行的回调。
  onSubmit: () => void;
  // onChangeField 表示事件文本字段变化时执行的回调。
  onChangeField: (
    field: Exclude<keyof EventFormValues, "participant_ids">,
    value: string,
  ) => void;
  // onToggleParticipant 表示切换事件参与者选中状态时执行的回调。
  onToggleParticipant: (characterId: number) => void;
}

// EventDrawer 渲染事件新增、详情和编辑抽屉。
// 参数 props 表示事件右侧抽屉需要的数据。
export function EventDrawer(props: EventDrawerProps) {
  const isFormMode = props.mode === "create" || props.mode === "edit";
  const title =
    props.mode === "create"
      ? "新增事件"
      : props.mode === "edit"
        ? "编辑事件"
        : "事件详情";

  return (
    <div
      className="event-drawer-mask"
      role="presentation"
      onClick={props.onCancel}
    >
      <aside
        className={
          isFormMode ? "event-drawer event-drawer-form" : "event-drawer"
        }
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="event-drawer-header">
          <div>
            <span>
              {props.mode === "create" ? "Event Draft" : "Event Detail"}
            </span>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={props.onCancel}>
            ×
          </button>
        </div>

        {props.detailLoading ? (
          <div className="event-drawer-loading">加载中...</div>
        ) : isFormMode ? (
          <EventForm
            characters={props.characters}
            characterPortraitURLs={props.characterPortraitURLs}
            formValues={props.formValues}
            submitting={props.submitting}
            onChangeField={props.onChangeField}
            onToggleParticipant={props.onToggleParticipant}
          />
        ) : props.event ? (
          <EventDetail event={props.event} />
        ) : (
          <div className="event-drawer-loading">暂无事件数据</div>
        )}

        <div className="event-drawer-footer">
          {props.mode === "view" ? (
            <>
              <button type="button" onClick={props.onCancel}>
                关闭
              </button>
              <button type="button" onClick={props.onDelete}>
                删除事件
              </button>
              <button type="button" onClick={props.onEdit}>
                编辑事件
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={props.submitting}
                onClick={props.onCancel}
              >
                取消
              </button>
              <button
                type="button"
                disabled={props.submitting}
                onClick={props.onSubmit}
              >
                {props.submitting ? "保存中..." : "保存事件"}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

// EventFormProps 表示事件表单需要的数据。
interface EventFormProps {
  // characters 表示当前小说角色卡列表。
  characters: CharacterSummaryItem[];
  // characterPortraitURLs 表示角色卡 ID 到肖像预览地址的映射。
  characterPortraitURLs: Record<number, string>;
  // formValues 表示事件表单值。
  formValues: EventFormValues;
  // submitting 表示表单是否正在提交。
  submitting: boolean;
  // onChangeField 表示事件文本字段变化时执行的回调。
  onChangeField: (
    field: Exclude<keyof EventFormValues, "participant_ids">,
    value: string,
  ) => void;
  // onToggleParticipant 表示切换事件参与者选中状态时执行的回调。
  onToggleParticipant: (characterId: number) => void;
}

// EventForm 渲染事件新增和编辑表单。
// 参数 props 表示事件表单需要的数据。
function EventForm(props: EventFormProps) {
  const selectedParticipantIds = new Set(props.formValues.participant_ids);
  const selectedCharacters: CharacterSummaryItem[] = [];

  for (const character of props.characters) {
    if (selectedParticipantIds.has(character.id)) {
      selectedCharacters.push(character);
    }
  }

  return (
    <div className="event-form event-form-template">
      <header className="event-detail-hero event-form-hero">
        <div className="event-detail-title-wrap event-form-title-wrap">
          <input
            className="event-form-title-input"
            value={props.formValues.name}
            disabled={props.submitting}
            placeholder="填写事件名称"
            aria-label="事件名称"
            onChange={(event) =>
              props.onChangeField("name", event.target.value)
            }
          />
          <span className="event-detail-seal" aria-hidden="true">
            事件
          </span>
        </div>
        <label
          className="event-detail-meta event-form-location"
          aria-label="事件地点"
        >
          <input
            value={props.formValues.location}
            disabled={props.submitting}
            placeholder="填写事件地点"
            aria-label="地点"
            onChange={(event) =>
              props.onChangeField("location", event.target.value)
            }
          />
        </label>
        <div className="event-detail-divider" />
      </header>
      <div className="event-detail-layout event-form-layout">
        <article>
          <EventTextArea
            field="cause"
            label="起因"
            value={props.formValues.cause}
            disabled={props.submitting}
            onChange={props.onChangeField}
          />
          <EventTextArea
            field="process"
            label="经过"
            value={props.formValues.process}
            disabled={props.submitting}
            onChange={props.onChangeField}
          />
          <EventTextArea
            field="result"
            label="结果"
            value={props.formValues.result}
            disabled={props.submitting}
            onChange={props.onChangeField}
          />
          <EventTextArea
            field="impact"
            label="造成的影响"
            value={props.formValues.impact}
            disabled={props.submitting}
            onChange={props.onChangeField}
          />
        </article>
        <aside>
          <h2 className="event-detail-sidebar-title">参与者</h2>
          <div className="event-form-participant-stack">
            <section
              className="event-selected-participant-panel"
              aria-label="已选事件参与者"
            >
              <h3 className="event-participant-section-title">已选参与者</h3>
              <div className="event-selected-participant-list">
                {selectedCharacters.length > 0 ? (
                  selectedCharacters.map((character) => (
                    <button
                      type="button"
                      className="event-selected-participant-card"
                      disabled={props.submitting}
                      key={character.id}
                      onClick={() => props.onToggleParticipant(character.id)}
                    >
                      <span className="event-selected-participant-avatar">
                        {props.characterPortraitURLs[character.id] ? (
                          <img
                            src={props.characterPortraitURLs[character.id]}
                            alt={`${character.name}肖像`}
                          />
                        ) : (
                          <span>{getCoverInitial(character.name)}</span>
                        )}
                      </span>
                      <strong>{character.name}</strong>
                    </button>
                  ))
                ) : (
                  <p className="event-participant-picker-empty">暂无参与者</p>
                )}
              </div>
            </section>

            <section
              className="event-participant-catalog"
              aria-label="角色列表"
            >
              <h3 className="event-participant-section-title">角色列表</h3>
              <div
                className="event-participant-picker"
                aria-label="选择事件参与者"
              >
                {props.characters.length > 0 ? (
                  props.characters.map((character) => (
                    <button
                      type="button"
                      aria-pressed={selectedParticipantIds.has(character.id)}
                      className={
                        selectedParticipantIds.has(character.id)
                          ? "event-participant-option event-participant-option-selected"
                          : "event-participant-option"
                      }
                      disabled={props.submitting}
                      key={character.id}
                      onClick={() => props.onToggleParticipant(character.id)}
                    >
                      <span
                        className="event-participant-option-strip"
                        aria-hidden="true"
                      />
                      <span className="event-participant-option-avatar">
                        {props.characterPortraitURLs[character.id] ? (
                          <img
                            src={props.characterPortraitURLs[character.id]}
                            alt={`${character.name}肖像`}
                          />
                        ) : (
                          <span>{getCoverInitial(character.name)}</span>
                        )}
                      </span>
                      <strong>{character.name}</strong>
                    </button>
                  ))
                ) : (
                  <p className="event-participant-picker-empty">暂无角色卡</p>
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}

// EventTextAreaProps 表示事件多行文本输入框需要的数据。
interface EventTextAreaProps {
  // field 表示事件表单字段名。
  field: Exclude<
    keyof EventFormValues,
    "name" | "location" | "participant_ids"
  >;
  // label 表示输入框标签。
  label: string;
  // value 表示输入框当前值。
  value: string;
  // disabled 表示输入框是否禁用。
  disabled: boolean;
  // onChange 表示输入框内容变化时执行的回调。
  onChange: (
    field: Exclude<keyof EventFormValues, "participant_ids">,
    value: string,
  ) => void;
}

// EventTextArea 渲染事件正文多行输入框。
// 参数 props 表示事件多行文本输入框需要的数据。
function EventTextArea(props: EventTextAreaProps) {
  return (
    <label className="event-form-section">
      <span>
        <span className="event-detail-section-marker" aria-hidden="true" />
        {props.label}
      </span>
      <textarea
        value={props.value}
        rows={5}
        disabled={props.disabled}
        placeholder={`填写事件${props.label}`}
        onChange={(event) => props.onChange(props.field, event.target.value)}
      />
    </label>
  );
}

// EventDetailProps 表示事件详情展示需要的数据。
interface EventDetailProps {
  // event 表示需要展示的事件详情。
  event: NovelEventItem;
}

// EventDetail 渲染参考模板结构的事件详情。
// 参数 props 表示事件详情展示需要的数据。
function EventDetail(props: EventDetailProps) {
  return (
    <div className="event-detail-template">
      <header className="event-detail-hero">
        <div className="event-detail-title-wrap">
          <h1>{props.event.name}</h1>
          <span className="event-detail-seal" aria-hidden="true">
            事件
          </span>
        </div>
        <div className="event-detail-meta" aria-label="事件地点">
          <span>
            {props.event.location
              ? `地点：${props.event.location}`
              : "地点未定"}
          </span>
        </div>
        <div className="event-detail-divider" />
      </header>
      <div className="event-detail-layout">
        <article>
          <EventDetailSection title="起因" content={props.event.cause} />
          <EventDetailSection title="经过" content={props.event.process} />
          <EventDetailSection title="结果" content={props.event.result} />
          <EventDetailSection title="造成的影响" content={props.event.impact} />
        </article>
        <aside>
          <h2 className="event-detail-sidebar-title">参与者</h2>
          <div className="event-participant-list">
            {props.event.participants.length > 0 ? (
              props.event.participants.map((participant) => (
                <EventParticipantCard
                  participant={participant}
                  key={participant.id}
                />
              ))
            ) : (
              <p>暂无参与者</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// EventDetailSectionProps 表示事件详情分区需要的数据。
interface EventDetailSectionProps {
  // title 表示分区标题。
  title: string;
  // content 表示分区正文。
  content: string;
}

// EventDetailSection 渲染事件详情正文分区。
// 参数 props 表示事件详情分区需要的数据。
function EventDetailSection(props: EventDetailSectionProps) {
  return (
    <section>
      <h3>
        <span className="event-detail-section-marker" aria-hidden="true" />
        {props.title}
      </h3>
      <p>{normalizeText(props.content) || "尚未记录。"}</p>
    </section>
  );
}

// EventParticipantCardProps 表示事件参与者卡片需要的数据。
interface EventParticipantCardProps {
  // participant 表示事件参与者摘要。
  participant: EventParticipantItem;
}

// EventParticipantCard 渲染只包含姓名、性别、标签的参与者卡片。
// 参数 props 表示事件参与者卡片需要的数据。
function EventParticipantCard(props: EventParticipantCardProps) {
  return (
    <div className="event-participant-card">
      <span className="event-participant-card-strip" aria-hidden="true" />
      <div className="event-participant-card-body">
        <strong>{props.participant.name}</strong>
        <span>{props.participant.gender || "性别未定"}</span>
        <div className="event-participant-card-tags">
          {splitNovelTags(props.participant.tags, 3).map((tag) => (
            <small key={tag}>{tag}</small>
          ))}
        </div>
      </div>
    </div>
  );
}
