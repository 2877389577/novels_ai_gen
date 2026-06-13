package server

import (
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// App 表示后端应用实例。
type App struct {
	// server 表示 HTTP 服务实例。
	server *http.Server
	// logger 表示结构化日志服务。
	logger *slog.Logger
}

// NewHTTPServer 创建 HTTP 服务实例。
// 参数 cfg 表示应用完整配置；参数 router 表示 Gin 路由引擎。
func NewHTTPServer(cfg *appconfig.AppConfig, router *gin.Engine) *http.Server {
	return &http.Server{
		Addr:    net.JoinHostPort(cfg.Server.Host, strconv.Itoa(cfg.Server.Port)),
		Handler: router,
	}
}

// NewApp 创建后端应用实例。
// 参数 logger 表示结构化日志服务；参数 server 表示 HTTP 服务实例。
func NewApp(logger *slog.Logger, server *http.Server) *App {
	return &App{
		server: server,
		logger: logger,
	}
}

// Run 启动 HTTP 服务。
func (a *App) Run() error {
	a.logger.Info("HTTP 服务启动", "addr", a.server.Addr)
	if err := a.server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("启动 HTTP 服务失败: %w", err)
	}
	return nil
}
