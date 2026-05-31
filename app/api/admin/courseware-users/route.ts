import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getAdminDb, isTeachingDbReady } from "@/lib/db";
import { isValidCnMobile } from "@/lib/phone";
import {
  cuAccessFilter,
  CU_STATUS_KEYS,
  type CoursewareUserStatus,
} from "@/lib/courseware-users";

const MENU = "courseware-users";

interface ListRow {
  id: number;
  phone: string;
  name: string | null;
  added_by_admin_id: number;
  note: string | null;
  note2: string | null;
  status: CoursewareUserStatus;
  created_at: number;
  updated_at: number;
  added_by_name: string | null;
  last_login_at: number | null;
  usage_count: number;
}

/**
 * GET /api/admin/courseware-users
 * 列表：行级权限 = added_by_admin_id 命中当前用户（超管看全部）。
 * 「最后登录时间 / 使用次数」跨 ATTACH 只读 teaching 库算出（库未就绪则降级为 null / 0）。
 *
 * Query：name（姓名模糊）、phone（手机号模糊）、status、page、pageSize
 */
export async function GET(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const url = new URL(req.url);
  const name = url.searchParams.get("name")?.trim() || "";
  const phone = url.searchParams.get("phone")?.trim() || "";
  const status = url.searchParams.get("status");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20)
  );

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  const filter = cuAccessFilter(session);
  if (filter.whereSql) {
    conditions.push(filter.whereSql);
    params.push(...filter.params);
  }
  if (name) {
    conditions.push("cu.name LIKE ?");
    params.push(`%${name}%`);
  }
  if (phone) {
    conditions.push("cu.phone LIKE ?");
    params.push(`%${phone}%`);
  }
  if (status && CU_STATUS_KEYS.includes(status as CoursewareUserStatus)) {
    conditions.push("cu.status = ?");
    params.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = getAdminDb();
  const teachingReady = isTeachingDbReady();

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM courseware_users cu ${where}`)
    .get(...params) as { c: number };
  const total = totalRow.c;

  const offset = (page - 1) * pageSize;

  // teaching 库就绪：跨 ATTACH 只读关联 last_login_at / usage_count；否则降级
  const loginSelect = teachingReady
    ? "tu.last_login_at AS last_login_at"
    : "NULL AS last_login_at";
  const usageSelect = teachingReady
    ? "(SELECT COUNT(*) FROM teaching.reports tr WHERE tr.user_phone = cu.phone) AS usage_count"
    : "0 AS usage_count";
  const teachingJoin = teachingReady
    ? "LEFT JOIN teaching.users tu ON tu.phone = cu.phone"
    : "";

  const rows = db
    .prepare(
      `SELECT
         cu.id, cu.phone, cu.name, cu.added_by_admin_id,
         cu.note, cu.note2, cu.status, cu.created_at, cu.updated_at,
         a.name AS added_by_name,
         ${loginSelect},
         ${usageSelect}
       FROM courseware_users cu
       LEFT JOIN admins a ON a.id = cu.added_by_admin_id
       ${teachingJoin}
       ${where}
       ORDER BY cu.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as ListRow[];

  return NextResponse.json({ rows, total, page, pageSize });
}

/**
 * POST /api/admin/courseware-users — 新建课件用户。
 * 新增即 status=active；added_by_admin_id = 当前管理员。
 */
export async function POST(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const phone = String(body.phone ?? "").trim();
  const name = String(body.name ?? "").trim();
  const note = String(body.note ?? "").trim();
  const note2 = String(body.note2 ?? "").trim();

  if (!phone) {
    return NextResponse.json({ error: "请填写手机号" }, { status: 400 });
  }
  if (!isValidCnMobile(phone)) {
    return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "请填写姓名" }, { status: 400 });
  }

  const now = Date.now();
  try {
    const result = getAdminDb()
      .prepare(
        `INSERT INTO courseware_users
           (phone, name, added_by_admin_id, note, note2, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
      )
      .run(phone, name, session.adminId!, note || null, note2 || null, now, now);
    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "该手机号已添加，请勿重复添加" },
        { status: 409 }
      );
    }
    throw e;
  }
}
