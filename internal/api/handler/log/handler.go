package log

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/gin-gonic/gin"
	"novels_ai_gen/internal/api/response"
	appconfig "novels_ai_gen/internal/bootstrap/config"
	"novels_ai_gen/internal/bootstrap/logger"
	"novels_ai_gen/internal/requestid"
)

const (
	defaultTailLines = 300
	maxTailLines     = 1000
	pollInterval     = time.Second
)

// Handler 表示文件日志实时预览 HTTP 处理器。
type Handler struct {
	// manager 表示运行期间共享的配置文件管理器。
	manager *appconfig.ConfigManager
	// now 表示获取当前时间的方法。
	now func() time.Time
}

// LogEntry 表示前端日志预览中的单条日志。
type LogEntry struct {
	// Time 表示日志记录时间。
	Time string `json:"time,omitempty"`
	// Level 表示日志等级。
	Level string `json:"level,omitempty"`
	// Message 表示日志消息。
	Message string `json:"message,omitempty"`
	// RequestID 表示日志关联的请求追踪标识。
	RequestID string `json:"request_id,omitempty"`
	// Source 表示日志来源位置。
	Source string `json:"source,omitempty"`
	// Attrs 表示除标准字段外的结构化日志属性。
	Attrs map[string]any `json:"attrs,omitempty"`
	// Raw 表示原始日志文本。
	Raw string `json:"raw"`
}

// streamEvent 表示日志流中的 NDJSON 事件。
type streamEvent struct {
	// Type 表示事件类型，支持 meta、entry、error。
	Type string `json:"type"`
	// RequestID 表示本次日志流请求的追踪标识。
	RequestID string `json:"request_id,omitempty"`
	// Path 表示当前跟随的日志文件路径。
	Path string `json:"path,omitempty"`
	// Follow 表示日志流是否会继续跟随文件追加。
	Follow bool `json:"follow,omitempty"`
	// Entry 表示日志条目事件中的日志内容。
	Entry *LogEntry `json:"entry,omitempty"`
	// Message 表示错误事件中的用户可读提示。
	Message string `json:"message,omitempty"`
}

// queryFilter 表示日志流请求中的筛选条件。
type queryFilter struct {
	// date 表示需要读取的单日日期。
	date time.Time
	// levels 表示允许展示的日志等级集合。
	levels map[string]struct{}
	// keyword 表示大小写不敏感的关键词。
	keyword string
	// tail 表示首次返回的最近日志条数。
	tail int
}

// NewHandler 创建文件日志实时预览 HTTP 处理器。
// 参数 manager 表示运行期间共享的配置文件管理器。
func NewHandler(manager *appconfig.ConfigManager) *Handler {
	return &Handler{
		manager: manager,
		now:     time.Now,
	}
}

