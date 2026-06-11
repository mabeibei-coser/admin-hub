import { NextRequest, NextResponse } from "next/server";
import { requireSuper } from "@/lib/admin-session";
import { getAdminDb, isAtaDbReady } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 系统设置：服务使用协议 / 隐私政策正文。仅超管可读写。
 *
 * 破例说明：admin-hub 默认只读 ata.* 库。经用户授权（2026-06-11），本接口可写
 *   - ata.site_settings（key='legal_terms' / 'legal_privacy' 的正文 upsert）
 * 其余 ata.* 表仍保持只读。详见 admin-hub CLAUDE.md / AGENTS.md 铁律 #1。
 *
 * 正文存薪酬域(ata100)自己的库，薪酬登录页 + 公开接口 GET /api/legal/:type 只读它，
 * 从而「后台保存 → 登录页生效」联动。
 */

const KEYS = new Set(["legal_terms", "legal_privacy"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB（含内嵌图片 data URL）

function ensureTable(db: ReturnType<typeof getAdminDb>) {
  // 与 ata100/lib/db.js 同一份 DDL（幂等）。ata100 是 schema 拥有者；这里防御性建表，
  // 保证首次保存时表必定存在（即使 ata100 尚未新建过它）。
  db.exec(`
    CREATE TABLE IF NOT EXISTS ata.site_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export async function GET() {
  const session = await requireSuper();
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!isAtaDbReady()) {
    return NextResponse.json({ error: "薪酬域数据库未就绪（ata100 可能未部署）" }, { status: 503 });
  }

  const db = getAdminDb();
  ensureTable(db);
  const rows = db
    .prepare("SELECT key, value, updated_at FROM ata.site_settings WHERE key IN ('legal_terms','legal_privacy')")
    .all() as Array<{ key: string; value: string; updated_at: number }>;
  const map = new Map(rows.map((r) => [r.key, r]));
  const pick = (k: string) => ({
    content: map.get(k)?.value ?? "",
    updatedAt: map.get(k)?.updated_at ?? 0,
  });
  return NextResponse.json({ terms: pick("legal_terms"), privacy: pick("legal_privacy") });
}

export async function PUT(req: NextRequest) {
  const session = await requireSuper();
  if (!session) return NextResponse.json({ error: "仅超管可编辑系统设置" }, { status: 403 });
  if (!isAtaDbReady()) {
    return NextResponse.json({ error: "薪酬域数据库未就绪（ata100 可能未部署）" }, { status: 503 });
  }

  const body = (await req.json().catch(() => null)) as { key?: string; content?: string } | null;
  if (!body || !KEYS.has(body.key ?? "")) {
    return NextResponse.json({ error: "key 必须是 legal_terms 或 legal_privacy" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content 必须是字符串" }, { status: 400 });
  }
  if (Buffer.byteLength(body.content, "utf8") > MAX_BYTES) {
    return NextResponse.json({ error: "内容过大（含图片不超过 5MB），请压缩图片后再试" }, { status: 413 });
  }

  const db = getAdminDb();
  ensureTable(db);
  const now = Date.now();
  try {
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO ata.site_settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).run(body.key, body.content, now);
    });
    tx();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "数据库写入失败";
    if (msg.includes("SQLITE_BUSY")) {
      return NextResponse.json({ error: "薪酬域数据库正忙，请稍后重试" }, { status: 503 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, key: body.key, updatedAt: now });
}
