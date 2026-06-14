import { useState, type ChangeEvent, type FormEvent } from "react";

import { loginWithPassword, persistAuthData } from "./api";

// LoginPageProps 表示登录页面需要的外部回调。
interface LoginPageProps {
  // onLoginSuccess 表示登录成功后通知应用层切换页面的回调。
  onLoginSuccess: () => void;
}

// LoginPage 渲染小说创作应用登录页面。
// 参数 props 表示登录页面需要的外部回调。
export function LoginPage(props: LoginPageProps) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  // handlePasswordChange 处理创作密钥输入框变化。
  // 参数 event 表示 React 输入框变化事件。
  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
  }

  // handleSubmit 处理登录表单提交并保存后端返回的访问令牌。
  // 参数 event 表示 React 表单提交事件。
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!password.trim()) {
      setStatus("error");
      setMessage("请输入创作密钥");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const data = await loginWithPassword(password);
      persistAuthData(data);
      setStatus("success");
      setMessage("登录成功，正在为你展开创作台");
      props.onLoginSuccess();
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "登录失败，请稍后再试");
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="paper-texture" aria-hidden="true" />

        <header className="brand-block">
          <div className="brand-seal" aria-hidden="true">
            墨
          </div>
          <h1 id="login-title">墨香墨苑</h1>
          <div className="brand-rule" aria-hidden="true" />
        </header>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="password-field" htmlFor="password">
            <span>输入创作密钥</span>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={handlePasswordChange}
              disabled={status === "loading"}
              required
            />
          </label>

          <p
            className={`login-message login-message-${status}`}
            role={status === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {message || "\u00a0"}
          </p>

          <button
            className="login-button"
            type="submit"
            disabled={status === "loading"}
          >
            <span>{status === "loading" ? "校验中" : "进入艺境"}</span>
            <span className="login-button-icon" aria-hidden="true">
              →
            </span>
          </button>
        </form>
      </section>
    </main>
  );
}
