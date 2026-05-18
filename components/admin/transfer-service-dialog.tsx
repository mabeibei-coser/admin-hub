"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, ArrowRightCircle, AlertTriangle, Info, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  SERVICE_CATEGORIES,
  type ServiceCategory,
  maskPhone,
} from "@/lib/service-tracking";
import { withBase } from "@/lib/url";

interface MeData {
  adminId: number;
  name: string;
  showService: boolean;
}

interface PickerAdmin {
  id: number;
  name: string;
}

export interface TransferTargetRow {
  /** nav.reports.id */
  id: number;
  user_name: string | null;
  user_phone: string | null;
  target_position: string | null;
}

interface TransferServiceDialogProps {
  open: boolean;
  row: TransferTargetRow | null;
  me: MeData | null;
  onClose: () => void;
}

export function TransferServiceDialog({
  open,
  row,
  me,
  onClose,
}: TransferServiceDialogProps) {
  const router = useRouter();
  const [category, setCategory] = useState<ServiceCategory | "">("");
  const [staff2, setStaff2] = useState<string>(""); // adminId 字符串，"" = 不指定
  const [admins, setAdmins] = useState<PickerAdmin[] | null>(null);
  const [adminsError, setAdminsError] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ existingId: number } | null>(null);

  // 打开时重置 + 拉 admins
  useEffect(() => {
    if (!open) return;
    setCategory("");
    setStaff2("");
    setError(null);
    setDuplicate(null);
    setAdmins(null);
    setAdminsError(false);
    setLoadingAdmins(true);
    fetch(withBase("/api/admin/admins/picker"))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { admins: PickerAdmin[] }) => setAdmins(d.admins))
      .catch(() => setAdminsError(true))
      .finally(() => setLoadingAdmins(false));
  }, [open]);

  if (!open || !row || !me) return null;

  const canSubmit =
    !!category && !submitting && !adminsError && !loadingAdmins;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !row) return;
    setError(null);
    setDuplicate(null);
    setSubmitting(true);
    try {
      const res = await fetch(withBase("/api/admin/service-tracking/transfer"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_report_id: row.id,
          service_category: category,
          staff2_admin_id: staff2 ? Number(staff2) : null,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (res.status === 409 && (json as { error?: string }).error === "duplicate") {
        setDuplicate({ existingId: Number(json.existingId) });
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        setError((json as { error?: string }).error ?? `操作失败 (HTTP ${res.status})`);
        setSubmitting(false);
        return;
      }
      // 成功跳转详情页
      const id = Number((json as { id?: number }).id);
      router.push(`/admin/service-tracking/${id}`);
      router.refresh();
      onClose();
    } catch (e) {
      // fetch 抛 / JSON 解析失败 / 后端返 HTML 错误页：把实际原因暴露给用户而不是泛化「网络错误」
      const msg = e instanceof Error ? e.message : String(e);
      setError(`提交失败：${msg || "网络错误"}`);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="transfer-dialog-title"
    >
      <div
        className="fixed inset-0 bg-black/40"
        onClick={submitting ? undefined : onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100">
              <ArrowRightCircle className="size-4 text-emerald-700" />
            </div>
            <h2
              id="transfer-dialog-title"
              className="text-base font-semibold text-gray-900"
            >
              转服务
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 无 service 权限警告（D6） */}
        {!me.showService && (
          <div className="mb-4 p-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              你没有「服务跟踪」菜单的权限，转后你将看不到这条记录，建议指定一位协同服务人员。
            </span>
          </div>
        )}

        {/* 409 重复横条 */}
        {duplicate && (
          <div className="mb-4 p-3 text-sm text-[var(--navy-800)] bg-[var(--blue-50)] border border-[var(--blue-200)] rounded-lg flex items-start gap-2">
            <Info className="size-4 shrink-0 mt-0.5 text-[var(--blue-700)]" />
            <div className="flex-1">
              本记录已转过服务
              {duplicate.existingId ? (
                <>
                  ，
                  <Link
                    href={`/admin/service-tracking/${duplicate.existingId}`}
                    className="text-[var(--blue-700)] underline underline-offset-2 hover:text-[var(--blue-600)]"
                    onClick={() => onClose()}
                  >
                    前往查看 →
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* 服务对象 */}
        <div className="px-3 py-2 bg-gray-50 rounded-lg flex items-center justify-between text-sm mb-4">
          <span className="text-gray-800 truncate">
            <span className="text-gray-400">服务对象：</span>
            {row.user_name || "—"}
          </span>
          <span className="text-xs tabular-nums text-gray-500 shrink-0 ml-2">
            {maskPhone(row.user_phone)}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 服务分类（DH1：决策最先；UI 改用下拉框） */}
          <div className="space-y-1.5">
            <Label htmlFor="service-category">服务分类</Label>
            <select
              id="service-category"
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as ServiceCategory | "")
              }
              className="w-full h-10 px-3 rounded-md ring-1 ring-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30"
              style={{ fontSize: "16px" }}
            >
              <option value="">请选择服务分类</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* 服务人员 2 */}
          <div className="space-y-1.5">
            <Label htmlFor="staff2">协同服务人员（可选）</Label>
            <select
              id="staff2"
              value={staff2}
              onChange={(e) => setStaff2(e.target.value)}
              disabled={loadingAdmins || adminsError}
              className="w-full h-10 px-3 rounded-md ring-1 ring-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30 disabled:bg-gray-50 disabled:text-gray-400"
              style={{ fontSize: "16px" }}
            >
              {loadingAdmins ? (
                <option value="" disabled>
                  加载中…
                </option>
              ) : adminsError ? (
                <option value="" disabled>
                  加载失败
                </option>
              ) : (
                <>
                  <option value="">不指定</option>
                  {admins
                    ?.filter((a) => a.id !== me.adminId)
                    .map((a) => (
                      <option key={a.id} value={String(a.id)}>
                        {a.name}
                      </option>
                    ))}
                </>
              )}
            </select>
            {adminsError && (
              <p className="text-xs text-red-600">
                无法加载管理员列表，请刷新页面
              </p>
            )}
          </div>

          {/* 主服务人员（只读，最下） */}
          <div className="space-y-1.5">
            <Label>主服务人员</Label>
            <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-700 flex items-center gap-2">
              <User2 className="size-4 text-gray-400" />
              当前操作员：{me.name}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* 确认前的提示 —— 让用户知道点完按钮会发生什么 */}
          <p className="text-xs text-gray-500 flex items-start gap-1.5">
            <Info className="size-3.5 shrink-0 mt-0.5 text-gray-400" />
            确认后将在「服务跟踪」模块中自动创建记录
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              取消
            </Button>
            <Button
              type="submit"
              className="flex-1 btn-primary-glow text-white"
              disabled={!canSubmit}
            >
              {submitting ? "提交中…" : "确认转入"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
