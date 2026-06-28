package db

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
	"gorm.io/gorm/utils"

	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"
	bizchapter "novels_ai_gen/internal/biz/chapter"
	bizcharacter "novels_ai_gen/internal/biz/character"
	bizevent "novels_ai_gen/internal/biz/event"
	biznovel "novels_ai_gen/internal/biz/novel"
	biznovelagent "novels_ai_gen/internal/biz/novelagent"
	biznoveloutline "novels_ai_gen/internal/biz/noveloutline"
	biznovelsummary "novels_ai_gen/internal/biz/novelsummary"
	bizprompt "novels_ai_gen/internal/biz/prompt"
	bizrelationship "novels_ai_gen/internal/biz/relationship"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// databaseType 表示当前选择的数据库类型。
type databaseType string

const (
	databaseTypeMySQL    databaseType = "mysql"
	databaseTypePostgres databaseType = "postgres"
	gormSlowThreshold                 = 200 * time.Millisecond
	// agentConversationNovelIDIndex 表示 Agent 会话表小说 ID 普通索引名称。
	agentConversationNovelIDIndex = "idx_agent_conversations_novel_id"
	// agentConversationNovelIDGuardIndex 表示迁移旧唯一索引时临时保护外键所需的小说 ID 索引名称。
	agentConversationNovelIDGuardIndex = "idx_agent_conversations_novel_id_fk_guard"
)

var (
	current *gorm.DB
	mu      sync.Mutex
)

// migrationModels 表示启动时需要交给 GORM 自动迁移的数据模型列表。
var migrationModels = []any{
	&biznovel.Novel{},
	&bizchapter.Chapter{},
	&bizcharacter.Character{},
	&bizaiprovider.Provider{},
	&bizrelationship.Graph{},
	&bizrelationship.Node{},
	&bizrelationship.Edge{},
	&bizevent.EventGraph{},
	&bizevent.Event{},
	&bizevent.Participant{},
	&bizevent.Relation{},
	&biznovelagent.Conversation{},
	&biznovelagent.MessageRecord{},
	&biznovelsummary.NovelSummary{},
	&biznoveloutline.NovelOutline{},
	&bizprompt.Prompt{},
}

// obsoleteAIProviderColumns 表示需要从旧版 AI 提供商表中物理删除的历史配置字段。
var obsoleteAIProviderColumns = []string{
	"model",
	"max_tokens",
	"temperature",
	"top_p",
	"thinking_level",
	"provider_type",
	"api_type",
}

// Provider 根据完整应用配置初始化全局数据库连接，并返回 Wire 清理函数。
// 参数 cfg 表示应用完整配置。
func Provider(cfg *appconfig.AppConfig) (*gorm.DB, func(), error) {
	conn, err := Init(cfg.Database)
	if err != nil {
		return nil, nil, fmt.Errorf("初始化数据库失败: %w", err)
	}

	return conn, CloseWithLog, nil
}

// CloseWithLog 关闭当前数据库连接，并记录关闭失败信息。
func CloseWithLog() {
	if err := Close(); err != nil {
		slog.Error("关闭数据库失败", "error", err)
	}
}

// Init 根据数据库配置初始化全局数据库连接。
// 参数 cfg 表示应用支持的 MySQL 和 PostgreSQL 数据库连接配置。
func Init(cfg appconfig.DatabaseConfig) (*gorm.DB, error) {
	mu.Lock()
	defer mu.Unlock()

	databaseType, connection, err := selectDatabaseConfig(cfg)
	if err != nil {
		return nil, err
	}

	if err := validateConnectionConfig(databaseType, connection); err != nil {
		return nil, err
	}

	conn, err := open(databaseType, connection)
	if err != nil {
		return nil, err
	}

	sqlDB, err := conn.DB()
	if err != nil {
		return nil, fmt.Errorf("获取底层数据库连接失败: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("连接数据库失败: %w", err)
	}

	if err := migrate(conn); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("执行数据库迁移失败: %w", err)
	}

	if current != nil {
		_ = close(current)
	}
	current = conn
	return current, nil
}

