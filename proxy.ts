import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { AdminSession } from "./lib/admin-session";

/**
 * 构造保留 basePath 的 redirect URL。
 *
 * 不要用 `new URL(path, req.url)`：在配了 basePath 的项目里，这种写法
 * 会把 basePath 剥离掉（new URL 的 absolute path 直接覆盖整个 pathname）。
 * `req.nextUrl.clone()` 是 Next.js 推荐的 basePath-aware 做法。
 */
function basePathAwareRedirect(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return url;
}

export async function proxy(req: NextRequest) {
  // trailingSlash:true 让 pathname 总是带尾斜杠（页面），但 API 路径不带。
  // normalize 成不带尾斜杠形式做精确匹配，避免漏判。
  const pathname = req.nextUrl.pathname;
  const normalized = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;

  if (
    normalized === "/admin/login" ||
    normalized === "/api/admin/login" ||
    normalized === "/api/admin/captcha" ||
    normalized === "/api/admin/health"
  ) {
    return NextResponse.next();
  }

  if (normalized.startsWith("/admin") || normalized.startsWith("/api/admin")) {
    const sessionPwd = process.env.ADMIN_SESSION_PASSWORD;

    if (!sessionPwd || sessionPwd.length < 32) {
      if (normalized.startsWith("/api/")) {
        return NextResponse.json({ error: "服务端配置错误" }, { status: 500 });
      }
      return NextResponse.redirect(basePathAwareRedirect(req, "/admin/login"));
    }

    const res = NextResponse.next();
    const session = await getIronSession<AdminSession>(req, res, {
      password: sessionPwd,
      cookieName: "career_admin_session",
    });

    // 软闸（soft gate）：proxy 做快速身份校验，route handler 是权威源（见 lib/admin-session.ts requireAdmin/requireSuper）
    if (!session.adminId) {
      if (normalized.startsWith("/api/")) {
        return NextResponse.json({ error: "未登录" }, { status: 401 });
      }
      return NextResponse.redirect(basePathAwareRedirect(req, "/admin/login"));
    }

    // 超管闸门：/admin/admins/* 和 /api/admin/admins/* 只有 isSuper 才能进
    const isAdminsPath =
      normalized.startsWith("/admin/admins") ||
      normalized.startsWith("/api/admin/admins");
    if (isAdminsPath && !session.isSuper) {
      if (normalized.startsWith("/api/")) {
        return NextResponse.json({ error: "无权限" }, { status: 403 });
      }
      return NextResponse.redirect(basePathAwareRedirect(req, "/admin/reports"));
    }

    // admin 页面/接口必须实时鉴权，禁止任何缓存
    res.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, max-age=0"
    );
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
