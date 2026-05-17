"use client";

import { useState } from "react";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCnMobile } from "@/lib/phone";
import { withBase } from "@/lib/url";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const usernameError =
    username.length > 0 && !isValidCnMobile(username)
      ? "请输入 11 位大陆手机号"
      : null;

  const canSubmit = isValidCnMobile(username) && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(withBase("/api/admin/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "登录失败");
        setLoading(false);
        return;
      }
      // Full page navigation — 避免 Next.js 客户端路由与 middleware 重定向冲突
      window.location.href = withBase("/admin/reports");
    } catch {
      setError("网络错误，请重试");
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
          <div className="mb-7">
            <h1 className="text-[28px] font-semibold tracking-tight text-white leading-tight">
              欢迎回来
            </h1>
            <p className="mt-2 text-sm text-white/55">
              登录后管理报告与服务跟进
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-[11px] font-medium text-white/55 uppercase tracking-wider"
              >
                手机号
              </Label>
              <Input
                id="username"
                type="tel"
                inputMode="numeric"
                placeholder="11 位大陆手机号"
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                autoFocus
                autoComplete="username"
                maxLength={11}
                required
                className={`${darkInputClass} tabular-nums`}
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
        <span className="hidden sm:inline tabular-nums">v0.1.15</span>
      </footer>
    </div>
  );
}