// migrate 使用 GORM 自动迁移功能创建或更新数据库表结构。
// 参数 conn 表示已经成功连接并通过 Ping 校验的 GORM 数据库连接。
func migrate(conn *gorm.DB) error {
	startedAt := time.Now()
	slog.Info("数据库自动迁移开始", "model_count", len(migrationModels))

	agentConversationTitleExisted := conn.Migrator().HasColumn(&biznovelagent.Conversation{}, "title")
	missingModels := missingMigrationModelNames(conn)
	triggered := len(missingModels) > 0
	slog.Info(
		"数据库自动迁移检查完成",
		"triggered", triggered,
		"missing_model_count", len(missingModels),
		"missing_models", missingModels,
	)

	if err := prepareAgentConversationSchemaBeforeAutoMigrate(conn); err != nil {
		slog.Error(
			"Agent 会话表自动迁移前兼容处理失败",
			"duration_ms", time.Since(startedAt).Milliseconds(),
			"error", err,
		)
		return err
	}
	if err := conn.AutoMigrate(migrationModels...); err != nil {
		slog.Error(
			"数据库自动迁移失败",
			"triggered", triggered,
			"missing_model_count", len(missingModels),
			"missing_models", missingModels,
			"duration_ms", time.Since(startedAt).Milliseconds(),
			"error", err,
		)
		return fmt.Errorf("自动迁移数据库表失败: %w", err)
	}
	if err := syncAgentConversationSchema(conn, agentConversationTitleExisted); err != nil {
		slog.Error(
			"Agent 会话表结构兼容迁移失败",
			"duration_ms", time.Since(startedAt).Milliseconds(),
			"error", err,
		)
		return err
	}
	if err := dropObsoleteAIProviderColumns(conn); err != nil {
		slog.Error(
			"数据库历史字段清理失败",
			"duration_ms", time.Since(startedAt).Milliseconds(),
			"error", err,
		)
		return err
	}

	slog.Info(
		"数据库自动迁移完成",
		"triggered", triggered,
		"missing_model_count", len(missingModels),
		"missing_models", missingModels,
		"duration_ms", time.Since(startedAt).Milliseconds(),
	)
	return nil
}

// prepareAgentConversationSchemaBeforeAutoMigrate 在 GORM 自动迁移前处理旧版 Agent 会话索引依赖。
// 参数 conn 表示已经成功连接并通过 Ping 校验的 GORM 数据库连接。
func prepareAgentConversationSchemaBeforeAutoMigrate(conn *gorm.DB) error {
	return ensureAgentConversationNovelIDGuardIndex(conn)
}

// syncAgentConversationSchema 处理 Agent 会话表从小说唯一会话到多会话的兼容迁移。
// 参数 conn 表示已经完成自动迁移的 GORM 数据库连接；参数 titleColumnExisted 表示自动迁移前会话表是否已经存在 title 列。
func syncAgentConversationSchema(conn *gorm.DB, titleColumnExisted bool) error {
	migrator := conn.Migrator()
	if !migrator.HasTable(&biznovelagent.Conversation{}) {
		return nil
	}
	if !titleColumnExisted && migrator.HasColumn(&biznovelagent.Conversation{}, "title") {
		if err := conn.Model(&biznovelagent.Conversation{}).
			Where("title = '' OR title IS NULL OR title = ?", "新会话").
			Update("title", "历史会话").Error; err != nil {
			return fmt.Errorf("补齐历史 Agent 会话标题失败: %w", err)
		}
	}
	if err := syncAgentConversationNovelIDIndex(conn); err != nil {
		return err
	}
	if err := dropAgentConversationNovelIDGuardIndex(conn); err != nil {
		return err
	}
	return nil
}

// ensureAgentConversationNovelIDGuardIndex 创建 MySQL 迁移旧唯一索引时保护外键所需的临时普通索引。
// 参数 conn 表示 GORM 数据库连接。
func ensureAgentConversationNovelIDGuardIndex(conn *gorm.DB) error {
	if conn.Dialector.Name() != string(databaseTypeMySQL) {
		return nil
	}
	migrator := conn.Migrator()
	if !migrator.HasTable(&biznovelagent.Conversation{}) ||
		!migrator.HasColumn(&biznovelagent.Conversation{}, "novel_id") ||
		!migrator.HasIndex(&biznovelagent.Conversation{}, agentConversationNovelIDIndex) {
		return nil
	}

	unique, err := agentConversationIndexIsUnique(conn, biznovelagent.Conversation{}.TableName(), agentConversationNovelIDIndex)
	if err != nil {
		return err
	}
	if !unique || migrator.HasIndex(&biznovelagent.Conversation{}, agentConversationNovelIDGuardIndex) {
		return nil
	}

	if err := conn.Exec("CREATE INDEX idx_agent_conversations_novel_id_fk_guard ON agent_conversations (novel_id)").Error; err != nil {
		return fmt.Errorf("创建 Agent 会话小说 ID 临时保护索引失败: %w", err)
	}
	return nil
}

