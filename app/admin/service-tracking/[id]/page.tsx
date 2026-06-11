import { notFound } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { getAdminDb, isNavDbReady } from "@/lib/db";
import { requireMenu } from "@/lib/admin-session";
import {
  accessFilter,
  maskPhone,
  type ServiceCategory,
  type ServiceStatus,
  type ServiceRecordAttachment,
} from "@/lib/service-tracking";
import { ServiceTrackingEditor } from "@/components/admin/service-tracking-editor";
import {
  ServiceRecordsList,
  type ServiceRecordItem,
  type NavRecordItem,
} from "@/components/admin/service-records-list";
import { PageHeader } from "@/components/admin/page-header";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { DeleteTrackingButton } from "@/components/admin/delete-tracking-button";

interface DetailRow {
  id: number;
  source_project: "report" | "nav" | "startup";
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
  attachments_json: string | null;
  created_at: number;
  updated_at: number;
}

interface NavReportRow {
  id: number;
  created_at: number;
  target_position: string | null;
  user_name: string | null;
  user_phone: string | null;
  employment_index: number | null;
}

function parseAttachments(s: string | null): ServiceRecordAttachment[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as ServiceRecordAttachment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
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

  const db = getAdminDb();
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

  // 归集：相同 user_phone + user_name 的职业导航报告，按时间穿插进服务记录列表
  // 跨库只读 nav.reports；TRIM 双侧空白；任一为空则不归集（避免 NULL+NULL 误匹配）
  let navRecords: NavReportRow[] = [];
  if (
    isNavDbReady() &&
    row.user_phone &&
    row.user_phone.trim() &&
    row.user_name &&
    row.user_name.trim()
  ) {
    navRecords = db
      .prepare(
        `SELECT n.id,
                n.created_at,
                n.target_position,
                json_extract(n.form_data_json, '$.name')  AS user_name,
                json_extract(n.form_data_json, '$.phone') AS user_phone,
                json_extract(n.report_json,    '$.employmentIndex') AS employment_index
         FROM nav.reports n
         WHERE TRIM(json_extract(n.form_data_json, '$.phone')) = TRIM(?)
           AND TRIM(json_extract(n.form_data_json, '$.name'))  = TRIM(?)
         ORDER BY n.created_at DESC`
      )
      .all(row.user_phone, row.user_name) as NavReportRow[];
  }

  const serviceItems: ServiceRecordItem[] = records.map((r) => ({
    kind: "service",
    id: r.id,
    service_at: r.service_at,
    content: r.content,
    note: r.note,
    recorder_admin_id: r.recorder_admin_id,
    recorder_name: r.recorder_name,
    attachments: parseAttachments(r.attachments_json),
  }));
  const navItems: NavRecordItem[] = navRecords.map((n) => ({
    kind: "nav",
    id: n.id,
    service_at: n.created_at,
    user_name: n.user_name,
    target_position: n.target_position,
    employment_index:
      typeof n.employment_index === "number" ? n.employment_index : null,
  }));
  const mergedItems = [...serviceItems, ...navItems].sort(
    (a, b) => b.service_at - a.service_at,
  );

  return (
    <div className="p-6 bg-background print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="print:hidden">
          <Breadcrumb
            items={[
              { label: "服务跟踪", href: "/admin/service-tracking" },
              {
                label: row.user_name || "—",
                trailing: maskPhone(row.user_phone),
              },
            ]}
          />
        </div>

        <div className="print:hidden">
          <PageHeader
            icon={LifeBuoy}
            eyebrow="服务跟踪记录"
            title={row.user_name || "—"}
            subtitle={
              <span className="tabular-nums">
                {row.target_position ?? "—"}
                {" · "}
                首次服务{" "}
                {new Date(row.first_service_at).toLocaleDateString("zh-CN")}
              </span>
            }
            accentColor="blue"
            actions={
              session.isSuper ? (
                <DeleteTrackingButton trackingId={row.id} userName={row.user_name} />
              ) : undefined
            }
          />
        </div>

        <ServiceTrackingEditor
          trackingId={row.id}
          adminId={session.adminId!}
          initial={{
            user_name: row.user_name,
            user_phone: row.user_phone,
            service_category: row.service_category,
            status: row.status,
            first_service_at: row.first_service_at,
            staff1_admin_id: row.staff1_admin_id,
            staff2_admin_id: row.staff2_admin_id,
            staff1_name: row.staff1_name,
            staff2_name: row.staff2_name,
          }}
        />

        <ServiceRecordsList
          trackingId={row.id}
          adminId={session.adminId!}
          initial={mergedItems}
          serviceCount={serviceItems.length}
        />
      </div>
    </div>
  );
}
