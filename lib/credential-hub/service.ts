import { createHash, randomBytes } from "node:crypto";
import type Database from "better-sqlite3";

import {
  decryptSecret,
  encryptSecret,
  type EncryptedSecret,
} from "./crypto.ts";

export type CredentialRole = "primary" | "fallback";
export type ProjectTokenScope = "credentials:resolve" | "credentials:events";

export interface CandidateInput {
  logicalKey: string;
  provider: string;
  capability: string;
  secret: string;
  endpoint: string;
  model: string;
  protocol: string;
  createdByAdminId?: number;
}

export interface CandidateResult {
  credentialId: number;
  versionId: number;
  version: number;
  status: "candidate";
}

export interface ResolvedCredential {
  bindingId: number;
  credentialVersion: number;
  provider: string;
  capability: string;
  role: CredentialRole;
  protocol: string;
  endpoint: string;
  model: string;
  apiKey: string;
  resolvedAt: number;
}

export interface CredentialVersionForValidation {
  credentialId: number;
  versionId: number;
  version: number;
  logicalKey: string;
  provider: string;
  capability: string;
  status: "candidate" | "retired";
  endpoint: string;
  model: string;
  protocol: string;
  apiKey: string;
}

export interface CredentialAdminView {
  id: number;
  logicalKey: string;
  provider: string;
  capability: string;
  bindings: Array<{
    id: number;
    projectId: string;
    capability: string;
    role: CredentialRole;
  }>;
  versions: Array<{
    id: number;
    version: number;
    status: "candidate" | "active" | "retired" | "revoked";
    testStatus: "untested" | "passed" | "failed";
    testErrorCategory: string | null;
    endpoint: string;
    model: string;
    protocol: string;
    testedAt: number | null;
    activatedAt: number | null;
  }>;
}

export interface ProjectTokenIdentity {
  tokenId: number;
  projectId: string;
  scopes: ProjectTokenScope[];
}

export interface ProjectCredentialEventInput {
  projectId: string;
  bindingId: number;
  credentialVersion: number;
  status: "success" | "error";
  latencyMs: number;
  errorCategory: string | null;
}

interface VersionRow {
  id: number;
  credential_id: number;
  version: number;
  status: "candidate" | "active" | "retired" | "revoked";
  secret_ciphertext: string;
  secret_iv: string;
  secret_auth_tag: string;
  encryption_key_version: 1;
  test_status: "untested" | "passed" | "failed";
}

interface CredentialAadInput {
  credentialId: number;
  version: number;
  logicalKey: string;
  provider: string;
  capability: string;
  endpoint: string;
  model: string;
  protocol: string;
}

function credentialAad(input: CredentialAadInput): string {
  return JSON.stringify([
    "credential-hub:v1",
    input.credentialId,
    input.version,
    input.logicalKey,
    input.provider,
    input.capability,
    input.endpoint,
    input.model,
    input.protocol,
  ]);
}

