import { NextRequest, NextResponse } from "next/server";
import { requireSuper } from "@/lib/admin-session";
import { getDb } from "@/lib/db";

interface GroupRow {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
  member_count: number;
}

/** GET /api/admin/admin-groups — 分组列表（超管专用） */
export async function GET() {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const rows = getDb()
    .prepare(
      `SELECT g.id, g.name, g.created_at, g.updated_at,
              (SELECT COUNT(*) FROM admins a WHERE a.group_id = g.id) AS member_count
       FROM admin_groups g
       ORDER BY g.created_at ASC`
    )
    .all() as GroupRow[];

  return NextResponse.json({ groups: rows });
}

/** POST /api/admin/admin-groups — 新建分组（超管专用） */
export async function POST(req: NextRequest) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "请填写分组名称" }, { status: 400 });
  }
  if (name.length > 30) {
    return NextResponse.json({ error: "分组名称最多 30 字" }, { status: 400 });
  }

  const now = Date.now();
  try {
    const result = getDb()
      .prepare(
        `INSERT INTO admin_groups (name, created_at, updated_at) VALUES (?, ?, ?)`
      )
      .run(name, now, now);
    return NextResponse.json({ ok: true, id: result.lastInsertRowid });
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "该分组名称已存在" }, { status: 409 });
    }
    throw e;
  }
}
