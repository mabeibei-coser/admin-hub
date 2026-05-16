import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { getDb } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const { oldPassword, newPassword } = body ?? {};

  if (!oldPassword || typeof oldPassword !== "string") {
    return NextResponse.json({ error: "请输入旧密码" }, { status: 400 });
  }
  if (!newPassword || typeof newPassword !== "string") {
    return NextResponse.json({ error: "请输入新密码" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "新密码至少 8 位" }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT password_hash FROM admins WHERE id = ?")
    .get(session.adminId) as { password_hash: string } | undefined;

  if (!row) {
    return NextResponse.json({ error: "账号不存在" }, { status: 404 });
  }

  const passwordOk = await bcrypt.compare(oldPassword, row.password_hash);
  if (!passwordOk) {
    return NextResponse.json({ error: "旧密码不正确" }, { status: 401 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  const now = Date.now();

  // 更新密码并设置 session_invalid_after，踢出所有旧 session（包括本次）
  db.prepare(
    `UPDATE admins
     SET password_hash = ?, session_invalid_after = ?, updated_at = ?
     WHERE id = ?`
  ).run(newHash, now, now, session.adminId);

  return NextResponse.json({ ok: true });
}
