import { NextRequest, NextResponse } from "next/server";
import { requireSuper } from "@/lib/admin-session";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * POST /api/admin/reports/hide
 * Body: { project: "nav" | "startup", reportId: number }
 *
 * 把一条 nav / startup 报告从「admin 端列表」隐藏掉（不删 nav.* / startup.* 业务库）。
 * 只允许超管操作。幂等：同一 (project, reportId) 重复隐藏 = INSERT OR IGNORE，不报错。
 */
export async function POST(req: NextRequest) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限（仅超管可操作）" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { project?: string; reportId?: number }
    | null;
  if (!body) {
    return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });
  }

  const { project, reportId } = body;
  if (project !== "nav" && project !== "startup") {
    return NextResponse.json({ error: "project 必须是 nav 或 startup" }, { status: 400 });
  }
  if (!Number.isInteger(reportId) || (reportId as number) <= 0) {
    return NextResponse.json({ error: "reportId 无效" }, { status: 400 });
  }

  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO hidden_reports (source_project, source_report_id, hidden_by_admin_id, hidden_at)
     VALUES (?, ?, ?, ?)`
  ).run(project, reportId, session.adminId!, Date.now());

  return NextResponse.json({ ok: true });
}
