import type { ChangeEvent, FormEvent } from "react";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";

import { getPromptModalTitle } from "./inspiration-utils";
import type { PromptFormState, PromptModalMode, TypeModalState } from "./types";

// TypeModalProps 表示提示词类型弹窗需要的数据和回调。
interface TypeModalProps {
  // state 表示提示词类型弹窗当前状态。
  state: TypeModalState;
  // submitting 表示类型保存请求是否正在提交。
  submitting: boolean;
  // onCancel 表示取消或关闭类型弹窗时执行的回调。
  onCancel: () => void;
  // onNameChange 表示类型名称输入框变更时执行的回调。
  onNameChange: (event: ChangeEvent<HTMLInputElement>) => void;
  // onSubmit 表示提交类型表单时执行的回调。
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

// TypeModal 渲染提示词类型新增和重命名弹窗。
// 参数 props 表示提示词类型弹窗需要的数据和回调。
export function TypeModal(props: TypeModalProps) {
  return (
    <Modal
      className="inspiration-type-modal"
      footer={null}
      maskClosable={!props.submitting}
      onCancel={props.onCancel}
      title={
        props.state.mode === "create" ? "新增提示词类型" : "重命名提示词类型"
      }
      visible={props.state.visible}
      width={460}
    >
      <form className="inspiration-modal-form" onSubmit={props.onSubmit}>
        <label className="inspiration-form-field">
          <span>类型名称</span>
          <input
            value={props.state.name}
            disabled={props.submitting}
            placeholder="例如：润色、情感、扩写"
            onChange={props.onNameChange}
          />
        </label>
        <div className="inspiration-modal-actions">
          <button
            type="button"
            className="settings-secondary-button"
            disabled={props.submitting}
            onClick={props.onCancel}
          >
            取消
          </button>
          <button
            type="submit"
            className="settings-primary-button"
            disabled={props.submitting}
          >
            {props.submitting ? "保存中..." : "保存"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// PromptModalProps 表示提示词内容弹窗需要的数据和回调。
interface PromptModalProps {
  // visible 表示提示词弹窗是否可见。
  visible: boolean;
  // mode 表示提示词弹窗当前用途。
  mode: PromptModalMode;
  // form 表示提示词弹窗当前表单状态。
  form: PromptFormState;
  // promptTypes 表示可选择的提示词类型列表。
  promptTypes: string[];
  // readonly 表示提示词表单字段是否只读。
  readonly: boolean;
  // detailLoading 表示提示词详情是否正在加载。
  detailLoading: boolean;
  // submitting 表示提示词保存请求是否正在提交。
  submitting: boolean;
  // onCancel 表示取消或关闭提示词弹窗时执行的回调。
  onCancel: () => void;
  // onSubmit 表示提交提示词表单时执行的回调。
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  // onFieldChange 表示提示词表单字段变更时执行的回调。
  onFieldChange: (field: keyof PromptFormState, value: string) => void;
  // onSwitchToEdit 表示从查看模式切换到编辑模式时执行的回调。
  onSwitchToEdit: () => void;
}

// PromptModal 渲染提示词新增、查看和编辑弹窗。
// 参数 props 表示提示词内容弹窗需要的数据和回调。
export function PromptModal(props: PromptModalProps) {
  return (
    <Modal
      className="inspiration-prompt-modal"
      footer={null}
      maskClosable={!props.submitting && !props.detailLoading}
      onCancel={props.onCancel}
      title={getPromptModalTitle(props.mode)}
      visible={props.visible}
      width={760}
    >
      <form
        className="inspiration-modal-form inspiration-prompt-form"
        onSubmit={props.onSubmit}
      >
        {props.detailLoading ? (
          <p className="inspiration-muted">提示词详情加载中...</p>
        ) : (
          <>
            <label className="inspiration-form-field">
              <span>提示词类型</span>
              <select
                value={props.form.promptType}
                disabled={props.readonly || props.submitting}
                onChange={function handlePromptTypeChange(event) {
                  props.onFieldChange("promptType", event.target.value);
                }}
              >
                {props.promptTypes.map((promptType) => (
                  <option key={promptType} value={promptType}>
                    {promptType}
                  </option>
                ))}
              </select>
            </label>
            <label className="inspiration-form-field">
              <span>提示词简介</span>
              <textarea
                value={props.form.description}
                disabled={props.readonly || props.submitting}
                rows={3}
                placeholder="简短说明这个提示词适合什么场景"
                onChange={function handleDescriptionChange(event) {
                  props.onFieldChange("description", event.target.value);
                }}
              />
            </label>
            <label className="inspiration-form-field">
              <span>提示词正文</span>
              <textarea
                value={props.form.content}
                disabled={props.readonly || props.submitting}
                rows={12}
                placeholder="输入完整提示词正文"
                onChange={function handleContentChange(event) {
                  props.onFieldChange("content", event.target.value);
                }}
              />
            </label>
          </>
        )}

        <div className="inspiration-modal-actions">
          <button
            type="button"
            className="settings-secondary-button"
            disabled={props.submitting}
            onClick={props.onCancel}
          >
            {props.mode === "view" ? "关闭" : "取消"}
          </button>
          {props.mode === "view" ? (
            <button
              type="button"
              className="settings-primary-button"
              disabled={props.detailLoading}
              onClick={props.onSwitchToEdit}
            >
              编辑
            </button>
          ) : (
            <button
              type="submit"
              className="settings-primary-button"
              disabled={props.submitting || props.detailLoading}
            >
              {props.submitting ? "保存中..." : "保存"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
