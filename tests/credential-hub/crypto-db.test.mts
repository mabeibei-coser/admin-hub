import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  decryptSecret,
  encryptSecret,
  parseMasterKey,
} from "../../lib/credential-hub/crypto.ts";
import {
  initializeCredentialSchema,
  openCredentialDb,
} from "../../lib/credential-hub/db.ts";

test("AES-256-GCM 往返、随机 IV、错误总钥匙和篡改检测", () => {
  const key = randomBytes(32);
  const plaintext = "pilot-secret-value";
  const first = encryptSecret(plaintext, key, "credential:1:1");
  const second = encryptSecret(plaintext, key, "credential:1:1");

  assert.equal(decryptSecret(first, key, "credential:1:1"), plaintext);
  assert.notEqual(first.iv, second.iv);
  assert.notEqual(first.ciphertext, second.ciphertext);
  assert.throws(
    () => decryptSecret(first, randomBytes(32), "credential:1:1"),
    /凭证解密失败/,
  );
  assert.throws(
    () =>
      decryptSecret(
        { ...first, ciphertext: `${first.ciphertext.slice(0, -2)}AA` },
        key,
        "credential:1:1",
      ),
    /凭证解密失败/,
  );
});

test("总钥匙只接受 32 字节 base64 或 64 位 hex", () => {
  const key = randomBytes(32);
  assert.deepEqual(parseMasterKey(key.toString("base64")), key);
  assert.deepEqual(parseMasterKey(key.toString("hex")), key);
  assert.throws(() => parseMasterKey("too-short"), /必须是 32 字节/);
  assert.throws(() => parseMasterKey(undefined), /未配置/);
});

test("credentials.db schema 可重复初始化且使用 WAL", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "credential-hub-g01-"));
  const dbPath = path.join(dir, "credentials.db");
  const db = openCredentialDb(dbPath);
  try {
    initializeCredentialSchema(db);
    const tables = new Set(
      (
        db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as Array<{ name: string }>
      ).map((row) => row.name),
    );
    for (const table of [
      "credentials",
      "credential_versions",
      "credential_bindings",
      "project_tokens",
      "credential_audit_events",
      "credential_project_events",
    ]) {
      assert.ok(tables.has(table), `missing table: ${table}`);
    }
    assert.equal(db.pragma("journal_mode", { simple: true }), "wal");
    assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

