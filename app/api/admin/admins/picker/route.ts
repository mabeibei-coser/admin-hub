import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { getDb } from "@/lib/db";

/**
 * GET /api/admin/admins/picker
 * 普通管理员可调用：列出 is_active=1 的全部管理员，只回 id + name。
 * **不返回** username（手机号），避免泄露给非超管的同事。
 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const rows = getDb()
    .prepare(
      `SELECT id, name FROM admins WHERE is_active = 1 ORDER BY created_at ASC`
    )
    .all() as Array<{ id: number; name: string }>;

  return NextResponse.json({ admins: rows });
}
