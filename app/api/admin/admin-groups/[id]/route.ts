import { NextRequest, NextResponse } from "next/server";
import { requireSuper } from "@/lib/admin-session";
import { getDb } from "@/lib/db";

/** PATCH /api/admin/admin-groups/[id] — 重命名分组 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const groupId = parseInt(id, 10);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: "无效 ID" }, { status: 400 });
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

  const db = getDb();
  const target = db.prepare("SELECT id FROM admin_groups WHERE id = ?").get(groupId);
  if (!target) {
    return NextResponse.json({ error: "分组不存在" }, { status: 404 });
  }

  try {
    db.prepare(`UPDATE admin_groups SET name = ?, updated_at = ? WHERE id = ?`).run(
      name,
      Date.now(),
      groupId
    );
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && e.message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "该分组名称已存在" }, { status: 409 });
    }
    throw e;
  }
}

/** DELETE /api/admin/admin-groups/[id] — 删除分组（成员的 group_id 自动置空） */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const groupId = parseInt(id, 10);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: "无效 ID" }, { status: 400 });
  }

  const db = getDb();
  const target = db.prepare("SELECT id FROM admin_groups WHERE id = ?").get(groupId);
  if (!target) {
    return NextResponse.json({ error: "分组不存在" }, { status: 404 });
  }

  const tx = db.transaction(() => {
    db.prepare("UPDATE admins SET group_id = NULL, updated_at = ? WHERE group_id = ?").run(
      Date.now(),
      groupId
    );
    db.prepare("DELETE FROM admin_groups WHERE id = ?").run(groupId);
  });
  tx();

  return NextResponse.json({ ok: true });
}