// Stream 处理文件日志实时预览请求。
// 参数 c 表示 Gin 请求上下文。
//
// @Summary 实时预览文件日志
// @Description 按日期、日志等级和关键词读取文件日志，并在当天日志文件上实时跟随新增内容。
// @Tags logs
// @Security Bearer
// @Produce json
// @Param date query string false "日志日期，格式 YYYY-MM-DD"
// @Param levels query string false "日志等级，多个等级用英文逗号分隔"
// @Param keyword query string false "日志关键词"
// @Param tail query int false "首次返回最近日志条数" default(300)
// @Success 200 {object} streamEvent "NDJSON 日志流事件"
// @Failure 400 {object} response.ErrorBody "文件日志未开启或参数错误"
// @Failure 401 {object} response.ErrorBody "未登录或登录过期"
// @Failure 500 {object} response.ErrorBody "服务器内部错误"
// @Router /logs/stream [get]
func (h *Handler) Stream(c *gin.Context) {
	cfg := h.manager.Current()
	if cfg == nil {
		response.Error(c, http.StatusInternalServerError, "日志配置未加载")
		return
	}
	if !cfg.Logger.File.Enabled {
		response.Error(c, http.StatusBadRequest, "当前未启用文件日志")
		return
	}

	filter, err := parseQuery(c, h.now())
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	paths, err := logger.LogFilePathsForDate(cfg.Logger.File, filter.date)
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	activePath, err := logger.LogFilePath(cfg.Logger.File, h.now())
	if err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		response.Error(c, http.StatusInternalServerError, "当前运行环境不支持日志流")
		return
	}

	ctx := c.Request.Context()
	encoder := json.NewEncoder(c.Writer)
	c.Header("Content-Type", "application/x-ndjson; charset=utf-8")
	c.Status(http.StatusOK)

	follow := sameDate(filter.date, h.now())
	metaPath := strings.Join(paths, ";")
	if follow {
		metaPath = activePath
	}
	if err := writeEvent(encoder, flusher, streamEvent{
		Type:      "meta",
		RequestID: requestid.FromContext(ctx),
		Path:      metaPath,
		Follow:    follow,
	}); err != nil {
		return
	}

	entries := tailMatchingEntries(paths, filter)
	for i := range entries {
		if err := writeEvent(encoder, flusher, streamEvent{Type: "entry", Entry: &entries[i]}); err != nil {
			return
		}
	}

	if !follow {
		return
	}

	offset := fileSize(activePath)
	h.follow(ctx, encoder, flusher, cfg.Logger.File, filter, activePath, offset)
}

// follow 跟随当前日期对应的日志文件追加内容。
// 参数 ctx 表示请求上下文；参数 encoder 表示 NDJSON 编码器；参数 flusher 表示响应刷新器；参数 cfg 表示文件日志配置；参数 filter 表示筛选条件；参数 activePath 表示当前文件路径；参数 offset 表示已经读取到的文件偏移量。
func (h *Handler) follow(ctx context.Context, encoder *json.Encoder, flusher http.Flusher, cfg appconfig.LoggerFileConfig, filter queryFilter, activePath string, offset int64) {
	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			nextPath, err := logger.LogFilePath(cfg, h.now())
			if err != nil {
				_ = writeEvent(encoder, flusher, streamEvent{Type: "error", Message: err.Error()})
				continue
			}
			if nextPath != activePath {
				activePath = nextPath
				offset = 0
			}

			nextOffset, entries, err := readNewEntries(activePath, offset, filter)
			if err != nil {
				if !errors.Is(err, os.ErrNotExist) {
					_ = writeEvent(encoder, flusher, streamEvent{Type: "error", Message: "读取日志文件失败"})
				}
				continue
			}
			offset = nextOffset
			for i := range entries {
				if err := writeEvent(encoder, flusher, streamEvent{Type: "entry", Entry: &entries[i]}); err != nil {
					return
				}
			}
		}
	}
}

// parseQuery 解析日志流查询参数。
// 参数 c 表示 Gin 请求上下文；参数 now 表示当前时间。
func parseQuery(c *gin.Context, now time.Time) (queryFilter, error) {
	date := now
	if value := strings.TrimSpace(c.Query("date")); value != "" {
		parsed, err := time.ParseInLocation("2006-01-02", value, now.Location())
		if err != nil {
			return queryFilter{}, fmt.Errorf("日期格式必须为 YYYY-MM-DD")
		}
		date = parsed
	}

	tail := defaultTailLines
	if value := strings.TrimSpace(c.Query("tail")); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed <= 0 {
			return queryFilter{}, fmt.Errorf("tail 必须为正整数")
		}
		if parsed > maxTailLines {
			parsed = maxTailLines
		}
		tail = parsed
	}

	levels := map[string]struct{}{}
	for _, value := range strings.Split(c.Query("levels"), ",") {
		level := strings.ToLower(strings.TrimSpace(value))
		if level == "" {
			continue
		}
		switch level {
		case "debug", "info", "warn", "warning", "error":
			if level == "warning" {
				level = "warn"
			}
			levels[level] = struct{}{}
		default:
			return queryFilter{}, fmt.Errorf("日志等级仅支持 debug、info、warn、error")
		}
	}

	return queryFilter{
		date:    date,
		levels:  levels,
		keyword: strings.ToLower(strings.TrimSpace(c.Query("keyword"))),
		tail:    tail,
	}, nil
}

