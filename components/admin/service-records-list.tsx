"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Loader2,
  Paperclip,
  Download,
  Upload,
  Compass,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ATTACHMENT_MAX_BYTES,
  type ServiceRecordAttachment,
} from "@/lib/service-tracking";
import { withBase } from "@/lib/url";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

export interface ServiceRecordItem {
  kind: "service";
  id: number;
  service_at: number;
  content: string | null;
  note: string | null;
  recorder_admin_id: number;
  recorder_name: string | null;
  attachments: ServiceRecordAttachment[];
}

export interface NavRecordItem {
  kind: "nav";
  id: number;
  /** nav.reports.created_at — 与 service_at 同语义参与时间排序 */
  service_at: number;
  user_name: string | null;
  target_position: string | null;
  employment_index: number | null;
}

export type RecordItem = ServiceRecordItem | NavRecordItem;

interface Props {
  trackingId: number;
  adminId: number;
  initial: RecordItem[];
  /** 用于标题计数（只算服务记录本身，不算归集来的 nav 报告） */
  serviceCount: number;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function ServiceRecordsList({
  trackingId,
  initial,
  serviceCount,
}: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ServiceRecordItem | null>(
    null,
  );

  const navCount = initial.filter((r) => r.kind === "nav").length;

  return (
    <div className="surface-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">
          服务记录（{serviceCount} 条
          {navCount > 0 ? (
            <span className="text-muted-foreground font-normal">
              {" "}
              · 含 {navCount} 条职业导航
            </span>
          ) : null}
          ）
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 bg-[var(--blue-700)] text-white text-xs px-3 py-1.5 rounded-md hover:bg-[var(--blue-600)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30"
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
        <p className="text-center py-10 text-sm text-muted-foreground">
          还没有服务记录，点上面「新增记录」开始记录
        </p>
      ) : (
        <div className="space-y-3">
          {initial.map((r) =>
            r.kind === "nav" ? (
              <NavRecordCard key={`nav-${r.id}`} item={r} />
            ) : (
              <div
                key={`sr-${r.id}`}
                className="group rounded-lg border border-border bg-muted/40 p-4 transition-colors hover:bg-muted"
              >
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
                        <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                          {formatTs(r.service_at)}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          记录人：{r.recorder_name || "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingId(r.id)}
                          className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          aria-label="编辑"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(r)}
                          className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-[var(--semantic-danger)] hover:bg-[oklch(0.97_0.04_25)] dark:hover:bg-[oklch(0.3_0.08_25)] transition-colors"
                          aria-label="删除"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    {r.content && (
                      <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
                        {r.content}
                      </p>
                    )}
                    {r.note && (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        备注：{r.note}
                      </p>
                    )}
                    {r.attachments.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {r.attachments.map((a) => (
                          <a
                            key={a.id}
                            href={withBase(
                              `/api/admin/service-tracking/${trackingId}/records/${r.id}/attachments/${a.id}`,
                            )}
                            download={a.filename}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-card ring-1 ring-border text-foreground hover:bg-[var(--blue-50)] hover:ring-[var(--blue-300)] hover:text-[var(--blue-700)] transition-colors max-w-[18rem]"
                            title={`${a.filename} (${formatSize(a.size)})`}
                          >
                            <Paperclip className="size-3 shrink-0" />
                            <span className="truncate">{a.filename}</span>
                            <span className="text-muted-foreground tabular-nums shrink-0">
                              {formatSize(a.size)}
                            </span>
                            <Download className="size-3 shrink-0 text-muted-foreground" />
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            ),
          )}
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
  initial?: ServiceRecordItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [serviceAtStr, setServiceAtStr] = useState(() =>
    tsToInput(initial?.service_at ?? Date.now()),
  );
  const [content, setContent] = useState(initial?.content ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [attachments, setAttachments] = useState<ServiceRecordAttachment[]>(
    initial?.attachments ?? [],
  );
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setUploading(true);
    const uploaded: ServiceRecordAttachment[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > ATTACHMENT_MAX_BYTES) {
          setError(`${file.name} 超过 ${Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB 上限`);
          continue;
        }
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(withBase("/api/admin/service-tracking/upload"), {
          method: "POST",
          body: fd,
        });
        const json = (await res.json()) as ServiceRecordAttachment & { error?: string };
        if (!res.ok) {
          setError(json.error ?? `上传失败：${file.name}`);
          continue;
        }
        uploaded.push(json);
      }
      if (uploaded.length > 0) {
        setAttachments((prev) => [...prev, ...uploaded]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

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
          ? withBase(`/api/admin/service-tracking/${trackingId}/records`)
          : withBase(
              `/api/admin/service-tracking/${trackingId}/records/${initial!.id}`,
            );
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_at: ts,
          content: content || null,
          note: note || null,
          attachments,
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
    <div className="bg-card p-4 rounded-lg space-y-3 border border-[var(--blue-200)] ring-1 ring-[var(--blue-100)]/40">
      <div className="space-y-1.5">
        <Label htmlFor="service-at">服务时间</Label>
        <Input
          id="service-at"
          type="datetime-local"
          value={serviceAtStr}
          onChange={(e) => setServiceAtStr(e.target.value)}
          className="bg-card"
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
          className="bg-card resize-none"
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
          className="bg-card"
          style={{ fontSize: "16px" }}
        />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label>附件</Label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || submitting}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-border text-foreground hover:bg-muted hover:ring-muted-foreground/30 transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                上传中…
              </>
            ) : (
              <>
                <Upload className="size-3" />
                选择文件
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
          />
        </div>
        {attachments.length > 0 ? (
          <ul className="space-y-1">
            {attachments.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-md bg-muted ring-1 ring-border"
              >
                <Paperclip className="size-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">{a.filename}</span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {formatSize(a.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-[var(--semantic-danger)] hover:bg-[oklch(0.97_0.04_25)] dark:hover:bg-[oklch(0.3_0.08_25)] shrink-0"
                  aria-label="移除"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">可附 PDF / Word / Excel / 图片（10 MB 内）</p>
        )}
      </div>
      {error && (
        <p className="text-sm text-[var(--semantic-danger)] bg-[oklch(0.97_0.04_25)] dark:bg-[oklch(0.3_0.08_25)] rounded px-2 py-1.5">
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
          disabled={submitting || uploading}
          className="flex-1 btn-primary-glow text-white"
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
  record: ServiceRecordItem;
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
        withBase(`/api/admin/service-tracking/${trackingId}/records/${record.id}`),
        { method: "DELETE" },
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

  // record 参数用于将来扩展（显示被删记录的预览信息），当前只作幂等占位
  void record;

  return (
    <ConfirmDialog
      icon={AlertTriangle}
      tone="danger"
      title="删除记录"
      confirmLabel="确认删除"
      busy={submitting}
      onCancel={onCancel}
      onConfirm={doDelete}
    >
      <p>删除后无法恢复，确认删除这条服务记录？</p>
      {error && (
        <p className="mt-3 text-sm text-[var(--semantic-danger)] bg-[oklch(0.97_0.04_25)] dark:bg-[oklch(0.3_0.08_25)] rounded px-2 py-1.5">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}

/**
 * 职业导航归集卡片：相同手机+姓名的 nav.reports 按时间穿插进列表。
 * 用 emerald 浅绿底 + Compass 图标，与普通服务记录视觉区分；只读，不可编辑/删除。
 */
function NavRecordCard({ item }: { item: NavRecordItem }) {
  return (
    <div className="rounded-lg p-4 bg-[oklch(0.97_0.04_155)] dark:bg-[oklch(0.3_0.06_155)] ring-1 ring-[oklch(0.85_0.08_155)]/60 dark:ring-[oklch(0.4_0.08_155)]/60">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="size-4 shrink-0 text-[oklch(0.45_0.13_155)] dark:text-[oklch(0.75_0.12_155)]" />
          <span className="text-xs font-medium text-[oklch(0.45_0.13_155)] dark:text-[oklch(0.78_0.12_155)] whitespace-nowrap">
            职业导航
          </span>
          <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
            {formatDate(item.service_at)}
          </span>
        </div>
        <Link
          href={`/admin/reports/${item.id}?project=nav`}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-card ring-1 ring-[oklch(0.75_0.1_155)]/60 dark:ring-[oklch(0.5_0.1_155)]/60 text-[oklch(0.45_0.13_155)] dark:text-[oklch(0.78_0.12_155)] hover:bg-[oklch(0.94_0.06_155)] dark:hover:bg-[oklch(0.35_0.08_155)] transition-colors"
        >
          <FileText className="size-3" />
          查看报告
        </Link>
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-1.5 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">姓名</dt>
          <dd className="text-foreground truncate">{item.user_name || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">意向岗位</dt>
          <dd className="text-foreground truncate">
            {item.target_position || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">就业指数</dt>
          <dd className="text-foreground tabular-nums">
            {item.employment_index ?? "—"}
          </dd>
        </div>
      </dl>
    </div>
  );
}
