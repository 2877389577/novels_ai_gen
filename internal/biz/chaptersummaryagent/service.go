package chaptersummaryagent

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	bizaiprovider "novels_ai_gen/internal/biz/aiprovider"
	bizchapter "novels_ai_gen/internal/biz/chapter"
	biznovelagent "novels_ai_gen/internal/biz/novelagent"
	appconfig "novels_ai_gen/internal/bootstrap/config"
)

const (
	defaultChapterSummaryTaskLimit = 128
	defaultChapterSummaryTimeout   = 300 * time.Second
	defaultChapterSummaryBackoff   = 300 * time.Millisecond
)

// ConfigProvider 表示读取当前应用配置快照的依赖。
type ConfigProvider interface {
	// Current 返回最近一次成功加载的应用配置副本。
	Current() *appconfig.AppConfig
}

// ProviderRepository 表示章节概要 Agent 读取 AI 提供商所需的仓储依赖。
type ProviderRepository interface {
	// GetByID 根据 ID 查询 AI 提供商。
	// 参数 ctx 表示请求上下文；参数 id 表示 AI 提供商主键 ID。
	GetByID(ctx context.Context, id uint64) (*bizaiprovider.Provider, error)
}

// Cipher 表示章节概要 Agent 解密 AI 提供商密钥所需的依赖。
type Cipher interface {
	// Decrypt 解密 AI 提供商 API Key 密文。
	// 参数 value 表示需要解密的密文。
	Decrypt(value string) (string, error)
}

// ChapterStore 表示章节概要 Agent 写回章节概要所需的数据依赖。
type ChapterStore interface {
	// UpdateChapterSummary 只更新章节总结字段并返回更新后的章节。
	// 参数 ctx 表示请求上下文；参数 condition 表示章节总结更新条件。
	UpdateChapterSummary(ctx context.Context, condition bizchapter.UpdateChapterSummaryCondition) (*bizchapter.Chapter, error)
}

// Service 表示后台章节概要 Agent 服务。
type Service struct {
	// configProvider 表示当前应用配置快照来源。
	configProvider ConfigProvider
	// providerRepo 表示 AI 提供商仓储。
	providerRepo ProviderRepository
	// cipher 表示 AI 提供商 API Key 解密器。
	cipher Cipher
	// textGenerator 表示直接调用模型生成文本的组件。
	textGenerator biznovelagent.ModelTextGenerator
	// chapterStore 表示章节概要写回仓储。
	chapterStore ChapterStore
	// logger 表示结构化日志记录器。
	logger *slog.Logger
	// ctx 表示后台 worker 生命周期上下文。
	ctx context.Context
	// cancel 表示停止后台 worker 的取消函数。
	cancel context.CancelFunc
	// cond 表示 worker 等待新任务的条件变量。
	cond *sync.Cond
	// pending 表示按章节去重后的待处理任务集合。
	pending map[chapterSummaryTaskKey]bizchapter.ChapterSummaryGenerationTask
	// closed 表示后台服务是否已经关闭。
	closed bool
	// taskLimit 表示 pending 中最多保留的不同章节任务数量。
	taskLimit int
	// wg 表示等待后台 worker 退出的同步器。
	wg sync.WaitGroup
}

// NewService 创建后台章节概要 Agent 服务并启动 worker。
// 参数 configProvider 表示当前应用配置快照来源；参数 providerRepo 表示 AI 提供商仓储；参数 cipher 表示 AI 提供商 API Key 解密器；参数 textGenerator 表示直接调用模型生成文本的组件；参数 chapterStore 表示章节概要写回仓储；参数 logger 表示结构化日志记录器。
func NewService(configProvider ConfigProvider, providerRepo ProviderRepository, cipher Cipher, textGenerator biznovelagent.ModelTextGenerator, chapterStore ChapterStore, logger *slog.Logger) *Service {
	ctx, cancel := context.WithCancel(context.Background())
	service := &Service{
		configProvider: configProvider,
		providerRepo:   providerRepo,
		cipher:         cipher,
		textGenerator:  textGenerator,
		chapterStore:   chapterStore,
		logger:         logger,
		ctx:            ctx,
		cancel:         cancel,
		pending:        make(map[chapterSummaryTaskKey]bizchapter.ChapterSummaryGenerationTask),
		taskLimit:      defaultChapterSummaryTaskLimit,
	}
	service.cond = sync.NewCond(&sync.Mutex{})
	service.wg.Add(1)
	go service.runWorker()
	return service
}

