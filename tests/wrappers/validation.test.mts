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

test("原始网址只接受智谱 AppCenter 智能体分享链接", () => {
  assert.equal(
    validateSourceUrl(
      "https://appcenter.bigmodel.cn/console/appcenter_v2/chat?share_code=6KXIIP71l6aH2rTMa5hVJ",
    ).ok,
    true,
  );

  for (const url of [
    "http://appcenter.bigmodel.cn/console/appcenter_v2/chat?share_code=x",
    "https://evil.example/console/appcenter_v2/chat?share_code=x",
    "https://appcenter.bigmodel.cn:444/console/appcenter_v2/chat?share_code=x",
    "https://appcenter.bigmodel.cn/other?share_code=x",
    "https://appcenter.bigmodel.cn/console/appcenter_v2/chat",
    "https://user:pass@appcenter.bigmodel.cn/console/appcenter_v2/chat?share_code=x",
  ]) {
    assert.equal(validateSourceUrl(url).ok, false, url);
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

    insert.run("legacy-evil", "https://evil.example/agent", now, now);
    const legacyRow = db
      .prepare("SELECT status, source_url FROM wrappers WHERE short_code = ?")
      .get("legacy-evil") as { status: string; source_url: string };
    assert.equal(isWrapperPubliclyAccessible(legacyRow), false);
    db.close();
  } finally {
    if (previousDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previousDbPath;
    rmSync(dir, { recursive: true, force: true });
  }
});
