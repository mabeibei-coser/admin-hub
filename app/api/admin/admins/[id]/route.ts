import { NextRequest, NextResponse } from "next/server";
import { requireSuper } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import { ASSIGNABLE_MENUS } from "@/lib/menus";
import bcrypt from "bcryptjs";

const VALID_MENU_KEYS = new Set<string>(ASSIGNABLE_MENUS.map((m) => m.key));

function validateMenus(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((k) => typeof k === "string" && VALID_MENU_KEYS.has(k));
}

interface AdminRow {
  id: number;
  is_super: number;
  is_active: number;
}

/** PATCH /api/admin/admins/[id] — 编辑管理员（超管专用） */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const { id } = await params;
  const targetId = parseInt(id, 10);
  if (isNaN(targetId)) {
    return NextResponse.json({ error: "无效 ID" }, { status: 400 });
  }

  const db = getDb();
  const target = db
    .prepare("SELECT id, is_super, is_active FROM admins WHERE id = ?")
    .get(targetId) as AdminRow | undefined;

  if (!target) {
    return NextResponse.json({ error: "管理员不存在" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const isSelf = session.adminId === targetId;

  // 防自锁：自己不能改自己的 is_super 和 is_active
  const { name, password, note, menus } = body;
  let { is_active, is_super } = body;
  if (isSelf) {
    is_super = undefined;
    is_active = undefined;
  }

  // 最后超管守卫（M2）：如果目标是超管，且有人试图禁用或取消超管资格，
  // 检查禁用/降级后是否还有其他活跃超管。
  if (target.is_super === 1) {
    const willDesuper = is_super === false || is_super === 0;
    const willDisable = is_active === false || is_active === 0;
    if (willDesuper || willDisable) {
      const remaining = db
        .prepare(
          "SELECT COUNT(*) AS c FROM admins WHERE is_super = 1 AND is_active = 1 AND id != ?"
        )
        .get(targetId) as { c: number };
      if (remaining.c < 1) {
        return NextResponse.json(
          { error: "系统必须保留至少一个活跃超管，无法执行此操作" },
          { status: 400 }
        );
      }
    }
  }

  // 构建 UPDATE
  const sets: string[] = [];
  const vals: unknown[] = [];
  let willInvalidateSession = false; // 是否需要踢出目标账号的旧 session

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "姓名不能为空" }, { status: 400 });
    }
    sets.push("name = ?");
    vals.push(name.trim());
  }

  if (note !== undefined) {
    sets.push("note = ?");
    vals.push(note?.trim() || null);
  }

  if (menus !== undefined) {
    const validated = validateMenus(menus);
    if (validated === null) {
      return NextResponse.json({ error: "菜单权限格式错误" }, { status: 400 });
    }
    sets.push("menus_json = ?");
    vals.push(JSON.stringify(validated));
    // 菜单权限变更也踢出旧 session，让用户重新登录拿到新权限
    willInvalidateSession = true;
  }

  if (password !== undefined) {
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
    }
    const newHash = await bcrypt.hash(password, 10);
    sets.push("password_hash = ?");
    vals.push(newHash);
    willInvalidateSession = true;
  }

  if (is_active !== undefined && !isSelf) {
    const v = is_active ? 1 : 0;
    sets.push("is_active = ?");
    vals.push(v);
    if (!v) willInvalidateSession = true; // 停用时踢出
  }

  if (is_super !== undefined && !isSelf) {
    const v = is_super ? 1 : 0;
    sets.push("is_super = ?");
    vals.push(v);
    if (!v) willInvalidateSession = true;
  }

  if (sets.length === 0) {
    return NextResponse.json({ ok: true }); // 没有任何变更
  }

  const now = Date.now();
  sets.push("updated_at = ?");
  vals.push(now);

  if (willInvalidateSession) {
    sets.push("session_invalid_after = ?");
    vals.push(now);
  }

  vals.push(targetId);
  db.prepare(`UPDATE admins SET ${sets.join(", ")} WHERE id = ?`).run(...vals);

  return NextResponse.json({ ok: true });
}
