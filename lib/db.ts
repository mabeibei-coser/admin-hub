import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH ?? path.join(DATA_DIR, "career-report.db");
// career-nav 数据库路径（ATTACH DATABASE 模式）。默认与 career-report 同目录。
// 部署时通过 NAV_DB_PATH env 指向实际 career-nav 数据文件。
const NAV_DB_PATH = process.env.NAV_DB_PATH ?? path.join(DATA_DIR, "career-nav.db");
// startup-diagnostic 数据库路径（ATTACH DATABASE 模式）。默认与 career-report 同目录。
// 部署时通过 STARTUP_DB_PATH env 指向实际 startup-diagnostic 数据文件。
const STARTUP_DB_PATH = process.env.STARTUP_DB_PATH ?? path.join(DATA_DIR, "startup-diagnostic.db");
// resume-tailor 数据库路径（ATTACH DATABASE 模式）。
// 部署时通过 TAILOR_DB_PATH env 指向实际 resume-tailor 数据文件。
const TAILOR_DB_PATH = process.env.TAILOR_DB_PATH ?? path.join(DATA_DIR, "resume-tailor.db");
// salary-report 数据库路径（ATTACH DATABASE 模式）。
// 部署时通过 SALARY_DB_PATH env 指向实际 salary-report 数据文件。
const SALARY_DB_PATH = process.env.SALARY_DB_PATH ?? path.join(DATA_DIR, "salary-report.db");
// hazard-detect 数据库路径（ATTACH DATABASE 模式）。
// 部署时通过 HAZARD_DB_PATH env 指向实际 hazard-detect 数据文件。
const HAZARD_DB_PATH = process.env.HAZARD_DB_PATH ?? path.join(DATA_DIR, "hazard-detect.db");
// ai-interview2 (模拟面试) 数据库路径（ATTACH DATABASE 模式）。
// ⚠️ ai-interview2 项目自己的 db 文件名是 startup-diagnostic.db（历史包袱，与 startup-dig 撞名），
//   admin-hub 这边给一个不撞的默认名 ai-interview.db；生产 .env 必须显式指定 INTERVIEW_DB_PATH。
const INTERVIEW_DB_PATH = process.env.INTERVIEW_DB_PATH ?? path.join(DATA_DIR, "ai-interview.db");
// smart-teaching (智能课件) 数据库路径（ATTACH DATABASE 模式）。
// 部署时通过 TEACHING_DB_PATH env 指向实际 smart-teaching 数据文件。
const TEACHING_DB_PATH = process.env.TEACHING_DB_PATH ?? path.join(DATA_DIR, "smart-teaching.db");

// asg100 (安全隐患域会员中心) 数据库路径（ATTACH DATABASE 只读模式）。
const ASG_DB_PATH = process.env.ASG_DB_PATH ?? path.join(DATA_DIR, "asg100.db");