// Enqueue 将章节概要生成任务加入后台队列。
// 参数 task 表示需要生成概要的章节快照。
func (s *Service) Enqueue(task bizchapter.ChapterSummaryGenerationTask) {
	if s == nil {
		return
	}
	key := newChapterSummaryTaskKey(task)
	if key.chapterID == 0 || key.novelID == 0 {
		s.logWarn("章节概要生成任务缺少章节标识", "novel_id", task.NovelID, "chapter_id", task.ChapterID)
		return
	}

	s.cond.L.Lock()
	defer s.cond.L.Unlock()
	if s.closed {
		return
	}
	if _, exists := s.pending[key]; !exists && len(s.pending) >= s.taskLimit {
		s.logWarn("章节概要生成队列已满，跳过新任务", "novel_id", task.NovelID, "chapter_id", task.ChapterID)
		return
	}
	s.pending[key] = task
	s.cond.Signal()
}

// Close 停止后台章节概要 Agent worker 并等待退出。
func (s *Service) Close() {
	if s == nil {
		return
	}
	s.cond.L.Lock()
	if !s.closed {
		s.closed = true
		s.cancel()
		s.cond.Broadcast()
	}
	s.cond.L.Unlock()
	s.wg.Wait()
}

// GenerateForChapter 立即为单个章节生成概要并写回数据库。
// 参数 ctx 表示请求上下文；参数 task 表示需要生成概要的章节快照。
func (s *Service) GenerateForChapter(ctx context.Context, task bizchapter.ChapterSummaryGenerationTask) error {
	if s == nil {
		return fmt.Errorf("章节概要 Agent 服务未初始化")
	}
	if s.textGenerator == nil {
		return fmt.Errorf("章节概要 Agent 模型生成器未初始化")
	}
	if s.chapterStore == nil {
		return fmt.Errorf("章节概要 Agent 章节仓储未初始化")
	}
	if err := validateChapterSummaryTask(task); err != nil {
		return err
	}
	if strings.TrimSpace(task.Content) == "" {
		return nil
	}

	cfg := s.currentConfig()
	if cfg == nil {
		return ErrChapterSummaryAgentNotConfigured
	}
	agentCfg, err := newRuntimeChapterSummaryAgentConfig(cfg.AI.ChapterSummaryAgent)
	if err != nil {
		return err
	}
	if !agentCfg.enabled {
		return nil
	}

	modelCfg, err := s.modelConfig(ctx, agentCfg)
	if err != nil {
		return err
	}
	output, err := s.textGenerator.GenerateText(ctx, modelCfg, agentCfg.retry, biznovelagent.ModelTextInput{
		SystemPrompt: agentCfg.instruction,
		UserPrompt:   chapterSummaryUserPrompt(task),
	})
	if err != nil {
		return fmt.Errorf("章节概要模型生成失败: %w", err)
	}
	summary := normalizeChapterSummaryOutput(output)
	if strings.TrimSpace(summary) == "" {
		return fmt.Errorf("章节概要模型返回空内容")
	}

	if _, err := s.chapterStore.UpdateChapterSummary(ctx, bizchapter.UpdateChapterSummaryCondition{
		NovelID:   task.NovelID,
		ChapterID: task.ChapterID,
		Summary:   summary,
	}); err != nil {
		return fmt.Errorf("写入章节概要失败: %w", err)
	}
	return nil
}

// runWorker 持续消费后台章节概要生成任务。
func (s *Service) runWorker() {
	defer s.wg.Done()
	for {
		task, ok := s.nextTask()
		if !ok {
			return
		}

		ctx, cancel := context.WithTimeout(s.ctx, defaultChapterSummaryTimeout)
		err := s.GenerateForChapter(ctx, task)
		cancel()
		if err != nil {
			s.logError("后台章节概要生成失败", err, "novel_id", task.NovelID, "chapter_id", task.ChapterID, "chapter_number", task.ChapterNumber)
			continue
		}
		s.logInfo("后台章节概要生成完成", "novel_id", task.NovelID, "chapter_id", task.ChapterID, "chapter_number", task.ChapterNumber)
	}
}

