/**
 * GET /api/admin/health
 *
 * 后台健康检查，给登录页"系统运行正常"指示器用 (L-02 修复)。
 * 检查项：
 *   - main DB (career-report.db) 可连接 + reports/admins 表可 SELECT
 *   - nav DB ATTACH 是否就绪 (允许 degraded — 老 nav 业务可能没启动)
 *
 * 返回:
 *   - 200 { ok: true, status: "healthy" | "degraded", checks: {...} }
 *   - 503 { ok: false, status: "unhealthy", error: "..." }
 *
 * 注意: 不需要登录。登录页就要用，且检查项不暴露任何业务数据。
 */
import { NextResponse } from "next/server";
import { getAdminDb, isNavDbReady } from "@/lib/db";

export const runtime = "nodejs";
// 不缓存 — 每次都查一次
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getAdminDb();
    // 主库连通性 + admins 表存在性
    db.prepare("SELECT 1 FROM admins LIMIT 1").get();
    const navReady = isNavDbReady();
    const status = navReady ? "healthy" : "degraded";
    return NextResponse.json(
      {
        ok: true,
        status,
        checks: {
          mainDb: "ok",
          navDb: navReady ? "ok" : "unavailable",
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("[admin/health] error:", e);
    return NextResponse.json(
      {
        ok: false,
        status: "unhealthy",
        error: e instanceof Error ? e.message : "unknown",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
