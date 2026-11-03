import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  isWrapperPubliclyAccessible,
  normalizeShortCode,
  validateFooterText,
  validateSourceUrl,
  validateWrapperSuffix,
  wrapperPublicPath,
  wrapperAccessFilter,
} from "../../lib/wrappers.ts";

test("域名访问后缀会统一为小写并严格限制字符", () => {
  assert.equal(normalizeShortCode("  Fire-AI  "), "fire-ai");
  assert.equal(wrapperPublicPath("  Fire-AI  "), "/?no=fire-ai");

  for (const code of ["abc", "8c2f3537", "fire-ai", "a".repeat(32)]) {
    assert.equal(validateWrapperSuffix(code).ok, true, code);
  }

  for (const code of ["", "ab", "-abc", "abc-", "ab/c", "ab!!!!c", "a".repeat(33)]) {
    assert.equal(validateWrapperSuffix(code).ok, false, code);
  }
});

test("底部说明限制为包装页能容纳的两行短文案", () => {
  assert.equal(validateFooterText("以上内容由 AI 生成，仅供参考").ok, true);
  assert.equal(validateFooterText("a".repeat(80)).ok, true);
  assert.equal(validateFooterText("a".repeat(81)).ok, false);
});

test("原始网址接受各平台 HTTPS 链接，保留安全校验", () => {
  for (const url of [
    "https://appcenter.bigmodel.cn/console/appcenter_v2/chat?share_code=test",
    "https://www.coze.cn/store/agent/example",
    "https://chat.example.com/chat/agent#conversation",
    "https://agent.example.com:8443/",
    "https://appcenter.bigmodel.cn/other",
  ]) {
    assert.equal(validateSourceUrl(url).ok, true, url);
    assert.equal(isWrapperPubliclyAccessible({ status: "active", source_url: url }), true);
    assert.equal(isWrapperPubliclyAccessible({ status: "disabled", source_url: url }), false);
  }
  for (const url of [
    "", "not-a-url", "http://example.com/agent", "javascript:alert(1)",
    "data:text/html,hello", "ftp://example.com/agent",
    "https://user:pass@example.com/agent", "https://user@example.com/agent",
  ]) {
    assert.equal(validateSourceUrl(url).ok, false, url);
    assert.equal(isWrapperPubliclyAccessible({ status: "active", source_url: url }), false);
  }
});

test("普通管理员所有者过滤可同时用于 SELECT 和 UPDATE", () => {
  assert.deepEqual(
    wrapperAccessFilter({ adminId: 7, isSuper: false }),
    { whereSql: "created_by_admin_id = ?", params: [7] },
  );
  assert.deepEqual(
    wrapperAccessFilter({ adminId: 1, isSuper: true }),
    { whereSql: "", params: [] },
  );
});

test("数据库约束拦截非法后缀，普通管理员 UPDATE 条件可执行", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "wrapper-db-test-"));
  const previousDbPath = process.env.DB_PATH;
  process.env.DB_PATH = path.join(dir, "admin-hub.db");

  try {
    const { getDb } = await import("../../lib/db.ts");
    const db = getDb();
    const now = Date.now();
    const insert = db.prepare(`
      INSERT INTO wrappers
        (short_code, name, note, source_url, footer_text, status, click_count,
         created_by_admin_id, created_at, updated_at)
      VALUES (?, 'QA', 'internal', ?, 'footer', 'active', 0, 7, ?, ?)
    `);
    const sourceUrl =
      "https://appcenter.bigmodel.cn/console/appcenter_v2/chat?share_code=test";

    const result = insert.run("valid-code", sourceUrl, now, now);
    assert.throws(
      () => insert.run("ab/c", sourceUrl, now, now),
      /invalid wrapper short_code/,
    );

    const filter = wrapperAccessFilter({ adminId: 7, isSuper: false });
    const updated = db
      .prepare(`UPDATE wrappers SET note = ? WHERE id = ? AND ${filter.whereSql}`)
      .run("updated", result.lastInsertRowid, ...filter.params);
    assert.equal(updated.changes, 1);

    const foreignFilter = wrapperAccessFilter({ adminId: 8, isSuper: false });
    const foreignUpdate = db
      .prepare(`UPDATE wrappers SET note = ? WHERE id = ? AND ${foreignFilter.whereSql}`)
      .run("should-not-change", result.lastInsertRowid, ...foreignFilter.params);
    const foreignDisable = db
      .prepare(`UPDATE wrappers SET status = 'disabled' WHERE id = ? AND ${foreignFilter.whereSql}`)
      .run(result.lastInsertRowid, ...foreignFilter.params);
    assert.equal(foreignUpdate.changes, 0);
    assert.equal(foreignDisable.changes, 0);

    insert.run("other-platform", "https://agent.example.com/agent", now, now);
    const legacyRow = db
      .prepare("SELECT status, source_url FROM wrappers WHERE short_code = ?")
      .get("other-platform") as { status: string; source_url: string };
    assert.equal(isWrapperPubliclyAccessible(legacyRow), true);
    db.close();
  } finally {
    if (previousDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previousDbPath;
    rmSync(dir, { recursive: true, force: true });
  }
});
