import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getAdminDb } from "@/lib/db";
import {
  normalizeShortCode,
  validateSourceUrl,
  wrapperAccessFilter,
  WRAPPER_STATUS_KEYS,
  type WrapperStatus,
  type WrapperListRow,
} from "@/lib/wrappers";
import { isShortCodeUsed } from "@/lib/wrappers-db";

const MENU = "wrappers";

/**
 * GET /api/admin/wrappers
 * 列表（short_code/name 模糊 + status 过滤 + 分页），LEFT JOIN admins 取创建人姓名。
 * 行级权限：非超管只能看自己创建的。
 */
export async function GET(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const url = new URL(req.url);
  const shortCode = url.searchParams.get("short_code")?.trim() || "";
  const name = url.searchParams.get("name")?.trim() || "";
  const status = url.searchParams.get("status");
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20") || 20));

  const conditions: string[] = [];
  const params: Array<string | number> = [];

  const filter = wrapperAccessFilter(session);
  if (filter.whereSql) {
    conditions.push(filter.whereSql);
    params.push(...filter.params);
  }
  if (shortCode) {
    conditions.push("w.short_code LIKE ?");
    params.push(`%${shortCode}%`);
  }
  if (name) {
    conditions.push("w.name LIKE ?");
    params.push(`%${name}%`);
  }
  if (status && WRAPPER_STATUS_KEYS.includes(status as WrapperStatus)) {
    conditions.push("w.status = ?");
    params.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = getAdminDb();

  const totalRow = db
    .prepare(`SELECT COUNT(*) AS c FROM wrappers w ${where}`)
    .get(...params) as { c: number };
  const total = totalRow.c;

  const offset = (page - 1) * pageSize;

  const rows = db
    .prepare(
      `SELECT
         w.*,
         a.name AS created_by_name
       FROM wrappers w
       LEFT JOIN admins a ON a.id = w.created_by_admin_id
       ${where}
       ORDER BY w.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, pageSize, offset) as WrapperListRow[];

  return NextResponse.json({ rows, total, page, pageSize });
}

/**
 * POST /api/admin/wrappers — 新建智能体包装。
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

  // 短码
  const shortCodeRaw = String(body.short_code ?? "").trim();
  if (!shortCodeRaw) {
    return NextResponse.json({ error: "请填写短码" }, { status: 400 });
  }
  const shortCode = normalizeShortCode(shortCodeRaw);
  if (shortCode.length < 3 || shortCode.length > 32) {
    return NextResponse.json({ error: "短码长度需 3-32 字符" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/.test(shortCode)) {
    return NextResponse.json({ error: "短码只能包含字母、数字和短横线，首尾不能是短横线" }, { status: 400 });
  }

  // 名称
  const nameVal = String(body.name ?? "").trim();
  if (!nameVal || nameVal.length > 100) {
    return NextResponse.json({ error: "请填写智能体名称（1-100 字）" }, { status: 400 });
  }

  // 备注
  const noteVal = String(body.note ?? "").trim();
  if (!noteVal || noteVal.length > 500) {
    return NextResponse.json({ error: "请填写备注（1-500 字）" }, { status: 400 });
  }

  // 原始网址
  const sourceUrlVal = String(body.source_url ?? "").trim();
  const urlCheck = validateSourceUrl(sourceUrlVal);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  // 底部说明
  const footerTextVal = String(body.footer_text ?? "").trim();
  if (!footerTextVal || footerTextVal.length > 500) {
    return NextResponse.json({ error: "请填写底部说明（1-500 字）" }, { status: 400 });
  }

  // 短码查重
  if (isShortCodeUsed(shortCode)) {
    return NextResponse.json({ error: "该短码已被占用" }, { status: 409 });
  }

  const now = Date.now();
  try {
    const result = getAdminDb()
      .prepare(
        `INSERT INTO wrappers
           (short_code, name, note, source_url, footer_text, status, click_count, created_by_admin_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', 0, ?, ?, ?)`
      )
      .run(shortCode, nameVal, noteVal, sourceUrlVal, footerTextVal, session.adminId!, now, now);
    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "该短码已被占用" }, { status: 409 });
    }
    throw e;
  }
}
