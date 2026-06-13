package main

import (
	"flag"
	"log"
	"strings"

	_ "novels_ai_gen/docs"
)

// @title 小说创作应用 API
// @version 1.0
// @description 小说创作应用后端接口文档。
// @BasePath /api/v1
// @schemes http https
// @securityDefinitions.apikey Bearer
// @in header
// @name Authorization
// @description 输入 Bearer token，例如：Bearer <token>

// main 初始化并启动小说创作应用后端服务。
func main() {
	configFile := parseConfigFileFlag()

	app, cleanup, err := initializeApp(configFile)
	if err != nil {
		log.Fatalf("初始化应用失败: %v", err)
	}
	if cleanup != nil {
		defer cleanup()
	}

	if err := app.Run(); err != nil {
		log.Fatalf("启动应用失败: %v", err)
	}
}

// parseConfigFileFlag 解析启动命令中的配置文件路径参数。
func parseConfigFileFlag() string {
	configFile := flag.String("f", "", "实际配置文件路径")
	flag.Parse()

	if strings.TrimSpace(*configFile) == "" {
		log.Fatal("请通过 -f 指定实际配置文件，例如：go run ./cmd/server -f ./config/local.yaml")
	}

	return *configFile
}
