import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { getDb } from "@/lib/db";

/**
 * GET /api/admin/admins/picker
 * 普通管理员可调用：列出 is_active=1 的全部管理员，只回 id + name + group_id。
 * **不返回** username（手机号），避免泄露给非超管的同事。
 *
 * 可选 query：
 *  - same_group_as=<adminId> — 只返回与该 admin 同分组的活跃管理员
 *    (含未分组互相可见：两者 group_id 都为 NULL 也算"同组")
 */
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(req.url);
  const sameGroupAsRaw = url.searchParams.get("same_group_as");
  const db = getDb();

  if (sameGroupAsRaw) {
    const anchorId = parseInt(sameGroupAsRaw, 10);
    if (isNaN(anchorId)) {
      return NextResponse.json({ error: "same_group_as 格式错误" }, { status: 400 });
    }
    const anchor = db
      .prepare("SELECT group_id FROM admins WHERE id = ?")
      .get(anchorId) as { group_id: number | null } | undefined;
    if (!anchor) {
      return NextResponse.json({ admins: [] });
    }

    const rows =
      anchor.group_id == null
        ? (db
            .prepare(
              `SELECT id, name, group_id FROM admins
               WHERE is_active = 1 AND group_id IS NULL
               ORDER BY created_at ASC`
            )
            .all() as Array<{ id: number; name: string; group_id: number | null }>)
        : (db
            .prepare(
              `SELECT id, name, group_id FROM admins
               WHERE is_active = 1 AND group_id = ?
               ORDER BY created_at ASC`
            )
            .all(anchor.group_id) as Array<{ id: number; name: string; group_id: number | null }>);

    return NextResponse.json({ admins: rows });
  }

  const rows = db
    .prepare(
      `SELECT id, name, group_id FROM admins WHERE is_active = 1 ORDER BY created_at ASC`
    )
    .all() as Array<{ id: number; name: string; group_id: number | null }>;

  return NextResponse.json({ admins: rows });
}
