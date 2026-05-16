import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/lib/db";
import { requireMenu } from "@/lib/admin-session";
import {
  accessFilter,
  maskPhone,
  type ServiceCategory,
  type ServiceStatus,
} from "@/lib/service-tracking";
import { ServiceTrackingEditor } from "@/components/admin/service-tracking-editor";
import { ServiceRecordsList } from "@/components/admin/service-records-list";

interface DetailRow {
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
  recorder_name: string | null;
  staff1_name: string | null;
  staff2_name: string | null;
}

interface RecordRow {
  id: number;
  tracking_id: number;
  service_at: number;
  content: string | null;
  note: string | null;
  recorder_admin_id: number;
  recorder_name: string | null;
  created_at: number;
  updated_at: number;
}

export default async function ServiceTrackingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireMenu("service");
  if (!session) {
    // 未登录或无权限：直接 404 隐藏存在性
    notFound();
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const db = getDb();
  const filter = accessFilter(session);

  const conditions: string[] = ["st.id = ?"];
  const sqlParams: Array<string | number> = [id];
  if (filter.whereSql) {
    conditions.push(filter.whereSql);
    sqlParams.push(...filter.params);
  }

  const row = db
    .prepare(
      `SELECT
         st.*,
         a_rec.name AS recorder_name,
         a_s1.name  AS staff1_name,
         a_s2.name  AS staff2_name
       FROM service_tracking st
       LEFT JOIN admins a_rec ON a_rec.id = st.recorder_admin_id
       LEFT JOIN admins a_s1  ON a_s1.id  = st.staff1_admin_id
       LEFT JOIN admins a_s2  ON a_s2.id  = st.staff2_admin_id
       WHERE ${conditions.join(" AND ")}`
    )
    .get(...sqlParams) as DetailRow | undefined;

  if (!row) notFound();

  const records = db
    .prepare(
      `SELECT sr.*, a.name AS recorder_name
       FROM service_records sr
       LEFT JOIN admins a ON a.id = sr.recorder_admin_id
       WHERE sr.tracking_id = ?
       ORDER BY sr.service_at DESC`
    )
    .all(id) as RecordRow[];

  return (
    <div className="p-6 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* 面包屑 */}
        <div className="flex items-center gap-2 print:hidden flex-wrap">
          <Link
            href="/admin/service-tracking"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ChevronLeft className="size-4" />
            服务跟踪
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-700">
            {row.user_name || "—"}
          </span>
          <span className="text-xs text-gray-400 tabular-nums ml-1">
            {maskPhone(row.user_phone)}
          </span>
        </div>

        <ServiceTrackingEditor
          trackingId={row.id}
          adminId={session.adminId!}
          initial={{
            source_project: row.source_project,
            target_position: row.target_position,
            service_category: row.service_category,
            status: row.status,
            overall_note: row.overall_note,
            first_service_at: row.first_service_at,
            staff1_admin_id: row.staff1_admin_id,
            staff2_admin_id: row.staff2_admin_id,
            staff1_name: row.staff1_name,
            staff2_name: row.staff2_name,
            recorder_name: row.recorder_name,
          }}
        />

        <ServiceRecordsList
          trackingId={row.id}
          adminId={session.adminId!}
          initial={records.map((r) => ({
            id: r.id,
            service_at: r.service_at,
            content: r.content,
            note: r.note,
            recorder_admin_id: r.recorder_admin_id,
            recorder_name: r.recorder_name,
          }))}
        />
      </div>
    </div>
  );
}