// tailMatchingEntries 读取日志文件并返回最近匹配的日志条目。
// 参数 paths 表示需要读取的日志文件路径列表；参数 filter 表示筛选条件。
func tailMatchingEntries(paths []string, filter queryFilter) []LogEntry {
	entries := make([]LogEntry, 0, filter.tail)
	for _, path := range paths {
		fileEntries := readMatchingFile(path, filter)
		for _, entry := range fileEntries {
			if len(entries) == filter.tail {
				copy(entries, entries[1:])
				entries = entries[:filter.tail-1]
			}
			entries = append(entries, entry)
		}
	}
	return entries
}

// readMatchingFile 读取单个日志文件中符合筛选条件的日志条目。
// 参数 path 表示日志文件路径；参数 filter 表示筛选条件。
func readMatchingFile(path string, filter queryFilter) []LogEntry {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()

	var entries []LogEntry
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		entry := parseLogLine(scanner.Text())
		if matchEntry(entry, filter) {
			entries = append(entries, entry)
		}
	}
	return entries
}

// readNewEntries 从指定偏移量开始读取新增日志条目。
// 参数 path 表示日志文件路径；参数 offset 表示开始读取的字节偏移量；参数 filter 表示筛选条件。
func readNewEntries(path string, offset int64, filter queryFilter) (int64, []LogEntry, error) {
	file, err := os.Open(path)
	if err != nil {
		return offset, nil, err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return offset, nil, err
	}
	if info.Size() < offset {
		offset = 0
	}
	if _, err := file.Seek(offset, 0); err != nil {
		return offset, nil, err
	}

	var entries []LogEntry
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for scanner.Scan() {
		entry := parseLogLine(scanner.Text())
		if matchEntry(entry, filter) {
			entries = append(entries, entry)
		}
	}
	if err := scanner.Err(); err != nil {
		return offset, nil, err
	}

	nextOffset, err := file.Seek(0, 1)
	if err != nil {
		return offset, nil, err
	}
	return nextOffset, entries, nil
}

// parseLogLine 将 slog 文本或 JSON 日志解析为前端展示条目。
// 参数 line 表示单行原始日志文本。
func parseLogLine(line string) LogEntry {
	if entry, ok := parseJSONLogLine(line); ok {
		return entry
	}
	if entry, ok := parseTextLogLine(line); ok {
		return entry
	}
	return LogEntry{Raw: line}
}

// parseJSONLogLine 将 JSON 格式日志解析为前端展示条目。
// 参数 line 表示单行原始日志文本。
func parseJSONLogLine(line string) (LogEntry, bool) {
	var data map[string]any
	if err := json.Unmarshal([]byte(line), &data); err != nil {
		return LogEntry{}, false
	}

	entry := LogEntry{
		Raw:   line,
		Attrs: map[string]any{},
	}
	for key, value := range data {
		switch key {
		case "time":
			entry.Time = fmt.Sprint(value)
		case "level":
			entry.Level = strings.ToLower(fmt.Sprint(value))
		case "msg":
			entry.Message = fmt.Sprint(value)
		case "request_id":
			entry.RequestID = fmt.Sprint(value)
		case "source":
			entry.Source = fmt.Sprint(value)
		default:
			entry.Attrs[key] = value
		}
	}
	if len(entry.Attrs) == 0 {
		entry.Attrs = nil
	}
	return entry, true
}

