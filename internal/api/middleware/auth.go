package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	bizauth "novels_ai_gen/internal/biz/auth"
)

const bearerPrefix = "Bearer "

// Auth 创建 Bearer token 鉴权中间件。
// 参数 service 表示登录鉴权业务服务。
func Auth(service *bizauth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := parseBearerToken(c.GetHeader("Authorization"))
		if !ok {
			response.Error(c, http.StatusUnauthorized, "请先登录")
			c.Abort()
			return
		}

		if err := service.Verify(token); err != nil {
			if errors.Is(err, bizauth.ErrExpiredToken) {
				response.Error(c, http.StatusUnauthorized, "登录已过期")
				c.Abort()
				return
			}
			response.Error(c, http.StatusUnauthorized, "请先登录")
			c.Abort()
			return
		}

		c.Next()
	}
}

// parseBearerToken 解析 Authorization 请求头中的 Bearer token。
// 参数 header 表示 Authorization 请求头内容。
func parseBearerToken(header string) (string, bool) {
	if !strings.HasPrefix(header, bearerPrefix) {
		return "", false
	}

	token := strings.TrimSpace(strings.TrimPrefix(header, bearerPrefix))
	return token, token != ""
}
