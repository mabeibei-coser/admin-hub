"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { withBase } from "@/lib/url";

/**
 * 服务跟踪详情页的「删除整条」按钮 — 仅超管渲染入口（server 端控制是否传 props）。
 * 删除成功后用 router.push 跳回列表，避免留在已被删除的 detail URL 上。
 *
 * 后端硬删 service_tracking + 级联 service_records；仅超管。
 */
export function DeleteTrackingButton({
  trackingId,
  userName,
}: {
  trackingId: number;
  userName: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md ring-1 ring-rose-200 text-rose-600 bg-card hover:bg-rose-50 hover:ring-rose-300 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/30"
      >
        <Trash2 className="size-3.5" />
        删除整条跟踪
      </button>
      {error && (
        <div className="mt-2 text-xs text-rose-600" role="alert">
          {error}
        </div>
      )}
      {open && (
        <ConfirmDialog
          icon={Trash2}
          tone="danger"
          title="删除服务跟踪"
          confirmLabel="确认删除"
          busy={busy}
          onCancel={() => setOpen(false)}
          onConfirm={async () => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch(
                withBase(`/api/admin/service-tracking/${trackingId}`),
                { method: "DELETE", credentials: "include" }
              );
              if (!res.ok) {
                const d = (await res.json().catch(() => ({}))) as { error?: string };
                throw new Error(d.error || "删除失败");
              }
              router.push("/admin/service-tracking");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "删除失败");
              setOpen(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            将删除「{userName || "（未填姓名）"}」的整条服务跟踪，
            包括所有跟进记录与附件元信息。
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            此操作不可撤销。源报告本身不会被删除。
          </p>
        </ConfirmDialog>
      )}
    </>
  );
}
