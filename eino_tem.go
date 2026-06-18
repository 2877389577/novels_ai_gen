package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"github.com/cloudwego/eino-ext/components/model/openai"
	"github.com/cloudwego/eino/adk"
	"github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/components/tool/utils"
	"github.com/cloudwego/eino/compose"
	"github.com/cloudwego/eino/schema"
)

type WeatherTool struct {
	Origin string `json:"origin" jsonschema:"required" jsonschema_description:"要查询的城市"`
}

func getWeather(ctx context.Context, tool *WeatherTool) (string, error) {
	if tool.Origin == "" {
		return "", errors.New("origin is required")
	}
	fmt.Println("天气查询工具被调用")
	return "天气:晴朗", nil
}

func NewWeatherTool() (tool.BaseTool, error) {
	return utils.InferTool("get_weather", "查询城市的天气", getWeather)
}

func main() {
	ctx := context.TODO()
	err := adk.SetLanguage(adk.LanguageChinese)
	if err != nil {
		panic(err)
	}

	model, err := openai.NewChatModel(ctx, &openai.ChatModelConfig{
		Model:   "doubao-seed-2-0-pro-260215",
		BaseURL: "https://windhub.cc/v1",
		APIKey:  "xxxxxxxxxxxx",
	})

	if err != nil {
		panic(err)
	}

	msg := []*schema.Message{
		schema.UserMessage(fmt.Sprint("北京的天气怎么样？")),
	}

	weatherTool, _ := NewWeatherTool()
	t := []tool.BaseTool{weatherTool}

	agentTool, err := adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.Message]{
		Name:        "天气查询机器人",
		Description: "负责天气查询的机器人",
		Instruction: "你是一个智能机器人，使用工具完成任务。",
		Model:       model,
		ToolsConfig: adk.ToolsConfig{
			ToolsNodeConfig: compose.ToolsNodeConfig{
				Tools: t,
			},
		},
	})

	newAgentTool := adk.NewAgentTool(ctx, agentTool)

	at := []tool.BaseTool{newAgentTool}

	agent, _ := adk.NewTypedChatModelAgent(ctx, &adk.TypedChatModelAgentConfig[*schema.Message]{
		Name:        "顶层Agent",
		Description: "负责调度子Agent",
		Instruction: "你是一个智能机器人，负责调度工具来完成任务，如果你发现没有工具能够完成用户的人物，那么你需要自己完成。",
		Model:       model,
		ToolsConfig: adk.ToolsConfig{
			ToolsNodeConfig: compose.ToolsNodeConfig{
				Tools: at,
			},
		},
	})

	if err != nil {
		panic(err)
	}

	runner := adk.NewTypedRunner(adk.TypedRunnerConfig[*schema.Message]{
		agent,
		false,
		nil,
	})

	run := runner.Run(ctx, msg)

	for {
		next, b := run.Next()
		if !b {
			break
		}
		if next.Err != nil {
			slog.Error("error:", next.Err.Error())
			continue
		}
		if next.Output != nil {
			fmt.Println(next.Output.MessageOutput)
		}
	}

}
