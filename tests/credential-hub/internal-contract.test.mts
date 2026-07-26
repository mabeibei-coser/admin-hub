import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { openCredentialDb } from "../../lib/credential-hub/db.ts";
import {
  parseProjectCredentialEvent,
  readBearerToken,
} from "../../lib/credential-hub/internal-contract.ts";
import { A100_PILOT } from "../../lib/credential-hub/pilot.ts";
import {
  activateVersion,
  authenticateProjectToken,
  authenticateProjectTokenIdentity,
  bindCredential,
  createCandidate,
  generateProjectToken,
  listRecentProjectCredentialEvents,
  markVersionTestResult,
  recordProjectCredentialEvent,
  registerProjectToken,
  resolveProjectCredentials,
  revokeProjectToken,
} from "../../lib/credential-hub/service.ts";

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "credential-hub-g04-"));
  const db = openCredentialDb(path.join(dir, "credentials.db"));
  const key = randomBytes(32);
  const candidate = createCandidate(db, key, {
    ...A100_PILOT,
    secret: "g04-resolve-only-test-value",
  });
  const bindingId = bindCredential(db, {
    projectId: A100_PILOT.projectId,
    capability: A100_PILOT.capability,
    role: A100_PILOT.role,
    credentialId: candidate.credentialId,
  });
  markVersionTestResult(db, candidate.versionId, true, null);
  activateVersion(db, candidate.credentialId, candidate.versionId);
  return {
    db,
    key,
    candidate,
    bindingId,
    close() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

test("Bearer token 只从标准请求头读取", () => {
  const token = generateProjectToken();
  assert.equal(readBearerToken(`Bearer ${token}`), token);
  assert.equal(readBearerToken(token), null);
  assert.equal(readBearerToken(`bearer ${token}`), null);
  assert.equal(readBearerToken(`Bearer ${token} extra`), null);
  assert.equal(readBearerToken(null), null);
});

test("项目 token 身份、scope、项目隔离和撤销立即生效", () => {
  const f = fixture();
  const a100 = generateProjectToken();
  const a200 = generateProjectToken();
  try {
    const a100Id = registerProjectToken(f.db, {
      projectId: "A100",
      token: a100,
      scopes: ["credentials:resolve", "credentials:events"],
    });
    registerProjectToken(f.db, {
      projectId: "A200",
      token: a200,
      scopes: ["credentials:resolve"],
    });
    assert.deepEqual(
      authenticateProjectTokenIdentity(f.db, a100, "credentials:events")?.projectId,
      "A100",
    );
    assert.equal(authenticateProjectToken(f.db, a100, "A100", "credentials:resolve"), true);
    assert.equal(authenticateProjectToken(f.db, a100, "A200", "credentials:resolve"), false);
    assert.equal(authenticateProjectToken(f.db, a200, "A100", "credentials:resolve"), false);
    assert.equal(authenticateProjectTokenIdentity(f.db, a200, "credentials:events"), null);
    assert.equal(resolveProjectCredentials(f.db, "A100", f.key).length, 1);
    revokeProjectToken(f.db, a100Id);
    assert.equal(authenticateProjectTokenIdentity(f.db, a100, "credentials:resolve"), null);
  } finally {
    f.close();
  }
});

test("事件合同只接受版本、状态、耗时和错误类别等固定字段", () => {
  const raw = {
    bindingId: 1,
    credentialVersion: 2,
    status: "success",
    latencyMs: 321,
    errorCategory: null,
  };
  const valid = parseProjectCredentialEvent(raw, "A100");
  assert.deepEqual(valid, {
    projectId: "A100",
    bindingId: 1,
    credentialVersion: 2,
    status: "success",
    latencyMs: 321,
    errorCategory: null,
  });

  for (const forbidden of [
    "prompt",
    "userContent",
    "image",
    "audio",
    "apiKey",
    "credential",
    "authorization",
    "projectId",
  ]) {
    assert.throws(
      () => parseProjectCredentialEvent({ ...raw, [forbidden]: "forbidden" }, "A100"),
      /未允许/,
    );
  }
  assert.throws(
    () => parseProjectCredentialEvent({ ...raw, status: "error", errorCategory: null }, "A100"),
    /错误类别/,
  );
  assert.throws(
    () => parseProjectCredentialEvent({ ...raw, latencyMs: 300_001 }, "A100"),
    /latencyMs/,
  );
});

test("事件只能引用 token 项目的真实绑定和版本，后台列表保持脱敏", () => {
  const f = fixture();
  try {
    const eventId = recordProjectCredentialEvent(
      f.db,
      {
        projectId: "A100",
        bindingId: f.bindingId,
        credentialVersion: f.candidate.version,
        status: "success",
        latencyMs: 456,
        errorCategory: null,
      },
      2000,
    );
    assert.ok(eventId > 0);
    assert.throws(
      () => recordProjectCredentialEvent(f.db, {
        projectId: "A200",
        bindingId: f.bindingId,
        credentialVersion: f.candidate.version,
        status: "error",
        latencyMs: 10,
        errorCategory: "provider_error",
      }),
      /不属于该项目/,
    );
    const events = listRecentProjectCredentialEvents(f.db);
    assert.deepEqual(events, [
      {
        id: eventId,
        projectId: "A100",
        bindingId: f.bindingId,
        credentialVersion: f.candidate.version,
        status: "success",
        latencyMs: 456,
        errorCategory: null,
        createdAt: 2000,
      },
    ]);
    const serialized = JSON.stringify({
      events,
      audit: f.db.prepare("SELECT metadata_json FROM credential_audit_events").all(),
    });
    for (const forbidden of [
      "g04-resolve-only-test-value",
      "apiKey",
      "prompt",
      "userContent",
      "image",
      "audio",
      "authorization",
    ]) {
      assert.equal(serialized.includes(forbidden), false);
    }
  } finally {
    f.close();
  }
});
