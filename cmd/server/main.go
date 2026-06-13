package main

import (
	"log"
	"log/slog"

	appconfig "novels_ai_gen/internal/bootstrap/config"
	appdb "novels_ai_gen/internal/bootstrap/db"
	applogger "novels_ai_gen/internal/bootstrap/logger"
)

// main 初始化应用配置并启动服务入口。
func main() {
	cfg, err := appconfig.Init(appconfig.DefaultConfigFile)
	if err != nil {
		log.Fatalf("初始化配置失败: %v", err)
	}

	if _, err := applogger.Init(cfg.Logger); err != nil {
		log.Fatalf("初始化日志服务失败: %v", err)
	}
	defer closeLogger()

	if _, err := appdb.Init(cfg.Database); err != nil {
		log.Fatalf("初始化数据库失败: %v", err)
	}
	defer closeDatabase()

	slog.Info("应用初始化完成")
}

// closeLogger 关闭日志服务并记录关闭失败信息。
func closeLogger() {
	if err := applogger.Close(); err != nil {
		log.Printf("关闭日志服务失败: %v", err)
	}
}

// closeDatabase 关闭数据库连接并记录关闭失败信息。
func closeDatabase() {
	if err := appdb.Close(); err != nil {
		log.Printf("关闭数据库失败: %v", err)
	}
}