// syncAgentConversationNovelIDIndex 将 Agent 会话小说 ID 索引从旧唯一索引迁移为普通索引。
// 参数 conn 表示已经完成自动迁移的 GORM 数据库连接。
func syncAgentConversationNovelIDIndex(conn *gorm.DB) error {
	migrator := conn.Migrator()
	if !migrator.HasIndex(&biznovelagent.Conversation{}, agentConversationNovelIDIndex) {
		if err := migrator.CreateIndex(&biznovelagent.Conversation{}, agentConversationNovelIDIndex); err != nil {
			return fmt.Errorf("创建 Agent 会话小说普通索引失败: %w", err)
		}
		return nil
	}

	unique, err := agentConversationIndexIsUnique(conn, biznovelagent.Conversation{}.TableName(), agentConversationNovelIDIndex)
	if err != nil {
		return err
	}
	if !unique {
		return nil
	}

	if err := ensureAgentConversationNovelIDGuardIndex(conn); err != nil {
		return err
	}
	if err := migrator.DropIndex(&biznovelagent.Conversation{}, agentConversationNovelIDIndex); err != nil {
		return fmt.Errorf("删除 Agent 会话小说唯一索引失败: %w", err)
	}
	if err := migrator.CreateIndex(&biznovelagent.Conversation{}, agentConversationNovelIDIndex); err != nil {
		return fmt.Errorf("创建 Agent 会话小说普通索引失败: %w", err)
	}
	return nil
}

// dropAgentConversationNovelIDGuardIndex 删除 Agent 会话小说 ID 临时保护索引。
// 参数 conn 表示已经完成目标索引迁移的 GORM 数据库连接。
func dropAgentConversationNovelIDGuardIndex(conn *gorm.DB) error {
	if conn.Dialector.Name() != string(databaseTypeMySQL) {
		return nil
	}
	migrator := conn.Migrator()
	if !migrator.HasTable(&biznovelagent.Conversation{}) ||
		!migrator.HasIndex(&biznovelagent.Conversation{}, agentConversationNovelIDGuardIndex) {
		return nil
	}
	if err := migrator.DropIndex(&biznovelagent.Conversation{}, agentConversationNovelIDGuardIndex); err != nil {
		return fmt.Errorf("删除 Agent 会话小说 ID 临时保护索引失败: %w", err)
	}
	return nil
}

// agentConversationIndexIsUnique 判断 Agent 会话表指定索引是否为唯一索引。
// 参数 conn 表示 GORM 数据库连接；参数 tableName 表示数据库表名；参数 indexName 表示索引名称。
func agentConversationIndexIsUnique(conn *gorm.DB, tableName string, indexName string) (bool, error) {
	switch conn.Dialector.Name() {
	case string(databaseTypeMySQL):
		var count int64
		if err := conn.Raw(
			"SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? AND non_unique = 0",
			tableName,
			indexName,
		).Scan(&count).Error; err != nil {
			return false, fmt.Errorf("查询 MySQL Agent 会话索引唯一性失败: %w", err)
		}
		return count > 0, nil
	case string(databaseTypePostgres):
		var count int64
		if err := conn.Raw(
			"SELECT COUNT(*) FROM pg_indexes WHERE schemaname = CURRENT_SCHEMA() AND tablename = ? AND indexname = ? AND indexdef LIKE 'CREATE UNIQUE INDEX%'",
			tableName,
			indexName,
		).Scan(&count).Error; err != nil {
			return false, fmt.Errorf("查询 PostgreSQL Agent 会话索引唯一性失败: %w", err)
		}
		return count > 0, nil
	default:
		return true, nil
	}
}

// dropObsoleteAIProviderColumns 删除旧版 AI 提供商表中已经废弃的提供商级配置字段。
// 参数 conn 表示已经完成自动迁移的 GORM 数据库连接。
func dropObsoleteAIProviderColumns(conn *gorm.DB) error {
	migrator := conn.Migrator()
	if !migrator.HasTable(&bizaiprovider.Provider{}) {
		return nil
	}

	for _, column := range obsoleteAIProviderColumns {
		if !migrator.HasColumn(&bizaiprovider.Provider{}, column) {
			continue
		}
		if err := migrator.DropColumn(&bizaiprovider.Provider{}, column); err != nil {
			return fmt.Errorf("删除 AI 提供商历史字段 %s 失败: %w", column, err)
		}
	}
	return nil
}

