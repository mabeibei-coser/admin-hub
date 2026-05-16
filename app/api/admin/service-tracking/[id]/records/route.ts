import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import { touchLastServiceAt } from "@/lib/service-tracking";

/**
 * POST /api/admin/service-tracking/[id]/records
 * 新增一条服务记录；写完同步更新主表 last_service_at（EC3 transaction）。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireMenu("service");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const trackingId = Number(idStr);
  if (!Number.isInteger(trackingId) || trackingId <= 0) {
    return NextResponse.json({ error: "id 无效" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  // 输入校验
  const serviceAt = Number(body.service_at);
  if (!Number.isInteger(serviceAt) || serviceAt <= 0) {
    return NextResponse.json({ error: "服务时间无效" }, { status: 400 });
  }
  const content = body.content === null || body.content === undefined
    ? null
    : String(body.content);
  const note = body.note === null || body.note === undefined
    ? null
    : String(body.note);

  const db = getDb();
  const now = Date.now();
  const adminId = session.adminId!;

  // ─── 行级权限：先用原子 SELECT 校验（EC2 兜底；INSERT 本身不可附 WHERE） ───
  const ownerCheckSql = session.isSuper
    ? `SELECT id FROM service_tracking WHERE id = ?`
    : `SELECT id FROM service_tracking WHERE id = ? AND (staff1_admin_id = ? OR staff2_admin_id = ?)`;
  const ownerCheckParams = session.isSuper
    ? [trackingId]
    : [trackingId, adminId, adminId];
  const owner = db.prepare(ownerCheckSql).get(...ownerCheckParams);
  if (!owner) {
    return NextResponse.json({ error: "记录不存在或无权访问" }, { status: 403 });
  }

  // ─── transaction: INSERT record + touchLastServiceAt（EC3） ──────
  let insertedId = 0;
  try {
    db.transaction(() => {
      const r = db
        .prepare(
          `INSERT INTO service_records (
             tracking_id, service_at, content, note, recorder_admin_id,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(trackingId, serviceAt, content, note, adminId, now, now);
      insertedId = Number(r.lastInsertRowid);
      touchLastServiceAt(db, trackingId);
    })();
  } catch (e) {
    return NextResponse.json(
      { error: "写入失败", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, id: insertedId });
}
