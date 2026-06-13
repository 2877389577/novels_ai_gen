//go:build wireinject

package main

import (
	"github.com/google/wire"
	authhandler "novels_ai_gen/internal/api/handler/auth"
	novelhandler "novels_ai_gen/internal/api/handler/novel"
	"novels_ai_gen/internal/api/router"
	bizauth "novels_ai_gen/internal/biz/auth"
	biznovel "novels_ai_gen/internal/biz/novel"
	"novels_ai_gen/internal/bootstrap/config"
	"novels_ai_gen/internal/bootstrap/db"
	"novels_ai_gen/internal/bootstrap/logger"
	datanovel "novels_ai_gen/internal/data/novel"
	"novels_ai_gen/internal/server"
)

// initializeApp 使用 Wire 生成应用依赖图。
// 参数 configFile 表示实际配置文件路径。
func initializeApp(configFile string) (*server.App, func(), error) {
	wire.Build(
		config.Load,
		logger.Provider,
		db.Provider,
		bizauth.NewService,
		datanovel.NewRepository,
		wire.Bind(new(biznovel.Repository), new(*datanovel.Repository)),
		biznovel.NewService,
		authhandler.NewHandler,
		novelhandler.NewHandler,
		router.NewRouter,
		server.NewHTTPServer,
		server.NewApp,
	)
	return nil, nil, nil
}