// missingMigrationModelNames 返回迁移前还没有对应数据表的模型名称列表。
// 参数 conn 表示用于检查数据表是否存在的 GORM 数据库连接。
func missingMigrationModelNames(conn *gorm.DB) []string {
	missingModels := make([]string, 0, len(migrationModels))
	migrator := conn.Migrator()

	for _, model := range migrationModels {
		if migrator.HasTable(model) {
			continue
		}
		missingModels = append(missingModels, fmt.Sprintf("%T", model))
	}

	return missingModels
}

// Get 返回已经初始化的数据库连接。
func Get() *gorm.DB {
	return current
}

// Close 关闭当前数据库连接。
func Close() error {
	mu.Lock()
	defer mu.Unlock()

	if current == nil {
		return nil
	}

	err := close(current)
	current = nil
	return err
}

// selectDatabaseConfig 按优先级选择实际使用的数据库配置。
// 参数 cfg 表示应用支持的 MySQL 和 PostgreSQL 数据库连接配置。
func selectDatabaseConfig(cfg appconfig.DatabaseConfig) (databaseType, appconfig.DatabaseConnectionConfig, error) {
	if hasConnectionConfig(cfg.MySQL) {
		return databaseTypeMySQL, cfg.MySQL, nil
	}
	if hasConnectionConfig(cfg.Postgres) {
		return databaseTypePostgres, cfg.Postgres, nil
	}
	return "", appconfig.DatabaseConnectionConfig{}, fmt.Errorf("未配置数据库连接")
}

// hasConnectionConfig 判断数据库连接配置是否被填写过。
// 参数 cfg 表示单个数据库的连接配置。
func hasConnectionConfig(cfg appconfig.DatabaseConnectionConfig) bool {
	return strings.TrimSpace(cfg.Host) != "" ||
		cfg.Port != 0 ||
		strings.TrimSpace(cfg.Username) != "" ||
		strings.TrimSpace(cfg.Password) != "" ||
		strings.TrimSpace(cfg.DBName) != ""
}

// validateConnectionConfig 校验数据库连接必填项。
// 参数 databaseType 表示当前选择的数据库类型；参数 cfg 表示对应数据库连接配置。
func validateConnectionConfig(databaseType databaseType, cfg appconfig.DatabaseConnectionConfig) error {
	var missing []string

	if strings.TrimSpace(cfg.Host) == "" {
		missing = append(missing, "host")
	}
	if cfg.Port <= 0 {
		missing = append(missing, "port")
	}
	if strings.TrimSpace(cfg.Username) == "" {
		missing = append(missing, "username")
	}
	if strings.TrimSpace(cfg.DBName) == "" {
		missing = append(missing, "dbname")
	}

	if len(missing) > 0 {
		return fmt.Errorf("%s 数据库配置缺少字段: %s", databaseType, strings.Join(missing, ", "))
	}

	return nil
}

// open 根据数据库类型创建 GORM 连接。
// 参数 databaseType 表示当前选择的数据库类型；参数 cfg 表示对应数据库连接配置。
func open(databaseType databaseType, cfg appconfig.DatabaseConnectionConfig) (*gorm.DB, error) {
	gormConfig := &gorm.Config{Logger: newSlogGORMLogger()}
	switch databaseType {
	case databaseTypeMySQL:
		conn, err := gorm.Open(mysql.Open(mysqlDSN(cfg)), gormConfig)
		if err != nil {
			return nil, fmt.Errorf("打开 MySQL 数据库失败: %w", err)
		}
		return conn, nil
	case databaseTypePostgres:
		conn, err := gorm.Open(postgres.Open(postgresDSN(cfg)), gormConfig)
		if err != nil {
			return nil, fmt.Errorf("打开 PostgreSQL 数据库失败: %w", err)
		}
		return conn, nil
	default:
		return nil, fmt.Errorf("不支持的数据库类型: %s", databaseType)
	}
}

// slogGORMLogger 表示把 GORM 日志转写到应用 slog 日志的适配器。
type slogGORMLogger struct {
	// level 表示当前 GORM 日志输出等级。
	level gormlogger.LogLevel
	// slowThreshold 表示慢 SQL 判定阈值。
	slowThreshold time.Duration
}

// newSlogGORMLogger 创建写入应用 slog 的 GORM 日志适配器。
func newSlogGORMLogger() gormlogger.Interface {
	return slogGORMLogger{
		level:         gormlogger.Warn,
		slowThreshold: gormSlowThreshold,
	}
}

// LogMode 返回指定 GORM 日志等级的新日志适配器。
// 参数 level 表示 GORM 请求切换到的日志等级。
func (l slogGORMLogger) LogMode(level gormlogger.LogLevel) gormlogger.Interface {
	l.level = level
	return l
}

