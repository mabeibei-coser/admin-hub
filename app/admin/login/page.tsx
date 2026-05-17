"use client";

import { useState } from "react";
import { ShieldCheck, ArrowRight, Briefcase, Compass, LifeBuoy } from "lucide-react";
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

  return (
    <div className="min-h-dvh flex">
      {/* ============ 左侧 form 面板 ============ */}
      <div className="login-form-panel relative flex flex-col flex-1 lg:flex-none lg:w-[44%] xl:w-[40%] min-w-0">
        {/* 顶部 logo */}
        <header className="px-8 lg:px-14 pt-8 lg:pt-10 flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-[var(--blue-700)] flex items-center justify-center shadow-[0_4px_12px_oklch(0.55_0.2_252_/_0.35)]">
            <ShieldCheck className="size-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight text-[var(--navy-800)]">
              谨世 ATA
            </div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--blue-600)] font-medium">
              admin&nbsp;hub
            </div>
          </div>
        </header>

        {/* 中段 form — 垂直居中 */}
        <main className="flex-1 flex items-center px-8 lg:px-14">
          <div className="w-full max-w-[380px] mx-auto py-12">
            <div className="mb-9">
              <h1 className="text-[28px] font-semibold tracking-tight text-[var(--navy-900)] leading-tight">
                欢迎回来
              </h1>
              <p className="mt-2 text-sm text-gray-500">
                登录后管理报告与服务跟进
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label
                  htmlFor="username"
                  className="text-[11px] font-medium text-gray-500 uppercase tracking-wider"
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
                  className="!h-11 !px-3.5 !text-[15px] tabular-nums"
                  style={{ fontSize: "16px" }}
                />
                {usernameError && (
                  <p className="text-xs text-red-600 pl-0.5">{usernameError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="password"
                  className="text-[11px] font-medium text-gray-500 uppercase tracking-wider"
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
                  className="!h-11 !px-3.5 !text-[15px]"
                  style={{ fontSize: "16px" }}
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="text-sm text-red-700 bg-red-50/80 border border-red-200/70 rounded-lg px-3 py-2.5 flex gap-2 items-start"
                >
                  <span className="size-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
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

            <p className="mt-7 text-xs text-gray-400 text-center">
              忘记密码？请联系超管重置
            </p>
          </div>
        </main>

        {/* 底部 copyright */}
        <footer className="px-8 lg:px-14 pb-6 flex items-center justify-between text-[11px] text-gray-400">
          <span>© {new Date().getFullYear()} 谨世 ATA · admin-hub</span>
          <span className="tabular-nums">v0.1.14</span>
        </footer>
      </div>

      {/* ============ 右侧 brand 面板（仅 lg+ 显示） ============ */}
      <aside className="login-brand-panel hidden lg:flex flex-1 relative items-center justify-center p-14 text-white">
        {/* 顶部辅助 chip */}
        <div className="absolute top-10 right-12 flex items-center gap-2 text-[11px] text-white/60 z-10">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(0.7_0.18_155)]" />
          <span>系统运行正常</span>
        </div>

        {/* 中央内容 */}
        <div className="relative z-10 max-w-md text-center">
          {/* 浮动品牌 mark */}
          <div className="login-mark mx-auto mb-10 size-20 rounded-3xl bg-white/[0.08] border border-white/15 backdrop-blur-md flex items-center justify-center shadow-[0_30px_60px_-20px_oklch(0_0_0_/_0.5)]">
            <ShieldCheck className="size-10 text-white" strokeWidth={1.5} />
          </div>

          <h2 className="text-[34px] leading-[1.15] font-semibold tracking-tight text-gradient-hero">
            一处后台
            <br />
            管全部业务
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-white/65 max-w-sm mx-auto">
            职业定位 · 职业导航 · 服务跟进
            <br />
            报告查阅、客户对接、权限管理 一站完成
          </p>

          {/* 业务模块 chip 行 */}
          <div className="mt-10 flex items-center justify-center gap-2">
            <BrandChip icon={Briefcase} label="职业定位" />
            <BrandChip icon={Compass} label="职业导航" />
            <BrandChip icon={LifeBuoy} label="服务跟进" />
          </div>
        </div>

        {/* 底部分隔线 + 引文 */}
        <div className="absolute bottom-12 left-14 right-14 z-10">
          <div className="brand-divider h-px w-full mb-5" />
          <p className="text-xs text-white/45 text-center tracking-wide">
            「让每一份报告都被认真对待」
          </p>
        </div>
      </aside>
    </div>
  );
}

function BrandChip({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md text-[12px] text-white/80">
      <Icon className="size-3.5 text-white/60" strokeWidth={2} />
      <span>{label}</span>
    </div>
  );
}
