package router

import (
	"io/fs"
	"net/http"
	"path"
	"strings"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
	authhandler "novels_ai_gen/internal/api/handler/auth"
	chapterhandler "novels_ai_gen/internal/api/handler/chapter"
	confighandler "novels_ai_gen/internal/api/handler/config"
	novelhandler "novels_ai_gen/internal/api/handler/novel"
	uploadhandler "novels_ai_gen/internal/api/handler/upload"
	"novels_ai_gen/internal/api/middleware"
	bizauth "novels_ai_gen/internal/biz/auth"
	frontend "novels_ai_gen/internal/web"
)

const indexHTML = "index.html"

// NewRouter 创建 Gin 路由引擎并注册系统接口。
// 参数 authHandler 表示登录鉴权 HTTP 处理器；参数 novelHandler 表示小说 HTTP 处理器；参数 chapterHandler 表示章节 HTTP 处理器；参数 uploadHandler 表示图片上传 HTTP 处理器；参数 configHandler 表示配置文件管理 HTTP 处理器；参数 authService 表示登录鉴权业务服务。
func NewRouter(authHandler *authhandler.Handler, novelHandler *novelhandler.Handler, chapterHandler *chapterhandler.Handler, uploadHandler *uploadhandler.Handler, configHandler *confighandler.Handler, authService *bizauth.Service) *gin.Engine {
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
	protected.GET("/novels/:id/next-chapter-number", chapterHandler.NextChapterNumber)
	protected.GET("/novels/:id/word-count", chapterHandler.WordCount)
	protected.POST("/novels/:id/chapters", chapterHandler.Create)
	protected.GET("/novels/:id/chapters", chapterHandler.List)
	protected.GET("/novels/:id/chapters/:chapter_id", chapterHandler.Get)
	protected.PUT("/novels/:id/chapters/:chapter_id", chapterHandler.Update)
	protected.DELETE("/novels/:id/chapters/:chapter_id", chapterHandler.Delete)
	protected.POST("/uploads/images", uploadHandler.UploadImage)
	protected.GET("/uploads/preview", uploadHandler.Preview)
	protected.GET("/config/file", configHandler.GetFile)
	protected.PUT("/config/file", configHandler.UpdateFile)

	registerFrontendRoutes(engine, frontend.FS())

	return engine
}

// registerFrontendRoutes 注册嵌入式前端静态文件路由。
// 参数 engine 表示 Gin 路由引擎；参数 frontendFS 表示前端构建产物文件系统。
func registerFrontendRoutes(engine *gin.Engine, frontendFS fs.FS) {
	fileServer := http.FileServer(http.FS(frontendFS))

	engine.NoRoute(func(c *gin.Context) {
		serveFrontend(c, frontendFS, fileServer)
	})
}

// serveFrontend 响应前端静态文件或单页应用入口文件。
// 参数 c 表示 Gin 请求上下文；参数 frontendFS 表示前端构建产物文件系统；参数 fileServer 表示静态文件服务处理器。
func serveFrontend(c *gin.Context, frontendFS fs.FS, fileServer http.Handler) {
	if shouldSkipFrontendFallback(c.Request.URL.Path) || !isFrontendMethod(c.Request.Method) {
		c.Status(http.StatusNotFound)
		return
	}

	fileName := frontendFileName(c.Request.URL.Path)
	if fileName != "" && frontendFileExists(frontendFS, fileName) {
		fileServer.ServeHTTP(c.Writer, c.Request)
		return
	}

	serveFrontendIndex(c, frontendFS)
}

// shouldSkipFrontendFallback 判断请求路径是否应跳过前端单页应用兜底。
// 参数 requestPath 表示 HTTP 请求路径。
func shouldSkipFrontendFallback(requestPath string) bool {
	return requestPath == "/api" ||
		strings.HasPrefix(requestPath, "/api/") ||
		requestPath == "/swagger" ||
		strings.HasPrefix(requestPath, "/swagger/")
}

// isFrontendMethod 判断请求方法是否适合返回前端页面或静态文件。
// 参数 method 表示 HTTP 请求方法。
func isFrontendMethod(method string) bool {
	return method == http.MethodGet || method == http.MethodHead
}

// frontendFileName 将请求路径转换为前端构建产物中的文件名。
// 参数 requestPath 表示 HTTP 请求路径。
func frontendFileName(requestPath string) string {
	cleanPath := path.Clean("/" + requestPath)
	fileName := strings.TrimPrefix(cleanPath, "/")
	if fileName == "." {
		return ""
	}
	return fileName
}

// frontendFileExists 判断前端构建产物中是否存在指定文件。
// 参数 frontendFS 表示前端构建产物文件系统；参数 fileName 表示需要检查的文件名。
func frontendFileExists(frontendFS fs.FS, fileName string) bool {
	info, err := fs.Stat(frontendFS, fileName)
	return err == nil && !info.IsDir()
}

// serveFrontendIndex 返回前端单页应用入口文件。
// 参数 c 表示 Gin 请求上下文；参数 frontendFS 表示前端构建产物文件系统。
func serveFrontendIndex(c *gin.Context, frontendFS fs.FS) {
	data, err := fs.ReadFile(frontendFS, indexHTML)
	if err != nil {
		c.Status(http.StatusInternalServerError)
		return
	}

	c.Data(http.StatusOK, "text/html; charset=utf-8", data)
}
