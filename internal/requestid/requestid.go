package requestid

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"
)

// contextKey 表示 RequestID 在 context 中使用的私有键类型。
type contextKey struct{}

// New 生成用于追踪单次 HTTP 请求的 RequestID。
func New() string {
	var buf [16]byte
	if _, err := rand.Read(buf[:]); err == nil {
		return hex.EncodeToString(buf[:])
	}

	var fallback [16]byte
	now := time.Now().UnixNano()
	for i := range fallback {
		fallback[i] = byte(now >> (i % 8 * 8))
	}
	return hex.EncodeToString(fallback[:])
}

// WithContext 将 RequestID 写入请求上下文。
// 参数 ctx 表示原始请求上下文；参数 id 表示本次请求的追踪标识。
func WithContext(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, contextKey{}, id)
}

// FromContext 从请求上下文中读取 RequestID。
// 参数 ctx 表示需要读取追踪标识的请求上下文。
func FromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}

	id, _ := ctx.Value(contextKey{}).(string)
	return id
}