function writeAudit(
  db: Database.Database,
  input: {
    actorType: "admin" | "project" | "system";
    actorId?: string | number;
    action: string;
    targetType: string;
    targetId?: string | number;
    metadata?: Record<string, string | number | boolean | null>;
    now: number;
  },
): void {
  db.prepare(
    `INSERT INTO credential_audit_events
       (actor_type, actor_id, action, target_type, target_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.actorType,
    input.actorId == null ? null : String(input.actorId),
    input.action,
    input.targetType,
    input.targetId == null ? null : String(input.targetId),
    JSON.stringify(input.metadata ?? {}),
    input.now,
  );
}

function encryptedFromRow(row: VersionRow): EncryptedSecret {
  return {
    algorithm: "aes-256-gcm",
    keyVersion: row.encryption_key_version,
    ciphertext: row.secret_ciphertext,
    iv: row.secret_iv,
    authTag: row.secret_auth_tag,
  };
}

export function hashProjectToken(token: string): string {
  if (!/^cph_[A-Za-z0-9_-]{43}$/.test(token)) {
    throw new Error("项目 token 格式无效");
  }
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function generateProjectToken(): string {
  return `cph_${randomBytes(32).toString("base64url")}`;
}

export function createCandidate(
  db: Database.Database,
  masterKey: Buffer,
  input: CandidateInput,
  now = Date.now(),
): CandidateResult {
  if (!input.logicalKey.trim() || !input.provider.trim() || !input.capability.trim()) {
    throw new Error("凭证逻辑标识、供应商和能力不能为空");
  }
  if (!input.endpoint.startsWith("https://")) {
    throw new Error("凭证端点必须使用 HTTPS");
  }

  return db.transaction(() => {
    const existing = db
      .prepare(
        "SELECT id, provider, capability FROM credentials WHERE logical_key = ?",
      )
      .get(input.logicalKey) as
      | { id: number; provider: string; capability: string }
      | undefined;
    if (
      existing &&
      (existing.provider !== input.provider || existing.capability !== input.capability)
    ) {
      throw new Error("候选版本不能修改逻辑凭证的供应商或能力");
    }
    if (existing) {
      db.prepare("UPDATE credentials SET updated_at = ? WHERE id = ?").run(
        now,
        existing.id,
      );
    } else {
      db.prepare(
        `INSERT INTO credentials
           (logical_key, provider, capability, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(input.logicalKey, input.provider, input.capability, now, now);
    }

    const credential = db
      .prepare("SELECT id FROM credentials WHERE logical_key = ?")
      .get(input.logicalKey) as { id: number };
    const next = db
      .prepare(
        "SELECT COALESCE(MAX(version), 0) + 1 AS version FROM credential_versions WHERE credential_id = ?",
      )
      .get(credential.id) as { version: number };
    const encrypted = encryptSecret(
      input.secret,
      masterKey,
      credentialAad({
        credentialId: credential.id,
        version: next.version,
        logicalKey: input.logicalKey,
        provider: input.provider,
        capability: input.capability,
        endpoint: input.endpoint,
        model: input.model,
        protocol: input.protocol,
      }),
    );
    const inserted = db
      .prepare(
        `INSERT INTO credential_versions
           (credential_id, version, status, secret_ciphertext, secret_iv,
            secret_auth_tag, encryption_key_version, endpoint, model, protocol,
            created_by_admin_id, created_at)
         VALUES (?, ?, 'candidate', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        credential.id,
        next.version,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        encrypted.keyVersion,
        input.endpoint,
        input.model,
        input.protocol,
        input.createdByAdminId ?? null,
        now,
      );
    const versionId = Number(inserted.lastInsertRowid);
    writeAudit(db, {
      actorType: input.createdByAdminId ? "admin" : "system",
      actorId: input.createdByAdminId,
      action: "candidate_created",
      targetType: "credential_version",
      targetId: versionId,
      metadata: {
        logicalKey: input.logicalKey,
        version: next.version,
        provider: input.provider,
      },
      now,
    });
    return {
      credentialId: credential.id,
      versionId,
      version: next.version,
      status: "candidate" as const,
    };
  })();
}

export function markVersionTestResult(
  db: Database.Database,
  versionId: number,
  passed: boolean,
  errorCategory: string | null,
  actorAdminId?: number,
  now = Date.now(),
): void {
  db.transaction(() => {
    const result = db
      .prepare(
        `UPDATE credential_versions
         SET test_status = ?, test_error_category = ?, tested_at = ?
         WHERE id = ? AND status IN ('candidate','retired')`,
      )
      .run(passed ? "passed" : "failed", passed ? null : errorCategory, now, versionId);
    if (result.changes !== 1) throw new Error("凭证版本不存在或不可测试");
    writeAudit(db, {
      actorType: actorAdminId ? "admin" : "system",
      actorId: actorAdminId,
      action: passed ? "candidate_test_passed" : "candidate_test_failed",
      targetType: "credential_version",
      targetId: versionId,
      metadata: passed ? {} : { errorCategory: errorCategory ?? "unknown" },
      now,
    });
  })();
}

export function activateVersion(
  db: Database.Database,
  credentialId: number,
  versionId: number,
  actorAdminId?: number,
  now = Date.now(),
): void {
  db.transaction(() => {
    const target = db
      .prepare(
        `SELECT id, credential_id, test_status, status
         FROM credential_versions WHERE id = ?`,
      )
      .get(versionId) as
      | { id: number; credential_id: number; test_status: string; status: string }
      | undefined;
    if (!target || target.credential_id !== credentialId) {
      throw new Error("凭证版本不属于该逻辑凭证");
    }
    if (target.test_status !== "passed") {
      throw new Error("候选版本尚未通过验证");
    }
    if (!new Set(["candidate", "retired"]).has(target.status)) {
      throw new Error("凭证版本不可启用");
    }

    db.prepare(
      `UPDATE credential_versions
       SET status = 'retired', retired_at = ?
       WHERE credential_id = ? AND status = 'active'`,
    ).run(now, credentialId);
    db.prepare(
      `UPDATE credential_versions
       SET status = 'active', activated_at = ?, retired_at = NULL
       WHERE id = ?`,
    ).run(now, versionId);
    writeAudit(db, {
      actorType: actorAdminId ? "admin" : "system",
      actorId: actorAdminId,
      action: "version_activated",
      targetType: "credential_version",
      targetId: versionId,
      metadata: { credentialId },
      now,
    });
  })();
}

export function rollbackCredential(
  db: Database.Database,
  credentialId: number,
  actorAdminId?: number,
  now = Date.now(),
): number {
  return db.transaction(() => {
    const current = db
      .prepare(
        "SELECT id FROM credential_versions WHERE credential_id = ? AND status = 'active'",
      )
      .get(credentialId) as { id: number } | undefined;
    const previous = db
      .prepare(
        `SELECT id FROM credential_versions
         WHERE credential_id = ? AND status = 'retired' AND test_status = 'passed'
         ORDER BY retired_at DESC, version DESC LIMIT 1`,
      )
      .get(credentialId) as { id: number } | undefined;
    if (!previous) throw new Error("没有可回滚的旧版本");
    activateVersion(db, credentialId, previous.id, actorAdminId, now);
    writeAudit(db, {
      actorType: actorAdminId ? "admin" : "system",
      actorId: actorAdminId,
      action: "credential_rollback",
      targetType: "credential",
      targetId: credentialId,
      metadata: {
        fromVersionId: current?.id ?? null,
        toVersionId: previous.id,
      },
      now,
    });
    return previous.id;
  })();
}

export function bindCredential(
  db: Database.Database,
  input: {
    projectId: string;
    capability: string;
    role: CredentialRole;
    credentialId: number;
  },
  now = Date.now(),
): number {
  return db.transaction(() => {
    const conflicting = db
      .prepare(
        `SELECT id FROM credential_bindings
         WHERE project_id = ? AND capability = ? AND role != ? AND credential_id = ?`,
      )
      .get(input.projectId, input.capability, input.role, input.credentialId);
    if (conflicting) {
      throw new Error("同一凭证不能同时充当真实主备");
    }

    db.prepare(
      `INSERT INTO credential_bindings
         (project_id, capability, role, credential_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_id, capability, role) DO UPDATE SET
         credential_id = excluded.credential_id,
         updated_at = excluded.updated_at`,
    ).run(
      input.projectId,
      input.capability,
      input.role,
      input.credentialId,
      now,
      now,
    );
    const row = db
      .prepare(
        `SELECT id FROM credential_bindings
         WHERE project_id = ? AND capability = ? AND role = ?`,
      )
      .get(input.projectId, input.capability, input.role) as { id: number };
    writeAudit(db, {
      actorType: "system",
      action: "binding_upserted",
      targetType: "credential_binding",
      targetId: row.id,
      metadata: {
        projectId: input.projectId,
        capability: input.capability,
        role: input.role,
        credentialId: input.credentialId,
      },
      now,
    });
    return row.id;
  })();
}

export function registerProjectToken(
  db: Database.Database,
  input: {
    projectId: string;
    token: string;
    scopes: ProjectTokenScope[];
  },
  now = Date.now(),
): number {
  return db.transaction(() => {
    const scopes = [...new Set(input.scopes)].sort();
    const result = db
      .prepare(
        `INSERT INTO project_tokens
           (project_id, token_hash, scopes_json, created_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        input.projectId,
        hashProjectToken(input.token),
        JSON.stringify(scopes),
        now,
      );
    const tokenId = Number(result.lastInsertRowid);
    writeAudit(db, {
      actorType: "system",
      action: "project_token_registered",
      targetType: "project_token",
      targetId: tokenId,
      metadata: { projectId: input.projectId, scopeCount: scopes.length },
      now,
    });
    return tokenId;
  })();
}

