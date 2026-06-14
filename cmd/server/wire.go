//go:build wireinject

package main

import (
	"github.com/google/wire"
	authhandler "novels_ai_gen/internal/api/handler/auth"
	chapterhandler "novels_ai_gen/internal/api/handler/chapter"
	confighandler "novels_ai_gen/internal/api/handler/config"
	novelhandler "novels_ai_gen/internal/api/handler/novel"
	uploadhandler "novels_ai_gen/internal/api/handler/upload"
	"novels_ai_gen/internal/api/router"
	bizauth "novels_ai_gen/internal/biz/auth"
	bizchapter "novels_ai_gen/internal/biz/chapter"
	biznovel "novels_ai_gen/internal/biz/novel"
	bizupload "novels_ai_gen/internal/biz/upload"
	"novels_ai_gen/internal/bootstrap/config"
	"novels_ai_gen/internal/bootstrap/db"
	"novels_ai_gen/internal/bootstrap/logger"
	datachapter "novels_ai_gen/internal/data/chapter"
	datanovel "novels_ai_gen/internal/data/novel"
	"novels_ai_gen/internal/data/objectstore"
	"novels_ai_gen/internal/server"
)

// initializeApp 使用 Wire 生成应用依赖图。
// 参数 configFile 表示实际配置文件路径。
func initializeApp(configFile string) (*server.App, func(), error) {
	wire.Build(
		config.NewManager,
		config.CurrentConfig,
		logger.Provider,
		db.Provider,
		wire.Bind(new(bizauth.PasswordProvider), new(*config.ConfigManager)),
		bizauth.NewService,
		datanovel.NewRepository,
		wire.Bind(new(biznovel.Repository), new(*datanovel.Repository)),
		biznovel.NewService,
		datachapter.NewRepository,
		wire.Bind(new(bizchapter.Repository), new(*datachapter.Repository)),
		bizchapter.NewService,
		objectstore.NewClient,
		wire.Bind(new(bizupload.ObjectStorage), new(*objectstore.Client)),
		bizupload.NewService,
		authhandler.NewHandler,
		novelhandler.NewHandler,
		chapterhandler.NewHandler,
		uploadhandler.NewHandler,
		confighandler.NewHandler,
		router.NewRouter,
		server.NewHTTPServer,
		server.NewApp,
	)
	return nil, nil, nil
}
