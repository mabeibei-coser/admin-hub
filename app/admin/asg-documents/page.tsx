"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import {
  Inbox,
  RefreshCw,
  Search,
  FolderLock,
  Plus,
  Trash2,
  Pin,
  Upload,
  Pencil,
  RotateCcw,
  X,
} from "lucide-react";
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
  subcategory: string | null;
  description: string | null;
  requiredTier: "free" | "vip";
  hasAttachment: boolean;
  attachmentName: string | null;
  pinned: boolean;
  createdAt: number;
  viewCount: number;
}

interface ListResponse {
  items: DocRow[];
  categories: string[];
  configured: boolean;
  error?: string;
}

/** 分类与子分类约定（与 doc-library 表自由文本字段对齐；UI 上做下拉约束） */
const CATEGORY_OPTIONS = [
  { value: "安防ASG", label: "安防ASG" },
  { value: "人才ATA", label: "人才ATA" },
] as const;

const SUBCATEGORY_OPTIONS = [
  { value: "制度模板", label: "制度模板" },
  { value: "宣传视频", label: "宣传视频" },
  { value: "岗位全景", label: "岗位全景" },
] as const;

function fmtDate(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const COLUMNS = ["标题", "分类", "子分类", "档位", "查看人数", "上传时间", "操作"] as const;

// ════════════ 新建 / 编辑 弹窗 ════════════
function DocumentDialog({
  editing,
  onClose,
  onDone,
}: {
  editing: DocRow | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const isEdit = !!editing;
  const [title, setTitle] = useState(editing?.title ?? "");
  const [category, setCategory] = useState(editing?.category ?? "");
  const [subcategory, setSubcategory] = useState(editing?.subcategory ?? "");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [tier, setTier] = useState<"free" | "vip">(editing?.requiredTier ?? "free");
  const [pinned, setPinned] = useState<boolean>(editing?.pinned ?? false);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) {
      setError("请填写标题");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // 1. 有新附件先上传拿元信息（编辑时若不选新文件 = 保持原附件不动）
      let attachmentField: unknown = undefined;
      if (file) {
        const fd = new FormData();
        fd.append("attachment", file);
        const upRes = await fetch(withBase("/api/admin/asg-documents/upload"), {
          method: "POST",
          credentials: "include",
          body: fd,
        });
        const upData = (await upRes.json()) as { attachment?: unknown; error?: string };
        if (!upRes.ok) throw new Error(upData.error || "附件上传失败");
        attachmentField = upData.attachment;
      }

      // 2. 建 or 改
      const payload: Record<string, unknown> = {
        title: title.trim(),
        category: category || null,
        subcategory: subcategory || null,
        description: description.trim() || null,
        requiredTier: tier,
        pinned,
      };
      if (attachmentField !== undefined) payload.attachment = attachmentField;

      const url = isEdit
        ? withBase(`/api/admin/asg-documents/${editing!.id}`)
        : withBase("/api/admin/asg-documents");
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || (isEdit ? "更新失败" : "创建失败"));
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* 遮罩与内容并列为兄弟元素（对齐 ConfirmDialog / courseware-user-dialog）。
          不要把 onClick 挂在「同时是遮罩又是内容父级」的外层容器上——拖选输入框文字
          滑出到遮罩区松开时，click 会在公共祖先(外层容器)触发，绕过 stopPropagation
          误关弹窗（“填一半框自己关”）。 */}
      <div
        className="fixed inset-0 bg-black/40"
        onClick={submitting ? undefined : onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-semibold text-foreground">
            {isEdit ? "编辑资料" : "新建资料"}
          </h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* 标题 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              标题 <span className="text-rose-600">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              placeholder="如：消防安全检查表模板"
            />
          </div>

          {/* 分类 + 子分类 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">分类</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">请选择…</option>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">子分类</label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">请选择…</option>
                {SUBCATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 档位 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">档位</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTier("free")}
                className={`flex-1 h-10 rounded-md text-sm border transition-all ${
                  tier === "free"
                    ? "ring-2 ring-[var(--semantic-positive)] bg-[oklch(0.96_0.04_155)] text-[var(--semantic-positive)] border-transparent"
                    : "border-input bg-background text-foreground hover:bg-muted"
                }`}
              >
                免费
              </button>
              <button
                type="button"
                onClick={() => setTier("vip")}
                className={`flex-1 h-10 rounded-md text-sm border transition-all ${
                  tier === "vip"
                    ? "ring-2 ring-[var(--amber-500)] bg-[oklch(0.97_0.06_70)] text-[var(--amber-700)] border-transparent"
                    : "border-input bg-background text-foreground hover:bg-muted"
                }`}
              >
                VIP 专享
              </button>
            </div>
          </div>

          {/* 置顶 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">置顶</label>
            <button
              type="button"
              onClick={() => setPinned((v) => !v)}
              className={`inline-flex items-center gap-2 h-10 rounded-md px-4 text-sm border transition-all ${
                pinned
                  ? "ring-2 ring-[var(--amber-500)] bg-[oklch(0.97_0.06_70)] text-[var(--amber-700)] border-transparent"
                  : "border-input bg-background text-foreground hover:bg-muted"
              }`}
            >
              <Pin className="size-4" />
              {pinned ? "已置顶 · 排在列表最前" : "设为置顶"}
            </button>
            <p className="mt-1.5 text-xs text-muted-foreground">置顶后该资料会显示在文档库最前面</p>
          </div>

          {/* 说明 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">说明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
              placeholder="文档简介"
            />
          </div>

          {/* 附件 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              附件
              {isEdit && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  （不选则保留原附件）
                </span>
              )}
            </label>
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-dashed border-input bg-background px-3 text-sm text-muted-foreground hover:border-ring">
              <Upload className="size-4" />
              <span className="truncate flex-1">
                {file ? file.name : isEdit && editing?.attachmentName ? editing.attachmentName : "选择文件"}
              </span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          {error && <Alert tone="error">{error}</Alert>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "提交中…" : isEdit ? "保存" : "确定新建"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ════════════ 列表页 ════════════
function AsgDocumentsInner() {
  const [items, setItems] = useState<DocRow[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState<"" | "free" | "vip">("");
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DocRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (category) params.set("category", category);
      if (tier) params.set("requiredTier", tier);
      const res = await fetch(withBase(`/api/admin/asg-documents?${params}`), {
        credentials: "include",
      });
      const data: ListResponse = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setItems(data.items || []);
      setConfigured(data.configured);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [q, category, tier]);

  // 关键词输入做轻量 debounce，下拉变化立即触发
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const resetFilters = () => {
    setQ("");
    setCategory("");
    setTier("");
  };
  const hasFilters = !!(q || category || tier);

  const doDelete = async () => {
    if (deleteId == null) return;
    try {
      const res = await fetch(withBase(`/api/admin/asg-documents/${deleteId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || "删除失败");
      }
      setDeleteId(null);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
      setDeleteId(null);
    }
  };

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(row: DocRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  return (
    <div className="relative p-6">
      <div aria-hidden className="list-header-aurora" />
      <div className="relative max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={FolderLock}
          title="文档资料"
          subtitle="安防文档库内容管理（新建 / 编辑 / 删除）"
          accentColor="indigo"
        />

      {/* 筛选 + 新建 */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">标题关键字</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索标题"
              className="h-9 w-52 rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">分类</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 w-32 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">全部</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">档位</label>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as "" | "free" | "vip")}
            className="h-9 w-28 rounded-md border border-input bg-background px-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">全部</option>
            <option value="free">免费</option>
            <option value="vip">VIP 专享</option>
          </select>
        </div>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <RotateCcw className="size-3.5" /> 重置
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="size-3.5" /> 刷新
        </Button>
        <Button size="sm" onClick={openCreate} className="ml-auto">
          <Plus className="size-3.5" /> 新建资料
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {!configured && !loading && (
        <Alert tone="warning">文档库未配置（DOC_LIB_SECRET 缺失），无法管理文档</Alert>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="h-32 text-center text-muted-foreground">
                  加载中…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="size-8 opacity-40" />
                    <span>{hasFilters ? "没有匹配的资料" : "暂无资料，点右上角新建"}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {d.pinned && (
                        <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium text-[var(--amber-700)] bg-[oklch(0.97_0.06_70)]">
                          <Pin className="size-3" /> 置顶
                        </span>
                      )}
                      {d.title}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.category || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.subcategory || "—"}</TableCell>
                  <TableCell>
                    <StatusPill tone={d.requiredTier === "vip" ? "info" : "success"}>
                      {d.requiredTier === "vip" ? "VIP" : "免费"}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{d.viewCount}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{fmtDate(d.createdAt)}</TableCell>
                  <TableCell>
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(d)}
                        className="text-[var(--blue-700)] hover:bg-[var(--blue-50)]"
                      >
                        <Pencil className="size-3.5" /> 编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(d.id)}
                        className="text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {dialogOpen && (
        <DocumentDialog
          editing={editing}
          onClose={() => setDialogOpen(false)}
          onDone={() => {
            setDialogOpen(false);
            load();
          }}
        />
      )}

      {deleteId != null && (
        <ConfirmDialog
          icon={Trash2}
          tone="danger"
          title="删除资料"
          confirmLabel="删除"
          onConfirm={doDelete}
          onCancel={() => setDeleteId(null)}
        >
          确定删除这条资料吗？此操作不可撤销。
        </ConfirmDialog>
      )}
      </div>
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
