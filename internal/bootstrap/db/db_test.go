package db

import (
	"strings"
	"testing"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

// TestSelectDatabaseConfigPrefersMySQL 验证 MySQL 和 PostgreSQL 都配置时优先选择 MySQL。
// 参数 t 表示测试上下文。
func TestSelectDatabaseConfigPrefersMySQL(t *testing.T) {
	cfg := appconfig.DatabaseConfig{
		MySQL: appconfig.DatabaseConnectionConfig{
			Host:     "127.0.0.1",
			Port:     3306,
			Username: "root",
			DBName:   "novels",
		},
		Postgres: appconfig.DatabaseConnectionConfig{
			Host:     "127.0.0.1",
			Port:     5432,
			Username: "postgres",
			DBName:   "novels",
		},
	}

	databaseType, connection, err := selectDatabaseConfig(cfg)
	if err != nil {
		t.Fatalf("选择数据库配置失败: %v", err)
	}
	if databaseType != databaseTypeMySQL {
		t.Fatalf("数据库类型不符合预期: %s", databaseType)
	}
	if connection.Host != cfg.MySQL.Host {
		t.Fatalf("数据库配置不符合预期: %+v", connection)
	}
}

// TestSelectDatabaseConfigUsesPostgres 验证仅配置 PostgreSQL 时选择 PostgreSQL。
// 参数 t 表示测试上下文。
func TestSelectDatabaseConfigUsesPostgres(t *testing.T) {
	cfg := appconfig.DatabaseConfig{
		Postgres: appconfig.DatabaseConnectionConfig{
			Host:     "127.0.0.1",
			Port:     5432,
			Username: "postgres",
			DBName:   "novels",
		},
	}

	databaseType, connection, err := selectDatabaseConfig(cfg)
	if err != nil {
		t.Fatalf("选择数据库配置失败: %v", err)
	}
	if databaseType != databaseTypePostgres {
		t.Fatalf("数据库类型不符合预期: %s", databaseType)
	}
	if connection.Host != cfg.Postgres.Host {
		t.Fatalf("数据库配置不符合预期: %+v", connection)
	}
}

// TestSelectDatabaseConfigReturnsErrorWhenEmpty 验证未配置数据库时返回错误。
// 参数 t 表示测试上下文。
func TestSelectDatabaseConfigReturnsErrorWhenEmpty(t *testing.T) {
	_, _, err := selectDatabaseConfig(appconfig.DatabaseConfig{})
	if err == nil {
		t.Fatal("未配置数据库时应该返回错误")
	}
}

// TestValidateConnectionConfigReturnsMissingFields 验证部分配置时会提示缺失字段。
// 参数 t 表示测试上下文。
func TestValidateConnectionConfigReturnsMissingFields(t *testing.T) {
	err := validateConnectionConfig(databaseTypeMySQL, appconfig.DatabaseConnectionConfig{Host: "127.0.0.1"})
	if err == nil {
		t.Fatal("缺少必填字段时应该返回错误")
	}

	message := err.Error()
	for _, field := range []string{"port", "username", "dbname"} {
		if !strings.Contains(message, field) {
			t.Fatalf("错误信息缺少字段 %s: %s", field, message)
		}
	}
}
