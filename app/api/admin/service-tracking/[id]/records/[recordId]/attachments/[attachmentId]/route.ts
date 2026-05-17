import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { requireMenu } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import { accessFilter, type ServiceRecordAttachment } from "@/lib/service-tracking";

export const runtime = "nodejs";

/**
 * GET /api/admin/service-tracking/[id]/records/[recordId]/attachments/[attachmentId]
 *
 * 全路径鉴权：先验 tracking 行级权限（staff1/staff2 或超管），再从 record.attachments_json
 * 找到 attachmentId 对应的 entry，才允许下载。直接命中 UUID 路径绕开这一层 → 403。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; recordId: string; attachmentId: string }> },
) {
  const session = await requireMenu("service");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id: trackingIdStr, recordId: recordIdStr, attachmentId } = await params;
  const trackingId = Number(trackingIdStr);
  const recordId = Number(recordIdStr);
  if (!Number.isInteger(trackingId) || !Number.isInteger(recordId)) {
    return NextResponse.json({ error: "id 无效" }, { status: 400 });
  }
  // attachmentId 必须是 UUID 形态，防止路径穿越（虽然只用作目录名，但多一层防御）
  if (!/^[a-f0-9-]{36}$/i.test(attachmentId)) {
    return NextResponse.json({ error: "attachmentId 无效" }, { status: 400 });
  }

  const db = getDb();
  const filter = accessFilter(session);

  // tracking 权限校验 + 记录归属确认
  const conditions: string[] = ["st.id = ?", "sr.id = ?", "sr.tracking_id = st.id"];
  const sqlParams: Array<string | number> = [trackingId, recordId];
  if (filter.whereSql) {
    conditions.push(filter.whereSql);
    sqlParams.push(...filter.params);
  }

  const row = db
    .prepare(
      `SELECT sr.attachments_json
       FROM service_records sr
       JOIN service_tracking st ON st.id = sr.tracking_id
       WHERE ${conditions.join(" AND ")}`,
    )
    .get(...sqlParams) as { attachments_json: string | null } | undefined;

  if (!row) {
    return NextResponse.json({ error: "记录不存在或无权访问" }, { status: 403 });
  }

  let attachments: ServiceRecordAttachment[] = [];
  if (row.attachments_json) {
    try {
      attachments = JSON.parse(row.attachments_json) as ServiceRecordAttachment[];
    } catch {
      /* corrupt */
    }
  }
  const att = attachments.find((a) => a.id === attachmentId);
  if (!att) {
    return NextResponse.json({ error: "附件不存在" }, { status: 404 });
  }

  const DATA_DIR = path.resolve(process.cwd(), "data");
  const filePath = path.join(DATA_DIR, "service-attachments", attachmentId, att.filename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "文件已丢失" }, { status: 410 });
  }

  const buf = fs.readFileSync(filePath);
  // RFC 5987 兼容的中文文件名 Content-Disposition
  const encodedName = encodeURIComponent(att.filename);
  return new Response(buf, {
    headers: {
      "Content-Type": att.mime || "application/octet-stream",
      "Content-Length": String(buf.length),
      "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-store",
    },
  });
}
