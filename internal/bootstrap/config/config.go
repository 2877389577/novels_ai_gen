package config

import (
	"errors"
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// AppConfig 表示应用启动所需的完整配置。
type AppConfig struct {
	// Server 表示 HTTP 服务相关配置。
	Server ServerConfig `mapstructure:"server"`
	// Database 表示数据库相关配置。
	Database DatabaseConfig `mapstructure:"database"`
	// Logger 表示日志服务相关配置。
	Logger LoggerConfig `mapstructure:"logger"`
	// Auth 表示登录鉴权相关配置。
	Auth AuthConfig `mapstructure:"auth"`
}

// ServerConfig 表示 HTTP 服务监听配置。
type ServerConfig struct {
	// Port 表示 HTTP 服务监听端口。
	Port int `mapstructure:"port"`
	// Host 表示 HTTP 服务监听地址。
	Host string `mapstructure:"host"`
}

// DatabaseConfig 表示应用支持的数据库配置集合。
type DatabaseConfig struct {
	// MySQL 表示 MySQL 数据库连接配置。
	MySQL DatabaseConnectionConfig `mapstructure:"mysql"`
	// Postgres 表示 PostgreSQL 数据库连接配置。
	Postgres DatabaseConnectionConfig `mapstructure:"postgres"`
}

// DatabaseConnectionConfig 表示单个数据库的连接配置。
type DatabaseConnectionConfig struct {
	// Host 表示数据库服务地址。
	Host string `mapstructure:"host"`
	// Port 表示数据库服务端口。
	Port int `mapstructure:"port"`
	// Username 表示数据库登录用户名。
	Username string `mapstructure:"username"`
	// Password 表示数据库登录密码。
	Password string `mapstructure:"password"`
	// DBName 表示需要连接的数据库名称。
	DBName string `mapstructure:"dbname"`
}

// AuthConfig 表示登录鉴权配置。
type AuthConfig struct {
	// Password 表示访问系统资源需要使用的登录密码。
	Password string `mapstructure:"password"`
}

// LoggerConfig 表示日志服务的整体配置。
type LoggerConfig struct {
	// Level 表示日志输出等级，支持 debug、info、warn、error。
	Level string `mapstructure:"level"`
	// Format 表示日志输出格式，支持 text、json。
	Format string `mapstructure:"format"`
	// AddSource 表示是否在日志中记录源码位置。
	AddSource bool `mapstructure:"add_source"`
	// Console 表示控制台日志输出配置。
	Console LoggerConsoleConfig `mapstructure:"console"`
	// File 表示文件日志输出配置。
	File LoggerFileConfig `mapstructure:"file"`
}

// LoggerConsoleConfig 表示控制台日志输出配置。
type LoggerConsoleConfig struct {
	// Enabled 表示是否开启控制台日志输出。
	Enabled bool `mapstructure:"enabled"`
}

// LoggerFileConfig 表示文件日志输出配置。
type LoggerFileConfig struct {
	// Enabled 表示是否开启文件日志输出。
	Enabled bool `mapstructure:"enabled"`
	// Dir 表示日志文件所在目录。
	Dir string `mapstructure:"dir"`
	// Filename 表示日志文件基础名称。
	Filename string `mapstructure:"filename"`
	// Rotation 表示按时间轮转的粒度，支持 daily、hourly、monthly。
	Rotation string `mapstructure:"rotation"`
}

var current *AppConfig

// Init 读取指定配置文件并初始化应用配置。
// 参数 configFile 表示实际配置文件路径，不能为空。
func Init(configFile string) (*AppConfig, error) {
	if strings.TrimSpace(configFile) == "" {
		return nil, errors.New("config file required")
	}

	loader := viper.New()
	loader.SetConfigFile(configFile)
	loader.SetConfigType("yaml")
	loader.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	loader.AutomaticEnv()

	setDefaults(loader)

	if err := loader.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("读取配置文件失败: %w", err)
	}

	var cfg AppConfig
	if err := loader.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}

	current = &cfg
	return current, nil
}

// Get 返回已经初始化的应用配置。
func Get() *AppConfig {
	return current
}

// setDefaults 设置配置文件缺省时使用的默认值。
// 参数 loader 表示承载默认值、配置文件和环境变量的 Viper 实例。
func setDefaults(loader *viper.Viper) {
	loader.SetDefault("server.host", "0.0.0.0")
	loader.SetDefault("server.port", 8080)
	loader.SetDefault("logger.level", "info")
	loader.SetDefault("logger.format", "text")
	loader.SetDefault("logger.add_source", false)
	loader.SetDefault("logger.console.enabled", true)
	loader.SetDefault("logger.file.enabled", false)
	loader.SetDefault("logger.file.dir", "logs")
	loader.SetDefault("logger.file.filename", "app.log")
	loader.SetDefault("logger.file.rotation", "daily")
	loader.SetDefault("auth.password", "admin123")
}

// Load 读取指定路径的应用配置。
// 参数 configFile 表示实际配置文件路径，不能为空。
func Load(configFile string) (*AppConfig, error) {
	return Init(configFile)
}
