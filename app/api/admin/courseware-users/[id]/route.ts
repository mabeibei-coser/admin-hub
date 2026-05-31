import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getAdminDb } from "@/lib/db";
import {
  cuAccessFilter,
  CU_STATUS_KEYS,
  type CoursewareUserStatus,
} from "@/lib/courseware-users";

const MENU = "courseware-users";

/**
 * PATCH /api/admin/courseware-users/[id]
 * 改 姓名 / 备注 / 其他备注 / 状态。手机号不可改（换人请删了重加）。
 * 原子 WHERE：普通管理员只能改自己加的（changes===0 → 404）；超管无限制。
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "无效 ID" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const sets: string[] = [];
  const vals: Array<string | number | null> = [];

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
    }
    sets.push("name = ?");
    vals.push(name);
  }
  if (typeof body.note === "string") {
    sets.push("note = ?");
    vals.push(body.note.trim() || null);
  }
  if (typeof body.note2 === "string") {
    sets.push("note2 = ?");
    vals.push(body.note2.trim() || null);
  }
  if (typeof body.status === "string") {
    if (!CU_STATUS_KEYS.includes(body.status as CoursewareUserStatus)) {
      return NextResponse.json({ error: "无效的状态" }, { status: 400 });
    }
    sets.push("status = ?");
    vals.push(body.status);
  }

  if (sets.length === 0) {
    return NextResponse.json({ error: "无可更新字段" }, { status: 400 });
  }

  sets.push("updated_at = ?");
  vals.push(Date.now());

  // 原子 WHERE：非超管追加 added_by_admin_id 限制
  const filter = cuAccessFilter(session);
  const accessWhere = filter.whereSql ? ` AND ${filter.whereSql}` : "";

  const result = getAdminDb()
    .prepare(
      `UPDATE courseware_users SET ${sets.join(", ")} WHERE id = ?${accessWhere}`
    )
    .run(...vals, id, ...filter.params);

  if (result.changes === 0) {
    return NextResponse.json({ error: "记录不存在或无权操作" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/courseware-users/[id]
 * 删除。原子 WHERE：普通管理员只能删自己加的（changes===0 → 404）；超管无限制。
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "无效 ID" }, { status: 400 });
  }

  const filter = cuAccessFilter(session);
  const accessWhere = filter.whereSql ? ` AND ${filter.whereSql}` : "";

  const result = getAdminDb()
    .prepare(`DELETE FROM courseware_users WHERE id = ?${accessWhere}`)
    .run(id, ...filter.params);

  if (result.changes === 0) {
    return NextResponse.json({ error: "记录不存在或无权操作" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
