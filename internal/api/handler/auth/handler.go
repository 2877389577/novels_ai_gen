package auth

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizauth "novels_ai_gen/internal/biz/auth"
)

// Handler 表示登录鉴权 HTTP 处理器。
type Handler struct {
	// service 表示登录鉴权业务服务。
	service *bizauth.Service
}

// LoginRequest 表示 Swagger 文档中的登录请求参数。
type LoginRequest struct {
	// Password 表示系统登录密码。
	Password string `json:"password" binding:"required" example:"admin123"`
}

// LoginData 表示 Swagger 文档中的登录响应数据。
type LoginData struct {
	// Token 表示后续访问系统资源使用的 Bearer 令牌。
	Token string `json:"token" example:"MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA"`
	// TokenType 表示令牌类型，固定为 Bearer。
	TokenType string `json:"token_type" example:"Bearer"`
	// ExpiresAt 表示令牌过期时间。
	ExpiresAt string `json:"expires_at" example:"2026-06-14T22:00:00+08:00"`
}

// ErrorBody 表示 Swagger 文档中的错误响应结构。
type ErrorBody struct {
	// Code 表示错误响应码，使用 HTTP 状态码。
	Code int `json:"code" example:"400"`
	// Message 表示用户可理解的错误提示。
	Message string `json:"message" example:"请求参数错误"`
}

// LoginSuccessResponse 表示登录接口 Swagger 成功响应结构。
type LoginSuccessResponse struct {
	// Code 表示业务响应码，成功固定为 0。
	Code int `json:"code" example:"0"`
	// Message 表示响应提示信息。
	Message string `json:"message" example:"ok"`
	// Data 表示登录成功后的令牌数据。
	Data LoginData `json:"data"`
}

// NewHandler 创建登录鉴权 HTTP 处理器。
// 参数 service 表示登录鉴权业务服务。
func NewHandler(service *bizauth.Service) *Handler {
	return &Handler{service: service}
}

// Login 处理用户登录请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 用户登录
// @Description 使用配置文件中的系统密码登录，成功后返回 Bearer token。
// @Tags auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "登录请求"
// @Success 200 {object} LoginSuccessResponse "登录成功"
// @Failure 400 {object} ErrorBody "请求参数错误"
// @Failure 401 {object} ErrorBody "登录密码错误"
// @Router /auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	var req bizauth.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "请求参数错误")
		return
	}

	data, err := h.service.Login(req)
	if err != nil {
		if errors.Is(err, bizauth.ErrInvalidPassword) {
			response.Error(c, http.StatusUnauthorized, "登录密码错误")
			return
		}
		response.Error(c, http.StatusInternalServerError, "登录失败")
		return
	}

	response.OK(c, data)
}
