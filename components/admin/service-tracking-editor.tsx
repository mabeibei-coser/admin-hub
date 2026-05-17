"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, AlertTriangle, UserCog, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  categoryLabel,
  statusLabel,
  CATEGORY_BADGE_CLASS,
  STATUS_BADGE_CLASS,
  SERVICE_PROJECT_LABELS,
  type ServiceCategory,
  type ServiceStatus,
} from "@/lib/service-tracking";
import { withBase } from "@/lib/url";

interface PickerAdmin {
  id: number;
  name: string;
}

export interface TrackingEditorInitial {
  source_project: "report" | "nav";
  target_position: string | null;
  service_category: ServiceCategory;
  status: ServiceStatus;
  overall_note: string | null;
  first_service_at: number;
  staff1_admin_id: number;
  staff2_admin_id: number | null;
  staff1_name: string | null;
  staff2_name: string | null;
  recorder_name: string | null;
}

interface Props {
  trackingId: number;
  adminId: number;
  initial: TrackingEditorInitial;
}

function formatTs(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ServiceTrackingEditor({ trackingId, adminId, initial }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 编辑状态字段
  const [category, setCategory] = useState<ServiceCategory>(initial.service_category);
  const [status, setStatus] = useState<ServiceStatus>(initial.status);
  const [overallNote, setOverallNote] = useState(initial.overall_note ?? "");
  const [staff1Id, setStaff1Id] = useState<number>(initial.staff1_admin_id);
  const [staff2Id, setStaff2Id] = useState<number | null>(initial.staff2_admin_id);
  const [admins, setAdmins] = useState<PickerAdmin[] | null>(null);
  const [adminsError, setAdminsError] = useState(false);

  // 转交确认弹窗
  const [confirmHandoff, setConfirmHandoff] = useState<null | {
    nextStaff1: number;
    nextStaff2: number | null;
  }>(null);

  // 进入编辑模式时拉 admins
  useEffect(() => {
    if (!editing) return;
    setAdmins(null);
    setAdminsError(false);
    fetch(withBase("/api/admin/admins/picker"))
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { admins: PickerAdmin[] }) => setAdmins(d.admins))
      .catch(() => setAdminsError(true));
  }, [editing]);

  function cancel() {
    setEditing(false);
    setError(null);
    setCategory(initial.service_category);
    setStatus(initial.status);
    setOverallNote(initial.overall_note ?? "");
    setStaff1Id(initial.staff1_admin_id);
    setStaff2Id(initial.staff2_admin_id);
  }

  async function performSave(opts?: { skipHandoffWarn?: boolean }) {
    setError(null);

    // 应用层 staff1 ≠ staff2 校验
    if (staff2Id !== null && staff2Id === staff1Id) {
      setError("两位服务人员不能是同一人");
      return;
    }

    const staffChanged =
      staff1Id !== initial.staff1_admin_id ||
      staff2Id !== initial.staff2_admin_id;
    const losingAccess =
      staffChanged && staff1Id !== adminId && staff2Id !== adminId;

    if (losingAccess && !opts?.skipHandoffWarn) {
      setConfirmHandoff({ nextStaff1: staff1Id, nextStaff2: staff2Id });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(withBase(`/api/admin/service-tracking/${trackingId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_category: category,
          status,
          overall_note: overallNote || null,
          staff1_admin_id: staff1Id,
          staff2_admin_id: staff2Id,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "保存失败");
        setSubmitting(false);
        return;
      }
      if (losingAccess) {
        // 失去访问权 → 显式跳转列表 + toast（EH7）
        router.push("/admin/service-tracking");
        router.refresh();
      } else {
        setEditing(false);
        setToast("已保存");
        setSubmitting(false);
        router.refresh();
        setTimeout(() => setToast(null), 2000);
      }
    } catch {
      setError("网络错误，请重试");
      setSubmitting(false);
    }
  }

  function staffName(id: number | null, fallback: string | null): string {
    if (id === null) return "—";
    if (admins) {
      return admins.find((a) => a.id === id)?.name ?? fallback ?? "—";
    }
    return fallback ?? "—";
  }

  return (
    <div className="bg-white rounded-xl ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 p-5 relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-3 right-3 px-3 py-1.5 bg-gray-900/90 text-white text-xs rounded-md shadow-lg animate-in fade-in slide-in-from-top-1 duration-200">
          {toast}
        </div>
      )}

      {/* 标题行 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">服务详情</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 hover:ring-gray-300 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <Pencil className="size-3" />
            编辑
          </button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={cancel}
              disabled={submitting}
              className="h-7 text-xs px-2.5"
            >
              取消
            </Button>
            <Button
              size="sm"
              onClick={() => performSave()}
              disabled={submitting}
              className="h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-3 mr-1 animate-spin" />
                  保存中…
                </>
              ) : (
                "保存"
              )}
            </Button>
          </div>
        )}
      </div>

      <div>
        <Row label="服务项目">
          {SERVICE_PROJECT_LABELS[initial.source_project] ?? initial.source_project}
        </Row>
        <Row label="意向岗位">{initial.target_position || "—"}</Row>
        <Row label="服务分类">
          {editing ? (
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map((c) => (
                <label
                  key={c.key}
                  className={`px-3 py-1 rounded-md text-xs cursor-pointer transition-all duration-150 border ${
                    category === c.key
                      ? "ring-2 ring-blue-500 bg-blue-50 text-blue-800 border-transparent"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="radio"
                    name="service_category"
                    value={c.key}
                    checked={category === c.key}
                    onChange={() => setCategory(c.key)}
                    className="sr-only"
                  />
                  {c.label}
                </label>
              ))}
            </div>
          ) : (
            <span
              className={`inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded border ${CATEGORY_BADGE_CLASS[initial.service_category]}`}
            >
              {categoryLabel(initial.service_category)}
            </span>
          )}
        </Row>
        <Row label="首次服务时间">
          <span className="tabular-nums">{formatTs(initial.first_service_at)}</span>
        </Row>
        <Row label="服务状态">
          {editing ? (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ServiceStatus)}
              className="h-8 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              {SERVICE_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${STATUS_BADGE_CLASS[initial.status]}`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  initial.status === "in_progress" ? "bg-blue-500" : "bg-emerald-500"
                }`}
              />
              {statusLabel(initial.status)}
            </span>
          )}
        </Row>
        <Row label="主服务人员">
          {editing ? (
            <StaffSelect
              value={staff1Id}
              admins={admins}
              error={adminsError}
              onChange={(v) => v !== null && setStaff1Id(v)}
              required
            />
          ) : (
            <span>{initial.staff1_name || "—"}</span>
          )}
        </Row>
        <Row label="协同服务人员">
          {editing ? (
            <StaffSelect
              value={staff2Id}
              admins={admins}
              error={adminsError}
              onChange={(v) => setStaff2Id(v)}
              allowNone
              excludeId={staff1Id}
            />
          ) : (
            <span>{initial.staff2_name || "—"}</span>
          )}
        </Row>
        <Row label="转入人">{initial.recorder_name || "—"}</Row>
        <Row label="整体备注">
          {editing ? (
            <Textarea
              value={overallNote}
              onChange={(e) => setOverallNote(e.target.value)}
              rows={3}
              placeholder="可补充背景信息、关键诉求、家庭情况等"
              className="resize-none"
              style={{ fontSize: "16px" }}
            />
          ) : (
            <span className="whitespace-pre-wrap text-gray-700">
              {initial.overall_note || "—"}
            </span>
          )}
        </Row>
      </div>

      {editing && (
        <p className="text-xs text-amber-700 mt-3 flex items-start gap-1">
          <AlertTriangle className="size-3 shrink-0 mt-0.5" />
          若把主/协同服务人员改成他人且你都不在其中，保存后你将立刻失去访问权。
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* 转交确认 modal */}
      {confirmHandoff && (
        <ConfirmHandoffModal
          onCancel={() => setConfirmHandoff(null)}
          onConfirm={() => {
            setConfirmHandoff(null);
            performSave({ skipHandoffWarn: true });
          }}
          newStaff1Name={staffName(confirmHandoff.nextStaff1, null)}
          newStaff2Name={
            confirmHandoff.nextStaff2 === null
              ? null
              : staffName(confirmHandoff.nextStaff2, null)
          }
        />
      )}
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="shrink-0 w-28 text-xs text-gray-500 pt-1">{label}</span>
      <div className="flex-1 text-sm text-gray-800 break-words">{children}</div>
    </div>
  );
}

function StaffSelect({
  value,
  admins,
  error,
  onChange,
  allowNone,
  excludeId,
  required,
}: {
  value: number | null;
  admins: PickerAdmin[] | null;
  error: boolean;
  onChange: (v: number | null) => void;
  allowNone?: boolean;
  excludeId?: number;
  required?: boolean;
}) {
  if (error) {
    return (
      <span className="text-xs text-red-600">无法加载管理员列表</span>
    );
  }
  if (!admins) {
    return <span className="text-xs text-gray-400">加载中…</span>;
  }
  return (
    <select
      value={value === null ? "" : String(value)}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : Number(e.target.value))
      }
      className="h-8 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 max-w-xs"
      style={{ fontSize: "16px" }}
    >
      {allowNone && <option value="">不指定</option>}
      {!allowNone && !required && <option value="">—</option>}
      {admins
        .filter((a) => a.id !== excludeId)
        .map((a) => (
          <option key={a.id} value={String(a.id)}>
            {a.name}
          </option>
        ))}
    </select>
  );
}

function ConfirmHandoffModal({
  newStaff1Name,
  newStaff2Name,
  onCancel,
  onConfirm,
}: {
  newStaff1Name: string;
  newStaff2Name: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="fixed inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-xs bg-white rounded-xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-amber-100">
              <UserCog className="size-4 text-amber-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">转交确认</h3>
          </div>
          <button
            onClick={onCancel}
            className="size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed">
          您即将把这条记录转交给
          <span className="font-medium text-gray-900 mx-1">
            {newStaff1Name}
            {newStaff2Name ? ` 与 ${newStaff2Name}` : ""}
          </span>
          ，转交后您将不再能访问此记录。
        </p>
        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onCancel}>
            取消
          </Button>
          <Button
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={onConfirm}
          >
            确认转交
          </Button>
        </div>
      </div>
    </div>
  );
}