export function revokeProjectToken(
  db: Database.Database,
  tokenId: number,
  now = Date.now(),
): void {
  db.transaction(() => {
    const token = db
      .prepare("SELECT project_id FROM project_tokens WHERE id = ? AND revoked_at IS NULL")
      .get(tokenId) as { project_id: string } | undefined;
    if (!token) throw new Error("项目 token 不存在或已撤销");
    db.prepare("UPDATE project_tokens SET revoked_at = ? WHERE id = ?").run(now, tokenId);
    writeAudit(db, {
      actorType: "system",
      action: "project_token_revoked",
      targetType: "project_token",
      targetId: tokenId,
      metadata: { projectId: token.project_id },
      now,
    });
  })();
}

export function authenticateProjectToken(
  db: Database.Database,
  token: string,
  projectId: string,
  requiredScope: ProjectTokenScope,
): boolean {
  const identity = authenticateProjectTokenIdentity(db, token, requiredScope);
  return identity?.projectId === projectId;
}

export function authenticateProjectTokenIdentity(
  db: Database.Database,
  token: string,
  requiredScope: ProjectTokenScope,
): ProjectTokenIdentity | null {
  let tokenHash: string;
  try {
    tokenHash = hashProjectToken(token);
  } catch {
    return null;
  }
  const row = db
    .prepare(
      `SELECT id, project_id, scopes_json FROM project_tokens
       WHERE token_hash = ? AND revoked_at IS NULL`,
    )
    .get(tokenHash) as
    | { id: number; project_id: string; scopes_json: string }
    | undefined;
  if (!row) return null;
  try {
    const scopes = JSON.parse(row.scopes_json) as unknown;
    if (!Array.isArray(scopes) || !scopes.includes(requiredScope)) return null;
    return {
      tokenId: row.id,
      projectId: row.project_id,
      scopes: scopes.filter(
        (scope): scope is ProjectTokenScope =>
          scope === "credentials:resolve" || scope === "credentials:events",
      ),
    };
  } catch {
    return null;
  }
}