// nextTask 从去重队列中取出一个待处理任务。
func (s *Service) nextTask() (bizchapter.ChapterSummaryGenerationTask, bool) {
	s.cond.L.Lock()
	defer s.cond.L.Unlock()

	for len(s.pending) == 0 && !s.closed {
		s.cond.Wait()
	}
	if s.closed {
		return bizchapter.ChapterSummaryGenerationTask{}, false
	}

	for key, task := range s.pending {
		delete(s.pending, key)
		return task, true
	}
	return bizchapter.ChapterSummaryGenerationTask{}, false
}

// currentConfig 返回当前应用配置快照。
func (s *Service) currentConfig() *appconfig.AppConfig {
	if s == nil || s.configProvider == nil {
		return appconfig.Get()
	}
	return s.configProvider.Current()
}

// modelConfig 根据章节概要 Agent 配置读取实际模型凭据。
// 参数 ctx 表示请求上下文；参数 agentCfg 表示运行时章节概要 Agent 配置。
func (s *Service) modelConfig(ctx context.Context, agentCfg runtimeChapterSummaryAgentConfig) (biznovelagent.ModelConfig, error) {
	if s == nil || s.providerRepo == nil {
		return biznovelagent.ModelConfig{}, fmt.Errorf("AI 提供商仓储未初始化")
	}
	if s.cipher == nil {
		return biznovelagent.ModelConfig{}, fmt.Errorf("AI 提供商密钥解密器未初始化")
	}

	provider, err := s.providerRepo.GetByID(ctx, agentCfg.providerID)
	if err != nil {
		return biznovelagent.ModelConfig{}, fmt.Errorf("章节概要 Agent 模型提供商 %d 不可用: %w", agentCfg.providerID, err)
	}
	if !provider.Enabled {
		return biznovelagent.ModelConfig{}, biznovelagent.ErrProviderDisabled
	}
	apiKey, err := s.cipher.Decrypt(provider.APIKeyCiphertext)
	if err != nil {
		return biznovelagent.ModelConfig{}, fmt.Errorf("解密章节概要 Agent API Key 失败: %w", err)
	}

	return biznovelagent.ModelConfig{
		ProviderID:      provider.ID,
		ProviderType:    provider.ProviderType,
		APIType:         provider.APIType,
		APIKey:          apiKey,
		BaseURL:         provider.BaseURL,
		Model:           agentCfg.model,
		ReasoningEffort: agentCfg.reasoningEffort,
	}, nil
}

// logInfo 写出章节概要 Agent 信息日志。
// 参数 message 表示日志消息；参数 args 表示结构化日志字段。
func (s *Service) logInfo(message string, args ...any) {
	if s != nil && s.logger != nil {
		s.logger.Info(message, args...)
		return
	}
	slog.Info(message, args...)
}

// logWarn 写出章节概要 Agent 警告日志。
// 参数 message 表示日志消息；参数 args 表示结构化日志字段。
func (s *Service) logWarn(message string, args ...any) {
	if s != nil && s.logger != nil {
		s.logger.Warn(message, args...)
		return
	}
	slog.Warn(message, args...)
}

// logError 写出章节概要 Agent 错误日志。
// 参数 message 表示日志消息；参数 err 表示错误对象；参数 args 表示结构化日志字段。
func (s *Service) logError(message string, err error, args ...any) {
	fields := append([]any{"error", err}, args...)
	if s != nil && s.logger != nil {
		s.logger.Error(message, fields...)
		return
	}
	slog.Error(message, fields...)
}

// chapterSummaryTaskKey 表示后台章节概要任务的去重键。
type chapterSummaryTaskKey struct {
	// novelID 表示所属小说 ID。
	novelID uint64
	// chapterID 表示章节主键 ID。
	chapterID uint64
}

// newChapterSummaryTaskKey 根据章节概要任务创建去重键。
// 参数 task 表示需要生成概要的章节快照。
func newChapterSummaryTaskKey(task bizchapter.ChapterSummaryGenerationTask) chapterSummaryTaskKey {
	return chapterSummaryTaskKey{
		novelID:   task.NovelID,
		chapterID: task.ChapterID,
	}
}
