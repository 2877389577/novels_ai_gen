package middleware

import (
	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/requestid"
)

const requestIDHeader = "X-Request-ID"

// RequestID 创建为每次请求生成 RequestID 的中间件。
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		id := requestid.New()
		c.Writer.Header().Set(requestIDHeader, id)
		c.Request = c.Request.WithContext(requestid.WithContext(c.Request.Context(), id))
		c.Next()
	}
}
