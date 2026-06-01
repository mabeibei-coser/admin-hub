"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Inbox, RefreshCw, Search, FolderLock, Plus, Trash2, FileText, Upload } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { StatusPill } from "@/components/admin/status-pill";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/url";

interface DocRow {
  id: number;
  title: string;
  category: string | null;
  description: string | null;
  requiredTier: "free" | "vip";
  hasAttachment: boolean;
  attachmentName: string | null;
  createdAt: number;
}

interface ListResponse {
  items: DocRow[];
  categories: string[];
  configured: boolean;
  error?: string;
}

function fmtDate(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const COLUMNS = ["标题", "分类", "档位", "附件", "上传时间", "操作"] as const;

function UploadDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState<"free" | "vip">("free");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setError("请填写标题"); return; }
    setSubmitting(true);
    setError(null);
    try {
      // 1. 有附件先上传拿元信息
      let attachment = null;
      if (file) {
        const fd = new FormData();
        fd.append("attachment", file);
        const upRes = await fetch(withBase("/api/admin/asg-documents/upload"), {
          method: "POST", credentials: "include", body: fd,
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error || "附件上传失败");
        attachment = upData.attachment;
      }
      // 2. 建文档
      const res = await fetch(withBase("/api/admin/asg-documents"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category: category.trim() || null,
          description: description.trim() || null,
          requiredTier: tier,
          attachment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-semibold text-foreground">上传文档</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">标题 *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="如：消防安全检查表模板" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-muted-foreground">分类</label>
              <input value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="如：检查表" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">档位</label>
              <select value={tier} onChange={(e) => setTier(e.target.value as "free" | "vip")} className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring">
                <option value="free">免费</option>
                <option value="vip">VIP 专享</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">说明</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="文档简介" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">附件</label>
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 text-sm text-muted-foreground hover:border-ring">
              <Upload className="size-4" />
              <span className="truncate">{file ? file.name : "选择文件"}</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {error && <Alert tone="error">{error}</Alert>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>取消</Button>
          <Button onClick={submit} disabled={submitting}>{submitting ? "提交中…" : "确定上传"}</Button>
        </div>
      </div>
    </div>
  );
}

function AsgDocumentsInner() {
  const [items, setItems] = useState<DocRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      const res = await fetch(withBase(`/api/admin/asg-documents?${params}`), { credentials: "include" });
      const data: ListResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setItems(data.items || []);
      setConfigured(data.configured);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const doDelete = async () => {
    if (deleteId == null) return;
    try {
      const res = await fetch(withBase(`/api/admin/asg-documents/${deleteId}`), {
        method: "DELETE", credentials: "include",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "删除失败");
      }
      setDeleteId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FolderLock}
        title="安防文档"
        subtitle="安防文档库内容管理（上传 / 删除）"
        accentColor="indigo"
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题 / 分类" className="h-9 w-56 rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <Button variant="outline" size="sm" onClick={load}><RefreshCw className="size-3.5" /> 刷新</Button>
        <Button size="sm" onClick={() => setShowUpload(true)} className="ml-auto"><Plus className="size-3.5" /> 上传文档</Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {!configured && !loading && (
        <Alert tone="warning">文档库未配置（DOC_LIB_SECRET 缺失），无法管理文档</Alert>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>{COLUMNS.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={COLUMNS.length} className="h-32 text-center text-muted-foreground">加载中…</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={COLUMNS.length} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Inbox className="size-8 opacity-40" />
                  <span>{q ? "没有匹配的文档" : "暂无文档，点右上角上传"}</span>
                </div>
              </TableCell></TableRow>
            ) : (
              items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.title}</TableCell>
                  <TableCell className="text-muted-foreground">{d.category || "—"}</TableCell>
                  <TableCell>
                    <StatusPill tone={d.requiredTier === "vip" ? "info" : "success"}>
                      {d.requiredTier === "vip" ? "VIP" : "免费"}
                    </StatusPill>
                  </TableCell>
                  <TableCell>
                    {d.hasAttachment ? (
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground"><FileText className="size-3.5" /> {d.attachmentName}</span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{fmtDate(d.createdAt)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(d.id)} className="text-rose-600 hover:bg-rose-50">
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {showUpload && <UploadDialog onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); load(); }} />}
      {deleteId != null && (
        <ConfirmDialog
          icon={Trash2}
          tone="danger"
          title="删除文档"
          confirmLabel="删除"
          onConfirm={doDelete}
          onCancel={() => setDeleteId(null)}
        >
          确定删除这个文档吗？此操作不可撤销。
        </ConfirmDialog>
      )}
    </div>
  );
}

export default function AsgDocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">加载中…</div>}>
      <AsgDocumentsInner />
    </Suspense>
  );
}
