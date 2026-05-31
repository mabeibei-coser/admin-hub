/**
 * 课件用户白名单 — 共享业务层。
 *
 * 课件用户 = admin 在「服务管理 > 课件用户」加入的手机号；加入且 status=active 才能登录智能课件(A700)。
 * 表 owner：admin-hub 主库 courseware_users（CRUD 全本地，零跨库写）。
 * 「最后登录时间 / 使用次数」不在本表 —— 列表查询时跨 ATTACH 只读 teaching 库算出（见 API route）：
 *   last_login_at ← teaching.users.last_login_at（按 phone 关联）
 *   usage_count   ← COUNT(teaching.reports WHERE user_phone = courseware_users.phone)
 *
 * 权限：管理员只看 / 只能操作自己加的（added_by_admin_id），超管全看 —— 同 service-tracking 模式。
 */

import type { AdminSession } from "./admin-session";

// ---------- 枚举与 label ----------

export const CU_STATUSES = [
  { key: "active", label: "启用" },
  { key: "disabled", label: "停用" },
] as const;

export type CoursewareUserStatus = (typeof CU_STATUSES)[number]["key"];
export const CU_STATUS_KEYS = CU_STATUSES.map((s) => s.key);
const CU_STATUS_LABEL_MAP: Record<CoursewareUserStatus, string> = Object.fromEntries(
  CU_STATUSES.map((s) => [s.key, s.label])
) as Record<CoursewareUserStatus, string>;
export function cuStatusLabel(key: string): string {
  return CU_STATUS_LABEL_MAP[key as CoursewareUserStatus] ?? key;
}

// ---------- 行级权限 ----------

export interface CuAccessFilter {
  /** 不含 AND 前缀的 WHERE 片段，调用方用 conditions.push 拼接 */
  whereSql: string;
  params: number[];
}

/**
 * 列表 / 详情 GET 的行级过滤。
 * 超管：返回 `{ whereSql: "", params: [] }`，不附加任何 WHERE
 * 普通管理员：返回 `added_by_admin_id = ?`
 */
export function cuAccessFilter(session: AdminSession): CuAccessFilter {
  if (session.isSuper) return { whereSql: "", params: [] };
  return { whereSql: "added_by_admin_id = ?", params: [session.adminId!] };
}

// ---------- 行类型 ----------

export interface CoursewareUserRow {
  id: number;
  phone: string;
  name: string | null;
  added_by_admin_id: number;
  note: string | null;
  note2: string | null;
  status: CoursewareUserStatus;
  created_at: number;
  updated_at: number;
}
