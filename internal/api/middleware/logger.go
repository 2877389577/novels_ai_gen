package middleware

import (
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestLogger 创建 HTTP 请求日志中间件。
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		duration := time.Since(start)
		attrs := []any{
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"route", c.FullPath(),
			"status", c.Writer.Status(),
			"duration", duration.String(),
			"client_ip", c.ClientIP(),
		}

		if len(c.Errors) > 0 {
			attrs = append(attrs, "errors", c.Errors.String())
		}

		if c.Writer.Status() >= 500 || len(c.Errors) > 0 {
			slog.ErrorContext(c.Request.Context(), "http request failed", attrs...)
			return
		}

		slog.InfoContext(
			c.Request.Context(),
			"http request",
			attrs...,
		)
	}
}
