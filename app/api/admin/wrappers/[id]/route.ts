import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getAdminDb } from "@/lib/db";
import {
  validateSourceUrl,
  wrapperAccessFilter,
  WRAPPER_STATUS_KEYS,
  type WrapperStatus,
} from "@/lib/wrappers";

const MENU = "wrappers";

/**
 * PUT /api/admin/wrappers/[id]
 * 更新 name/note/source_url/footer_text/status。短码不可修改。
 * 原子 WHERE：非超管只能改自己创建的（changes===0 → 404）。
 */
export async function PUT(
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
    if (!name || name.length > 100) {
      return NextResponse.json({ error: "智能体名称需要 1-100 字" }, { status: 400 });
    }
    sets.push("name = ?");
    vals.push(name);
  }
  if (typeof body.note === "string") {
    const note = body.note.trim();
    if (!note || note.length > 500) {
      return NextResponse.json({ error: "备注需要 1-500 字" }, { status: 400 });
    }
    sets.push("note = ?");
    vals.push(note);
  }
  if (typeof body.source_url === "string") {
    const urlCheck = validateSourceUrl(body.source_url);
    if (!urlCheck.ok) {
      return NextResponse.json({ error: urlCheck.error }, { status: 400 });
    }
    sets.push("source_url = ?");
    vals.push(body.source_url.trim());
  }
  if (typeof body.footer_text === "string") {
    const ft = body.footer_text.trim();
    if (!ft || ft.length > 500) {
      return NextResponse.json({ error: "底部说明需要 1-500 字" }, { status: 400 });
    }
    sets.push("footer_text = ?");
    vals.push(ft);
  }
  if (typeof body.status === "string") {
    if (!WRAPPER_STATUS_KEYS.includes(body.status as WrapperStatus)) {
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

  // 原子 WHERE：非超管追加 created_by_admin_id 限制
  const filter = wrapperAccessFilter(session);
  const accessWhere = filter.whereSql ? ` AND ${filter.whereSql}` : "";

  const result = getAdminDb()
    .prepare(
      `UPDATE wrappers SET ${sets.join(", ")} WHERE id = ?${accessWhere}`
    )
    .run(...vals, id, ...filter.params);

  if (result.changes === 0) {
    return NextResponse.json({ error: "记录不存在或无权操作" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/wrappers/[id] — 软删除（改 status='disabled'，保留 click_count 历史）。
 * 原子 WHERE：非超管只能停用自己的。
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

  const filter = wrapperAccessFilter(session);
  const accessWhere = filter.whereSql ? ` AND ${filter.whereSql}` : "";

  const result = getAdminDb()
    .prepare(
      `UPDATE wrappers SET status = 'disabled', updated_at = ? WHERE id = ?${accessWhere}`
    )
    .run(Date.now(), id, ...filter.params);

  if (result.changes === 0) {
    return NextResponse.json({ error: "记录不存在或无权操作" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
