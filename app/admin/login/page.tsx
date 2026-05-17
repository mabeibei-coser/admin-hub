"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="relative min-h-dvh bg-gray-50">
      {/* Tabler 风顶部蓝色粗装饰条（border-top-wide border-primary） */}
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-1 bg-[var(--blue-700)] z-10"
      />

      <div className="min-h-dvh grid lg:grid-cols-[5fr_7fr]">
        {/* 左：登录表单区 */}
        <div className="flex items-center justify-center px-4 py-12 lg:px-12 bg-white">
          <div className="w-full max-w-sm">
            {/* 品牌标识 — 居中（Tabler navbar-logo 风） */}
            <div className="flex flex-col items-center gap-3 mb-8">
              <div className="size-12 rounded-2xl bg-[var(--blue-700)] flex items-center justify-center shadow-sm">
                <ShieldCheck className="size-6 text-white" />
              </div>
              <div className="text-center leading-tight">
                <h1 className="text-xl font-semibold tracking-tight text-[var(--navy-800)]">
                  谨世 ATA
                </h1>
                <p className="text-[11px] text-gray-500 mt-0.5">管理后台</p>
              </div>
            </div>

            {/* 登录卡片 — Tabler card card-md 风 */}
            <Card className="border border-[var(--report-border)] shadow-sm bg-white">
              <CardContent className="p-7">
                <h2 className="text-base font-semibold text-center text-[var(--navy-800)] mb-6">
                  登录到您的账号
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-xs text-gray-600">
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
                      className="h-10"
                      style={{ fontSize: "16px" }}
                    />
                    {usernameError && (
                      <p className="text-xs text-red-600">{usernameError}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password" className="text-xs text-gray-600">
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
                      className="h-10"
                      style={{ fontSize: "16px" }}
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-10 bg-[var(--blue-700)] hover:bg-[var(--blue-600)] text-white disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
                    disabled={loading || !canSubmit}
                  >
                    {loading ? "登录中…" : "登录"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* 底部 helper */}
            <p className="mt-6 text-[11px] text-gray-400 text-center">
              忘记密码？请联系超管重置
            </p>
          </div>
        </div>

        {/* 右：品牌叙述区（Tabler cover 风蓝色装饰区，仅桌面） */}
        <aside className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[var(--navy-900)] via-[var(--blue-700)] to-[var(--blue-600)]">
          {/* 几何网格装饰（复用 globals.css 的 hero-grid） */}
          <div aria-hidden className="absolute inset-0 hero-grid opacity-30" />
          {/* 柔光球装饰 */}
          <div
            aria-hidden
            className="absolute -top-32 -right-32 size-96 rounded-full bg-white/5 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-40 -left-32 size-[28rem] rounded-full bg-[var(--blue-400)]/15 blur-3xl"
          />

          {/* 内容 */}
          <div className="relative z-10 flex flex-col justify-center px-16 py-24 text-white max-w-2xl">
            <div className="flex items-center gap-2 mb-8">
              <div className="size-1.5 rounded-full bg-white/70" />
              <div className="text-[11px] font-mono text-white/60 tracking-wider uppercase">
                Admin Console
              </div>
            </div>
            <h2 className="text-4xl xl:text-5xl font-semibold tracking-tight leading-[1.15]">
              应届校招定位
              <br />
              与求职导航后台
            </h2>
            <p className="mt-5 text-sm text-white/70 leading-relaxed max-w-md">
              管理报告 · 跟进服务 · 监控转化——一个后台贯穿所有业务线。
            </p>
            <div className="mt-12 flex items-center gap-3 text-[10px] font-mono text-white/40 tracking-widest uppercase">
              <div className="size-1 rounded-full bg-white/40" />
              PROD · v2.1
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