export function resolveProjectCredentials(
  db: Database.Database,
  projectId: string,
  masterKey: Buffer,
  now = Date.now(),
): ResolvedCredential[] {
  const rows = db
    .prepare(
      `SELECT b.id AS binding_id, b.capability AS binding_capability, b.role,
              c.id AS credential_id, c.logical_key, c.provider,
              c.capability AS credential_capability,
              v.version, v.secret_ciphertext, v.secret_iv, v.secret_auth_tag,
              v.encryption_key_version, v.endpoint, v.model, v.protocol,
              v.id, v.credential_id, v.status, v.test_status
       FROM credential_bindings b
       JOIN credentials c ON c.id = b.credential_id
       JOIN credential_versions v
         ON v.credential_id = c.id AND v.status = 'active'
       WHERE b.project_id = ?
       ORDER BY b.capability, b.role`,
    )
    .all(projectId) as Array<
    VersionRow & {
      binding_id: number;
      binding_capability: string;
      role: CredentialRole;
      credential_id: number;
      logical_key: string;
      provider: string;
      credential_capability: string;
      endpoint: string;
      model: string;
      protocol: string;
    }
  >;

  return rows.map((row) => ({
    bindingId: row.binding_id,
    credentialVersion: row.version,
    provider: row.provider,
    capability: row.binding_capability,
    role: row.role,
    protocol: row.protocol,
    endpoint: row.endpoint,
    model: row.model,
    apiKey: decryptSecret(
      encryptedFromRow(row),
      masterKey,
      credentialAad({
        credentialId: row.credential_id,
        version: row.version,
        logicalKey: row.logical_key,
        provider: row.provider,
        capability: row.credential_capability,
        endpoint: row.endpoint,
        model: row.model,
        protocol: row.protocol,
      }),
    ),
    resolvedAt: now,
  }));
}

