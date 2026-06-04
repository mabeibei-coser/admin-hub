import { NextRequest, NextResponse } from "next/server";
import { requireMenu, requireSuper } from "@/lib/admin-session";
import { getAdminDb, isAtaDbReady } from "@/lib/db";

export const runtime = "nodejs";

const MENU = "ata-members";

interface OrderRow {
  id: number;
  out_trade_no: string;
  package_id: string;
  amount_cents: number;
  duration_days: number;
  status: string;
  created_at: number;
  paid_at: number | null;
}

interface MemberDetail {
  phone: string;
  isVip: boolean;
  vipExpireAt: number;
  totalPaidCents: number;
  updatedAt: number;
  createdAt: number | null;
  lastLoginAt: number | null;
  orderCount: number;
  paidOrderCount: number;
}

/**
 * GET /api/admin/ata-members/[phone]
 * 会员详情（只读 ATTACH asg 库）+ 充值记录列表（按 created_at DESC）。
 * 充值记录 = orders 表全量（含 pending / paid / refunded 等所有状态），方便排查问题。
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  if (!isAtaDbReady()) {
    return NextResponse.json({ error: "会员数据库未就绪" }, { status: 503 });
  }

  const { phone: rawPhone } = await params;
  const phone = decodeURIComponent(rawPhone).trim();
  if (!/^\d{11}$/.test(phone)) {
    return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
  }

  const db = getAdminDb();
  const now = Date.now();

  const member = db
    .prepare(
      `SELECT
         m.phone,
         m.vip_expire_at,
         m.total_paid_cents,
         m.updated_at,
         u.created_at    AS reg_created_at,
         u.last_login_at AS last_login_at,
         (SELECT COUNT(*) FROM ata.orders o WHERE o.payer_phone = m.phone) AS order_count,
         (SELECT COUNT(*) FROM ata.orders o WHERE o.payer_phone = m.phone AND o.status = 'paid') AS paid_order_count
       FROM ata.memberships m
       LEFT JOIN ata.users u ON u.phone = m.phone
       WHERE m.phone = ?`
    )
    .get(phone) as
    | {
        phone: string;
        vip_expire_at: number;
        total_paid_cents: number;
        updated_at: number;
        reg_created_at: number | null;
        last_login_at: number | null;
        order_count: number;
        paid_order_count: number;
      }
    | undefined;

  if (!member) {
    return NextResponse.json({ error: "未找到该会员" }, { status: 404 });
  }

  const orders = db
    .prepare(
      `SELECT id, out_trade_no, package_id, amount_cents, duration_days, status, created_at, paid_at
       FROM ata.orders
       WHERE payer_phone = ?
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all(phone) as OrderRow[];

  const detail: MemberDetail = {
    phone: member.phone,
    isVip: member.vip_expire_at > now,
    vipExpireAt: member.vip_expire_at,
    totalPaidCents: member.total_paid_cents,
    updatedAt: member.updated_at,
    createdAt: member.reg_created_at,
    lastLoginAt: member.last_login_at,
    orderCount: member.order_count,
    paidOrderCount: member.paid_order_count,
  };

  return NextResponse.json({
    member: detail,
    orders: orders.map((o) => ({
      id: o.id,
      outTradeNo: o.out_trade_no,
      packageId: o.package_id,
      amountCents: o.amount_cents,
      durationDays: o.duration_days,
      status: o.status,
      createdAt: o.created_at,
      paidAt: o.paid_at,
    })),
  });
}

/**
 * PATCH /api/admin/ata-members/[phone]
 * 超管手动调整 VIP 到期时间（运营 / 退款 / 客诉补偿）。
 *
 * 破例说明：admin-hub 默认只读 asg.* 库。经用户授权，本接口可写
 *   - ata.memberships.vip_expire_at / updated_at
 *   - ata.membership_ledger（追加一条 type='admin_adjust' 流水做审计）
 * 其余 asg.* 表仍保持只读。详见 admin-hub CLAUDE.md 铁律 #1。
 *
 * 入参 body: { vipExpireAt: number }  毫秒时间戳；0 = 撤销 VIP / 降为普通
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> }
) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "仅超管可编辑会员状态" }, { status: 403 });
  }
  if (!isAtaDbReady()) {
    return NextResponse.json({ error: "会员数据库未就绪" }, { status: 503 });
  }

  const { phone: rawPhone } = await params;
  const phone = decodeURIComponent(rawPhone).trim();
  if (!/^\d{11}$/.test(phone)) {
    return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { vipExpireAt?: number } | null;
  if (!body || typeof body.vipExpireAt !== "number" || !Number.isFinite(body.vipExpireAt)) {
    return NextResponse.json({ error: "vipExpireAt 必须是数字（毫秒时间戳；0 = 撤销 VIP）" }, { status: 400 });
  }
  const newExpireAt = Math.floor(body.vipExpireAt);
  if (newExpireAt < 0) {
    return NextResponse.json({ error: "vipExpireAt 不能为负数" }, { status: 400 });
  }
  // 安全上限：拒绝 100 年后的"伪永久 VIP"，防误填
  const MAX_FUTURE_MS = Date.now() + 100 * 365 * 24 * 60 * 60 * 1000;
  if (newExpireAt > MAX_FUTURE_MS) {
    return NextResponse.json({ error: "到期日不能超过 100 年后" }, { status: 400 });
  }

  const db = getAdminDb();

  // 必须存在 memberships 行才能改（避免凭空给陌生手机号开 VIP）
  const cur = db
    .prepare("SELECT vip_expire_at FROM ata.memberships WHERE phone = ?")
    .get(phone) as { vip_expire_at: number } | undefined;
  if (!cur) {
    return NextResponse.json({ error: "未找到该会员" }, { status: 404 });
  }

  const expireBefore = cur.vip_expire_at;
  if (expireBefore === newExpireAt) {
    return NextResponse.json({ ok: true, changed: false, vipExpireAt: newExpireAt });
  }

  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE ata.memberships SET vip_expire_at = ?, updated_at = ? WHERE phone = ?`
    ).run(newExpireAt, now, phone);
    db.prepare(
      `INSERT INTO ata.membership_ledger
         (phone, type, duration_days, expire_before, expire_after, amount_cents, related_order_id, created_at)
       VALUES (?, 'admin_adjust', 0, ?, ?, 0, NULL, ?)`
    ).run(phone, expireBefore, newExpireAt, now);
  });

  try {
    tx();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "数据库写入失败";
    // SQLITE_BUSY 给前端友好提示
    if (msg.includes("SQLITE_BUSY")) {
      return NextResponse.json(
        { error: "会员数据库正忙，请稍后重试" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    changed: true,
    vipExpireAt: newExpireAt,
    expireBefore,
  });
}