// parseTextLogLine 将 slog 文本格式日志解析为前端展示条目。
// 参数 line 表示单行原始日志文本。
func parseTextLogLine(line string) (LogEntry, bool) {
	parts := splitTextAttrs(line)
	if len(parts) == 0 {
		return LogEntry{}, false
	}

	entry := LogEntry{
		Raw:   line,
		Attrs: map[string]any{},
	}
	for key, value := range parts {
		switch key {
		case "time":
			entry.Time = value
		case "level":
			entry.Level = strings.ToLower(value)
		case "msg":
			entry.Message = value
		case "request_id":
			entry.RequestID = value
		case "source":
			entry.Source = value
		default:
			entry.Attrs[key] = value
		}
	}
	if len(entry.Attrs) == 0 {
		entry.Attrs = nil
	}
	return entry, true
}

// splitTextAttrs 拆分 slog 文本格式日志中的键值对。
// 参数 line 表示单行原始日志文本。
func splitTextAttrs(line string) map[string]string {
	attrs := map[string]string{}
	for i := 0; i < len(line); {
		for i < len(line) && unicode.IsSpace(rune(line[i])) {
			i++
		}
		keyStart := i
		for i < len(line) && line[i] != '=' && !unicode.IsSpace(rune(line[i])) {
			i++
		}
		if i >= len(line) || line[i] != '=' {
			break
		}
		key := line[keyStart:i]
		i++

		valueStart := i
		var value string
		if i < len(line) && line[i] == '"' {
			i++
			escaped := false
			for i < len(line) {
				if line[i] == '\\' && !escaped {
					escaped = true
					i++
					continue
				}
				if line[i] == '"' && !escaped {
					i++
					break
				}
				escaped = false
				i++
			}
			raw := line[valueStart:i]
			if unquoted, err := strconv.Unquote(raw); err == nil {
				value = unquoted
			} else {
				value = strings.Trim(raw, "\"")
			}
		} else {
			for i < len(line) && !unicode.IsSpace(rune(line[i])) {
				i++
			}
			value = line[valueStart:i]
		}
		if key != "" {
			attrs[key] = value
		}
	}
	return attrs
}

// matchEntry 判断日志条目是否符合筛选条件。
// 参数 entry 表示日志条目；参数 filter 表示筛选条件。
func matchEntry(entry LogEntry, filter queryFilter) bool {
	if len(filter.levels) > 0 {
		level := strings.ToLower(entry.Level)
		if level == "warning" {
			level = "warn"
		}
		if _, ok := filter.levels[level]; !ok {
			return false
		}
	}

	if entry.Time != "" {
		if parsed, ok := parseEntryTime(entry.Time); ok && !sameDate(parsed, filter.date) {
			return false
		}
	}

	if filter.keyword == "" {
		return true
	}

	target := strings.ToLower(entry.Raw + " " + entry.Message + " " + entry.RequestID)
	return strings.Contains(target, filter.keyword)
}

// parseEntryTime 解析日志记录时间。
// 参数 value 表示日志条目中的时间文本。
func parseEntryTime(value string) (time.Time, bool) {
	formats := []string{time.RFC3339Nano, time.RFC3339, "2006-01-02T15:04:05.000Z07:00", "2006-01-02 15:04:05"}
	for _, format := range formats {
		parsed, err := time.Parse(format, value)
		if err == nil {
			return parsed, true
		}
	}
	return time.Time{}, false
}

// sameDate 判断两个时间是否属于同一自然日。
// 参数 left 表示第一个时间；参数 right 表示第二个时间。
func sameDate(left time.Time, right time.Time) bool {
	left = left.In(right.Location())
	return left.Year() == right.Year() && left.Month() == right.Month() && left.Day() == right.Day()
}

// fileSize 返回文件当前大小，文件不存在时返回 0。
// 参数 path 表示需要检查的文件路径。
func fileSize(path string) int64 {
	info, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return info.Size()
}

// writeEvent 写入并刷新单个日志流事件。
// 参数 encoder 表示 NDJSON 编码器；参数 flusher 表示响应刷新器；参数 event 表示需要写入的事件。
func writeEvent(encoder *json.Encoder, flusher http.Flusher, event streamEvent) error {
	if err := encoder.Encode(event); err != nil {
		return err
	}
	flusher.Flush()
	return nil
}
