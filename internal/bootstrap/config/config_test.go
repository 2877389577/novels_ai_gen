package config

import (
	"testing"
)

// TestInitRequiresConfigFile 验证初始化配置时必须传入实际配置文件路径。
// 参数 t 表示测试上下文。
func TestInitRequiresConfigFile(t *testing.T) {
	_, err := Init("")
	if err == nil {
		t.Fatal("空配置文件路径应该返回错误")
	}

	if err.Error() != "config file required" {
		t.Fatalf("错误信息不符合预期: %v", err)
	}
}
