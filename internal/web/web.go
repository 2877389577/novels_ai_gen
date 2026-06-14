package web

import (
	"embed"
	"fmt"
	"io/fs"
)

// embeddedFiles 表示编译进 Go 二进制文件中的前端构建产物。
//
//go:embed dist
var embeddedFiles embed.FS

// FS 返回前端构建产物所在的嵌入式文件系统。
func FS() fs.FS {
	return mustSubFS(embeddedFiles, "dist")
}

// mustSubFS 从嵌入式文件系统中截取指定子目录，失败时直接中断启动。
// 参数 source 表示原始嵌入式文件系统；参数 dir 表示需要截取的子目录。
func mustSubFS(source fs.FS, dir string) fs.FS {
	sub, err := fs.Sub(source, dir)
	if err != nil {
		panic(fmt.Errorf("初始化前端嵌入文件失败: %w", err))
	}
	return sub
}
