package db

import (
	"fmt"
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

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// databaseType 表示当前选择的数据库类型。
type databaseType string

const (
	databaseTypeMySQL    databaseType = "mysql"
	databaseTypePostgres databaseType = "postgres"
)

var (
	current *gorm.DB
	mu      sync.Mutex
)

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

	if current != nil {
		_ = close(current)
	}
	current = conn
	return current, nil
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
	switch databaseType {
	case databaseTypeMySQL:
		conn, err := gorm.Open(mysql.Open(mysqlDSN(cfg)), &gorm.Config{})
		if err != nil {
			return nil, fmt.Errorf("打开 MySQL 数据库失败: %w", err)
		}
		return conn, nil
	case databaseTypePostgres:
		conn, err := gorm.Open(postgres.Open(postgresDSN(cfg)), &gorm.Config{})
		if err != nil {
			return nil, fmt.Errorf("打开 PostgreSQL 数据库失败: %w", err)
		}
		return conn, nil
	default:
		return nil, fmt.Errorf("不支持的数据库类型: %s", databaseType)
	}
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
	values := url.Values{}
	values.Set("sslmode", "disable")
	values.Set("TimeZone", "Asia/Shanghai")

	dsn := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(cfg.Username, cfg.Password),
		Host:     net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		Path:     cfg.DBName,
		RawQuery: values.Encode(),
	}

	return dsn.String()
}
