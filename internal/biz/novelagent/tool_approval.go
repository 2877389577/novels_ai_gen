package novelagent

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/cloudwego/eino/adk"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
)

const toolApprovalRequiredMessage = "该工具执行前需要人工审核"

// init 注册人工审核中断恢复相关类型，确保 Eino checkpoint 可以序列化自定义数据。
func init() {
	schema.RegisterName[ToolApprovalInterruptInfo]("novelagent_tool_approval_interrupt_info")
	schema.RegisterName[ToolApprovalResumeData]("novelagent_tool_approval_resume_data")
}

// ToolApprovalInterruptInfo 表示工具执行前请求人工审核时展示给用户的信息。
type ToolApprovalInterruptInfo struct {
	// ToolName 表示请求执行的工具名称。
	ToolName string `json:"tool_name"`
	// ToolArguments 表示请求执行工具时模型生成的参数 JSON 字符串。
	ToolArguments string `json:"tool_arguments"`
	// Message 表示展示给用户的审核提示。
	Message string `json:"message"`
}

// ToolApprovalRejectedResult 表示用户拒绝执行工具后返回给 Agent 的结构化结果。
type ToolApprovalRejectedResult struct {
	// OK 表示工具是否成功执行，拒绝时固定为 false。
	OK bool `json:"ok"`
	// Status 表示工具执行状态，拒绝时为 rejected。
	Status string `json:"status"`
	// Tool 表示被拒绝执行的工具名称。
	Tool string `json:"tool"`
	// Message 表示返回给 Agent 的拒绝说明。
	Message string `json:"message"`
	// Reason 表示用户拒绝时填写的补充原因。
	Reason string `json:"reason,omitempty"`
}

// approvalInvokableTool 表示带人工审核能力的 InvokableTool 包装器。
type approvalInvokableTool struct {
	// inner 表示被包装的原始工具。
	inner tool.InvokableTool
	// toolName 表示工具固定名称。
	toolName string
}

// emptyJSONArgumentsInvokableTool 表示会把空参数恢复为 JSON 空对象的 InvokableTool 包装器。
type emptyJSONArgumentsInvokableTool struct {
	// inner 表示被包装的原始工具。
	inner tool.InvokableTool
}

// Info 返回被包装工具的元信息。
// 参数 ctx 表示请求上下文。
func (t emptyJSONArgumentsInvokableTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return t.inner.Info(ctx)
}

// InvokableRun 执行工具前把空白参数标准化为合法 JSON 空对象。
// 参数 ctx 表示请求上下文；参数 argumentsInJSON 表示模型传入的工具参数 JSON 字符串；参数 opts 表示 Eino 工具调用选项。
func (t emptyJSONArgumentsInvokableTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	return t.inner.InvokableRun(ctx, normalizeToolArgumentsJSON(argumentsInJSON), opts...)
}

// Info 返回被包装工具的元信息。
// 参数 ctx 表示请求上下文。
func (t approvalInvokableTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return t.inner.Info(ctx)
}

// InvokableRun 在需要时先触发人工审核，再执行被包装工具。
// 参数 ctx 表示请求上下文；参数 argumentsInJSON 表示模型传入的工具参数 JSON 字符串；参数 opts 表示 Eino 工具调用选项。
func (t approvalInvokableTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...tool.Option) (string, error) {
	info := ToolApprovalInterruptInfo{
		ToolName:      t.toolName,
		ToolArguments: argumentsInJSON,
		Message:       toolApprovalRequiredMessage,
	}

	wasInterrupted, _, _ := tool.GetInterruptState[any](ctx)
	if !wasInterrupted {
		return "", tool.Interrupt(ctx, info)
	}

	isResumeTarget, hasResumeData, data := tool.GetResumeContext[ToolApprovalResumeData](ctx)
	if !isResumeTarget || !hasResumeData {
		return "", tool.Interrupt(ctx, info)
	}
	if !data.Approved {
		return toolApprovalRejectedJSON(t.toolName, data.Reason)
	}
	return t.inner.InvokableRun(ctx, argumentsInJSON, opts...)
}

// wrapToolApproval 按工具配置为普通工具增加人工审核包装。
// 参数 baseTool 表示原始工具；参数 toolConfig 表示工具运行时配置。
func wrapToolApproval(baseTool tool.BaseTool, toolConfig runtimeAgentTool) (tool.BaseTool, error) {
	if !toolConfig.requireApproval {
		return baseTool, nil
	}
	invokableTool, ok := baseTool.(tool.InvokableTool)
	if !ok {
		return nil, fmt.Errorf("%w: 工具 %s 不支持人工审核包装", ErrAgentConfigInvalid, toolConfig.name)
	}
	return approvalInvokableTool{inner: invokableTool, toolName: toolConfig.name}, nil
}

// wrapEmptyJSONArguments 为普通可调用工具增加空 JSON 参数兼容包装。
// 参数 baseTool 表示需要包装的工具。
func wrapEmptyJSONArguments(baseTool tool.BaseTool) tool.BaseTool {
	invokableTool, ok := baseTool.(tool.InvokableTool)
	if !ok {
		return baseTool
	}
	return emptyJSONArgumentsInvokableTool{inner: invokableTool}
}

