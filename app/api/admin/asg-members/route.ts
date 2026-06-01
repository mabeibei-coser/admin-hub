import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getAdminDb, isAsgDbReady } from "@/lib/db";

export const runtime = "nodejs";

const MENU = "asg-members";

interface MemberRow {
  phone: string;
  vip_expire_at: number;
  total_paid_cents: number;
  updated_at: number;
  created_at: number | null;
  order_count: number;
  paid_order_count: number;
}

/** 本周一 00:00 的时间戳（本地时区，周一为周首日）。 */
function weekStartMs(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  // getDay: 0=周日,1=周一,...,6=周六；想要从周一起
  const dayOfWeek = d.getDay();
  const offsetToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  d.setDate(d.getDate() - offsetToMonday);
  return d.getTime();
}

/**
 * GET /api/admin/asg-members
 * 会员列表（只读 ATTACH asg 库）。计算 VIP 状态：vip_expire_at > now。
 * Query：phone（手机号模糊）、status（vip / normal）、page、pageSize
 *
 * 铁律：只读 asg.*，绝不写（CLAUDE.md 约束）。
 */
export async function GET(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  if (!isAsgDbReady()) {
    return NextResponse.json({ rows: [], total: 0, page: 1, pageSize: 20, ready: false });
  }

  const url = new URL(req.url);
  const phone = url.searchParams.get("phone")?.trim() || "";
  const status = url.searchParams.get("status"); // "vip" | "normal" | null
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20)
  );

  const now = Date.now();
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  if (phone) {
    conditions.push("m.phone LIKE ?");
    params.push(`%${phone}%`);
  }
  if (status === "vip") {
    conditions.push("m.vip_expire_at > ?");
    params.push(now);
  } else if (status === "normal") {
    conditions.push("m.vip_expire_at <= ?");
    params.push(now);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = getAdminDb();

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM asg.memberships m ${where}`)
    .get(...params) as { c: number };
  const total = totalRow.c;

  const offset = (page - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT
         m.phone,
         m.vip_expire_at,
         m.total_paid_cents,
         m.updated_at,
         u.created_at AS created_at,
         (SELECT COUNT(*) FROM asg.orders o WHERE o.payer_phone = m.phone) AS order_count,
         (SELECT COUNT(*) FROM asg.orders o WHERE o.payer_phone = m.phone AND o.status = 'paid') AS paid_order_count
       FROM asg.memberships m
       LEFT JOIN asg.users u ON u.phone = m.phone
       ${where}
       ORDER BY m.updated_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as MemberRow[];

  // KPI 统计（全量，不受分页/筛选影响）
  const stats = db
    .prepare(
      `SELECT
         COUNT(*) AS total_members,
         SUM(CASE WHEN vip_expire_at > ? THEN 1 ELSE 0 END) AS vip_members,
         COALESCE(SUM(total_paid_cents), 0) AS total_revenue_cents
       FROM asg.memberships`
    )
    .get(now) as { total_members: number; vip_members: number; total_revenue_cents: number };

  // 本周新增：用户注册时间在本周一 0 点之后；users 表为登录账号源头
  const weekStart = weekStartMs(now);
  const weekRow = db
    .prepare(`SELECT COUNT(*) AS c FROM asg.users WHERE created_at >= ?`)
    .get(weekStart) as { c: number };

  return NextResponse.json({
    rows: rows.map((r) => ({
      phone: r.phone,
      isVip: r.vip_expire_at > now,
      vipExpireAt: r.vip_expire_at,
      totalPaidCents: r.total_paid_cents,
      orderCount: r.order_count,
      paidOrderCount: r.paid_order_count,
      updatedAt: r.updated_at,
      createdAt: r.created_at,
    })),
    total,
    page,
    pageSize,
    ready: true,
    stats: {
      totalMembers: stats.total_members,
      vipMembers: stats.vip_members,
      totalRevenueCents: stats.total_revenue_cents,
      newThisWeek: weekRow.c,
    },
  });
}
