package system

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
)

const (
	targetRemote     = "origin"
	targetBranch     = "main"
	restartConfig    = "config/config-prod.yaml"
	restartLogPath   = "logs/update-restart.log"
	logsPathspec     = "logs"
	restartDelayExpr = "sleep 1"
)

var (
	// ErrUpdateInProgress 表示已经有系统更新任务正在执行。
	ErrUpdateInProgress = errors.New("system update in progress")
	// ErrDirtyWorktree 表示工作区存在除运行日志外的未提交改动。
	ErrDirtyWorktree = errors.New("dirty worktree")
)

// CommandRunner 表示系统更新过程中执行外部命令的依赖。
type CommandRunner interface {
	// Run 执行外部命令并返回合并后的标准输出和标准错误。
	// 参数 ctx 表示命令执行上下文；参数 dir 表示命令工作目录；参数 name 表示命令名称；参数 args 表示命令参数。
	Run(ctx context.Context, dir string, name string, args ...string) (string, error)
	// Start 启动后台命令并立即返回。
	// 参数 dir 表示命令工作目录；参数 name 表示命令名称；参数 args 表示命令参数。
	Start(dir string, name string, args ...string) error
}

// Service 表示系统维护业务服务。
type Service struct {
	// runner 表示用于执行 Git 和重启脚本的命令执行器。
	runner CommandRunner
	// mu 表示保护 updating 状态的互斥锁。
	mu sync.Mutex
	// updating 表示当前进程是否已经启动系统更新任务。
	updating bool
}

// UpdateResult 表示系统更新接口成功后的响应数据。
type UpdateResult struct {
	// Branch 表示本次更新拉取的目标分支。
	Branch string `json:"branch" example:"main"`
	// CommitBefore 表示更新前当前仓库的 commit。
	CommitBefore string `json:"commit_before" example:"f3c2d1e"`
	// CommitAfter 表示更新后当前仓库的 commit。
	CommitAfter string `json:"commit_after" example:"a8b7c6d"`
	// Restarting 表示是否已经启动后台重启脚本。
	Restarting bool `json:"restarting" example:"true"`
}

// NewService 创建系统维护业务服务。
func NewService() *Service {
	return NewServiceWithRunner(osCommandRunner{})
}

// NewServiceWithRunner 使用指定命令执行器创建系统维护业务服务。
// 参数 runner 表示用于执行外部命令的依赖。
func NewServiceWithRunner(runner CommandRunner) *Service {
	return &Service{runner: runner}
}

// TriggerUpdate 拉取 GitHub 最新代码并启动后台重启脚本。
// 参数 ctx 表示 HTTP 请求上下文，用于取消尚未完成的 Git 命令。
func (s *Service) TriggerUpdate(ctx context.Context) (UpdateResult, error) {
	if !s.beginUpdate() {
		return UpdateResult{}, ErrUpdateInProgress
	}

	success := false
	defer func() {
		if !success {
			s.finishFailedUpdate()
		}
	}()

	repoRoot, err := s.git(ctx, "", "rev-parse", "--show-toplevel")
	if err != nil {
		return UpdateResult{}, err
	}
	repoRoot = strings.TrimSpace(repoRoot)
	if repoRoot == "" {
		return UpdateResult{}, errors.New("解析仓库根目录失败")
	}

	commitBefore, err := s.git(ctx, repoRoot, "rev-parse", "HEAD")
	if err != nil {
		return UpdateResult{}, err
	}
	commitBefore = strings.TrimSpace(commitBefore)

	nonLogDirtyFiles, hasLogDirty, err := s.dirtyTrackedFiles(ctx, repoRoot)
	if err != nil {
		return UpdateResult{}, err
	}
	if len(nonLogDirtyFiles) > 0 {
		return UpdateResult{}, fmt.Errorf("%w: %s", ErrDirtyWorktree, strings.Join(nonLogDirtyFiles, ", "))
	}
	if hasLogDirty {
		if _, err := s.git(ctx, repoRoot, "checkout", "--", logsPathspec); err != nil {
			return UpdateResult{}, err
		}
	}

	if _, err := s.git(ctx, repoRoot, "fetch", targetRemote, targetBranch); err != nil {
		return UpdateResult{}, err
	}
	if err := s.checkoutTargetBranch(ctx, repoRoot); err != nil {
		return UpdateResult{}, err
	}
	if _, err := s.git(ctx, repoRoot, "pull", "--ff-only", targetRemote, targetBranch); err != nil {
		return UpdateResult{}, err
	}

	commitAfter, err := s.git(ctx, repoRoot, "rev-parse", "HEAD")
	if err != nil {
		return UpdateResult{}, err
	}
	commitAfter = strings.TrimSpace(commitAfter)

	if err := s.startRestartScript(repoRoot, os.Getpid()); err != nil {
		return UpdateResult{}, err
	}

	success = true
	return UpdateResult{
		Branch:       targetBranch,
		CommitBefore: commitBefore,
		CommitAfter:  commitAfter,
		Restarting:   true,
	}, nil
}

// beginUpdate 标记系统更新开始，若已有更新任务则返回 false。
func (s *Service) beginUpdate() bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.updating {
		return false
	}
	s.updating = true
	return true
}

