import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import {
  accessFilter,
  SERVICE_CATEGORY_KEYS,
  SERVICE_STATUS_KEYS,
  type ServiceCategory,
  type ServiceStatus,
} from "@/lib/service-tracking";

interface ListRow {
  id: number;
  source_project: "report" | "nav";
  user_name: string | null;
  user_phone: string | null;
  target_position: string | null;
  service_category: ServiceCategory;
  status: ServiceStatus;
  first_service_at: number;
  last_service_at: number | null;
  recorder_name: string | null;
  staff1_name: string | null;
  staff2_name: string | null;
}

/**
 * GET /api/admin/service-tracking
 * 列表：行级权限 = staff1 / staff2 之一 = 当前用户（超管看全部）
 *
 * Query：
 *   status, category, page, pageSize
 */
export async function GET(req: NextRequest) {
  const session = await requireMenu("service");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20)
  );

  // ─── 拼 WHERE（EH1：accessFilter 不带 AND 前缀，由调用方拼） ───
  const conditions: string[] = [];
  const params: Array<string | number> = [];

  const filter = accessFilter(session);
  if (filter.whereSql) {
    conditions.push(filter.whereSql);
    params.push(...filter.params);
  }

  if (status && SERVICE_STATUS_KEYS.includes(status as ServiceStatus)) {
    conditions.push("status = ?");
    params.push(status);
  }
  if (category && SERVICE_CATEGORY_KEYS.includes(category as ServiceCategory)) {
    conditions.push("service_category = ?");
    params.push(category);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = getDb();

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM service_tracking ${where}`)
    .get(...params) as { c: number };
  const total = totalRow.c;

  const offset = (page - 1) * pageSize;
  const rows = db
    .prepare(
      `SELECT
         st.id,
         st.source_project,
         st.user_name,
         st.user_phone,
         st.target_position,
         st.service_category,
         st.status,
         st.first_service_at,
         st.last_service_at,
         a_rec.name AS recorder_name,
         a_s1.name  AS staff1_name,
         a_s2.name  AS staff2_name
       FROM service_tracking st
       LEFT JOIN admins a_rec ON a_rec.id = st.recorder_admin_id
       LEFT JOIN admins a_s1  ON a_s1.id  = st.staff1_admin_id
       LEFT JOIN admins a_s2  ON a_s2.id  = st.staff2_admin_id
       ${where}
       ORDER BY st.first_service_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as ListRow[];

  return NextResponse.json({
    rows,
    total,
    page,
    pageSize,
  });
}
