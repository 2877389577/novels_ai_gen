package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/requestid"
)

// Body 表示统一 HTTP 响应结构。
type Body struct {
	// Code 表示业务响应码，成功固定为 0，失败使用 HTTP 状态码。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
	// Data 表示响应数据内容。
	Data any `json:"data,omitempty"`
}

// ErrorBody 表示统一错误响应结构。
type ErrorBody struct {
	// Code 表示错误响应码，使用 HTTP 状态码。
	Code int `json:"code" example:"400"`
	// Message 表示用户可理解的错误提示。
	Message string `json:"message" example:"请求参数错误"`
	// RequestID 表示本次请求的追踪标识。
	RequestID string `json:"request_id,omitempty" example:"8f2d6c6d0cf2473e9f8e24d9d0ab3d81"`
}

// OK 写入成功响应。
// 参数 c 表示 Gin 请求上下文；参数 data 表示响应数据内容。
func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Body{
		Code:      0,
		Message:   "ok",
		RequestID: requestid.FromContext(c.Request.Context()),
		Data:      data,
	})
}

// Error 写入失败响应。
// 参数 c 表示 Gin 请求上下文；参数 status 表示 HTTP 状态码；参数 message 表示错误提示。
func Error(c *gin.Context, status int, message string) {
	c.JSON(status, ErrorBody{
		Code:      status,
		Message:   message,
		RequestID: requestid.FromContext(c.Request.Context()),
	})
}
