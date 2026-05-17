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
    <div className="relative min-h-dvh bg-gray-50 flex items-center justify-center p-4">
      {/* Tabler 风顶部蓝色细装饰条 */}
      <div
        aria-hidden
        className="absolute top-0 inset-x-0 h-1 bg-[var(--blue-700)]"
      />

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
  );
}