// normalizeToolArgumentsJSON 将模型输出的空白工具参数恢复为合法 JSON 空对象。
// 参数 argumentsInJSON 表示模型传入的工具参数 JSON 字符串。
func normalizeToolArgumentsJSON(argumentsInJSON string) string {
	if strings.TrimSpace(argumentsInJSON) == "" {
		return "{}"
	}
	return argumentsInJSON
}

// toolApprovalRejectedJSON 生成用户拒绝执行工具后返回给 Agent 的 JSON 文本。
// 参数 toolName 表示被拒绝执行的工具名称；参数 reason 表示用户拒绝时填写的补充原因。
func toolApprovalRejectedJSON(toolName string, reason string) (string, error) {
	result := ToolApprovalRejectedResult{
		OK:      false,
		Status:  "rejected",
		Tool:    toolName,
		Message: "用户已拒绝执行该工具，本次工具未执行",
		Reason:  strings.TrimSpace(reason),
	}
	data, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("序列化工具拒绝结果失败: %w", err)
	}
	return string(data), nil
}

// AgentInterruptedError 表示 Agent 运行因等待人工审核而中断。
type AgentInterruptedError struct {
	// CheckPointID 表示恢复 Agent 执行所需的 checkpoint 标识。
	CheckPointID string
	// InterruptID 表示恢复 Agent 执行所需的中断点标识。
	InterruptID string
	// ToolName 表示等待人工审核的工具名称。
	ToolName string
	// ToolArguments 表示等待人工审核的工具调用参数 JSON 字符串。
	ToolArguments string
	// Message 表示展示给用户的审核提示。
	Message string
}

// Error 返回人工审核中断的错误说明。
func (e *AgentInterruptedError) Error() string {
	if e == nil {
		return ""
	}
	return "novel agent waiting for tool approval"
}

// agentInterruptedErrorFromInfo 将 Eino 中断信息转换为业务层人工审核中断错误。
// 参数 checkPointID 表示当前运行使用的 checkpoint 标识；参数 info 表示 Eino ADK 返回的中断信息。
func agentInterruptedErrorFromInfo(checkPointID string, info *adk.InterruptInfo) *AgentInterruptedError {
	if info == nil || len(info.InterruptContexts) == 0 {
		return &AgentInterruptedError{CheckPointID: checkPointID, Message: toolApprovalRequiredMessage}
	}
	interruptCtx := rootCauseInterruptContext(info.InterruptContexts)
	approvalInfo := approvalInfoFromInterruptContext(interruptCtx)
	toolName := approvalInfo.ToolName
	if toolName == "" {
		toolName = toolNameFromInterruptContext(interruptCtx)
	}
	message := approvalInfo.Message
	if strings.TrimSpace(message) == "" {
		message = toolApprovalRequiredMessage
	}
	return &AgentInterruptedError{
		CheckPointID:  checkPointID,
		InterruptID:   interruptCtx.ID,
		ToolName:      toolName,
		ToolArguments: approvalInfo.ToolArguments,
		Message:       message,
	}
}

// rootCauseInterruptContext 返回根因中断点。
// 参数 contexts 表示 Eino ADK 返回的中断上下文列表。
func rootCauseInterruptContext(contexts []*adk.InterruptCtx) *adk.InterruptCtx {
	for _, item := range contexts {
		if item != nil && item.IsRootCause {
			return item
		}
	}
	for _, item := range contexts {
		if item != nil {
			return item
		}
	}
	return &adk.InterruptCtx{}
}

// approvalInfoFromInterruptContext 从中断上下文中提取工具审核信息。
// 参数 interruptCtx 表示 Eino ADK 返回的单个中断上下文。
func approvalInfoFromInterruptContext(interruptCtx *adk.InterruptCtx) ToolApprovalInterruptInfo {
	if interruptCtx == nil {
		return ToolApprovalInterruptInfo{}
	}
	switch info := interruptCtx.Info.(type) {
	case ToolApprovalInterruptInfo:
		return info
	case *ToolApprovalInterruptInfo:
		if info != nil {
			return *info
		}
	case map[string]any:
		return ToolApprovalInterruptInfo{
			ToolName:      stringFromMap(info, "tool_name"),
			ToolArguments: stringFromMap(info, "tool_arguments"),
			Message:       stringFromMap(info, "message"),
		}
	}
	return ToolApprovalInterruptInfo{}
}

// stringFromMap 从通用映射中读取字符串字段。
// 参数 values 表示通用映射；参数 key 表示需要读取的字段名。
func stringFromMap(values map[string]any, key string) string {
	value, ok := values[key]
	if !ok {
		return ""
	}
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return text
}

// toolNameFromInterruptContext 从中断地址中推断工具名称。
// 参数 interruptCtx 表示 Eino ADK 返回的单个中断上下文。
func toolNameFromInterruptContext(interruptCtx *adk.InterruptCtx) string {
	if interruptCtx == nil {
		return ""
	}
	for index := len(interruptCtx.Address) - 1; index >= 0; index-- {
		segment := interruptCtx.Address[index]
		if segment.Type == adk.AddressSegmentTool {
			return segment.ID
		}
	}
	return ""
}
