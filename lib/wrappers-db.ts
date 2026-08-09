/**
 * 智能体包装 — DB 相关函数（server-only）。
 *
 * 这些函数会 import better-sqlite3 → 不可被 client component 引用。
 */

import { getDb } from "./db";
import { normalizeShortCode, type WrapperRow } from "./wrappers";

// ---------- 查询 ----------

/** 按 short_code 查找（不分 status，返回原始数据用于 410 判断） */
export function findWrapperByShortCode(code: string): WrapperRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM wrappers WHERE short_code = ?")
    .get(normalizeShortCode(code)) as WrapperRow | undefined;
}

/** 按 short_code 查找 active 状态的（公开页用） */
export function findActiveWrapperByShortCode(code: string): WrapperRow | undefined {
  const row = findWrapperByShortCode(code);
  if (!row) return undefined;
  return row.status === "active" ? row : undefined;
}

// ---------- 计数 ----------

/** 点击计数 +1（公开页 after() 中调用） */
export function incrementClickCount(id: number): void {
  getDb()
    .prepare("UPDATE wrappers SET click_count = click_count + 1 WHERE id = ?")
    .run(id);
}

// ---------- 查重 ----------

/** 检查 short_code 是否已被占用（编辑时可排除自身 id） */
export function isShortCodeUsed(code: string, excludeId?: number): boolean {
  const db = getDb();
  const normalized = normalizeShortCode(code);
  if (excludeId !== undefined) {
    const row = db
      .prepare("SELECT id FROM wrappers WHERE short_code = ? AND id != ?")
      .get(normalized, excludeId);
    return !!row;
  }
  const row = db
    .prepare("SELECT id FROM wrappers WHERE short_code = ?")
    .get(normalized);
  return !!row;
}
