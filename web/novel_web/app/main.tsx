import "@douyinfe/semi-ui-19/react19-adapter";
import "@douyinfe/semi-ui-19/lib/es/_base/base.css";
import "@xyflow/react/dist/style.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./app.css";
import { App } from "./App";
import { applyAppTheme, readStoredAppTheme } from "./theme";

// mountApp 将 React 应用挂载到指定 DOM 节点。
// 参数 container 表示承载 React 应用的根 DOM 节点。
function mountApp(container: HTMLElement) {
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// applyInitialTheme 在应用挂载前恢复用户上次选择的主题。
function applyInitialTheme() {
  applyAppTheme(readStoredAppTheme());
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("找不到前端应用根节点");
}

applyInitialTheme();
mountApp(root);
