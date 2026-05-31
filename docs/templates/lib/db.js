// ─────────────────────────────────────────────────────────────────────────
// templates/lib/db.js
// 适用：Vite + Express 形态。直接 cp 到项目根的 lib/db.js。
// 替换：<PROJECT> → 项目名大写（如 SALARY）；<your-project> → 项目名 kebab 小写
// 来源：基于 salary-report (A500) 实战版本提炼。
// ─────────────────────────────────────────────────────────────────────────

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");

// 优先 env 指定；否则默认项目根 data/<your-project>.db
const DB_PATH =
  process.env.<PROJECT>_DB_PATH || path.join(DATA_DIR, "<your-project>.db");

let _db = null;

export function getDb() {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");         // ⚠️ 硬约束：跨进程并发的前提
  _db.pragma("busy_timeout = 5000");        // 偶发竞争时自动重试 5s

  // ── users 表 ────────────────────────────────────────────────────
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      phone         TEXT NOT NULL UNIQUE,
      created_at    INTEGER NOT NULL,
      last_login_at INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
  `);

  // ── reports 表 ──────────────────────────────────────────────────
  // 核心列（不要改名、不要改类型）：id / user_id / user_phone / created_at /
  //                                  report_json / duration_ms / ip / user_agent
  // 业务列（按你项目自由加，下面是 salary-report 的样例）：
  _db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL,
      user_phone   TEXT    NOT NULL,
      created_at   INTEGER NOT NULL,
      -- ▼ 业务列（按你项目改，下面 5 个是 salary-report 的样例） ▼
      position     TEXT,
      company      TEXT,
      rank         TEXT,
      education    TEXT,
      city         TEXT,
      -- ▲ 业务列结束 ▲
      form_data_json TEXT,                  -- 用户填表原始输入（可选；字段多 / 易变时推荐用这个）
      report_json  TEXT    NOT NULL,        -- AI 返回的完整 JSON
      duration_ms  INTEGER,
      ip           TEXT,
      user_agent   TEXT,
      has_resume   INTEGER DEFAULT 0,       -- 简历上传（可选）
      resume_filename TEXT                  -- 简历文件名（可选）
    );
    CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_user       ON reports(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_reports_phone      ON reports(user_phone, created_at DESC);
    -- 查询缓存索引：按你业务 cache key 列调整
    CREATE INDEX IF NOT EXISTS idx_reports_query_cache
      ON reports(position, company, rank, education, city, created_at DESC);
  `);

  return _db;
}

// ──── helper: 登录时 upsert 用户 ────────────────────────────────────
export function upsertUserByPhone(phone) {
  const db = getDb();
  const now = Date.now();
  const existing = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone);
  if (existing) {
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(now, existing.id);
    return existing.id;
  }
  const info = db
    .prepare("INSERT INTO users(phone, created_at, last_login_at) VALUES (?, ?, ?)")
    .run(phone, now, now);
  return Number(info.lastInsertRowid);
}

// ──── helper: 查找缓存的报告（按你业务字段调整） ────────────────────
// 入参 formData 的 cache key 字段必须与索引列对齐
export function findCachedReport(formData, withinMs) {
  const db = getDb();
  const sinceTs = Date.now() - withinMs;
  // FIXME: 改成你业务的查询缓存键
  const { position, company, rank, education, city } = formData;
  return db
    .prepare(
      `SELECT id, user_id, user_phone, created_at, report_json
         FROM reports
        WHERE position = ? AND company = ? AND rank = ? AND education = ? AND city = ?
          AND created_at >= ?
        ORDER BY created_at DESC
        LIMIT 1`
    )
    .get(position, company, rank, education, city, sinceTs);
}

// ──── helper: 插入报告 ─────────────────────────────────────────────
export function insertReport(payload) {
  const db = getDb();
  // FIXME: 按你 reports 表实际列调整下面的 INSERT
  const info = db
    .prepare(
      `INSERT INTO reports(
        user_id, user_phone, created_at,
        position, company, rank, education, city,
        form_data_json, report_json,
        duration_ms, ip, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      payload.userId,
      payload.userPhone,
      payload.createdAt,
      payload.formData?.position || null,
      payload.formData?.company || null,
      payload.formData?.rank || null,
      payload.formData?.education || null,
      payload.formData?.city || null,
      JSON.stringify(payload.formData || {}),
      JSON.stringify(payload.report),
      payload.durationMs ?? null,
      payload.ip ?? null,
      payload.userAgent ?? null,
    );
  return Number(info.lastInsertRowid);
}
