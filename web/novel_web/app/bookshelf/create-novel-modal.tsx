import { Form } from "@douyinfe/semi-ui-19/lib/es/form";
import type { FormApi } from "@douyinfe/semi-ui-19/lib/es/form";
import Modal from "@douyinfe/semi-ui-19/lib/es/modal";
import Toast from "@douyinfe/semi-ui-19/lib/es/toast";
import Upload from "@douyinfe/semi-ui-19/lib/es/upload";
import type { customRequestArgs } from "@douyinfe/semi-ui-19/lib/es/upload";
import { useCallback, useRef, useState } from "react";

import {
  UnauthorizedError,
  createNovel,
  uploadImage,
  type ImageUploadData,
} from "../api";
import {
  defaultNovelStatus,
  novelStatusOptions,
  novelTagSeparators,
  splitNovelTagInputValue,
} from "../novel-utils";
import {
  getErrorMessage,
  handleCoverAcceptInvalid,
  handleCoverExceed,
  handleCoverSizeError,
  normalizeCreateNovelValues,
  validateNovelName,
} from "./bookshelf-utils";
import type { CreateNovelFormValues } from "./types";

const coverUploadMaxSizeKB = 20 * 1024;

const emptyCreateNovelFormValues: CreateNovelFormValues = {
  name: "",
  status: defaultNovelStatus,
  author_name: "",
  description: "",
  tags: [],
  cover_url: "",
};

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
export function CreateNovelModal(props: CreateNovelModalProps) {
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