export function getCredentialVersionForValidation(
  db: Database.Database,
  versionId: number,
  masterKey: Buffer,
): CredentialVersionForValidation {
  const row = db
    .prepare(
      `SELECT v.id, v.credential_id, v.version, v.status,
              v.secret_ciphertext, v.secret_iv, v.secret_auth_tag,
              v.encryption_key_version, v.endpoint, v.model, v.protocol,
              v.test_status, c.logical_key, c.provider, c.capability
       FROM credential_versions v
       JOIN credentials c ON c.id = v.credential_id
       WHERE v.id = ? AND v.status IN ('candidate','retired')`,
    )
    .get(versionId) as
    | (VersionRow & {
        logical_key: string;
        provider: string;
        capability: string;
        endpoint: string;
        model: string;
        protocol: string;
      })
    | undefined;
  if (!row) throw new Error("凭证版本不存在或不可测试");
  return {
    credentialId: row.credential_id,
    versionId: row.id,
    version: row.version,
    logicalKey: row.logical_key,
    provider: row.provider,
    capability: row.capability,
    status: row.status as "candidate" | "retired",
    endpoint: row.endpoint,
    model: row.model,
    protocol: row.protocol,
    apiKey: decryptSecret(
      encryptedFromRow(row),
      masterKey,
      credentialAad({
        credentialId: row.credential_id,
        version: row.version,
        logicalKey: row.logical_key,
        provider: row.provider,
        capability: row.capability,
        endpoint: row.endpoint,
        model: row.model,
        protocol: row.protocol,
      }),
    ),
  };
}

export function getCredentialIdByLogicalKey(
  db: Database.Database,
  logicalKey: string,
): number | null {
  const row = db
    .prepare("SELECT id FROM credentials WHERE logical_key = ?")
    .get(logicalKey) as { id: number } | undefined;
  return row?.id ?? null;
}

export function getCredentialIdForVersion(
  db: Database.Database,
  versionId: number,
): number | null {
  const row = db
    .prepare("SELECT credential_id FROM credential_versions WHERE id = ?")
    .get(versionId) as { credential_id: number } | undefined;
  return row?.credential_id ?? null;
}

