"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, ArrowRight, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withBase } from "@/lib/url";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [captchaUrl, setCaptchaUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 用户名最少 3 字符（之前的"必须是大陆手机号"放宽，因为用户名可能是手机号/字母/混合）
  const usernameError =
    username.length > 0 && username.trim().length < 3
      ? "用户名至少 3 个字符"
      : null;

  const canSubmit =
    username.trim().length >= 3 &&
    password.length > 0 &&
    captcha.trim().length > 0;

  const refreshCaptcha = useCallback(() => {
    setCaptcha("");
    setCaptchaUrl(withBase(`/api/admin/captcha?_t=${Date.now()}`));
  }, []);

  useEffect(() => {
    refreshCaptcha();
  }, [refreshCaptcha]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(withBase("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, captcha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "登录失败");
        // 服务端已销毁 captcha cookie，需要立刻刷新一张
        refreshCaptcha();
        setLoading(false);
        return;
      }
      // Full page navigation — 避免 Next.js 客户端路由与 middleware 重定向冲突
      window.location.href = withBase("/admin/reports");
    } catch {
      setError("网络错误，请重试");
      refreshCaptcha();
      setLoading(false);
    }
  };

  // —— input 在深色背景下的覆盖样式（! 用于压过 Input primitive 的默认 light theme） ——
  const darkInputClass =
    "!h-11 !px-3.5 !text-[15px] " +
    "!bg-white/[0.04] !border-white/15 !text-white placeholder:!text-white/30 " +
    "hover:!border-white/25 " +
    "focus-visible:!bg-white/[0.07] focus-visible:!border-[var(--blue-400)] focus-visible:!ring-[oklch(0.7_0.16_245_/_0.25)]";

  return (
    <div className="login-brand-panel relative min-h-dvh flex items-center justify-center p-6">
      {/* 左上 logo */}
      <header className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-2.5 z-10">
        <div className="size-9 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center shadow-[0_4px_12px_oklch(0_0_0_/_0.3)]">
          <ShieldCheck className="size-4 text-white" strokeWidth={2.4} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-white">
            谨世 ATA
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-white/60 font-medium">
            admin&nbsp;hub
          </div>
        </div>
      </header>

      {/* 右上角运行状态 */}
      <div className="absolute top-8 right-8 hidden sm:flex items-center gap-2 text-[11px] text-white/60 z-10">
        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(0.7_0.18_155)]" />
        <span>系统运行正常</span>
      </div>

      {/* —— 中央 form 卡片：glassmorphism —— */}
      <div className="relative z-10 w-full max-w-[400px]">
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-2xl shadow-[0_30px_60px_-20px_oklch(0_0_0_/_0.5),inset_0_1px_0_oklch(1_0_0_/_0.08)] p-8 sm:p-10">
          <div className="mb-7 text-center">
            <div className="mb-3 flex items-center justify-center gap-2.5">
              <span
                aria-hidden
                className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--blue-400)]"
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--blue-300)]">
                谨世&nbsp;ATA&nbsp;·&nbsp;后台
              </span>
              <span
                aria-hidden
                className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--blue-400)]"
              />
            </div>
            <h1 className="text-[30px] font-semibold tracking-tight text-white leading-tight">
              欢迎回来
            </h1>
            <p className="mt-2 text-sm text-white/50">
              让每一份报告都被认真对待
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-[11px] font-medium text-white/55 uppercase tracking-wider"
              >
                用户名
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="手机号 / 用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                required
                className={darkInputClass}
                style={{ fontSize: "16px" }}
              />
              {usernameError && (
                <p className="text-xs text-red-300 pl-0.5">{usernameError}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-[11px] font-medium text-white/55 uppercase tracking-wider"
              >
                密码
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={darkInputClass}
                style={{ fontSize: "16px" }}
              />
            </div>

            {/* 图形验证码 — 输入 + 图（点图换一张） */}
            <div className="space-y-1.5">
              <Label
                htmlFor="captcha"
                className="text-[11px] font-medium text-white/55 uppercase tracking-wider"
              >
                验证码
              </Label>
              <div className="flex gap-2">
                <Input
                  id="captcha"
                  type="text"
                  placeholder="4 位字符"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value.trim())}
                  autoComplete="off"
                  maxLength={6}
                  required
                  className={`${darkInputClass} flex-1 uppercase tracking-widest`}
                  style={{ fontSize: "16px" }}
                />
                <button
                  type="button"
                  onClick={refreshCaptcha}
                  title="换一张"
                  aria-label="刷新验证码"
                  className="group relative shrink-0 h-11 w-[120px] rounded-lg overflow-hidden bg-white/[0.05] border border-white/15 hover:border-white/30 transition-colors cursor-pointer flex items-center justify-center"
                >
                  {captchaUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={captchaUrl}
                        alt="点击换一张"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <RefreshCw className="size-4 text-white" />
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-white/40">加载…</span>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="text-sm text-red-200 bg-red-500/10 border border-red-400/30 rounded-lg px-3 py-2.5 flex gap-2 items-start"
              >
                <span className="size-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="btn-primary-glow w-full h-11 rounded-xl text-[15px] font-medium flex items-center justify-center gap-2 group"
            >
              <span>{loading ? "登录中…" : "登录"}</span>
              {!loading && (
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2.25}
                />
              )}
            </button>
          </form>

          <p className="mt-7 text-xs text-white/40 text-center">
            忘记密码？请联系超管重置
          </p>
        </div>
      </div>

      {/* 底部 copyright */}
      <footer className="absolute bottom-5 left-0 right-0 flex items-center justify-center gap-3 text-[11px] text-white/35 z-10">
        <span>© {new Date().getFullYear()} 谨世 ATA · admin-hub</span>
        <span className="hidden sm:inline text-white/20">·</span>
        <span className="hidden sm:inline tabular-nums">v0.1.19</span>
      </footer>
    </div>
  );
}
