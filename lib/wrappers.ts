/**
 * 智能体包装 — 纯类型、枚举、工具函数（零 DB 依赖，可安全地被 client component 引用）。
 *
 * DB 相关函数（findXxx / increment / isShortCodeUsed）在 wrappers-db.ts 中。
 */

import type { AdminSession } from "./admin-session";

// ---------- 枚举与 label ----------

export const WRAPPER_STATUSES = [
  { key: "active", label: "启用" },
  { key: "disabled", label: "停用" },
] as const;

export type WrapperStatus = (typeof WRAPPER_STATUSES)[number]["key"];
export const WRAPPER_STATUS_KEYS = WRAPPER_STATUSES.map((s) => s.key);
const STATUS_LABEL_MAP: Record<WrapperStatus, string> = Object.fromEntries(
  WRAPPER_STATUSES.map((s) => [s.key, s.label])
) as Record<WrapperStatus, string>;
export function wrapperStatusLabel(key: string): string {
  return STATUS_LABEL_MAP[key as WrapperStatus] ?? key;
}

// ---------- 短码规范化 ----------

/** 统一短码为小写、去除首尾空白。所有写入前必调。 */
export function normalizeShortCode(code: string): string {
  return code.toLowerCase().trim();
}

// ---------- URL 校验 ----------

/** 校验 source_url 是否为合法的 HTTPS URL（精校，DB 层只做 GLOB 粗筛） */
export function validateSourceUrl(url: string): { ok: boolean; error?: string } {
  if (!url || !url.trim()) return { ok: false, error: "原始网址不能为空" };
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:") {
      return { ok: false, error: "原始网址必须以 https:// 开头" };
    }
    if (!parsed.hostname) {
      return { ok: false, error: "原始网址格式不正确" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "原始网址格式不正确" };
  }
}

// ---------- 行级权限 ----------

export interface WrapperAccessFilter {
  whereSql: string;
  params: number[];
}

/** 超管全看；普通管理员只看自己创建的（server-only，API route 用） */
export function wrapperAccessFilter(session: AdminSession): WrapperAccessFilter {
  if (session.isSuper) return { whereSql: "", params: [] };
  return { whereSql: "w.created_by_admin_id = ?", params: [session.adminId!] };
}

// ---------- 行类型 ----------

export interface WrapperRow {
  id: number;
  short_code: string;
  name: string;
  note: string;
  source_url: string;
  footer_text: string;
  status: WrapperStatus;
  click_count: number;
  created_by_admin_id: number;
  created_at: number;
  updated_at: number;
}

export interface WrapperListRow extends WrapperRow {
  created_by_name: string | null;
}
