package logger

import (
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	appconfig "novels_ai_gen/internal/bootstrap/config"
)

var (
	closeCurrent io.Closer
	mu           sync.Mutex
)

// Provider 根据完整应用配置初始化全局日志服务，并返回 Wire 清理函数。
// 参数 cfg 表示应用完整配置。
func Provider(cfg *appconfig.AppConfig) (*slog.Logger, func(), error) {
	log, err := Init(cfg.Logger)
	if err != nil {
		return nil, nil, fmt.Errorf("初始化日志服务失败: %w", err)
	}

	return log, CloseWithLog, nil
}

// CloseWithLog 关闭当前日志服务，并记录关闭失败信息。
func CloseWithLog() {
	if err := Close(); err != nil {
		slog.Error("关闭日志服务失败", "error", err)
	}
}

// Init 根据配置初始化全局日志服务。
// 参数 cfg 表示日志服务的控制台、文件、格式和等级配置。
func Init(cfg appconfig.LoggerConfig) (*slog.Logger, error) {
	mu.Lock()
	defer mu.Unlock()

	if closeCurrent != nil {
		_ = closeCurrent.Close()
		closeCurrent = nil
	}

	level, err := parseLevel(cfg.Level)
	if err != nil {
		return nil, err
	}

	writer, closeFunc, err := buildWriter(cfg)
	if err != nil {
		return nil, err
	}

	handler, err := buildHandler(cfg, writer, level)
	if err != nil {
		_ = closeFunc.Close()
		return nil, err
	}

	log := slog.New(handler)
	slog.SetDefault(log)
	closeCurrent = closeFunc

	return log, nil
}

// Close 关闭当前日志服务持有的资源。
func Close() error {
	mu.Lock()
	defer mu.Unlock()

	if closeCurrent == nil {
		return nil
	}

	err := closeCurrent.Close()
	closeCurrent = nil
	return err
}

// parseLevel 将配置中的日志等级转换为 slog 等级。
// 参数 value 表示配置中的日志等级文本或数值。
func parseLevel(value string) (slog.Level, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "info":
		return slog.LevelInfo, nil
	case "debug":
		return slog.LevelDebug, nil
	case "warn", "warning":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		level, err := strconv.Atoi(value)
		if err != nil {
			return slog.LevelInfo, fmt.Errorf("不支持的日志等级: %s", value)
		}
		return slog.Level(level), nil
	}
}

// buildWriter 根据配置创建日志输出目标。
// 参数 cfg 表示日志服务的输出配置。
func buildWriter(cfg appconfig.LoggerConfig) (io.Writer, io.Closer, error) {
	var writers []io.Writer
	var closers []io.Closer

	if cfg.Console.Enabled {
		writers = append(writers, os.Stdout)
	}

	if cfg.File.Enabled {
		fileWriter, err := newTimeRotateWriter(cfg.File)
		if err != nil {
			return nil, nil, err
		}
		writers = append(writers, fileWriter)
		closers = append(closers, fileWriter)
	}

	if len(writers) == 0 {
		writers = append(writers, os.Stdout)
	}

	closeFunc := closerGroup{closers: closers}

	if len(writers) == 1 {
		return writers[0], closeFunc, nil
	}

	return io.MultiWriter(writers...), closeFunc, nil
}

// closerGroup 表示一组需要统一关闭的日志资源。
type closerGroup struct {
	// closers 表示需要关闭的日志资源列表。
	closers []io.Closer
}

// Close 依次关闭日志资源列表。
func (g closerGroup) Close() error {
	var errs []error
	for _, closer := range g.closers {
		if err := closer.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("关闭日志输出失败: %v", errs)
	}
	return nil
}

// buildHandler 根据配置创建 slog Handler。
// 参数 cfg 表示日志格式和源码位置配置；参数 writer 表示日志输出目标；参数 level 表示日志等级。
func buildHandler(cfg appconfig.LoggerConfig, writer io.Writer, level slog.Level) (slog.Handler, error) {
	options := &slog.HandlerOptions{
		AddSource: cfg.AddSource,
		Level:     level,
	}

	switch strings.ToLower(strings.TrimSpace(cfg.Format)) {
	case "", "text":
		return slog.NewTextHandler(writer, options), nil
	case "json":
		return slog.NewJSONHandler(writer, options), nil
	default:
		return nil, fmt.Errorf("不支持的日志格式: %s", cfg.Format)
	}
}

// timeRotateWriter 表示按时间轮转的日志文件写入器。
type timeRotateWriter struct {
	// dir 表示日志文件所在目录。
	dir string
	// filename 表示日志文件基础名称。
	filename string
	// layout 表示时间轮转使用的 Go 时间格式。
	layout string
	// currentKey 表示当前打开文件对应的时间片。
	currentKey string
	// file 表示当前正在写入的日志文件。
	file *os.File
	// mu 表示保护文件轮转和写入的互斥锁。
	mu sync.Mutex
	// now 表示获取当前时间的方法。
	now func() time.Time
}

// newTimeRotateWriter 创建按时间轮转的日志文件写入器。
// 参数 cfg 表示文件日志输出配置。
func newTimeRotateWriter(cfg appconfig.LoggerFileConfig) (*timeRotateWriter, error) {
	layout, err := rotationLayout(cfg.Rotation)
	if err != nil {
		return nil, err
	}

	writer := &timeRotateWriter{
		dir:      cfg.Dir,
		filename: cfg.Filename,
		layout:   layout,
		now:      time.Now,
	}

	if writer.dir == "" {
		writer.dir = "logs"
	}
	if writer.filename == "" {
		writer.filename = "app.log"
	}

	if err := writer.rotate(writer.now().Format(writer.layout)); err != nil {
		return nil, err
	}

	return writer, nil
}

// Write 将日志内容写入当前时间片对应的文件。
// 参数 p 表示需要写入的日志字节内容。
func (w *timeRotateWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	key := w.now().Format(w.layout)
	if w.file == nil || key != w.currentKey {
		if err := w.rotate(key); err != nil {
			return 0, err
		}
	}

	return w.file.Write(p)
}

// Close 关闭当前打开的日志文件。
func (w *timeRotateWriter) Close() error {
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.file == nil {
		return nil
	}

	err := w.file.Close()
	w.file = nil
	return err
}

// rotate 将日志文件切换到指定时间片。
// 参数 key 表示新日志文件对应的时间片标识。
func (w *timeRotateWriter) rotate(key string) error {
	if err := os.MkdirAll(w.dir, 0755); err != nil {
		return fmt.Errorf("创建日志目录失败: %w", err)
	}

	file, err := os.OpenFile(w.filePath(key), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("打开日志文件失败: %w", err)
	}

	if w.file != nil {
		_ = w.file.Close()
	}

	w.file = file
	w.currentKey = key
	return nil
}

// filePath 生成指定时间片对应的日志文件路径。
// 参数 key 表示日志文件对应的时间片标识。
func (w *timeRotateWriter) filePath(key string) string {
	ext := filepath.Ext(w.filename)
	name := strings.TrimSuffix(w.filename, ext)
	return filepath.Join(w.dir, fmt.Sprintf("%s-%s%s", name, key, ext))
}

// rotationLayout 将轮转粒度转换为 Go 时间格式。
// 参数 rotation 表示配置中的时间轮转粒度。
func rotationLayout(rotation string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(rotation)) {
	case "", "daily", "day":
		return "2006-01-02", nil
	case "hourly", "hour":
		return "2006-01-02-15", nil
	case "monthly", "month":
		return "2006-01", nil
	default:
		return "", fmt.Errorf("不支持的日志轮转粒度: %s", rotation)
	}
}
