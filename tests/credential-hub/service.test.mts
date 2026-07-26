import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { openCredentialDb } from "../../lib/credential-hub/db.ts";
import {
  activateVersion,
  authenticateProjectToken,
  bindCredential,
  createCandidate,
  generateProjectToken,
  listCredentials,
  markVersionTestResult,
  registerProjectToken,
  resolveProjectCredentials,
  revokeProjectToken,
  rollbackCredential,
} from "../../lib/credential-hub/service.ts";

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "credential-hub-g02-"));
  const dbPath = path.join(dir, "credentials.db");
  const db = openCredentialDb(dbPath);
  return {
    db,
    dbPath,
    key: randomBytes(32),
    close() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

const candidateBase = {
  logicalKey: "bananarouter.text.primary",
  provider: "bananarouter",
  capability: "resume_text",
  endpoint: "https://api.bananarouter.com",
  model: "gemini-3.1-flash-lite",
  protocol: "gemini-native",
  createdByAdminId: 1,
};

test("候选不影响当前版本，启用原子切换，回滚恢复旧版", () => {
  const f = fixture();
  try {
    const first = createCandidate(f.db, f.key, {
      ...candidateBase,
      secret: "pilot-secret-v1",
    }, 1000);
    bindCredential(f.db, {
      projectId: "A100",
      capability: "resume_text",
      role: "primary",
      credentialId: first.credentialId,
    }, 1001);
    assert.deepEqual(resolveProjectCredentials(f.db, "A100", f.key), []);
    assert.throws(
      () => activateVersion(f.db, first.credentialId, first.versionId),
      /尚未通过验证/,
    );

    markVersionTestResult(f.db, first.versionId, true, null, 1, 1002);
    activateVersion(f.db, first.credentialId, first.versionId, 1, 1003);
    assert.equal(
      resolveProjectCredentials(f.db, "A100", f.key, 1004)[0].apiKey,
      "pilot-secret-v1",
    );

    const second = createCandidate(f.db, f.key, {
      ...candidateBase,
      secret: "pilot-secret-v2",
    }, 1005);
    assert.equal(
      resolveProjectCredentials(f.db, "A100", f.key, 1006)[0].apiKey,
      "pilot-secret-v1",
    );
    markVersionTestResult(f.db, second.versionId, true, null, 1, 1007);
    activateVersion(f.db, second.credentialId, second.versionId, 1, 1008);
    assert.equal(
      resolveProjectCredentials(f.db, "A100", f.key, 1009)[0].apiKey,
      "pilot-secret-v2",
    );

    assert.equal(rollbackCredential(f.db, first.credentialId, 1, 1010), first.versionId);
    assert.equal(
      resolveProjectCredentials(f.db, "A100", f.key, 1011)[0].apiKey,
      "pilot-secret-v1",
    );
    const active = listCredentials(f.db).filter((row) => row.status === "active");
    assert.equal(active.length, 1);
    assert.equal(active[0].version, 1);
  } finally {
    f.close();
  }
});

test("失败候选不可启用，同一凭证不可伪装成真实主备", () => {
  const f = fixture();
  try {
    const candidate = createCandidate(f.db, f.key, {
      ...candidateBase,
      secret: "failed-secret",
    });
    markVersionTestResult(f.db, candidate.versionId, false, "unauthorized");
    assert.throws(
      () => activateVersion(f.db, candidate.credentialId, candidate.versionId),
      /尚未通过验证/,
    );
    bindCredential(f.db, {
      projectId: "A100",
      capability: "resume_text",
      role: "primary",
      credentialId: candidate.credentialId,
    });
    assert.throws(
      () =>
        bindCredential(f.db, {
          projectId: "A100",
          capability: "resume_text",
          role: "fallback",
          credentialId: candidate.credentialId,
        }),
      /不能同时充当真实主备/,
    );
  } finally {
    f.close();
  }
});

test("候选不能污染逻辑凭证元数据，调用配置被篡改后密文不可解", () => {
  const f = fixture();
  try {
    const candidate = createCandidate(f.db, f.key, {
      ...candidateBase,
      secret: "tamper-proof-secret",
    });
    assert.throws(
      () => createCandidate(f.db, f.key, {
        ...candidateBase,
        provider: "evil-provider",
        capability: "other",
        secret: "evil-secret",
      }),
      /不能修改逻辑凭证/,
    );
    bindCredential(f.db, {
      projectId: "A100",
      capability: "resume_text",
      role: "primary",
      credentialId: candidate.credentialId,
    });
    markVersionTestResult(f.db, candidate.versionId, true, null);
    activateVersion(f.db, candidate.credentialId, candidate.versionId);

    const versionFields = [
      ["endpoint", "https://evil.example"],
      ["model", "evil-model"],
      ["protocol", "evil-protocol"],
    ] as const;
    for (const [field, badValue] of versionFields) {
      const original = f.db
        .prepare(`SELECT ${field} AS value FROM credential_versions WHERE id = ?`)
        .get(candidate.versionId) as { value: string };
      f.db.prepare(`UPDATE credential_versions SET ${field} = ? WHERE id = ?`).run(
        badValue,
        candidate.versionId,
      );
      assert.throws(
        () => resolveProjectCredentials(f.db, "A100", f.key),
        /凭证解密失败/,
      );
      f.db.prepare(`UPDATE credential_versions SET ${field} = ? WHERE id = ?`).run(
        original.value,
        candidate.versionId,
      );
    }

    for (const [field, badValue] of [
      ["provider", "evil-provider"],
      ["capability", "evil-capability"],
    ] as const) {
      const original = f.db
        .prepare(`SELECT ${field} AS value FROM credentials WHERE id = ?`)
        .get(candidate.credentialId) as { value: string };
      f.db.prepare(`UPDATE credentials SET ${field} = ? WHERE id = ?`).run(
        badValue,
        candidate.credentialId,
      );
      assert.throws(
        () => resolveProjectCredentials(f.db, "A100", f.key),
        /凭证解密失败/,
      );
      f.db.prepare(`UPDATE credentials SET ${field} = ? WHERE id = ?`).run(
        original.value,
        candidate.credentialId,
      );
    }
  } finally {
    f.close();
  }
});

test("测试状态与审计同事务，审计失败时不留下通过状态", () => {
  const f = fixture();
  try {
    const candidate = createCandidate(f.db, f.key, {
      ...candidateBase,
      secret: "atomic-audit-secret",
    });
    f.db.exec(`
      CREATE TRIGGER reject_candidate_test_audit
      BEFORE INSERT ON credential_audit_events
      WHEN NEW.action LIKE 'candidate_test_%'
      BEGIN
        SELECT RAISE(ABORT, 'audit blocked');
      END;
    `);
    assert.throws(
      () => markVersionTestResult(f.db, candidate.versionId, true, null),
      /audit blocked/,
    );
    const row = f.db
      .prepare("SELECT test_status FROM credential_versions WHERE id = ?")
      .get(candidate.versionId) as { test_status: string };
    assert.equal(row.test_status, "untested");
  } finally {
    f.close();
  }
});

test("项目 token 按项目和 scope 隔离，撤销立即生效且数据库无明文", () => {
  const f = fixture();
  const token = generateProjectToken();
  try {
    assert.match(token, /^cph_[A-Za-z0-9_-]{43}$/);
    assert.throws(
      () => registerProjectToken(f.db, {
        projectId: "A100",
        token: "weak-token-weak-token-weak-token",
        scopes: ["credentials:resolve"],
      }),
      /格式无效/,
    );
    const tokenId = registerProjectToken(f.db, {
      projectId: "A100",
      token,
      scopes: ["credentials:resolve"],
    });
    assert.equal(
      authenticateProjectToken(f.db, token, "A100", "credentials:resolve"),
      true,
    );
    assert.equal(
      authenticateProjectToken(f.db, token, "A200", "credentials:resolve"),
      false,
    );
    assert.equal(
      authenticateProjectToken(f.db, token, "A100", "credentials:events"),
      false,
    );
    revokeProjectToken(f.db, tokenId);
    assert.equal(
      authenticateProjectToken(f.db, token, "A100", "credentials:resolve"),
      false,
    );

    f.db.pragma("wal_checkpoint(TRUNCATE)");
    const bytes = readFileSync(f.dbPath).toString("latin1");
    assert.equal(bytes.includes(token), false);
  } finally {
    f.close();
  }
});

test("密文库和审计记录不出现凭证明文", () => {
  const f = fixture();
  const secret = "never-store-this-plaintext-secret";
  try {
    const candidate = createCandidate(f.db, f.key, {
      ...candidateBase,
      secret,
    });
    markVersionTestResult(f.db, candidate.versionId, true, null, 1);
    f.db.pragma("wal_checkpoint(TRUNCATE)");
    const bytes = readFileSync(f.dbPath).toString("latin1");
    assert.equal(bytes.includes(secret), false);
    const audit = JSON.stringify(
      f.db.prepare("SELECT * FROM credential_audit_events").all(),
    );
    assert.equal(audit.includes(secret), false);
  } finally {
    f.close();
  }
});
