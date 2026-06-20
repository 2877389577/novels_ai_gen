package config

import (
	"bytes"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
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
	// AI 表示 AI 功能相关配置。
	AI AIConfig `mapstructure:"ai"`
	// Storage 表示文件对象存储相关配置。
	Storage StorageConfig `mapstructure:"storage"`
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

// AIConfig 表示 AI 功能相关配置。
type AIConfig struct {
	// ProviderSecretKey 表示 AI 提供商 API Key 应用层加密密钥，可填写任意非空字符串。
	ProviderSecretKey string `mapstructure:"provider_secret_key" json:"provider_secret_key" yaml:"provider_secret_key"`
	// PromptTypes 表示全局提示词类型库，类型名不能为空且不能重复。
	PromptTypes []string `mapstructure:"prompt_types" json:"prompt_types" yaml:"prompt_types"`
	// Agent 表示小说写作多层 Agent 配置。
	Agent AgentConfig `mapstructure:"agent" json:"agent" yaml:"agent"`
}

// AgentConfig 表示小说写作多层 Agent 配置集合。
type AgentConfig struct {
	// Supervisor 表示顶层 Agent 配置。
	Supervisor AgentDefinition `mapstructure:"supervisor" json:"supervisor" yaml:"supervisor"`
	// Agent 表示可被顶层 Agent 当成工具调用的子 Agent 配置列表。
	Agent []AgentDefinition `mapstructure:"agent" json:"agent" yaml:"agent"`
	// Memory 表示小说写作 Agent 的持久记忆配置。
	Memory AgentMemoryConfig `mapstructure:"memory" json:"memory" yaml:"memory"`
}

// AgentMemoryConfig 表示小说写作 Agent 的持久记忆配置。
type AgentMemoryConfig struct {
	// RecentRounds 表示每次请求注入模型上下文的最近对话轮数，小于等于 0 时使用业务默认值。
	RecentRounds int `mapstructure:"recent_rounds" json:"recent_rounds" yaml:"recent_rounds"`
}

// AgentDefinition 表示单个小说写作 Agent 的配置。
type AgentDefinition struct {
	// Name 表示 Eino ADK Agent 名称，子 Agent 会同时作为 tool 名称。
	Name string `mapstructure:"name" json:"name" yaml:"name"`
	// Enabled 表示子 Agent 是否启用，未配置时子 Agent 默认启用，顶层 Agent 忽略该字段。
	Enabled *bool `mapstructure:"enabled" json:"enabled,omitempty" yaml:"enabled,omitempty"`
	// ProviderID 表示该 Agent 自定义使用的 AI 提供商 ID，0 表示继承本次请求的提供商。
	ProviderID uint64 `mapstructure:"provider_id" json:"provider_id" yaml:"provider_id"`
	// Model 表示该 Agent 自定义使用的模型标识，空值表示继承本次请求模型或使用自定义提供商默认模型。
	Model string `mapstructure:"model" json:"model" yaml:"model"`
	// Task 表示子 Agent 产生流式事件时返回给前端的任务标识，顶层 Agent 可留空。
	Task string `mapstructure:"task" json:"task" yaml:"task,omitempty"`
	// Description 表示 Agent 能力描述，供顶层 Agent 判断是否调用该子 Agent。
	Description string `mapstructure:"description" json:"description" yaml:"description"`
	// Instruction 表示 Agent 系统提示词，内容会按原文传给 Eino。
	Instruction string `mapstructure:"instruction" json:"instruction" yaml:"instruction"`
	// MaxIterations 表示 Eino ADK Agent 最大生成循环次数，小于等于 0 时使用业务默认值。
	MaxIterations int `mapstructure:"max_iterations" json:"max_iterations" yaml:"max_iterations,omitempty"`
	// Tools 表示 Agent 可使用的普通工具名称列表，当前仅支持 get_content。
	Tools []string `mapstructure:"tools" json:"tools" yaml:"tools,omitempty"`
	// Parameters 表示子 Agent 作为工具被调用时的入参定义，键为参数名。
	Parameters map[string]AgentParameterDefinition `mapstructure:"parameters" json:"parameters" yaml:"parameters,omitempty"`
}

// AgentParameterDefinition 表示子 Agent 工具参数定义。
type AgentParameterDefinition struct {
	// Type 表示参数类型，支持 string、number、integer、boolean、array、object、null，空值默认 string。
	Type string `mapstructure:"type" json:"type" yaml:"type,omitempty"`
	// Description 表示参数用途说明。
	Description string `mapstructure:"description" json:"description" yaml:"description,omitempty"`
	// Required 表示调用工具时该参数是否必填。
	Required bool `mapstructure:"required" json:"required" yaml:"required,omitempty"`
	// Enum 表示 string 参数允许的枚举值。
	Enum []string `mapstructure:"enum" json:"enum" yaml:"enum,omitempty"`
	// Items 表示 array 参数的元素类型定义。
	Items *AgentParameterDefinition `mapstructure:"items" json:"items" yaml:"items,omitempty"`
	// Properties 表示 object 参数的子参数定义，键为子参数名。
	Properties map[string]AgentParameterDefinition `mapstructure:"properties" json:"properties" yaml:"properties,omitempty"`
}

// StorageConfig 表示文件对象存储配置集合。
type StorageConfig struct {
	// S3 表示 S3 兼容对象存储配置。
	S3 S3Config `mapstructure:"s3"`
}

// S3Config 表示 S3 兼容对象存储连接与上传限制配置。
type S3Config struct {
	// Endpoint 表示对象存储服务地址，不包含 bucket 名称。
	Endpoint string `mapstructure:"endpoint"`
	// AccessKey 表示服务端访问对象存储使用的访问密钥 ID。
	AccessKey string `mapstructure:"access_key"`
	// SecretKey 表示服务端访问对象存储使用的访问密钥 Secret。
	SecretKey string `mapstructure:"secret_key"`
	// Bucket 表示图片对象保存的 bucket 名称。
	Bucket string `mapstructure:"bucket"`
	// Region 表示对象存储 bucket 所在区域，可以为空。
	Region string `mapstructure:"region"`
	// UseSSL 表示连接对象存储时是否使用 HTTPS。
	UseSSL bool `mapstructure:"use_ssl"`
	// BucketLookup 表示 bucket 寻址方式，支持 auto、dns、path。
	BucketLookup string `mapstructure:"bucket_lookup"`
	// PreviewExpire 表示预签名预览链接有效期。
	PreviewExpire time.Duration `mapstructure:"preview_expire"`
	// MaxUploadSizeMB 表示单个图片允许上传的最大大小，单位为 MB。
	MaxUploadSizeMB int64 `mapstructure:"max_upload_size_mb"`
	// CoverPrefix 表示小说封面图片对象 key 的前缀。
	CoverPrefix string `mapstructure:"cover_prefix"`
	// CharacterPrefix 表示人物图片对象 key 的前缀。
	CharacterPrefix string `mapstructure:"character_prefix"`
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

var (
	current   *AppConfig
	currentMu sync.RWMutex
)

var (
	// ErrConfigContentRequired 表示配置文件内容不能为空。
	ErrConfigContentRequired = errors.New("config content required")
	// ErrInvalidConfigContent 表示配置文件内容无法解析为有效应用配置。
	ErrInvalidConfigContent = errors.New("invalid config content")
	// ErrPromptTypeNameRequired 表示提示词类型名称不能为空。
	ErrPromptTypeNameRequired = errors.New("prompt type name required")
	// ErrPromptTypeConflict 表示提示词类型名称重复。
	ErrPromptTypeConflict = errors.New("prompt type conflict")
	// ErrPromptTypeNotFound 表示提示词类型不存在。
	ErrPromptTypeNotFound = errors.New("prompt type not found")
)

// ConfigManager 表示运行期间共享的配置文件管理器。
type ConfigManager struct {
	// configFile 表示启动 -f 参数指定的实际配置文件绝对路径。
	configFile string
	// cfg 表示最近一次成功加载后的应用配置。
	cfg *AppConfig
	// reloadedAt 表示最近一次成功加载配置的时间。
	reloadedAt time.Time
	// watcher 表示监听配置文件变更的 fsnotify 监听器。
	watcher *fsnotify.Watcher
	// done 表示停止配置文件监听协程的信号。
	done chan struct{}
	// fileMu 表示保护配置文件读写和磁盘重载的互斥锁。
	fileMu sync.Mutex
	// mu 表示保护当前有效配置快照的读写锁。
	mu sync.RWMutex
}

// FileSnapshot 表示配置文件文本和加载状态快照。
type FileSnapshot struct {
	// ConfigFile 表示启动 -f 参数指定的实际配置文件绝对路径。
	ConfigFile string
	// Content 表示配置文件当前文本内容。
	Content string
	// ModifiedAt 表示配置文件在文件系统中的最后修改时间。
	ModifiedAt time.Time
	// ReloadedAt 表示后端最近一次成功加载该配置文件的时间。
	ReloadedAt time.Time
}

// NewManager 创建运行时配置文件管理器并启动热更新监听。
// 参数 configFile 表示实际配置文件路径，不能为空。
func NewManager(configFile string) (*ConfigManager, func(), error) {
	absFile, err := absoluteConfigFile(configFile)
	if err != nil {
		return nil, nil, err
	}

	cfg, err := loadConfigFile(absFile)
	if err != nil {
		return nil, nil, err
	}

	manager := &ConfigManager{
		configFile: absFile,
		cfg:        cfg,
		reloadedAt: time.Now(),
		done:       make(chan struct{}),
	}
	setCurrent(cfg)

	if err := manager.startWatcher(); err != nil {
		return nil, nil, err
	}

	return manager, manager.CloseWithLog, nil
}

// CurrentConfig 返回启动期间其它服务使用的配置快照。
// 参数 manager 表示运行时配置文件管理器。
func CurrentConfig(manager *ConfigManager) *AppConfig {
	if manager == nil {
		return Get()
	}
	return manager.Current()
}

// Current 返回最近一次成功加载的应用配置副本。
func (m *ConfigManager) Current() *AppConfig {
	if m == nil {
		return nil
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.cfg == nil {
		return nil
	}
	cfg := *m.cfg
	return &cfg
}

// AuthPassword 返回当前有效配置中的系统登录密码。
func (m *ConfigManager) AuthPassword() string {
	cfg := m.Current()
	if cfg == nil {
		return ""
	}
	return cfg.Auth.Password
}

// ReadFile 读取当前启动配置文件的文本内容。
func (m *ConfigManager) ReadFile() (FileSnapshot, error) {
	if m == nil {
		return FileSnapshot{}, errors.New("配置管理器未初始化")
	}

	m.fileMu.Lock()
	defer m.fileMu.Unlock()

	return m.readFileLocked()
}

// UpdateFile 校验并保存新的配置文件文本，成功后更新运行时配置快照。
// 参数 content 表示需要写入配置文件的完整 YAML 文本。
func (m *ConfigManager) UpdateFile(content string) (FileSnapshot, error) {
	if m == nil {
		return FileSnapshot{}, errors.New("配置管理器未初始化")
	}
	if strings.TrimSpace(content) == "" {
		return FileSnapshot{}, ErrConfigContentRequired
	}

	cfg, err := parseConfigContent(content)
	if err != nil {
		return FileSnapshot{}, err
	}

	m.fileMu.Lock()
	defer m.fileMu.Unlock()

	return m.writeParsedConfigLocked(content, cfg)
}

// ReloadFromDisk 从磁盘重新读取配置文件，成功后更新运行时配置快照。
func (m *ConfigManager) ReloadFromDisk() error {
	if m == nil {
		return errors.New("配置管理器未初始化")
	}

	m.fileMu.Lock()
	defer m.fileMu.Unlock()

	cfg, err := loadConfigFile(m.configFile)
	if err != nil {
		return err
	}

	m.apply(cfg, time.Now())
	return nil
}

// CloseWithLog 关闭配置文件监听器，并记录关闭失败信息。
func (m *ConfigManager) CloseWithLog() {
	if err := m.Close(); err != nil {
		slog.Error("关闭配置文件监听器失败", "error", err)
	}
}

// Close 关闭配置文件热更新监听器。
func (m *ConfigManager) Close() error {
	if m == nil {
		return nil
	}

	select {
	case <-m.done:
	default:
		close(m.done)
	}
	if m.watcher == nil {
		return nil
	}
	return m.watcher.Close()
}

// apply 将新配置设置为当前有效配置。
// 参数 cfg 表示已经成功解析的配置；参数 reloadedAt 表示本次加载完成时间。
func (m *ConfigManager) apply(cfg *AppConfig, reloadedAt time.Time) {
	m.mu.Lock()
	m.cfg = cfg
	m.reloadedAt = reloadedAt
	m.mu.Unlock()

	setCurrent(cfg)
}

// readFileLocked 在持有文件锁时读取配置文件快照。
func (m *ConfigManager) readFileLocked() (FileSnapshot, error) {
	data, err := os.ReadFile(m.configFile)
	if err != nil {
		return FileSnapshot{}, fmt.Errorf("读取配置文件失败: %w", err)
	}

	info, err := os.Stat(m.configFile)
	if err != nil {
		return FileSnapshot{}, fmt.Errorf("读取配置文件状态失败: %w", err)
	}

	m.mu.RLock()
	reloadedAt := m.reloadedAt
	m.mu.RUnlock()

	return FileSnapshot{
		ConfigFile: m.configFile,
		Content:    string(data),
		ModifiedAt: info.ModTime(),
		ReloadedAt: reloadedAt,
	}, nil
}

// startWatcher 启动配置文件目录监听，用于支持外部修改后的热加载。
func (m *ConfigManager) startWatcher() error {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("创建配置文件监听器失败: %w", err)
	}

	dir := filepath.Dir(m.configFile)
	if err := watcher.Add(dir); err != nil {
		_ = watcher.Close()
		return fmt.Errorf("监听配置文件目录失败: %w", err)
	}

	m.watcher = watcher
	go m.watchLoop()
	return nil
}

// watchLoop 监听配置文件变化事件并尝试重新加载配置。
func (m *ConfigManager) watchLoop() {
	for {
		select {
		case <-m.done:
			return
		case event, ok := <-m.watcher.Events:
			if !ok {
				return
			}
			if !m.isConfigFileEvent(event) {
				continue
			}
			go m.reloadAfterEvent(event)
		case err, ok := <-m.watcher.Errors:
			if !ok {
				return
			}
			slog.Error("配置文件监听失败", "config_file", m.configFile, "error", err)
		}
	}
}

// reloadAfterEvent 在文件事件稳定后重新加载配置。
// 参数 event 表示文件系统变更事件。
func (m *ConfigManager) reloadAfterEvent(event fsnotify.Event) {
	time.Sleep(120 * time.Millisecond)
	if err := m.ReloadFromDisk(); err != nil {
		slog.Error(
			"配置文件热加载失败，继续使用上一份有效配置",
			"config_file", m.configFile,
			"operation", event.Op.String(),
			"error", err,
		)
		return
	}

	slog.Info(
		"配置文件热加载成功",
		"config_file", m.configFile,
		"operation", event.Op.String(),
	)
}

// isConfigFileEvent 判断文件系统事件是否来自当前配置文件。
// 参数 event 表示文件系统变更事件。
func (m *ConfigManager) isConfigFileEvent(event fsnotify.Event) bool {
	if event.Name == "" {
		return false
	}

	absName, err := filepath.Abs(event.Name)
	if err != nil {
		return false
	}
	if !samePath(absName, m.configFile) {
		return false
	}

	return event.Has(fsnotify.Write) ||
		event.Has(fsnotify.Create) ||
		event.Has(fsnotify.Rename)
}

// Init 读取指定配置文件并初始化应用配置。
// 参数 configFile 表示实际配置文件路径，不能为空。
func Init(configFile string) (*AppConfig, error) {
	absFile, err := absoluteConfigFile(configFile)
	if err != nil {
		return nil, err
	}
	cfg, err := loadConfigFile(absFile)
	if err != nil {
		return nil, err
	}
	setCurrent(cfg)
	return cfg, nil
}

// Get 返回已经初始化的应用配置。
func Get() *AppConfig {
	currentMu.RLock()
	defer currentMu.RUnlock()

	if current == nil {
		return nil
	}
	cfg := *current
	return &cfg
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
	loader.SetDefault("ai.provider_secret_key", "")
	loader.SetDefault("ai.prompt_types", []string{})
	loader.SetDefault("storage.s3.bucket_lookup", "auto")
	loader.SetDefault("storage.s3.preview_expire", "24h")
	loader.SetDefault("storage.s3.max_upload_size_mb", 20)
	loader.SetDefault("storage.s3.cover_prefix", "covers")
	loader.SetDefault("storage.s3.character_prefix", "characters")
}

// Load 读取指定路径的应用配置。
// 参数 configFile 表示实际配置文件路径，不能为空。
func Load(configFile string) (*AppConfig, error) {
	return Init(configFile)
}

// setCurrent 设置全局当前配置快照。
// 参数 cfg 表示最近一次成功加载的应用配置。
func setCurrent(cfg *AppConfig) {
	currentMu.Lock()
	current = cfg
	currentMu.Unlock()
}

// absoluteConfigFile 返回配置文件绝对路径并校验路径非空。
// 参数 configFile 表示调用方传入的配置文件路径。
func absoluteConfigFile(configFile string) (string, error) {
	if strings.TrimSpace(configFile) == "" {
		return "", errors.New("config file required")
	}

	absFile, err := filepath.Abs(configFile)
	if err != nil {
		return "", fmt.Errorf("解析配置文件绝对路径失败: %w", err)
	}
	return absFile, nil
}

// loadConfigFile 从磁盘读取并解析指定配置文件。
// 参数 configFile 表示需要读取的配置文件绝对路径。
func loadConfigFile(configFile string) (*AppConfig, error) {
	loader := newLoader()
	loader.SetConfigFile(configFile)
	loader.SetConfigType("yaml")

	if err := loader.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("读取配置文件失败: %w", err)
	}

	return unmarshalLoader(loader)
}

// parseConfigContent 解析配置页提交的 YAML 配置文本。
// 参数 content 表示配置文件完整文本内容。
func parseConfigContent(content string) (*AppConfig, error) {
	loader := newLoader()
	loader.SetConfigType("yaml")

	if err := loader.ReadConfig(bytes.NewReader([]byte(content))); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}

	cfg, err := unmarshalLoader(loader)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}
	return cfg, nil
}

