package router

import (
	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	authhandler "novels_ai_gen/internal/api/handler/auth"
	novelhandler "novels_ai_gen/internal/api/handler/novel"
	"novels_ai_gen/internal/api/middleware"
	bizauth "novels_ai_gen/internal/biz/auth"
)

// NewRouter 创建 Gin 路由引擎并注册系统接口。
// 参数 authHandler 表示登录鉴权 HTTP 处理器；参数 novelHandler 表示小说 HTTP 处理器；参数 authService 表示登录鉴权业务服务。
func NewRouter(authHandler *authhandler.Handler, novelHandler *novelhandler.Handler, authService *bizauth.Service) *gin.Engine {
	engine := gin.New()
	engine.Use(gin.Recovery(), middleware.RequestLogger())

	engine.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	api := engine.Group("/api/v1")
	api.POST("/auth/login", authHandler.Login)

	protected := api.Group("")
	protected.Use(middleware.Auth(authService))
	protected.POST("/novels", novelHandler.Create)
	protected.GET("/novels", novelHandler.List)
	protected.GET("/novels/:id", novelHandler.Get)
	protected.PUT("/novels/:id", novelHandler.Update)
	protected.DELETE("/novels/:id", novelHandler.Delete)

	return engine
}
