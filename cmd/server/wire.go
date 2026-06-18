//go:build wireinject

package main

import (
	"github.com/google/wire"
	aiproviderhandler "novels_ai_gen/internal/api/handler/aiprovider"
	authhandler "novels_ai_gen/internal/api/handler/auth"
	chapterhandler "novels_ai_gen/internal/api/handler/chapter"
	characterhandler "novels_ai_gen/internal/api/handler/character"
	confighandler "novels_ai_gen/internal/api/handler/config"
	eventhandler "novels_ai_gen/internal/api/handler/event"
	loghandler "novels_ai_gen/internal/api/handler/log"
	novelhandler "novels_ai_gen/internal/api/handler/novel"
	relationshiphandler "novels_ai_gen/internal/api/handler/relationship"
	systemhandler "novels_ai_gen/internal/api/handler/system"
	uploadhandler "novels_ai_gen/internal/api/handler/upload"
	"novels_ai_gen/internal/api/router"
	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"
	bizauth "novels_ai_gen/internal/biz/auth"
	bizchapter "novels_ai_gen/internal/biz/chapter"
	bizcharacter "novels_ai_gen/internal/biz/character"
	bizevent "novels_ai_gen/internal/biz/event"
	biznovel "novels_ai_gen/internal/biz/novel"
	bizrelationship "novels_ai_gen/internal/biz/relationship"
	bizsystem "novels_ai_gen/internal/biz/system"
	bizupload "novels_ai_gen/internal/biz/upload"
	"novels_ai_gen/internal/bootstrap/config"
	"novels_ai_gen/internal/bootstrap/db"
	"novels_ai_gen/internal/bootstrap/logger"
	dataaiprovider "novels_ai_gen/internal/data/aiprovider"
	datachapter "novels_ai_gen/internal/data/chapter"
	datacharacter "novels_ai_gen/internal/data/character"
	dataevent "novels_ai_gen/internal/data/event"
	datanovel "novels_ai_gen/internal/data/novel"
	"novels_ai_gen/internal/data/objectstore"
	datarelationship "novels_ai_gen/internal/data/relationship"
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
		bizaiprovider.NewCipher,
		datanovel.NewRepository,
		wire.Bind(new(biznovel.Repository), new(*datanovel.Repository)),
		biznovel.NewService,
		datachapter.NewRepository,
		wire.Bind(new(bizchapter.Repository), new(*datachapter.Repository)),
		bizchapter.NewService,
		datacharacter.NewRepository,
		wire.Bind(new(bizcharacter.Repository), new(*datacharacter.Repository)),
		bizcharacter.NewService,
		datarelationship.NewRepository,
		wire.Bind(new(bizrelationship.Repository), new(*datarelationship.Repository)),
		bizrelationship.NewService,
		dataevent.NewRepository,
		wire.Bind(new(bizevent.Repository), new(*dataevent.Repository)),
		bizevent.NewService,
		dataaiprovider.NewRepository,
		wire.Bind(new(bizaiprovider.Repository), new(*dataaiprovider.Repository)),
		bizaiprovider.NewModelClient,
		wire.Bind(new(bizaiprovider.ModelFetcher), new(*bizaiprovider.ModelClient)),
		bizaiprovider.NewService,
		objectstore.NewClient,
		wire.Bind(new(bizupload.ObjectStorage), new(*objectstore.Client)),
		bizupload.NewService,
		authhandler.NewHandler,
		novelhandler.NewHandler,
		chapterhandler.NewHandler,
		characterhandler.NewHandler,
		relationshiphandler.NewHandler,
		eventhandler.NewHandler,
		aiproviderhandler.NewHandler,
		uploadhandler.NewHandler,
		confighandler.NewHandler,
		loghandler.NewHandler,
		bizsystem.NewService,
		systemhandler.NewHandler,
		router.NewRouter,
		server.NewHTTPServer,
		server.NewApp,
	)
	return nil, nil, nil
}
