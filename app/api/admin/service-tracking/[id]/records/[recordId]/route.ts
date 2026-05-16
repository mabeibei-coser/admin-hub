import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import { touchLastServiceAt } from "@/lib/service-tracking";

/**
 * PATCH /api/admin/service-tracking/[id]/records/[recordId]
 * 编辑一条服务记录的 service_at / content / note；recorder 不可改（审计）
 */
export async function PATCH(
  req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; recordId: string }> }
) {
  const session = await requireMenu("service");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id: idStr, recordId: recordIdStr } = await params;
  const trackingId = Number(idStr);
  const recordId = Number(recordIdStr);
  if (
    !Number.isInteger(trackingId) ||
    trackingId <= 0 ||
    !Number.isInteger(recordId) ||
    recordId <= 0
  ) {
    return NextResponse.json({ error: "id 无效" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const sets: string[] = [];
  const sqlParams: Array<string | number | null> = [];

  if (body.service_at !== undefined) {
    const n = Number(body.service_at);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "服务时间无效" }, { status: 400 });
    }
    sets.push("service_at = ?");
    sqlParams.push(n);
  }
  if (body.content !== undefined) {
    sets.push("content = ?");
    sqlParams.push(body.content === null ? null : String(body.content));
  }
  if (body.note !== undefined) {
    sets.push("note = ?");
    sqlParams.push(body.note === null ? null : String(body.note));
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "没有可更新字段" }, { status: 400 });
  }

  sets.push("updated_at = ?");
  sqlParams.push(Date.now());

  const db = getDb();
  const adminId = session.adminId!;

  // 原子权限：记录必须属于一个我能访问的 tracking
  // service_records 没有 staff 字段，需要 EXISTS 子查询关联到 service_tracking
  const accessWhere = session.isSuper
    ? `EXISTS (SELECT 1 FROM service_tracking st WHERE st.id = service_records.tracking_id AND st.id = ?)`
    : `EXISTS (SELECT 1 FROM service_tracking st WHERE st.id = service_records.tracking_id AND st.id = ? AND (st.staff1_admin_id = ? OR st.staff2_admin_id = ?))`;

  const whereParts = [`id = ?`, accessWhere];
  sqlParams.push(recordId, trackingId);
  if (!session.isSuper) {
    sqlParams.push(adminId, adminId);
  }

  let changes = 0;
  try {
    db.transaction(() => {
      const r = db
        .prepare(
          `UPDATE service_records SET ${sets.join(", ")} WHERE ${whereParts.join(" AND ")}`
        )
        .run(...sqlParams);
      changes = r.changes;
      if (changes > 0) {
        touchLastServiceAt(db, trackingId);
      }
    })();
  } catch (e) {
    return NextResponse.json(
      { error: "更新失败", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  if (changes === 0) {
    return NextResponse.json({ error: "记录不存在或无权修改" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/service-tracking/[id]/records/[recordId]
 */
export async function DELETE(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; recordId: string }> }
) {
  const session = await requireMenu("service");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id: idStr, recordId: recordIdStr } = await params;
  const trackingId = Number(idStr);
  const recordId = Number(recordIdStr);
  if (
    !Number.isInteger(trackingId) ||
    trackingId <= 0 ||
    !Number.isInteger(recordId) ||
    recordId <= 0
  ) {
    return NextResponse.json({ error: "id 无效" }, { status: 400 });
  }

  const db = getDb();
  const adminId = session.adminId!;

  const accessWhere = session.isSuper
    ? `EXISTS (SELECT 1 FROM service_tracking st WHERE st.id = service_records.tracking_id AND st.id = ?)`
    : `EXISTS (SELECT 1 FROM service_tracking st WHERE st.id = service_records.tracking_id AND st.id = ? AND (st.staff1_admin_id = ? OR st.staff2_admin_id = ?))`;

  const sqlParams: Array<number> = [recordId, trackingId];
  if (!session.isSuper) {
    sqlParams.push(adminId, adminId);
  }

  let changes = 0;
  try {
    db.transaction(() => {
      const r = db
        .prepare(
          `DELETE FROM service_records WHERE id = ? AND ${accessWhere}`
        )
        .run(...sqlParams);
      changes = r.changes;
      if (changes > 0) {
        touchLastServiceAt(db, trackingId);
      }
    })();
  } catch (e) {
    return NextResponse.json(
      { error: "删除失败", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }

  if (changes === 0) {
    return NextResponse.json({ error: "记录不存在或无权删除" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
