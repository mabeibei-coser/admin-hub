/**
 * 服务跟踪模块共享业务层。
 *
 * 职责：
 *   - 枚举 + 中文 label
 *   - accessFilter / assertCanWrite：行级权限统一入口
 *   - touchLastServiceAt：service_records 增删改后同步主表
 *
 * 所有读路径强制走 accessFilter；所有写路径用「原子 WHERE」+ 兜底 assertCanWrite。
 */

import type Database from "better-sqlite3";
import type { AdminSession } from "./admin-session";

// ---------- 枚举与 label ----------

export const SERVICE_CATEGORIES = [
  { key: "easy", label: "易帮扶" },
  { key: "moderate", label: "较难帮扶" },
  { key: "hard", label: "难帮扶" },
  { key: "priority", label: "重点帮扶" },
  { key: "safety_net", label: "托底帮扶" },
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number]["key"];
export const SERVICE_CATEGORY_KEYS = SERVICE_CATEGORIES.map((c) => c.key);
const CATEGORY_LABEL_MAP: Record<ServiceCategory, string> = Object.fromEntries(
  SERVICE_CATEGORIES.map((c) => [c.key, c.label])
) as Record<ServiceCategory, string>;
export function categoryLabel(key: string): string {
  return CATEGORY_LABEL_MAP[key as ServiceCategory] ?? key;
}

export const SERVICE_STATUSES = [
  { key: "in_progress", label: "跟进中" },
  { key: "completed", label: "已完成" },
] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number]["key"];
export const SERVICE_STATUS_KEYS = SERVICE_STATUSES.map((s) => s.key);
const STATUS_LABEL_MAP: Record<ServiceStatus, string> = Object.fromEntries(
  SERVICE_STATUSES.map((s) => [s.key, s.label])
) as Record<ServiceStatus, string>;
export function statusLabel(key: string): string {
  return STATUS_LABEL_MAP[key as ServiceStatus] ?? key;
}

// 服务项目映射（来自 nav.reports / main.reports / startup.reports）
export const SERVICE_PROJECT_LABELS: Record<string, string> = {
  nav: "职业导航",
  report: "职业定位",
  startup: "创业诊断",
};

// 分类 / 状态徽章统一走 components/admin/status-pill.tsx (data-tone),
// 旧的 CATEGORY_BADGE_CLASS / STATUS_BADGE_CLASS 已删除。

// ---------- 行级权限 ----------

export interface AccessFilter {
  /** 不含 AND 前缀的 WHERE 片段，调用方用 conditions.push 拼接 */
  whereSql: string;
  params: number[];
}

/**
 * 列表 / 详情 GET 的行级过滤。
 * 超管：返回 `{ whereSql: "", params: [] }`，不附加任何 WHERE
 * 普通管理员：返回 `(staff1_admin_id = ? OR staff2_admin_id = ?)`
 *
 * 调用方拼接示例：
 *   const filter = accessFilter(session);
 *   const conditions: string[] = [];
 *   if (filter.whereSql) conditions.push(filter.whereSql);
 *   const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
 */
export function accessFilter(session: AdminSession): AccessFilter {
  if (session.isSuper) return { whereSql: "", params: [] };
  const id = session.adminId!;
  return {
    whereSql: "(staff1_admin_id = ? OR staff2_admin_id = ?)",
    params: [id, id],
  };
}

/**
 * 写操作的兜底权限检查（用于无法走「原子 WHERE」的场景，如先查再决定下一步）。
 * 主要写路径请直接用 atomic UPDATE/DELETE WHERE id = ? AND (staff1 = ? OR staff2 = ?)，
 * 然后看 `result.changes === 0` 判断 403，**不要**先 SELECT 再 UPDATE。
 */
export function canWrite(
  session: AdminSession,
  row: { staff1_admin_id: number; staff2_admin_id: number | null }
): boolean {
  if (session.isSuper) return true;
  const id = session.adminId;
  if (!id) return false;
  return row.staff1_admin_id === id || row.staff2_admin_id === id;
}

// ---------- 数据维护 ----------

/**
 * 重新计算指定 tracking 的 last_service_at。
 * service_records 任何写操作（INSERT / UPDATE / DELETE）后调用。
 * 必须放在 transaction 里使用（EC3）。
 */
export function touchLastServiceAt(
  db: Database.Database,
  trackingId: number
): void {
  const row = db
    .prepare(
      `SELECT MAX(service_at) AS max_at FROM service_records WHERE tracking_id = ?`
    )
    .get(trackingId) as { max_at: number | null } | undefined;
  const max = row?.max_at ?? null;
  db.prepare(
    `UPDATE service_tracking SET last_service_at = ?, updated_at = ? WHERE id = ?`
  ).run(max, Date.now(), trackingId);
}

// ---------- 显示工具 ----------

/** 138****1234 风格的手机号脱敏 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const s = phone.trim();
  if (s.length !== 11) return s;
  return `${s.slice(0, 3)}****${s.slice(-4)}`;
}

/**
 * 预警阈值（天）：状态为「跟进中」且 `last_service_at`（如为 null 则用 `first_service_at`）落在
 * 阈值天前即视为预警。改这一个常量即可调整全站预警敏感度。
 */
export const WARNING_THRESHOLD_DAYS = 14;

/** 服务时间相对显示（X 天前 / 今天 / N 小时前），用于列表 "最新服务记录" 列 */
export function formatRelative(ts: number | null | undefined): string {
  if (!ts) return "—";
  const now = Date.now();
  const diff = now - ts;
  const day = 86400_000;
  if (diff < 60_000) return "刚刚";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / 3600_000)} 小时前`;
  const days = Math.floor(diff / day);
  if (days < 30) return `${days} 天前`;
  return new Date(ts).toLocaleDateString("zh-CN");
}

// ---------- 行类型 ----------

export interface ServiceTrackingRow {
  id: number;
  source_project: "report" | "nav";
  source_report_id: number;
  user_name: string | null;
  user_phone: string | null;
  target_position: string | null;
  service_category: ServiceCategory;
  status: ServiceStatus;
  staff1_admin_id: number;
  staff2_admin_id: number | null;
  recorder_admin_id: number;
  overall_note: string | null;
  first_service_at: number;
  last_service_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface ServiceRecordRow {
  id: number;
  tracking_id: number;
  service_at: number;
  content: string | null;
  note: string | null;
  recorder_admin_id: number;
  attachments_json: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * 服务记录附件元数据（存于 service_records.attachments_json）。
 * 实际文件在磁盘上的位置由 `id` 派生：<DATA_DIR>/service-attachments/<id>/<filename>
 */
export interface ServiceRecordAttachment {
  /** UUID，与磁盘目录同名 */
  id: string;
  filename: string;
  mime: string;
  /** byte */
  size: number;
}

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
/** 允许上传的扩展名（小写带点），按 HR 业务常用文档类型白名单 */
export const ATTACHMENT_ALLOWED_EXT = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".txt",
  ".csv",
]);