export function listCredentialAdminViews(
  db: Database.Database,
): CredentialAdminView[] {
  const credentials = db
    .prepare(
      `SELECT id, logical_key, provider, capability
       FROM credentials ORDER BY id`,
    )
    .all() as Array<{
    id: number;
    logical_key: string;
    provider: string;
    capability: string;
  }>;
  const bindings = db
    .prepare(
      `SELECT id, credential_id, project_id, capability, role
       FROM credential_bindings ORDER BY id`,
    )
    .all() as Array<{
    id: number;
    credential_id: number;
    project_id: string;
    capability: string;
    role: CredentialRole;
  }>;
  const versions = db
    .prepare(
      `SELECT id, credential_id, version, status, test_status,
              test_error_category, endpoint, model, protocol,
              tested_at, activated_at
       FROM credential_versions ORDER BY credential_id, version DESC`,
    )
    .all() as Array<{
    id: number;
    credential_id: number;
    version: number;
    status: "candidate" | "active" | "retired" | "revoked";
    test_status: "untested" | "passed" | "failed";
    test_error_category: string | null;
    endpoint: string;
    model: string;
    protocol: string;
    tested_at: number | null;
    activated_at: number | null;
  }>;

  return credentials.map((credential) => ({
    id: credential.id,
    logicalKey: credential.logical_key,
    provider: credential.provider,
    capability: credential.capability,
    bindings: bindings
      .filter((binding) => binding.credential_id === credential.id)
      .map((binding) => ({
        id: binding.id,
        projectId: binding.project_id,
        capability: binding.capability,
        role: binding.role,
      })),
    versions: versions
      .filter((version) => version.credential_id === credential.id)
      .map((version) => ({
        id: version.id,
        version: version.version,
        status: version.status,
        testStatus: version.test_status,
        testErrorCategory: version.test_error_category,
        endpoint: version.endpoint,
        model: version.model,
        protocol: version.protocol,
        testedAt: version.tested_at,
        activatedAt: version.activated_at,
      })),
  }));
}

export function recordProjectCredentialEvent(
  db: Database.Database,
  input: ProjectCredentialEventInput,
  now = Date.now(),
): number {
  return db.transaction(() => {
    const binding = db
      .prepare(
        `SELECT b.id
         FROM credential_bindings b
         JOIN credential_versions v ON v.credential_id = b.credential_id
         WHERE b.id = ? AND b.project_id = ? AND v.version = ?`,
      )
      .get(input.bindingId, input.projectId, input.credentialVersion);
    if (!binding) throw new Error("事件绑定或凭证版本不属于该项目");

    const result = db
      .prepare(
        `INSERT INTO credential_project_events
           (project_id, binding_id, credential_version, status,
            latency_ms, error_category, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.projectId,
        input.bindingId,
        input.credentialVersion,
        input.status,
        input.latencyMs,
        input.errorCategory,
        now,
      );
    const eventId = Number(result.lastInsertRowid);
    writeAudit(db, {
      actorType: "project",
      actorId: input.projectId,
      action: "credential_use_reported",
      targetType: "credential_project_event",
      targetId: eventId,
      metadata: {
        bindingId: input.bindingId,
        credentialVersion: input.credentialVersion,
        status: input.status,
        latencyMs: input.latencyMs,
        errorCategory: input.errorCategory,
      },
      now,
    });
    return eventId;
  })();
}

export function listRecentProjectCredentialEvents(
  db: Database.Database,
  limit = 20,
): Array<{
  id: number;
  projectId: string;
  bindingId: number;
  credentialVersion: number;
  status: "success" | "error";
  latencyMs: number;
  errorCategory: string | null;
  createdAt: number;
}> {
  const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
  return db
    .prepare(
      `SELECT id, project_id AS projectId, binding_id AS bindingId,
              credential_version AS credentialVersion, status,
              latency_ms AS latencyMs, error_category AS errorCategory,
              created_at AS createdAt
       FROM credential_project_events
       ORDER BY created_at DESC, id DESC LIMIT ?`,
    )
    .all(safeLimit) as Array<{
    id: number;
    projectId: string;
    bindingId: number;
    credentialVersion: number;
    status: "success" | "error";
    latencyMs: number;
    errorCategory: string | null;
    createdAt: number;
  }>;
}

export function listCredentials(db: Database.Database): Array<Record<string, unknown>> {
  return db
    .prepare(
      `SELECT c.id, c.logical_key AS logicalKey, c.provider, c.capability,
              v.id AS versionId, v.version, v.status, v.test_status AS testStatus,
              v.test_error_category AS testErrorCategory, v.endpoint, v.model,
              v.protocol, v.tested_at AS testedAt, v.activated_at AS activatedAt
       FROM credentials c
       LEFT JOIN credential_versions v ON v.credential_id = c.id
       ORDER BY c.id, v.version DESC`,
    )
    .all() as Array<Record<string, unknown>>;
}
