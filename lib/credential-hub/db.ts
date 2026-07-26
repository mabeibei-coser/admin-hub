import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_DB_PATH = path.resolve(process.cwd(), "data", "credentials.db");

export function resolveCredentialDbPath(
  environment: Partial<
    Pick<NodeJS.ProcessEnv, "CREDENTIALS_DB_PATH" | "NODE_ENV">
  > = process.env,
): string {
  const configured = environment.CREDENTIALS_DB_PATH?.trim();
  if (configured) return path.resolve(configured);
  if (environment.NODE_ENV === "production") {
    throw new Error("生产环境未配置 CREDENTIALS_DB_PATH");
  }
  return DEFAULT_DB_PATH;
}

export function initializeCredentialSchema(db: Database.Database): void {
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(`
    CREATE TABLE IF NOT EXISTS credentials (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      logical_key  TEXT NOT NULL UNIQUE,
      provider     TEXT NOT NULL,
      capability   TEXT NOT NULL,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS credential_versions (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      credential_id          INTEGER NOT NULL REFERENCES credentials(id),
      version                INTEGER NOT NULL,
      status                 TEXT NOT NULL DEFAULT 'candidate'
                             CHECK (status IN ('candidate','active','retired','revoked')),
      secret_ciphertext      TEXT NOT NULL,
      secret_iv              TEXT NOT NULL,
      secret_auth_tag        TEXT NOT NULL,
      encryption_key_version INTEGER NOT NULL DEFAULT 1,
      endpoint               TEXT NOT NULL,
      model                  TEXT NOT NULL,
      protocol               TEXT NOT NULL,
      test_status            TEXT NOT NULL DEFAULT 'untested'
                             CHECK (test_status IN ('untested','passed','failed')),
      test_error_category    TEXT,
      tested_at              INTEGER,
      activated_at           INTEGER,
      retired_at             INTEGER,
      created_by_admin_id    INTEGER,
      created_at             INTEGER NOT NULL,
      UNIQUE (credential_id, version)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_credential_versions_one_active
      ON credential_versions(credential_id) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_credential_versions_status
      ON credential_versions(credential_id, status, version DESC);

    CREATE TABLE IF NOT EXISTS credential_bindings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id    TEXT NOT NULL,
      capability    TEXT NOT NULL,
      role          TEXT NOT NULL CHECK (role IN ('primary','fallback')),
      credential_id INTEGER NOT NULL REFERENCES credentials(id),
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL,
      UNIQUE (project_id, capability, role)
    );

    CREATE TABLE IF NOT EXISTS project_tokens (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id  TEXT NOT NULL,
      token_hash  TEXT NOT NULL UNIQUE,
      scopes_json TEXT NOT NULL,
      revoked_at  INTEGER,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_project_tokens_project
      ON project_tokens(project_id, revoked_at);

    CREATE TABLE IF NOT EXISTS credential_audit_events (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_type    TEXT NOT NULL CHECK (actor_type IN ('admin','project','system')),
      actor_id      TEXT,
      action        TEXT NOT NULL,
      target_type   TEXT NOT NULL,
      target_id     TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_credential_audit_created
      ON credential_audit_events(created_at DESC);

    CREATE TABLE IF NOT EXISTS credential_project_events (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id         TEXT NOT NULL,
      binding_id         INTEGER,
      credential_version INTEGER,
      status             TEXT NOT NULL CHECK (status IN ('success','error')),
      latency_ms         INTEGER,
      error_category     TEXT,
      created_at         INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_credential_project_events_latest
      ON credential_project_events(project_id, created_at DESC);
  `);
}

export function openCredentialDb(
  dbPath?: string,
): Database.Database {
  const resolvedPath = dbPath ?? resolveCredentialDbPath();
  if (resolvedPath !== ":memory:") {
    const parent = path.dirname(path.resolve(resolvedPath));
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
    if (process.platform !== "win32") fs.chmodSync(parent, 0o700);
  }
  const db = new Database(resolvedPath);
  if (resolvedPath !== ":memory:" && process.platform !== "win32") {
    fs.chmodSync(path.resolve(resolvedPath), 0o600);
  }
  db.pragma("journal_mode = WAL");
  initializeCredentialSchema(db);
  return db;
}

let singleton: Database.Database | null = null;

export function getCredentialDb(): Database.Database {
  singleton ??= openCredentialDb();
  return singleton;
}
