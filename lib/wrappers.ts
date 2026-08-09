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

/** 对外分享地址由 nginx 在根域内部映射到 /b100/w/:code，浏览器地址保持不变。 */
export function wrapperPublicPath(code: string): string {
  return `/?no=${encodeURIComponent(normalizeShortCode(code))}`;
}

export const WRAPPER_SUFFIX_PATTERN = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
export const WRAPPER_FOOTER_MAX_LENGTH = 80;

export function validateWrapperSuffix(code: string): { ok: boolean; error?: string } {
  const normalized = normalizeShortCode(code);
  if (!normalized) return { ok: false, error: "请填写域名访问后缀" };
  if (normalized.length < 3 || normalized.length > 32) {
    return { ok: false, error: "域名访问后缀需为 3-32 个字符" };
  }
  if (!WRAPPER_SUFFIX_PATTERN.test(normalized)) {
    return {
      ok: false,
      error: "域名访问后缀只能包含小写字母、数字和短横线，首尾不能是短横线",
    };
  }
  return { ok: true };
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
    if (parsed.username || parsed.password) {
      return { ok: false, error: "原始网址不能包含账号或密码" };
    }
    if (
      parsed.origin !== "https://appcenter.bigmodel.cn" ||
      parsed.pathname !== "/console/appcenter_v2/chat" ||
      !parsed.searchParams.get("share_code")?.trim()
    ) {
      return {
        ok: false,
        error: "当前仅支持智谱 AppCenter 的智能体分享链接",
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "原始网址格式不正确" };
  }
}

export function validateFooterText(text: string): { ok: boolean; error?: string } {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > WRAPPER_FOOTER_MAX_LENGTH) {
    return {
      ok: false,
      error: `底部说明需为 1-${WRAPPER_FOOTER_MAX_LENGTH} 字`,
    };
  }
  return { ok: true };
}

/** 公开页的最后一道 fail-closed 检查，兼容上线前已经写入的旧数据。 */
export function isWrapperPubliclyAccessible(wrapper: {
  status: string;
  source_url: string;
}): boolean {
  return wrapper.status === "active" && validateSourceUrl(wrapper.source_url).ok;
}

// ---------- 行级权限 ----------

export interface WrapperAccessFilter {
  whereSql: string;
  params: number[];
}

/** 超管全看；普通管理员只看自己创建的（server-only，API route 用） */
export function wrapperAccessFilter(session: AdminSession): WrapperAccessFilter {
  if (session.isSuper) return { whereSql: "", params: [] };
  return { whereSql: "created_by_admin_id = ?", params: [session.adminId!] };
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
