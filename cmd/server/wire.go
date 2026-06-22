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
	novelagenthandler "novels_ai_gen/internal/api/handler/novelagent"
	noveloutlinehandler "novels_ai_gen/internal/api/handler/noveloutline"
	novelsummaryhandler "novels_ai_gen/internal/api/handler/novelsummary"
	prompthandler "novels_ai_gen/internal/api/handler/prompt"
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
	biznovelagent "novels_ai_gen/internal/biz/novelagent"
	agenttools "novels_ai_gen/internal/biz/novelagent/tools"
	biznoveloutline "novels_ai_gen/internal/biz/noveloutline"
	biznovelsummary "novels_ai_gen/internal/biz/novelsummary"
	bizprompt "novels_ai_gen/internal/biz/prompt"
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
	datanovelagent "novels_ai_gen/internal/data/novelagent"
	datanoveloutline "novels_ai_gen/internal/data/noveloutline"
	datanovelsummary "novels_ai_gen/internal/data/novelsummary"
	"novels_ai_gen/internal/data/objectstore"
	dataprompt "novels_ai_gen/internal/data/prompt"
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
		wire.Bind(new(agenttools.ChapterReader), new(*datachapter.Repository)),
		bizchapter.NewService,
		datacharacter.NewRepository,
		wire.Bind(new(bizcharacter.Repository), new(*datacharacter.Repository)),
		wire.Bind(new(agenttools.CharacterStore), new(*datacharacter.Repository)),
		bizcharacter.NewService,
		datarelationship.NewRepository,
		wire.Bind(new(bizrelationship.Repository), new(*datarelationship.Repository)),
		wire.Bind(new(agenttools.RelationshipGraphStore), new(*datarelationship.Repository)),
		bizrelationship.NewService,
		dataevent.NewRepository,
		wire.Bind(new(bizevent.Repository), new(*dataevent.Repository)),
		bizevent.NewService,
		dataaiprovider.NewRepository,
		wire.Bind(new(bizaiprovider.Repository), new(*dataaiprovider.Repository)),
		wire.Bind(new(biznovelagent.Repository), new(*dataaiprovider.Repository)),
		bizaiprovider.NewModelClient,
		wire.Bind(new(bizaiprovider.ModelFetcher), new(*bizaiprovider.ModelClient)),
		bizaiprovider.NewService,
		wire.Bind(new(biznovelagent.Cipher), new(*bizaiprovider.Cipher)),
		wire.Bind(new(biznovelagent.PromptProvider), new(*config.ConfigManager)),
		biznovelagent.NewEinoAgentRuntimeFactory,
		wire.Bind(new(biznovelagent.AgentRuntimeFactory), new(*biznovelagent.EinoAgentRuntimeFactory)),
		datanovelagent.NewRepository,
		wire.Bind(new(biznovelagent.MemoryRepository), new(*datanovelagent.Repository)),
		datanovelsummary.NewRepository,
		wire.Bind(new(biznovelsummary.Repository), new(*datanovelsummary.Repository)),
		wire.Bind(new(agenttools.NovelSummaryStore), new(*datanovelsummary.Repository)),
		biznovelsummary.NewService,
		datanoveloutline.NewRepository,
		wire.Bind(new(biznoveloutline.Repository), new(*datanoveloutline.Repository)),
		wire.Bind(new(agenttools.NovelOutlineStore), new(*datanoveloutline.Repository)),
		biznoveloutline.NewService,
		biznovelagent.NewService,
		dataprompt.NewRepository,
		wire.Bind(new(bizprompt.Repository), new(*dataprompt.Repository)),
		wire.Bind(new(bizprompt.PromptTypesProvider), new(*config.ConfigManager)),
		bizprompt.NewService,
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
		novelagenthandler.NewHandler,
		novelsummaryhandler.NewHandler,
		noveloutlinehandler.NewHandler,
		prompthandler.NewHandler,
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
