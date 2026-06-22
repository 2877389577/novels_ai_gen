import { Form } from "@douyinfe/semi-ui-19/lib/es/form";
import type { FormApi } from "@douyinfe/semi-ui-19/lib/es/form";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import Upload from "@douyinfe/semi-ui-19/lib/es/upload";
import type { customRequestArgs } from "@douyinfe/semi-ui-19/lib/es/upload";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  UnauthorizedError,
  deleteNovel,
  refreshImagePreview,
  updateNovel,
  uploadImage,
  type ImageUploadData,
  type NovelItem,
  type NovelUpdateParams,
} from "../api";
import {
  defaultNovelStatus,
  isPrivateObjectKey,
  normalizeNovelStatus,
  normalizeNovelTags,
  normalizeText,
  novelStatusOptions,
  novelTagSeparators,
  splitNovelTagInputValue,
  splitNovelTags,
} from "../novel-utils";
import { getErrorMessage } from "./detail-utils";
import type { EditNovelFormValues } from "./types";

const coverUploadMaxSizeKB = 20 * 1024;

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
export function EditNovelModal(props: EditNovelModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [coverValue, setCoverValue] = useState(
    normalizeText(props.novel.cover_url),
  );
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
export function DeleteNovelConfirmModal(props: DeleteNovelConfirmModalProps) {
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
      <p>将删除《{props.novel.name}》。删除后无法恢复，请确认是否继续。</p>
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
