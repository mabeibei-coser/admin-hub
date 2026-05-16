import { NextResponse, type NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { AdminSession } from "./lib/admin-session";

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const sessionPwd = process.env.ADMIN_SESSION_PASSWORD;

    if (!sessionPwd || sessionPwd.length < 32) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "服务端配置错误" }, { status: 500 });
      }
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    const res = NextResponse.next();
    const session = await getIronSession<AdminSession>(req, res, {
      password: sessionPwd,
      cookieName: "career_admin_session",
    });

    // 软闸（soft gate）：proxy 做快速身份校验，route handler 是权威源（见 lib/admin-session.ts requireAdmin/requireSuper）
    if (!session.adminId) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "未登录" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }

    // 超管闸门：/admin/admins/* 和 /api/admin/admins/* 只有 isSuper 才能进
    const isAdminsPath =
      pathname.startsWith("/admin/admins") ||
      pathname.startsWith("/api/admin/admins");
    if (isAdminsPath && !session.isSuper) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "无权限" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/admin/reports", req.url));
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
