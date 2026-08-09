import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import { deriveVisibleMenus } from "@/lib/menus";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const {
    showAll,
    visibleProjects,
    showService,
    showCoursewareUsers,
    showAsgMembers,
    showAsgDocuments,
    showAtaMembers,
    showWrappers,
    showAdmins,
  } = deriveVisibleMenus(session);

  // 查当前登录 admin 的分组（用于客户端展示，如「添加课件用户」弹窗）
  // session 里没有 group_id，故每次 me 重新读一次 DB（成本低）
  let group_id: number | null = null;
  let group_name: string | null = null;
  if (session.adminId) {
    const row = getDb()
      .prepare(
        `SELECT a.group_id, g.name AS group_name
         FROM admins a
         LEFT JOIN admin_groups g ON g.id = a.group_id
         WHERE a.id = ?`
      )
      .get(session.adminId) as { group_id: number | null; group_name: string | null } | undefined;
    if (row) {
      group_id = row.group_id;
      group_name = row.group_name;
    }
  }

  return NextResponse.json({
    adminId: session.adminId,
    username: session.username,
    name: session.name,
    isSuper: session.isSuper ?? false,
    menus: session.menus ?? [],
    group_id,
    group_name,
    // 便捷字段，sidebar 直接读，不需要再跑 deriveVisibleMenus
    showAll,
    visibleProjects,
    showService,
    showCoursewareUsers,
    showAsgMembers,
    showAsgDocuments,
    showAtaMembers,
    showWrappers,
    showAdmins,
  });
}
