"use client";

import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { isValidCnMobile } from "@/lib/phone";

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
      const res = await fetch("/api/admin/login", {
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
      window.location.href = "/admin/reports";
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh bg-white grid md:grid-cols-[1fr_1.5fr]">
      {/* 顶部克制装饰：1px 蓝色细线 */}
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-px bg-[var(--blue-200)]"
      />

      {/* 左叙述区：仅桌面端显示 */}
      <aside className="hidden md:flex md:flex-col md:justify-center md:px-12 md:py-16 md:border-r md:border-[var(--report-border)]">
        <h2 className="text-3xl font-semibold tracking-tight text-[var(--navy-800)]">
          谨世 ATA
        </h2>
        <p className="mt-3 text-sm text-[var(--navy-700)] leading-relaxed">
          应届校招定位 &amp; 求职导航后台
        </p>
        <p className="mt-6 text-[10px] font-mono text-gray-400 tracking-wider uppercase">
          PROD · v2.1
        </p>
      </aside>

      {/* 右表单区 */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          {/* 移动端品牌标识 — 仅 < md 显示 */}
          <div className="md:hidden mb-6 flex flex-col items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-[var(--navy-800)]">
              谨世 ATA
            </h1>
            <p className="text-[12px] text-gray-500">管理后台</p>
          </div>

          {/* 登录卡片 + 左侧 accent rail */}
          <div className="relative">
            <span
              aria-hidden
              className="absolute left-0 inset-y-0 w-1 bg-[var(--blue-700)] rounded-l-md"
            />
            <Card className="relative ml-1 border border-[var(--report-border)] bg-white shadow-sm">
              <CardContent className="p-6 pt-7">
                {/* 卡片内的小图标 + 标题 */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--blue-700)]">
                    <ShieldCheck className="size-5 text-white" />
                  </div>
                  <div className="leading-tight">
                    <div className="text-base font-semibold text-[var(--navy-800)] tracking-tight">
                      欢迎回来
                    </div>
                    <div className="text-[11px] text-gray-500">
                      用手机号 + 密码登录
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="username">手机号</Label>
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
                    <Label htmlFor="password">密码</Label>
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
                    className="w-full h-10 bg-[var(--blue-700)] hover:bg-[var(--blue-600)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
                    disabled={loading || !canSubmit}
                  >
                    {loading ? "登录中…" : "登录"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* 底部 helper */}
          <p className="mt-6 text-[11px] text-gray-400 text-center">
            忘记密码？请联系超管重置
          </p>
        </div>
      </div>
    </div>
  );
}