// finishFailedUpdate 清理失败更新任务留下的运行状态。
func (s *Service) finishFailedUpdate() {
	s.mu.Lock()
	s.updating = false
	s.mu.Unlock()
}

// dirtyTrackedFiles 返回除日志外的已跟踪脏文件，并标记日志是否被修改。
// 参数 ctx 表示命令执行上下文；参数 repoRoot 表示 Git 仓库根目录。
func (s *Service) dirtyTrackedFiles(ctx context.Context, repoRoot string) ([]string, bool, error) {
	status, err := s.git(ctx, repoRoot, "status", "--porcelain", "--untracked-files=no")
	if err != nil {
		return nil, false, err
	}
	return parseDirtyTrackedFiles(status)
}

// checkoutTargetBranch 切换到一键更新固定使用的目标分支。
// 参数 ctx 表示命令执行上下文；参数 repoRoot 表示 Git 仓库根目录。
func (s *Service) checkoutTargetBranch(ctx context.Context, repoRoot string) error {
	if _, err := s.git(ctx, repoRoot, "show-ref", "--verify", "refs/heads/"+targetBranch); err == nil {
		_, err = s.git(ctx, repoRoot, "checkout", targetBranch)
		return err
	}

	_, err := s.git(ctx, repoRoot, "checkout", "-b", targetBranch, "--track", targetRemote+"/"+targetBranch)
	return err
}

// startRestartScript 启动后台重启脚本。
// 参数 repoRoot 表示 Git 仓库根目录；参数 pid 表示当前需要终止的旧进程 ID。
func (s *Service) startRestartScript(repoRoot string, pid int) error {
	script := fmt.Sprintf(
		"(%s; kill -TERM %d; sleep 1; cd %s; mkdir -p logs; nohup go run ./cmd/server/ -f %s >> %s 2>&1 &) >/dev/null 2>&1 &",
		restartDelayExpr,
		pid,
		shellQuote(repoRoot),
		shellQuote(restartConfig),
		shellQuote(restartLogPath),
	)
	return s.runner.Start(repoRoot, "sh", "-c", script)
}

// git 执行 Git 命令并返回命令输出。
// 参数 ctx 表示命令执行上下文；参数 dir 表示命令工作目录；参数 args 表示 Git 参数列表。
func (s *Service) git(ctx context.Context, dir string, args ...string) (string, error) {
	return s.runner.Run(ctx, dir, "git", args...)
}

// parseDirtyTrackedFiles 解析 git status --porcelain 输出。
// 参数 status 表示 Git 工作区状态文本。
func parseDirtyTrackedFiles(status string) ([]string, bool, error) {
	var nonLogDirtyFiles []string
	hasLogDirty := false

	for _, line := range strings.Split(status, "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		if len(line) < 4 {
			return nil, false, fmt.Errorf("解析 Git 状态失败: %s", line)
		}

		paths := statusLinePaths(line[3:])
		for _, filePath := range paths {
			if isLogPath(filePath) {
				hasLogDirty = true
				continue
			}
			nonLogDirtyFiles = append(nonLogDirtyFiles, filePath)
		}
	}

	return nonLogDirtyFiles, hasLogDirty, nil
}

// statusLinePaths 返回单条 Git 状态中的文件路径列表。
// 参数 rawPath 表示 Git 状态行中的路径部分。
func statusLinePaths(rawPath string) []string {
	rawPath = strings.TrimSpace(rawPath)
	parts := strings.Split(rawPath, " -> ")
	paths := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.Trim(strings.TrimSpace(part), `"`)
		if part != "" {
			paths = append(paths, part)
		}
	}
	return paths
}

// isLogPath 判断文件路径是否位于运行日志目录下。
// 参数 filePath 表示 Git 状态中返回的仓库相对路径。
func isLogPath(filePath string) bool {
	cleanPath := filepath.ToSlash(filepath.Clean(strings.TrimPrefix(filePath, "./")))
	return cleanPath == "logs" || strings.HasPrefix(cleanPath, "logs/")
}

// shellQuote 将字符串转换为 POSIX shell 单引号参数。
// 参数 value 表示需要传给 shell 的原始字符串。
func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\\''") + "'"
}

// osCommandRunner 表示使用操作系统进程执行命令的实现。
type osCommandRunner struct{}

// Run 执行外部命令并返回合并后的输出。
// 参数 ctx 表示命令执行上下文；参数 dir 表示命令工作目录；参数 name 表示命令名称；参数 args 表示命令参数。
func (osCommandRunner) Run(ctx context.Context, dir string, name string, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Dir = dir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return string(output), fmt.Errorf("执行命令 %s %s 失败: %w: %s", name, strings.Join(args, " "), err, strings.TrimSpace(string(output)))
	}
	return string(output), nil
}

// Start 启动后台命令并异步回收进程资源。
// 参数 dir 表示命令工作目录；参数 name 表示命令名称；参数 args 表示命令参数。
func (osCommandRunner) Start(dir string, name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("启动命令 %s %s 失败: %w", name, strings.Join(args, " "), err)
	}
	go func() {
		_ = cmd.Wait()
	}()
	return nil
}
