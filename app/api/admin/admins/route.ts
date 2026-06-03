import { NextRequest, NextResponse } from "next/server";
import { requireSuper } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import { isValidCnMobile } from "@/lib/phone";
import { ASSIGNABLE_MENUS } from "@/lib/menus";
import bcrypt from "bcryptjs";

const VALID_MENU_KEYS = new Set<string>(ASSIGNABLE_MENUS.map((m) => m.key));

function validateMenus(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const keys = raw.filter((k) => typeof k === "string" && VALID_MENU_KEYS.has(k));
  return keys;
}

/** GET /api/admin/admins — 管理员列表（超管专用） */
export async function GET() {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const rows = getDb()
    .prepare(
      `SELECT a.id, a.username, a.name, a.note, a.menus_json,
              a.is_super, a.is_active, a.created_at, a.updated_at,
              a.group_id, g.name AS group_name
       FROM admins a
       LEFT JOIN admin_groups g ON g.id = a.group_id
       ORDER BY a.created_at ASC`
    )
    .all();

  return NextResponse.json({ admins: rows });
}

/** 校验 group_id：null/undefined = 不分组；数字 = 必须存在 */
function validateGroupId(raw: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: true, value: null };
  }
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (isNaN(n)) return { ok: false, error: "分组 ID 格式错误" };
  const row = getDb().prepare("SELECT id FROM admin_groups WHERE id = ?").get(n);
  if (!row) return { ok: false, error: "分组不存在" };
  return { ok: true, value: n };
}

/** POST /api/admin/admins — 新建管理员（超管专用） */
export async function POST(req: NextRequest) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const { username, name, password, note, menus, group_id } = body;

  if (!username || typeof username !== "string") {
    return NextResponse.json({ error: "请填写手机号" }, { status: 400 });
  }
  if (!isValidCnMobile(username)) {
    return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "请填写姓名" }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
  }

  const validatedMenus = validateMenus(menus ?? []);
  if (validatedMenus === null) {
    return NextResponse.json({ error: "菜单权限格式错误" }, { status: 400 });
  }

  const groupCheck = validateGroupId(group_id);
  if (!groupCheck.ok) {
    return NextResponse.json({ error: groupCheck.error }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = Date.now();

  try {
    const result = getDb()
      .prepare(
        `INSERT INTO admins (username, name, password_hash, note, menus_json, is_super, is_active, group_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)`
      )
      .run(
        username.trim(),
        name.trim(),
        passwordHash,
        note?.trim() || null,
        JSON.stringify(validatedMenus),
        groupCheck.value,
        now,
        now
      );

    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json(
        { error: "该手机号已存在，请更换手机号" },
        { status: 409 }
      );
    }
    throw e;
  }
}