// Info 写入 GORM 信息日志。
// 参数 ctx 表示 GORM 操作上下文；参数 msg 表示日志格式文本；参数 args 表示日志格式参数。
func (l slogGORMLogger) Info(ctx context.Context, msg string, args ...interface{}) {
	if l.level < gormlogger.Info {
		return
	}
	slog.InfoContext(ctx, fmt.Sprintf(msg, args...), "source", utils.FileWithLineNum())
}

// Warn 写入 GORM 警告日志。
// 参数 ctx 表示 GORM 操作上下文；参数 msg 表示日志格式文本；参数 args 表示日志格式参数。
func (l slogGORMLogger) Warn(ctx context.Context, msg string, args ...interface{}) {
	if l.level < gormlogger.Warn {
		return
	}
	slog.WarnContext(ctx, fmt.Sprintf(msg, args...), "source", utils.FileWithLineNum())
}

// Error 写入 GORM 错误日志。
// 参数 ctx 表示 GORM 操作上下文；参数 msg 表示日志格式文本；参数 args 表示日志格式参数。
func (l slogGORMLogger) Error(ctx context.Context, msg string, args ...interface{}) {
	if l.level < gormlogger.Error {
		return
	}
	slog.ErrorContext(ctx, fmt.Sprintf(msg, args...), "source", utils.FileWithLineNum())
}

// Trace 写入 GORM SQL 执行日志。
// 参数 ctx 表示 GORM 操作上下文；参数 begin 表示 SQL 开始执行时间；参数 fc 表示延迟获取 SQL 与影响行数的方法；参数 err 表示 SQL 执行错误。
func (l slogGORMLogger) Trace(ctx context.Context, begin time.Time, fc func() (sql string, rowsAffected int64), err error) {
	if l.level <= gormlogger.Silent {
		return
	}

	elapsed := time.Since(begin)
	switch {
	case err != nil && l.level >= gormlogger.Error:
		sql, rows := fc()
		slog.ErrorContext(
			ctx,
			"gorm sql error",
			"source", utils.FileWithLineNum(),
			"duration_ms", elapsed.Milliseconds(),
			"rows", formatRowsAffected(rows),
			"sql", sql,
			"error", err,
		)
	case elapsed > l.slowThreshold && l.slowThreshold > 0 && l.level >= gormlogger.Warn:
		sql, rows := fc()
		slog.WarnContext(
			ctx,
			"gorm slow sql",
			"source", utils.FileWithLineNum(),
			"duration_ms", elapsed.Milliseconds(),
			"slow_threshold", l.slowThreshold.String(),
			"rows", formatRowsAffected(rows),
			"sql", sql,
		)
	case l.level >= gormlogger.Info:
		sql, rows := fc()
		slog.InfoContext(
			ctx,
			"gorm sql",
			"source", utils.FileWithLineNum(),
			"duration_ms", elapsed.Milliseconds(),
			"rows", formatRowsAffected(rows),
			"sql", sql,
		)
	}
}

// formatRowsAffected 格式化 GORM SQL 影响行数。
// 参数 rows 表示 GORM 返回的影响行数，-1 表示未知。
func formatRowsAffected(rows int64) any {
	if rows == -1 {
		return "-"
	}
	return rows
}

// close 关闭指定的 GORM 数据库连接。
// 参数 conn 表示需要关闭的 GORM 数据库连接。
func close(conn *gorm.DB) error {
	sqlDB, err := conn.DB()
	if err != nil {
		return fmt.Errorf("获取底层数据库连接失败: %w", err)
	}
	return sqlDB.Close()
}

// mysqlDSN 构造 MySQL 数据库连接字符串。
// 参数 cfg 表示 MySQL 数据库连接配置。
func mysqlDSN(cfg appconfig.DatabaseConnectionConfig) string {
	dsn := mysqlDriver.Config{
		User:      cfg.Username,
		Passwd:    cfg.Password,
		Net:       "tcp",
		Addr:      net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		DBName:    cfg.DBName,
		ParseTime: true,
		Loc:       time.Local,
		Params: map[string]string{
			"charset": "utf8mb4",
		},
	}
	return dsn.FormatDSN()
}

// postgresDSN 构造 PostgreSQL 数据库连接字符串。
// 参数 cfg 表示 PostgreSQL 数据库连接配置。
func postgresDSN(cfg appconfig.DatabaseConnectionConfig) string {
	dsn := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(cfg.Username, cfg.Password),
		Host:     net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		Path:     cfg.DBName,
		RawQuery: "sslmode=disable&TimeZone=Asia/Shanghai",
	}

	return dsn.String()
}
