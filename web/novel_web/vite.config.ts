import { existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const embeddedWebOutDir = resolve(__dirname, "../../internal/web/dist");

// BundleAsset 表示 Vite 构建输出中的静态资源。
interface BundleAsset {
  // type 表示输出资源类型。
  type: "asset";
  // source 表示输出资源内容。
  source: string | Uint8Array;
}

// BundleChunk 表示 Vite 构建输出中的 JavaScript 代码块。
interface BundleChunk {
  // type 表示输出代码块类型。
  type: "chunk";
  // code 表示输出代码块内容。
  code: string;
}

type BundleOutput = Record<string, BundleAsset | BundleChunk>;

// cleanEmbeddedWebOutDir 清理上一轮前端构建产物。
// 参数 outDir 表示 Vite 输出编译文件的目标目录。
function cleanEmbeddedWebOutDir(outDir: string) {
  if (!existsSync(outDir)) {
    return;
  }

  for (const entry of readdirSync(outDir, { withFileTypes: true })) {
    rmSync(resolve(outDir, entry.name), { force: true, recursive: true });
  }
}

// inlineCompiledAssets 创建把编译后 JS 和 CSS 内联进 HTML 的 Vite 插件。
function inlineCompiledAssets(): Plugin {
  return {
    name: "inline-compiled-assets",
    apply: "build",
    enforce: "post",
    buildStart() {
      cleanEmbeddedWebOutDir(embeddedWebOutDir);
    },
    generateBundle(_options, bundle) {
      const outputBundle = bundle as BundleOutput;
      const htmlAsset = findIndexHtmlAsset(outputBundle);
      if (!htmlAsset || typeof htmlAsset.source !== "string") {
        return;
      }

      let html = htmlAsset.source;

      for (const [fileName, output] of Object.entries(outputBundle)) {
        if (output.type === "chunk") {
          html = inlineScriptChunk(html, fileName, output);
          delete outputBundle[fileName];
          continue;
        }

        if (output.type === "asset" && fileName.endsWith(".css")) {
          html = inlineStyleAsset(html, fileName, output);
          delete outputBundle[fileName];
        }
      }

      htmlAsset.source = html;
    },
  };
}

// findIndexHtmlAsset 从 Rollup 输出集合中查找入口 HTML 资源。
// 参数 bundle 表示 Vite 交给 Rollup 的输出资源集合。
function findIndexHtmlAsset(bundle: BundleOutput): BundleAsset | undefined {
  const output = bundle["index.html"];
  if (output?.type === "asset") {
    return output;
  }
  return undefined;
}

// inlineScriptChunk 将指定 JS chunk 对应的 script 标签替换为内联脚本。
// 参数 html 表示当前 HTML 内容；参数 fileName 表示 chunk 文件名；参数 chunk 表示 JS 输出块。
function inlineScriptChunk(
  html: string,
  fileName: string,
  chunk: BundleChunk,
): string {
  const scriptTag = new RegExp(
    `<script\\b[^>]*\\bsrc=["']/${escapeRegExp(fileName)}["'][^>]*></script>`,
    "g",
  );
  return html.replace(
    scriptTag,
    () => `<script type="module">\n${chunk.code}\n</script>`,
  );
}

// inlineStyleAsset 将指定 CSS asset 对应的 link 标签替换为内联样式。
// 参数 html 表示当前 HTML 内容；参数 fileName 表示 CSS 文件名；参数 asset 表示 CSS 输出资源。
function inlineStyleAsset(
  html: string,
  fileName: string,
  asset: BundleAsset,
): string {
  const styleTag = new RegExp(
    `<link\\b[^>]*\\bhref=["']/${escapeRegExp(fileName)}["'][^>]*>`,
    "g",
  );
  return html.replace(styleTag, () => `<style>\n${String(asset.source)}\n</style>`);
}

// escapeRegExp 转义字符串中对正则表达式有特殊含义的字符。
// 参数 value 表示需要放入正则表达式的原始字符串。
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default defineConfig({
  plugins: [tailwindcss(), inlineCompiledAssets()],
  build: {
    assetsDir: "assets",
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    emptyOutDir: false,
    modulePreload: false,
    outDir: embeddedWebOutDir,
    rollupOptions: {
      input: "index.html",
    },
  },
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
