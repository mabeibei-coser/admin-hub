import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "career-report.db");
// career-nav 数据库路径（ATTACH DATABASE 模式）。默认与 career-report 同目录。
// 部署时通过 NAV_DB_PATH env 指向实际 career-nav 数据文件。
const NAV_DB_PATH = process.env.NAV_DB_PATH ?? path.join(DATA_DIR, "career-nav.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "reports"), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "resumes"), { recursive: true });
  fs.mkdirSync(path.join(DATA_DIR, "temp"), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      target_position TEXT NOT NULL,
      target_education TEXT,
      target_company TEXT,
      target_city_tier TEXT,
      has_resume INTEGER DEFAULT 0,
      resume_filename TEXT,
      resume_storage_path TEXT,
      report_storage_path TEXT,
      sections_status TEXT,
      ip TEXT,
      user_agent TEXT,
      duration_ms INTEGER
    )
  `);
  _db.exec(
    `CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC)`
  );
  _db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      username              TEXT NOT NULL UNIQUE,
      name                  TEXT NOT NULL,
      password_hash         TEXT NOT NULL,
      note                  TEXT,
      menus_json            TEXT NOT NULL DEFAULT '[]',
      is_super              INTEGER NOT NULL DEFAULT 0,
      is_active             INTEGER NOT NULL DEFAULT 1,
      session_invalid_after INTEGER,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
  `);

  // 服务跟踪：把咨询用户从 nav.reports「转入」持续服务跟进流程
  _db.exec(`
    CREATE TABLE IF NOT EXISTS service_tracking (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      source_project      TEXT    NOT NULL CHECK (source_project IN ('report','nav')),
      source_report_id    INTEGER NOT NULL,
      user_name           TEXT,
      user_phone          TEXT,
      target_position     TEXT,
      service_category    TEXT    NOT NULL
                          CHECK (service_category IN ('easy','moderate','hard','priority','safety_net')),
      status              TEXT    NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN ('in_progress','completed')),
      staff1_admin_id     INTEGER NOT NULL,
      staff2_admin_id     INTEGER
                          CHECK (staff2_admin_id IS NULL OR staff2_admin_id != staff1_admin_id),
      recorder_admin_id   INTEGER NOT NULL,
      overall_note        TEXT,
      first_service_at    INTEGER NOT NULL,
      last_service_at     INTEGER,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_st_source ON service_tracking(source_project, source_report_id);
    CREATE INDEX IF NOT EXISTS idx_st_staff1 ON service_tracking(staff1_admin_id);
    CREATE INDEX IF NOT EXISTS idx_st_staff2 ON service_tracking(staff2_admin_id);
    CREATE INDEX IF NOT EXISTS idx_st_first ON service_tracking(first_service_at DESC);

    CREATE TABLE IF NOT EXISTS service_records (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_id         INTEGER NOT NULL,
      service_at          INTEGER NOT NULL,
      content             TEXT,
      note                TEXT,
      recorder_admin_id   INTEGER NOT NULL,
      attachments_json    TEXT,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sr_tracking_at ON service_records(tracking_id, service_at DESC);
  `);

  // 老库补列：SQLite 不支持 ADD COLUMN IF NOT EXISTS
  const srCols = new Set(
    (_db.prepare("PRAGMA table_info(service_records)").all() as Array<{ name: string }>).map(
      (c) => c.name,
    ),
  );
  if (!srCols.has("attachments_json")) {
    _db.exec("ALTER TABLE service_records ADD COLUMN attachments_json TEXT");
  }

  return _db;
}

/**
 * 给 admin 用的 DB 句柄：在主 DB 之上 ATTACH career-nav.db 作为 `nav` schema。
 * 幂等：多次调用只 ATTACH 一次。
 *
 * 如果 NAV_DB_PATH 指向的文件不存在，ATTACH 会创建空文件（SQLite 行为）。
 * career-nav 第一次启动会建表，所以即使 ATTACH 时为空文件也不算错。
 * 但 nav.reports 表不存在时 admin 查询会报错——这种情况返回结构化 hint。
 */
export function getAdminDb(): Database.Database {
  const db = getDb();
  const attached = db.prepare("PRAGMA database_list").all() as Array<{ name: string }>;
  if (!attached.some((d) => d.name === "nav")) {
    // SQLite 字符串字面量转义：把单引号变成两个
    const safePath = NAV_DB_PATH.replaceAll("'", "''");
    db.exec(`ATTACH DATABASE '${safePath}' AS nav`);
  }
  return db;
}

/** admin 端检查 nav 库是否就绪（有 reports 表）。返回 false 时 admin 应降级到 'report' tab。 */
export function isNavDbReady(): boolean {
  try {
    const db = getAdminDb();
    const tables = db
      .prepare("SELECT name FROM nav.sqlite_master WHERE type='table' AND name='reports'")
      .all() as Array<{ name: string }>;
    return tables.length > 0;
  } catch {
    return false;
  }
}