// newLoader 创建带默认值和环境变量读取规则的 Viper 实例。
func newLoader() *viper.Viper {
	loader := viper.New()
	loader.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	loader.AutomaticEnv()
	setDefaults(loader)
	return loader
}

// unmarshalLoader 将 Viper 当前解析结果转换为应用配置结构。
// 参数 loader 表示已经读取配置来源的 Viper 实例。
func unmarshalLoader(loader *viper.Viper) (*AppConfig, error) {
	var cfg AppConfig
	if err := loader.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("解析配置文件失败: %w", err)
	}
	promptTypes, err := normalizePromptTypeList(cfg.AI.PromptTypes)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidConfigContent, err)
	}
	cfg.AI.PromptTypes = promptTypes
	return &cfg, nil
}

// IsValidationError 判断错误是否属于配置内容校验失败。
// 参数 err 表示需要判断的错误。
func IsValidationError(err error) bool {
	return errors.Is(err, ErrConfigContentRequired) ||
		errors.Is(err, ErrInvalidConfigContent)
}

// samePath 判断两个绝对路径是否指向同一路径。
// 参数 left 表示左侧路径；参数 right 表示右侧路径。
func samePath(left string, right string) bool {
	left = filepath.Clean(left)
	right = filepath.Clean(right)
	if os.PathSeparator == '\\' {
		return strings.EqualFold(left, right)
	}
	return left == right
}
