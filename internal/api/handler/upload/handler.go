package upload

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizupload "novels_ai_gen/internal/biz/upload"
)

const multipartOverheadBytes = int64(1024 * 1024)

// Handler 表示图片上传 HTTP 处理器。
type Handler struct {
	// service 表示图片上传业务服务。
	service *bizupload.Service
}

// ErrorBody 表示 Swagger 文档中的错误响应结构。
type ErrorBody struct {
	// Code 表示错误响应码，使用 HTTP 状态码。
	Code int `json:"code" example:"400"`
	// Message 表示用户可理解的错误提示。
	Message string `json:"message" example:"请求参数错误"`
}

// UploadImageData 表示 Swagger 文档中的图片上传响应数据。
type UploadImageData struct {
	// ObjectKey 表示图片保存在对象存储中的对象 key。
	ObjectKey string `json:"object_key" example:"covers/2026/06/9f1c1c0a1b2c3d4e.png"`
	// PreviewURL 表示可直接预览私有图片的预签名链接。
	PreviewURL string `json:"preview_url" example:"https://s3.example.com/bucket/covers/2026/06/example.png?X-Amz-Signature=..."`
	// PreviewExpiresAt 表示预签名预览链接过期时间。
	PreviewExpiresAt time.Time `json:"preview_expires_at" example:"2026-06-15T22:00:00+08:00"`
	// ContentType 表示根据文件内容探测出的 MIME 类型。
	ContentType string `json:"content_type" example:"image/png"`
	// Size 表示上传文件大小，单位为字节。
	Size int64 `json:"size" example:"1024"`
	// OriginalFilename 表示用户上传文件的原始文件名。
	OriginalFilename string `json:"original_filename" example:"cover.png"`
}

// PreviewData 表示 Swagger 文档中的图片预览刷新响应数据。
type PreviewData struct {
	// ObjectKey 表示图片保存在对象存储中的对象 key。
	ObjectKey string `json:"object_key" example:"covers/2026/06/9f1c1c0a1b2c3d4e.png"`
	// PreviewURL 表示可直接预览私有图片的预签名链接。
	PreviewURL string `json:"preview_url" example:"https://s3.example.com/bucket/covers/2026/06/example.png?X-Amz-Signature=..."`
	// PreviewExpiresAt 表示预签名预览链接过期时间。
	PreviewExpiresAt time.Time `json:"preview_expires_at" example:"2026-06-15T22:00:00+08:00"`
}

// UploadImageSuccessResponse 表示上传图片接口 Swagger 成功响应结构。
type UploadImageSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// Data 表示图片上传成功后的响应数据。
	Data UploadImageData `json:"data"`
}

// PreviewSuccessResponse 表示刷新图片预览接口 Swagger 成功响应结构。
type PreviewSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// Data 表示刷新预览链接后的响应数据。
	Data PreviewData `json:"data"`
}

// NewHandler 创建图片上传 HTTP 处理器。
// 参数 service 表示图片上传业务服务。
func NewHandler(service *bizupload.Service) *Handler {
	return &Handler{service: service}
}

// UploadImage 处理图片上传请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 上传图片
// @Description 上传小说封面或人物图片到私有对象存储，并返回对象 key 和预签名预览链接。
// @Tags uploads
// @Accept multipart/form-data
// @Produce json
// @Security Bearer
// @Param file formData file true "图片文件"
// @Param usage formData string true "图片用途" Enums(cover,character)
// @Success 200 {object} UploadImageSuccessResponse "上传成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /uploads/images [post]
func (h *Handler) UploadImage(c *gin.Context) {
	if h.service != nil {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, h.service.MaxUploadSizeBytes()+multipartOverheadBytes)
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		if strings.Contains(err.Error(), "request body too large") {
			response.Error(c, http.StatusBadRequest, "图片大小超过限制")
			return
		}
		response.Error(c, http.StatusBadRequest, "请上传图片文件")
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		recordInternalError(c, err)
		response.Error(c, http.StatusInternalServerError, "读取上传图片失败")
		return
	}
	defer file.Close()

	data, err := h.service.UploadImage(c.Request.Context(), bizupload.UploadImageRequest{
		Usage:            c.PostForm("usage"),
		OriginalFilename: fileHeader.Filename,
		Size:             fileHeader.Size,
		Content:          file,
	})
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// Preview 处理刷新图片预览链接请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 刷新图片预览链接
// @Description 根据对象 key 生成新的私有图片预签名预览链接。
// @Tags uploads
// @Accept json
// @Produce json
// @Security Bearer
// @Param object_key query string true "对象 key"
// @Success 200 {object} PreviewSuccessResponse "刷新成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "未登录或登录已过期"
// @Failure 500 {object} ErrorBody "服务器内部错误"
// @Router /uploads/preview [get]
func (h *Handler) Preview(c *gin.Context) {
	data, err := h.service.Preview(c.Request.Context(), bizupload.PreviewRequest{
		ObjectKey: c.Query("object_key"),
	})
	if err != nil {
		writeServiceError(c, err)
		return
	}

	response.OK(c, data)
}

// writeServiceError 将图片上传业务错误转换为 HTTP 响应。
// 参数 c 表示 Gin 请求上下文；参数 err 表示业务层返回的错误。
func writeServiceError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, bizupload.ErrInvalidUsage):
		response.Error(c, http.StatusBadRequest, "图片用途仅支持 cover 或 character")
	case errors.Is(err, bizupload.ErrFileRequired):
		response.Error(c, http.StatusBadRequest, "请上传图片文件")
	case errors.Is(err, bizupload.ErrEmptyFile):
		response.Error(c, http.StatusBadRequest, "图片文件不能为空")
	case errors.Is(err, bizupload.ErrFileTooLarge):
		response.Error(c, http.StatusBadRequest, "图片大小超过限制")
	case errors.Is(err, bizupload.ErrUnsupportedContentType):
		response.Error(c, http.StatusBadRequest, "仅支持 JPEG、PNG、WebP、GIF 图片")
	case errors.Is(err, bizupload.ErrInvalidObjectKey):
		response.Error(c, http.StatusBadRequest, "对象 key 不合法")
	case errors.Is(err, bizupload.ErrStorageUnavailable):
		recordInternalError(c, err)
		response.Error(c, http.StatusInternalServerError, "服务器内部错误")
	default:
		recordInternalError(c, err)
		response.Error(c, http.StatusInternalServerError, "服务器内部错误")
	}
}

// recordInternalError 将内部错误挂到 Gin 上下文，供请求日志中间件统一记录。
// 参数 c 表示 Gin 请求上下文；参数 err 表示需要记录的内部错误。
func recordInternalError(c *gin.Context, err error) {
	if err == nil {
		return
	}
	c.Error(err)
}
