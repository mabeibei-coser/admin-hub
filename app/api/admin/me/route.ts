import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { deriveVisibleMenus } from "@/lib/menus";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { showAll, visibleProjects, showService, showAdmins } =
    deriveVisibleMenus(session);

  return NextResponse.json({
    adminId: session.adminId,
    username: session.username,
    name: session.name,
    isSuper: session.isSuper ?? false,
    menus: session.menus ?? [],
    // 便捷字段，sidebar 直接读，不需要再跑 deriveVisibleMenus
    showAll,
    visibleProjects,
    showService,
    showAdmins,
  });
}
