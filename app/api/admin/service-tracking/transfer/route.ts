import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getAdminDb, isNavDbReady } from "@/lib/db";
import { SERVICE_CATEGORY_KEYS, type ServiceCategory } from "@/lib/service-tracking";

/**
 * POST /api/admin/service-tracking/transfer
 *
 * 把一条 nav.reports 记录「转入」服务跟踪。
 *
 * 权限：requireMenu("nav") — 操作员需有职业导航菜单权限
 * source_project 后端写死 'nav'（V1 不接前端参数；report 项目下版再放开）
 *
 * 错误处理：
 *   - 400 输入校验失败
 *   - 404 源记录不存在
 *   - 409 已转过 + existingId（TOCTOU 安全：try INSERT → catch SQLITE_CONSTRAINT_UNIQUE）
 *   - 503 nav 库不可用
 */
export async function POST(req: NextRequest) {
  const session = await requireMenu("nav");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  if (!isNavDbReady()) {
    return NextResponse.json({ error: "职业导航数据库暂不可用" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  // ─── 输入校验（EH3） ────────────────────────────────────────────
  const sourceReportId = Number(body.source_report_id);
  if (!Number.isInteger(sourceReportId) || sourceReportId <= 0) {
    return NextResponse.json({ error: "source_report_id 无效" }, { status: 400 });
  }

  const category = String(body.service_category ?? "");
  if (!SERVICE_CATEGORY_KEYS.includes(category as ServiceCategory)) {
    return NextResponse.json({ error: "服务分类无效" }, { status: 400 });
  }

  // staff2_admin_id 可选：null / undefined / 0 / 空字符串都视为不指定
  let staff2: number | null = null;
  const rawStaff2 = body.staff2_admin_id;
  if (rawStaff2 !== null && rawStaff2 !== undefined && rawStaff2 !== "" && rawStaff2 !== 0) {
    const n = Number(rawStaff2);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json({ error: "协同服务人员 id 无效" }, { status: 400 });
    }
    staff2 = n;
  }

  const staff1 = session.adminId!;

  if (staff2 !== null && staff2 === staff1) {
    return NextResponse.json(
      { error: "两位服务人员不能是同一人" },
      { status: 400 }
    );
  }

  // 校验 staff2 存在且 is_active=1
  const db = getAdminDb();
  if (staff2 !== null) {
    const ok = db
      .prepare(`SELECT 1 FROM admins WHERE id = ? AND is_active = 1`)
      .get(staff2) as { 1: number } | undefined;
    if (!ok) {
      return NextResponse.json({ error: "协同服务人员不存在或已停用" }, { status: 400 });
    }
  }

  // ─── 源记录存在性 + 关键字段（EH4） ─────────────────────────────
  // nav.reports 真实 schema 里没有 user_name / user_phone 列，
  // 姓名手机号埋在 form_data_json，照搬 [/api/admin/reports/route.ts] 用 json_extract 抽
  const source = db
    .prepare(
      `SELECT
         json_extract(form_data_json, '$.name')  AS user_name,
         json_extract(form_data_json, '$.phone') AS user_phone,
         target_position
       FROM nav.reports WHERE id = ?`
    )
    .get(sourceReportId) as
    | {
        user_name: string | null;
        user_phone: string | null;
        target_position: string | null;
      }
    | undefined;
  if (!source) {
    return NextResponse.json({ error: "源记录不存在" }, { status: 404 });
  }

  const now = Date.now();

  // ─── TOCTOU 安全 INSERT（EC1） ─────────────────────────────────
  try {
    const result = db
      .prepare(
        `INSERT INTO service_tracking (
          source_project, source_report_id,
          user_name, user_phone, target_position,
          service_category, status,
          staff1_admin_id, staff2_admin_id, recorder_admin_id,
          overall_note,
          first_service_at, last_service_at,
          created_at, updated_at
        ) VALUES ('nav', ?, ?, ?, ?, ?, 'in_progress', ?, ?, ?, NULL, ?, NULL, ?, ?)`
      )
      .run(
        sourceReportId,
        source.user_name,
        source.user_phone,
        source.target_position,
        category,
        staff1,
        staff2,
        staff1, // recorder_admin_id = 当前操作员
        now, // first_service_at = 转服务时间
        now,
        now
      );

    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e: unknown) {
    // better-sqlite3 把 SQLite 错误代码放在 e.code（message 只有 "UNIQUE constraint failed: ..."）
    const code = (e as { code?: string } | null)?.code;
    if (code === "SQLITE_CONSTRAINT_UNIQUE") {
      const existing = db
        .prepare(
          `SELECT id FROM service_tracking
           WHERE source_project = 'nav' AND source_report_id = ?`
        )
        .get(sourceReportId) as { id: number } | undefined;
      return NextResponse.json(
        {
          error: "duplicate",
          existingId: existing?.id ?? null,
          message: "该记录已转过服务",
        },
        { status: 409 }
      );
    }
    throw e;
  }
}
