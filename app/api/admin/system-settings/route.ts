import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireSuper } from "@/lib/admin-session";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const VALID_KEYS = ["service_agreement", "privacy_policy"] as const;
type SettingKey = (typeof VALID_KEYS)[number];

interface SettingRow {
  key: SettingKey;
  title: string;
  content: string;
  updated_at: number;
}

/**
 * GET /api/admin/system-settings
 * 所有登录 admin 可读（用于查看协议内容）。返回两条记录。
 */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT key, title, content, updated_at FROM system_settings WHERE key IN ('service_agreement','privacy_policy') ORDER BY key"
    )
    .all() as SettingRow[];
  return NextResponse.json({
    rows: rows.map((r) => ({
      key: r.key,
      title: r.title,
      content: r.content,
      updatedAt: r.updated_at,
    })),
  });
}

/**
 * PUT /api/admin/system-settings
 * Body: { key: 'service_agreement'|'privacy_policy', title: string, content: string }
 * 仅超管可改。
 */
export async function PUT(req: NextRequest) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限（仅超管可编辑）" }, { status: 403 });
  }
  let body: { key?: unknown; title?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const key = String(body?.key || "").trim() as SettingKey;
  if (!VALID_KEYS.includes(key)) {
    return NextResponse.json(
      { error: "key 必须是 service_agreement 或 privacy_policy" },
      { status: 400 },
    );
  }
  const title = String(body?.title || "").trim();
  const content = String(body?.content ?? "");
  if (!title) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }
  if (title.length > 80) {
    return NextResponse.json({ error: "标题不能超过 80 字" }, { status: 400 });
  }
  if (content.length > 500_000) {
    return NextResponse.json(
      { error: "内容过长（上限 50 万字符）" },
      { status: 400 },
    );
  }

  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO system_settings(key, title, content, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET title=excluded.title, content=excluded.content, updated_at=excluded.updated_at`,
  ).run(key, title, content, now);

  return NextResponse.json({ ok: true, key, title, updatedAt: now });
}
