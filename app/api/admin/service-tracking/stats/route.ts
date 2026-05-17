import { NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import { accessFilter, WARNING_THRESHOLD_DAYS } from "@/lib/service-tracking";

interface StatsResponse {
  total: number;
  monthNew: number;
  inProgress: number;
  warning: number;
}

/**
 * GET /api/admin/service-tracking/stats
 *
 * 顶部数据看板：4 个数字。行级权限同 list（普通管理员只看自己经手的）。
 *
 *   - total:        全部条数
 *   - monthNew:     本月新增（first_service_at 落在当月）
 *   - inProgress:   status = 'in_progress'
 *   - warning:      跟进中且最近一次服务时间落在 N 天前（N = WARNING_THRESHOLD_DAYS）
 *                   `last_service_at IS NULL` 时退化到 `first_service_at`
 */
export async function GET() {
  const session = await requireMenu("service");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const db = getDb();
  const filter = accessFilter(session);
  const accessWhere = filter.whereSql ? `WHERE ${filter.whereSql}` : "";
  const accessParams = filter.params;

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM service_tracking ${accessWhere}`)
    .get(...accessParams) as { c: number };

  // 本月起点（本机时区）：用 JS 算出 ms，再传给 SQL 比较
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthRow = db
    .prepare(
      `SELECT COUNT(*) AS c FROM service_tracking
       ${accessWhere ? `${accessWhere} AND` : "WHERE"} first_service_at >= ?`,
    )
    .get(...accessParams, monthStart) as { c: number };

  const inProgressRow = db
    .prepare(
      `SELECT COUNT(*) AS c FROM service_tracking
       ${accessWhere ? `${accessWhere} AND` : "WHERE"} status = 'in_progress'`,
    )
    .get(...accessParams) as { c: number };

  const warnCutoff = Date.now() - WARNING_THRESHOLD_DAYS * 86400_000;
  const warningRow = db
    .prepare(
      `SELECT COUNT(*) AS c FROM service_tracking
       ${accessWhere ? `${accessWhere} AND` : "WHERE"} status = 'in_progress'
         AND COALESCE(last_service_at, first_service_at) < ?`,
    )
    .get(...accessParams, warnCutoff) as { c: number };

  const stats: StatsResponse = {
    total: totalRow.c,
    monthNew: monthRow.c,
    inProgress: inProgressRow.c,
    warning: warningRow.c,
  };
  return NextResponse.json(stats);
}
