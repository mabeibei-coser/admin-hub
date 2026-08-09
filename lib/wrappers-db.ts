/**
 * 智能体包装 — DB 相关函数（server-only）。
 *
 * 这些函数会 import better-sqlite3 → 不可被 client component 引用。
 */

import { getDb } from "./db";
import {
  isWrapperPubliclyAccessible,
  normalizeShortCode,
  type WrapperRow,
} from "./wrappers";

// ---------- 查询 ----------

/** 按 short_code 查找（不分 status，返回原始数据用于停用判断） */
export function findWrapperByShortCode(code: string): WrapperRow | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM wrappers WHERE short_code = ?")
    .get(normalizeShortCode(code)) as WrapperRow | undefined;
}

/** 按 short_code 查找可公开展示的记录；旧数据或直接写库的非白名单网址一律拒绝 */
export function findActiveWrapperByShortCode(code: string): WrapperRow | undefined {
  const row = findWrapperByShortCode(code);
  if (!row) return undefined;
  return isWrapperPubliclyAccessible(row) ? row : undefined;
}

// ---------- 查重 ----------

/** 检查 short_code 是否已被占用 */
export function isShortCodeUsed(code: string): boolean {
  const db = getDb();
  const normalized = normalizeShortCode(code);
  const row = db
    .prepare("SELECT id FROM wrappers WHERE short_code = ?")
    .get(normalized);
  return !!row;
}
