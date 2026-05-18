"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, AlertTriangle, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  categoryLabel,
  statusLabel,
  maskPhone,
  type ServiceCategory,
  type ServiceStatus,
} from "@/lib/service-tracking";
import { withBase } from "@/lib/url";
import { StatusPill, type StatusTone } from "@/components/admin/status-pill";
import { DataRow } from "@/components/admin/data-row";

const CATEGORY_TONE: Record<ServiceCategory, StatusTone> = {
  easy: "info",
  moderate: "info",
  hard: "warning",
  priority: "danger",
  safety_net: "neutral",
};
const STATUS_TONE: Record<ServiceStatus, StatusTone> = {
  in_progress: "info",
  completed: "success",
};

interface PickerAdmin {
  id: number;
  name: string;
}

export interface TrackingEditorInitial {
  user_name: string | null;
  user_phone: string | null;
  service_category: ServiceCategory;
  status: ServiceStatus;
  first_service_at: number;
  staff1_admin_id: number;
  staff2_admin_id: number | null;
  staff1_name: string | null;
  staff2_name: string | null;
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
    // 进入编辑模式时重置 + 拉数据，需要响应 editing 切换
    /* eslint-disable react-hooks/set-state-in-effect */
    setAdmins(null);
    setAdminsError(false);
    /* eslint-enable react-hooks/set-state-in-effect */
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
    <div className="surface-panel p-5 relative">
      {/* Toast */}
      {toast && (
        <div className="absolute top-3 right-3 px-3 py-1.5 bg-foreground/90 text-background text-xs rounded-md shadow-lg animate-in fade-in slide-in-from-top-1 duration-200">
          {toast}
        </div>
      )}

      {/* 标题行 */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">服务详情</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md ring-1 ring-border text-foreground hover:bg-muted hover:ring-muted-foreground/30 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30"
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
              className="h-7 text-xs px-2.5 btn-primary-glow text-white"
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
        <DataRow label="服务对象">
          <span className="text-foreground">
            {initial.user_name || "—"}
          </span>
          <span className="ml-2 text-xs tabular-nums text-muted-foreground">
            {maskPhone(initial.user_phone)}
          </span>
        </DataRow>
        <DataRow label="转服务时间">
          <span className="tabular-nums">{formatTs(initial.first_service_at)}</span>
        </DataRow>
        <DataRow label="服务分类">
          {editing ? (
            <div className="flex flex-wrap gap-2">
              {SERVICE_CATEGORIES.map((c) => (
                <label
                  key={c.key}
                  className={`px-3 py-1 rounded-md text-xs cursor-pointer transition-all duration-150 border ${
                    category === c.key
                      ? "ring-2 ring-[var(--blue-500)] bg-[var(--blue-50)] text-[var(--navy-800)] border-transparent"
                      : "border-border bg-card text-foreground hover:bg-muted"
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
            <StatusPill tone={CATEGORY_TONE[initial.service_category]} dot={false}>
              {categoryLabel(initial.service_category)}
            </StatusPill>
          )}
        </DataRow>
        <DataRow label="主服务人员">
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
        </DataRow>
        <DataRow label="协同服务人员">
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
        </DataRow>
        <DataRow label="服务状态">
          {editing ? (
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ServiceStatus)}
              className="h-8 text-sm border border-input rounded-md px-2.5 bg-card text-foreground w-full min-w-[5em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30"
            >
              {SERVICE_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <StatusPill tone={STATUS_TONE[initial.status]}>
              {statusLabel(initial.status)}
            </StatusPill>
          )}
        </DataRow>
      </div>

      {editing && (
        <p className="text-xs text-[var(--semantic-warning)] mt-3 flex items-start gap-1">
          <AlertTriangle className="size-3 shrink-0 mt-0.5" />
          若把主/协同服务人员改成他人且你都不在其中，保存后你将立刻失去访问权。
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm text-[var(--semantic-danger)] bg-[oklch(0.97_0.04_25)] dark:bg-[oklch(0.3_0.08_25)] rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* 转交确认 modal */}
      {confirmHandoff && (
        <ConfirmDialog
          icon={UserCog}
          tone="warning"
          title="转交确认"
          confirmLabel="确认转交"
          busy={submitting}
          onCancel={() => setConfirmHandoff(null)}
          onConfirm={() => {
            setConfirmHandoff(null);
            performSave({ skipHandoffWarn: true });
          }}
        >
          <p>
            您即将把这条记录转交给
            <span className="font-medium text-foreground mx-1">
              {staffName(confirmHandoff.nextStaff1, null)}
              {confirmHandoff.nextStaff2 !== null
                ? ` 与 ${staffName(confirmHandoff.nextStaff2, null)}`
                : ""}
            </span>
            ，转交后您将不再能访问此记录。
          </p>
        </ConfirmDialog>
      )}
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
      <span className="text-xs text-[var(--semantic-danger)]">无法加载管理员列表</span>
    );
  }
  if (!admins) {
    return <span className="text-xs text-muted-foreground">加载中…</span>;
  }
  return (
    <select
      value={value === null ? "" : String(value)}
      onChange={(e) =>
        onChange(e.target.value === "" ? null : Number(e.target.value))
      }
      className="h-8 text-sm border border-input rounded-md px-2.5 bg-card text-foreground w-full min-w-[5em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30"
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

