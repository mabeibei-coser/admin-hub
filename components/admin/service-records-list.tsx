"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface RecordItem {
  id: number;
  service_at: number;
  content: string | null;
  note: string | null;
  recorder_admin_id: number;
  recorder_name: string | null;
}

interface Props {
  trackingId: number;
  adminId: number;
  initial: RecordItem[];
}

function tsToInput(ms: number): string {
  // <input type="datetime-local"> 要求 YYYY-MM-DDTHH:MM
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function inputToTs(s: string): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}
function formatTs(ms: number): string {
  return new Date(ms).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ServiceRecordsList({ trackingId, initial }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RecordItem | null>(null);

  return (
    <div className="bg-white rounded-xl ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">
          服务记录（{initial.length} 条）
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 bg-blue-600 text-white text-xs px-3 py-1.5 rounded-md hover:bg-blue-700 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          >
            <Plus className="size-3" />
            新增记录
          </button>
        )}
      </div>

      {adding && (
        <div className="mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <RecordForm
            trackingId={trackingId}
            mode="create"
            onClose={() => setAdding(false)}
            onSaved={() => {
              setAdding(false);
              router.refresh();
            }}
          />
        </div>
      )}

      {initial.length === 0 && !adding ? (
        <p className="text-center py-10 text-sm text-gray-400">
          还没有服务记录，点上面「新增记录」开始记录
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {initial.map((r) => (
            <div key={r.id} className="py-4 group">
              {editingId === r.id ? (
                <RecordForm
                  trackingId={trackingId}
                  mode="edit"
                  initial={r}
                  onClose={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-medium text-gray-900 tabular-nums whitespace-nowrap">
                        {formatTs(r.service_at)}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        记录人：{r.recorder_name || "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setEditingId(r.id)}
                        className="size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        aria-label="编辑"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(r)}
                        className="size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label="删除"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                  {r.content && (
                    <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                      {r.content}
                    </p>
                  )}
                  {r.note && (
                    <p className="mt-1 text-xs text-gray-500 italic">
                      备注：{r.note}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <ConfirmDelete
          record={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirmed={() => {
            setConfirmDelete(null);
            router.refresh();
          }}
          trackingId={trackingId}
        />
      )}
    </div>
  );
}

function RecordForm({
  trackingId,
  mode,
  initial,
  onClose,
  onSaved,
}: {
  trackingId: number;
  mode: "create" | "edit";
  initial?: RecordItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serviceAtStr, setServiceAtStr] = useState(
    tsToInput(initial?.service_at ?? Date.now())
  );
  const [content, setContent] = useState(initial?.content ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const ts = inputToTs(serviceAtStr);
    if (ts === null) {
      setError("请填写服务时间");
      return;
    }
    setSubmitting(true);
    try {
      const url =
        mode === "create"
          ? `/api/admin/service-tracking/${trackingId}/records`
          : `/api/admin/service-tracking/${trackingId}/records/${initial!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_at: ts,
          content: content || null,
          note: note || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "保存失败");
        setSubmitting(false);
        return;
      }
      onSaved();
    } catch {
      setError("网络错误，请重试");
      setSubmitting(false);
    }
  }

  return (
    <div className="bg-gray-50/60 p-4 rounded-lg space-y-3 border border-gray-100">
      <div className="space-y-1.5">
        <Label htmlFor="service-at">服务时间</Label>
        <Input
          id="service-at"
          type="datetime-local"
          value={serviceAtStr}
          onChange={(e) => setServiceAtStr(e.target.value)}
          className="bg-white"
          style={{ fontSize: "16px" }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="content">服务记录</Label>
        <Textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="本次沟通要点、关键进展、下一步动作"
          rows={3}
          className="bg-white resize-none"
          style={{ fontSize: "16px" }}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="note">备注</Label>
        <Input
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="可选"
          className="bg-white"
          style={{ fontSize: "16px" }}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded px-2 py-1.5">
          {error}
        </p>
      )}
      <div className="flex gap-2">
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
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
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
    </div>
  );
}

function ConfirmDelete({
  record,
  trackingId,
  onCancel,
  onConfirmed,
}: {
  record: RecordItem;
  trackingId: number;
  onCancel: () => void;
  onConfirmed: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/admin/service-tracking/${trackingId}/records/${record.id}`,
        { method: "DELETE" }
      );
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "删除失败");
        setSubmitting(false);
        return;
      }
      onConfirmed();
    } catch {
      setError("网络错误，请重试");
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/40"
        onClick={submitting ? undefined : onCancel}
      />
      <div className="relative z-10 w-full max-w-xs bg-white rounded-xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="size-4 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-900">删除记录</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={submitting}
            className="size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="text-sm text-gray-700">
          删除后无法恢复，确认删除这条服务记录？
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-600 bg-red-50 rounded px-2 py-1.5">
            {error}
          </p>
        )}
        <div className="flex gap-2 mt-5">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            onClick={doDelete}
            disabled={submitting}
          >
            {submitting ? "删除中…" : "确认删除"}
          </Button>
        </div>
      </div>
    </div>
  );
}
