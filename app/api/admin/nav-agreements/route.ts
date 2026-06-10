import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { getAdminDb, isNavDbReady } from "@/lib/db";

export const runtime = "nodejs";

// 协议管理复用「职业导航」项目菜单权限:能管 nav 报告 = 能管 nav 协议。
const MENU = "nav";
const VALID_TYPES = ["terms", "privacy"] as const;
type AgreementType = (typeof VALID_TYPES)[number];

interface AgreementRow {
  type: AgreementType;
  title: string;
  content: string;
  updated_at: number;
}

// 幂等 ensure:nav DB 已 ATTACH 但老库还没 legal_documents 表时主动建。
// 与 career-nav 自己 db.ts 里的 CREATE TABLE IF NOT EXISTS 同步,任一侧先跑都安全。
function ensureNavLegalTable() {
  const db = getAdminDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS nav.legal_documents (
      type        TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      updated_at  INTEGER NOT NULL
    )
  `);
  const now = Date.now();
  db.prepare(
    "INSERT OR IGNORE INTO nav.legal_documents(type, title, content, updated_at) VALUES (?, ?, ?, ?)"
  ).run("terms", "服务使用协议", "", now);
  db.prepare(
    "INSERT OR IGNORE INTO nav.legal_documents(type, title, content, updated_at) VALUES (?, ?, ?, ?)"
  ).run("privacy", "隐私政策", "", now);
}

/**
 * GET /api/admin/nav-agreements
 * 返回两份协议的当前内容。
 */
export async function GET() {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  if (!isNavDbReady()) {
    return NextResponse.json({ rows: [], ready: false });
  }
  ensureNavLegalTable();
  const db = getAdminDb();
  const rows = db
    .prepare(
      "SELECT type, title, content, updated_at FROM nav.legal_documents WHERE type IN ('terms', 'privacy') ORDER BY type"
    )
    .all() as AgreementRow[];
  return NextResponse.json({
    rows: rows.map((r) => ({
      type: r.type,
      title: r.title,
      content: r.content,
      updatedAt: r.updated_at,
    })),
    ready: true,
  });
}

/**
 * PUT /api/admin/nav-agreements
 * Body: { type: 'terms'|'privacy', title: string, content: string }
 */
export async function PUT(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  if (!isNavDbReady()) {
    return NextResponse.json({ error: "career-nav 数据库未就绪" }, { status: 503 });
  }
  ensureNavLegalTable();
  let body: { type?: unknown; title?: unknown; content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const type = String(body?.type || "").trim() as AgreementType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "type 必须是 terms 或 privacy" }, { status: 400 });
  }
  const title = String(body?.title || "").trim();
  const content = String(body?.content || "");
  if (!title) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }
  if (title.length > 80) {
    return NextResponse.json({ error: "标题不能超过 80 字" }, { status: 400 });
  }
  if (content.length > 200_000) {
    return NextResponse.json({ error: "协议内容过长(上限 20 万字符)" }, { status: 400 });
  }

  const db = getAdminDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO nav.legal_documents(type, title, content, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(type) DO UPDATE SET title=excluded.title, content=excluded.content, updated_at=excluded.updated_at`
  ).run(type, title, content, now);

  return NextResponse.json({ ok: true, type, title, updatedAt: now });
}