// ata100 (薪酬域会员中心) 数据库路径（ATTACH DATABASE 只读模式）。
// 会员管理只读查 memberships / orders / membership_ledger / users。
// 部署时通过 ATA_DB_PATH env 指向实际 ata100 数据文件。
const ATA_DB_PATH = process.env.ATA_DB_PATH ?? path.join(DATA_DIR, "ata100.db");

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

  // 管理员分组：仅用于组织分类，删除分组不影响管理员本身（admin.group_id 自动置空）
  _db.exec(`
    CREATE TABLE IF NOT EXISTS admin_groups (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_groups_name ON admin_groups(name);
  `);
  const adminCols = new Set(
    (_db.prepare("PRAGMA table_info(admins)").all() as Array<{ name: string }>).map(
      (c) => c.name,
    ),
  );
  if (!adminCols.has("group_id")) {
    _db.exec("ALTER TABLE admins ADD COLUMN group_id INTEGER");
    _db.exec("CREATE INDEX IF NOT EXISTS idx_admins_group ON admins(group_id)");
  }

  // 服务跟踪：把咨询用户从 nav.reports「转入」持续服务跟进流程
  _db.exec(`
    CREATE TABLE IF NOT EXISTS service_tracking (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      source_project      TEXT    NOT NULL CHECK (source_project IN ('report','nav','startup')),
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

  // 老库迁移：service_tracking.source_project CHECK 约束扩展 'startup'。
  // SQLite 不支持 ALTER TABLE 改 CHECK，必须重建表。幂等：检查 sql 文本含 'startup' 则跳过。
  const stMeta = _db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='service_tracking'")
    .get() as { sql?: string } | undefined;
  if (stMeta?.sql && !stMeta.sql.includes("'startup'")) {
    _db.exec(`
      BEGIN;
      CREATE TABLE service_tracking_new (
        id                  INTEGER PRIMARY KEY AUTOINCREMENT,
        source_project      TEXT    NOT NULL CHECK (source_project IN ('report','nav','startup')),
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
      INSERT INTO service_tracking_new SELECT * FROM service_tracking;
      DROP TABLE service_tracking;
      ALTER TABLE service_tracking_new RENAME TO service_tracking;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_st_source ON service_tracking(source_project, source_report_id);
      CREATE INDEX IF NOT EXISTS idx_st_staff1 ON service_tracking(staff1_admin_id);
      CREATE INDEX IF NOT EXISTS idx_st_staff2 ON service_tracking(staff2_admin_id);
      CREATE INDEX IF NOT EXISTS idx_st_first ON service_tracking(first_service_at DESC);
      COMMIT;
    `);
  }

  // 报告隐藏名单：admin 在跨库（nav / startup）报告列表里把某条记录"删除"。
  // 实际不动 nav.* / startup.* 业务库（守住「admin-hub 跨库只读」铁律），
  // 只在 admin-hub 这边记一笔，列表查询时 LEFT JOIN 过滤掉。
  // 主键 (source_project, source_report_id) 天然幂等，删两次是同一条记录。
  _db.exec(`
    CREATE TABLE IF NOT EXISTS hidden_reports (
      source_project     TEXT    NOT NULL CHECK (source_project IN ('nav','startup')),
      source_report_id   INTEGER NOT NULL,
      hidden_by_admin_id INTEGER NOT NULL,
      hidden_at          INTEGER NOT NULL,
      PRIMARY KEY (source_project, source_report_id)
    );
    CREATE INDEX IF NOT EXISTS idx_hidden_reports_project ON hidden_reports(source_project, source_report_id);
  `);

  // 课件用户白名单：admin 加入的手机号才能登录智能课件(A700)。
  // 「最后登录时间/使用次数」不存本表，列表查询时跨 ATTACH 只读 teaching 库算出。
  _db.exec(`
    CREATE TABLE IF NOT EXISTS courseware_users (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      phone             TEXT    NOT NULL UNIQUE,
      name              TEXT,
      added_by_admin_id INTEGER NOT NULL,
      note              TEXT,
      note2             TEXT,
      status            TEXT    NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','disabled')),
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_cu_phone ON courseware_users(phone);
    CREATE INDEX IF NOT EXISTS idx_cu_added_by ON courseware_users(added_by_admin_id);
    CREATE INDEX IF NOT EXISTS idx_cu_created ON courseware_users(created_at DESC);
  `);

  // 全局系统设置（key-value）。当前用于「服务使用协议 / 隐私政策」全局文案。
  // 与 ata.legal_documents 的区别：那张表绑定 ATA100 业务，这张表全局通用。
  _db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key         TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT NOT NULL DEFAULT '',
      updated_at  INTEGER NOT NULL
    );
  `);
  const seedNow = Date.now();
  _db.prepare(
    "INSERT OR IGNORE INTO system_settings(key, title, content, updated_at) VALUES (?, ?, ?, ?)"
  ).run("service_agreement", "服务使用协议", "", seedNow);
  _db.prepare(
    "INSERT OR IGNORE INTO system_settings(key, title, content, updated_at) VALUES (?, ?, ?, ?)"
  ).run("privacy_policy", "隐私政策", "", seedNow);

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
  if (!attached.some((d) => d.name === "startup")) {
    const safePath = STARTUP_DB_PATH.replaceAll("'", "''");
    db.exec(`ATTACH DATABASE '${safePath}' AS startup`);
  }
  if (!attached.some((d) => d.name === "tailor")) {
    const safePath = TAILOR_DB_PATH.replaceAll("'", "''");
    db.exec(`ATTACH DATABASE '${safePath}' AS tailor`);
  }
  if (!attached.some((d) => d.name === "salary")) {
    const safePath = SALARY_DB_PATH.replaceAll("'", "''");
    db.exec(`ATTACH DATABASE '${safePath}' AS salary`);
  }
  if (!attached.some((d) => d.name === "hazard")) {
    const safePath = HAZARD_DB_PATH.replaceAll("'", "''");
    db.exec(`ATTACH DATABASE '${safePath}' AS hazard`);
  }
  if (!attached.some((d) => d.name === "interview")) {
    const safePath = INTERVIEW_DB_PATH.replaceAll("'", "''");
    db.exec(`ATTACH DATABASE '${safePath}' AS interview`);
  }
  if (!attached.some((d) => d.name === "teaching")) {
    const safePath = TEACHING_DB_PATH.replaceAll("'", "''");
    db.exec(`ATTACH DATABASE '${safePath}' AS teaching`);
  }
  if (!attached.some((d) => d.name === "asg")) {
    const safePath = ASG_DB_PATH.replaceAll("'", "''");
    db.exec(`ATTACH DATABASE '${safePath}' AS asg`);
  }
  if (!attached.some((d) => d.name === "ata")) {
    const safePath = ATA_DB_PATH.replaceAll("'", "''");
    db.exec(`ATTACH DATABASE '${safePath}' AS ata`);
    // 协议管理表（admin-hub 写入、ATA100 前台只读）：
    // 此表是「ATA100 业务库只读」铁律的明确例外，仅限协议这种由后台维护、业务侧消费的配置数据。
    // 业务表（users / orders / memberships / ledger）仍严格只读。
    // 如果 ATA100 先启动已建表，IF NOT EXISTS 跳过；如果 admin-hub 先启动，这里兜底建表。
    db.exec(`
      CREATE TABLE IF NOT EXISTS ata.legal_documents (
        type        TEXT PRIMARY KEY,
        title       TEXT NOT NULL,
        content     TEXT NOT NULL DEFAULT '',
        updated_at  INTEGER NOT NULL
      );
    `);
    const now = Date.now();
    db.prepare(
      "INSERT OR IGNORE INTO ata.legal_documents(type, title, content, updated_at) VALUES (?, ?, ?, ?)"
    ).run("terms", "服务使用协议", "", now);
    db.prepare(
      "INSERT OR IGNORE INTO ata.legal_documents(type, title, content, updated_at) VALUES (?, ?, ?, ?)"
    ).run("privacy", "隐私政策", "", now);
  }
  return db;
}

/** admin 端检查 asg 库是否就绪（有 memberships 表）。返回 false 时会员管理降级为空。 */
export function isAsgDbReady(): boolean {
  try {
    const db = getAdminDb();
    const tables = db
      .prepare("SELECT name FROM asg.sqlite_master WHERE type='table' AND name='memberships'")
      .all() as Array<{ name: string }>;
    return tables.length > 0;
  } catch {
    return false;
  }
}

/** admin 端检查 ata 库是否就绪（有 memberships 表）。返回 false 时会员管理降级为空。 */
export function isAtaDbReady(): boolean {
  try {
    const db = getAdminDb();
    const tables = db
      .prepare("SELECT name FROM ata.sqlite_master WHERE type='table' AND name='memberships'")
      .all() as Array<{ name: string }>;
    return tables.length > 0;
  } catch {
    return false;
  }
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

/** admin 端检查 startup 库是否就绪（有 reports 表）。返回 false 时 admin 应降级到 'report' tab。 */
export function isStartupDbReady(): boolean {
  try {
    const db = getAdminDb();
    const tables = db
      .prepare("SELECT name FROM startup.sqlite_master WHERE type='table' AND name='reports'")
      .all() as Array<{ name: string }>;
    return tables.length > 0;
  } catch {
    return false;
  }
}

/** startup 数据库目录路径（用于读 quiz-bank.json 等附属文件）。 */
export function getStartupDbDir(): string {
  return path.dirname(STARTUP_DB_PATH);
}

/** admin 端检查 tailor 库是否就绪（有 reports 表）。返回 false 时 admin 应降级到 'report' tab。 */
export function isTailorDbReady(): boolean {
  try {
    const db = getAdminDb();
    const tables = db
      .prepare("SELECT name FROM tailor.sqlite_master WHERE type='table' AND name='reports'")
      .all() as Array<{ name: string }>;
    return tables.length > 0;
  } catch {
    return false;
  }
}

/** admin 端检查 salary 库是否就绪（有 reports 表）。返回 false 时 admin 应降级到 'report' tab。 */
export function isSalaryDbReady(): boolean {
  try {
    const db = getAdminDb();
    const tables = db
      .prepare("SELECT name FROM salary.sqlite_master WHERE type='table' AND name='reports'")
      .all() as Array<{ name: string }>;
    return tables.length > 0;
  } catch {
    return false;
  }
}

/** admin 端检查 hazard 库是否就绪（有 reports 表）。返回 false 时 admin 应降级到 'report' tab。 */
export function isHazardDbReady(): boolean {
  try {
    const db = getAdminDb();
    const tables = db
      .prepare("SELECT name FROM hazard.sqlite_master WHERE type='table' AND name='reports'")
      .all() as Array<{ name: string }>;
    return tables.length > 0;
  } catch {
    return false;
  }
}

/** admin 端检查 interview 库是否就绪（有 reports 表）。返回 false 时 admin 应降级到 'report' tab。 */
export function isInterviewDbReady(): boolean {
  try {
    const db = getAdminDb();
    const tables = db
      .prepare("SELECT name FROM interview.sqlite_master WHERE type='table' AND name='reports'")
      .all() as Array<{ name: string }>;
    return tables.length > 0;
  } catch {
    return false;
  }
}

/** interview 数据库目录路径（用于读 quiz-bank.json 等附属文件）。 */
export function getInterviewDbDir(): string {
  return path.dirname(INTERVIEW_DB_PATH);
}

/** admin 端检查 teaching（智能课件）库是否就绪（有 reports 表）。返回 false 时 admin 应降级到 'report' tab。 */
export function isTeachingDbReady(): boolean {
  try {
    const db = getAdminDb();
    const tables = db
      .prepare("SELECT name FROM teaching.sqlite_master WHERE type='table' AND name='reports'")
      .all() as Array<{ name: string }>;
    return tables.length > 0;
  } catch {
    return false;
  }
}
