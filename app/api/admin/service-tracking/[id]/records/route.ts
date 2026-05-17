import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import {
  touchLastServiceAt,
  type ServiceRecordAttachment,
} from "@/lib/service-tracking";

/** 校验客户端传来的 attachments 数组（只信关键字段，其它丢掉）。无效 → 返回空数组。 */
function sanitizeAttachments(input: unknown): ServiceRecordAttachment[] {
  if (!Array.isArray(input)) return [];
  const out: ServiceRecordAttachment[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || !/^[a-f0-9-]{36}$/i.test(o.id)) continue;
    if (typeof o.filename !== "string" || !o.filename) continue;
    if (typeof o.mime !== "string") continue;
    if (typeof o.size !== "number" || !Number.isFinite(o.size)) continue;
    out.push({ id: o.id, filename: o.filename, mime: o.mime, size: o.size });
  }
  return out;
}

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
  const attachments = sanitizeAttachments(body.attachments);

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
             attachments_json, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          trackingId,
          serviceAt,
          content,
          note,
          adminId,
          attachments.length ? JSON.stringify(attachments) : null,
          now,
          now,
        );
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
