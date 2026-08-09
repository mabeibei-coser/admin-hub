"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Inbox,
  RefreshCw,
  RotateCcw,
  Search,
  Bot,
  Plus,
  Pencil,
  Copy,
  QrCode,
  ExternalLink,
  Ban,
  Play,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { Pagination } from "@/components/admin/pagination";
import { StatusPill, type StatusTone } from "@/components/admin/status-pill";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { WrapperDialog } from "@/components/admin/wrapper-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  WRAPPER_STATUSES,
  wrapperStatusLabel,
  type WrapperStatus,
  type WrapperListRow,
} from "@/lib/wrappers";
import { withBase } from "@/lib/url";
import { QRCodeSVG } from "qrcode.react";

const STATUS_TONE: Record<WrapperStatus, StatusTone> = {
  active: "success",
  disabled: "neutral",
};

interface ListResponse {
  rows: WrapperListRow[];
  total: number;
  page: number;
  pageSize: number;
}

const COLUMNS = [
  "短码",
  "名称",
  "备注",
  "原始网址",
  "访问次数",
  "创建时间",
  "创建人",
  "状态",
  "操作",
] as const;

function formatTsWithTime(ms: number | null | undefined) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function copyToClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // http fallback
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

export default function WrappersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ListContent />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-64 surface-panel" />
      </div>
    </div>
  );
}

function ListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const shortCodeParam = searchParams.get("short_code") ?? "";
  const nameParam = searchParams.get("name") ?? "";
  const statusParam = searchParams.get("status") as WrapperStatus | null;
  const pageParam = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = 20;

  const [shortCodeInput, setShortCodeInput] = useState(shortCodeParam);
  const [nameInput, setNameInput] = useState(nameParam);
  const [statusInput, setStatusInput] = useState<string>(statusParam ?? "");

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WrapperListRow | null>(null);
  const [qrOpen, setQrOpen] = useState<string | null>(null); // short_code for QR modal
  const [copied, setCopied] = useState<string | null>(null); // short_code for "copied" feedback
  const [toggleConfirm, setToggleConfirm] = useState<{ row: WrapperListRow; action: "disable" | "enable" } | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (shortCodeParam) sp.set("short_code", shortCodeParam);
      if (nameParam) sp.set("name", nameParam);
      if (statusParam) sp.set("status", statusParam);
      sp.set("page", String(pageParam));
      sp.set("pageSize", String(pageSize));
      const res = await fetch(withBase(`/api/admin/wrappers?${sp}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ListResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [shortCodeParam, nameParam, statusParam, pageParam]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  function applyFilters() {
    const sp = new URLSearchParams();
    if (shortCodeInput.trim()) sp.set("short_code", shortCodeInput.trim());
    if (nameInput.trim()) sp.set("name", nameInput.trim());
    if (statusInput) sp.set("status", statusInput);
    router.replace(`/admin/wrappers?${sp.toString()}`);
  }

  function resetFilters() {
    setShortCodeInput("");
    setNameInput("");
    setStatusInput("");
    router.replace("/admin/wrappers");
  }

  function goPage(p: number) {
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    sp.set("page", String(p));
    router.replace(`/admin/wrappers?${sp.toString()}`);
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(row: WrapperListRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  async function handleToggleStatus(row: WrapperListRow) {
    const newStatus = row.status === "active" ? "disabled" : "active";
    try {
      const res = await fetch(withBase(`/api/admin/wrappers/${row.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fetch_();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  }

  async function handleCopy(row: WrapperListRow) {
    const url = `${window.location.origin}${withBase(`/w/${row.short_code}`)}`;
    try {
      await copyToClipboard(url);
      setCopied(row.short_code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="relative p-6">
      <div aria-hidden className="list-header-aurora" />
      <div className="relative max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={Bot}
          title="智能体包装"
          subtitle={
            <span className="tabular-nums">
              外部智能体链接包装管理
              {loading ? " · 加载中…" : data ? ` · 共 ${data.total} 条` : ""}
            </span>
          }
          accentColor="blue"
        />

        {/* 筛选 + 添加 */}
        <div className="surface-panel p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="filter-code" className="block text-xs text-muted-foreground mb-1">短码</label>
            <input
              id="filter-code"
              type="text"
              value={shortCodeInput}
              placeholder="短码搜索"
              onChange={(e) => setShortCodeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyFilters(); } }}
              className="h-8 w-28 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30"
            />
          </div>
          <div>
            <label htmlFor="filter-name" className="block text-xs text-muted-foreground mb-1">名称</label>
            <input
              id="filter-name"
              type="text"
              value={nameInput}
              placeholder="名称搜索"
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyFilters(); } }}
              className="h-8 w-36 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30"
            />
          </div>
          <div>
            <label htmlFor="filter-status" className="block text-xs text-muted-foreground mb-1">状态</label>
            <select
              id="filter-status"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}
              className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30 cursor-pointer"
            >
              <option value="">全部</option>
              {WRAPPER_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilters}>
              <Search />
              搜索
            </Button>
            <Button variant="outline" onClick={resetFilters}>
              <RotateCcw />
              重置
            </Button>
          </div>
          <Button className="ml-auto btn-primary-glow text-white" onClick={openCreate}>
            <Plus />
            添加智能体
          </Button>
        </div>

        {error && (
          <Alert tone="error" action={
            <Button size="sm" variant="outline" onClick={fetch_} className="h-7 text-xs">
              <RefreshCw className="size-3 mr-1" />重试
            </Button>
          }>
            {error}
          </Alert>
        )}

        {/* 桌面 Table */}
        <div className="surface-panel overflow-hidden hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground border-b border-[var(--report-border)]">
                {COLUMNS.map((c) => (
                  <TableHead key={c} className={c === "操作" ? "text-center" : ""}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    {COLUMNS.map((c) => (
                      <TableCell key={c} className="py-4"><div className="h-4 bg-muted rounded animate-pulse" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="text-center py-16">
                    <EmptyState onAdd={openCreate} />
                  </TableCell>
                </TableRow>
              ) : (
                data?.rows.map((row) => (
                  <TableRow key={row.id} className="text-sm row-hover">
                    <TableCell className="tabular-nums text-xs font-mono text-foreground whitespace-nowrap">
                      {row.short_code}
                    </TableCell>
                    <TableCell className="text-foreground max-w-[120px] truncate">{row.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate" title={row.note}>{row.note || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                      <a href={row.source_url} target="_blank" rel="noopener noreferrer" className="hover:text-[var(--blue-600)] underline underline-offset-2 inline-flex items-center gap-1">
                        {new URL(row.source_url).hostname}
                        <ExternalLink className="size-3" />
                      </a>
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground">{row.click_count}</TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">{formatTsWithTime(row.created_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.created_by_name || "—"}</TableCell>
                    <TableCell><StatusPill tone={STATUS_TONE[row.status]}>{wrapperStatusLabel(row.status)}</StatusPill></TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1 flex-wrap justify-center">
                        <button onClick={() => openEdit(row)} title="编辑" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-[var(--blue-200)] text-[var(--blue-700)] bg-[var(--blue-50)] hover:bg-[var(--blue-100)] hover:ring-[var(--blue-300)] transition-all duration-150 cursor-pointer">
                          <Pencil className="size-3" />编辑
                        </button>
                        <button onClick={() => handleCopy(row)} title="复制链接" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-[var(--green-200)] text-[var(--green-700)] bg-[var(--green-50)] hover:bg-[var(--green-100)] transition-all duration-150 cursor-pointer">
                          <Copy className="size-3" />
                          {copied === row.short_code ? "已复制" : "复制"}
                        </button>
                        <button onClick={() => setQrOpen(row.short_code)} title="二维码" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-border text-muted-foreground bg-card hover:bg-muted transition-all duration-150 cursor-pointer">
                          <QrCode className="size-3" />
                        </button>
                        <button
                          onClick={() => setToggleConfirm({ row, action: row.status === "active" ? "disable" : "enable" })}
                          title={row.status === "active" ? "停用" : "启用"}
                          className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-all duration-150 cursor-pointer ${
                            row.status === "active"
                              ? "ring-1 ring-[var(--semantic-warning)]/30 text-[var(--semantic-warning)] bg-[oklch(0.97_0.06_70)] hover:bg-[oklch(0.93_0.08_70)]"
                              : "ring-1 ring-[var(--semantic-positive)]/30 text-[var(--semantic-positive)] bg-[oklch(0.96_0.04_155)] hover:bg-[oklch(0.92_0.06_155)]"
                          }`}
                        >
                          {row.status === "active" ? <><Ban className="size-3" />停用</> : <><Play className="size-3" />启用</>}
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {data && (
            <Pagination page={pageParam} totalPages={totalPages} total={data.total} onPageChange={goPage} />
          )}
        </div>

        {/* 移动卡片 */}
        <div className="md:hidden surface-panel overflow-hidden">
          {loading ? (
            <div className="divide-y divide-[var(--report-divider)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4"><div className="h-4 w-32 bg-muted rounded animate-pulse mb-2" /><div className="h-3 w-48 bg-muted rounded animate-pulse" /></div>
              ))}
            </div>
          ) : data?.rows.length === 0 ? (
            <div className="py-16"><EmptyState onAdd={openCreate} /></div>
          ) : (
            <div className="divide-y divide-[var(--report-divider)]">
              {data?.rows.map((row) => (
                <div key={row.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground truncate">{row.name}</span>
                    <StatusPill tone={STATUS_TONE[row.status]}>{wrapperStatusLabel(row.status)}</StatusPill>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground">{row.short_code}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2 line-clamp-1">{row.note}</div>
                  <div className="text-xs text-muted-foreground mb-2">访问 {row.click_count} 次 · {row.created_by_name || "—"}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <button onClick={() => openEdit(row)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-[var(--blue-200)] text-[var(--blue-700)] bg-[var(--blue-50)]"><Pencil className="size-3" />编辑</button>
                    <button onClick={() => handleCopy(row)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-[var(--green-200)] text-[var(--green-700)] bg-[var(--green-50)]"><Copy className="size-3" />{copied === row.short_code ? "已复制" : "复制"}</button>
                    <button onClick={() => setQrOpen(row.short_code)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-border text-muted-foreground bg-card"><QrCode className="size-3" /></button>
                    <button onClick={() => setToggleConfirm({ row, action: row.status === "active" ? "disable" : "enable" })} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ${row.status === "active" ? "ring-1 ring-[var(--semantic-warning)]/30 text-[var(--semantic-warning)] bg-[oklch(0.97_0.06_70)]" : "ring-1 ring-[var(--semantic-positive)]/30 text-[var(--semantic-positive)] bg-[oklch(0.96_0.04_155)]"}`}>
                      {row.status === "active" ? <><Ban className="size-3" />停用</> : <><Play className="size-3" />启用</>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {data && <Pagination page={pageParam} totalPages={totalPages} onPageChange={goPage} compact />}
        </div>
      </div>

      {/* Dialog */}
      <WrapperDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} onSaved={fetch_} />

      {/* QR Modal */}
      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setQrOpen(null)}>
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="relative z-10 bg-card border border-border rounded-xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <QRCodeSVG value={`${window.location.origin}${withBase(`/w/${qrOpen}`)}`} size={200} />
            <p className="text-xs text-muted-foreground text-center mt-3 break-all">
              {window.location.origin}{withBase(`/w/${qrOpen}`)}
            </p>
            <Button onClick={() => setQrOpen(null)} variant="outline" className="mt-3 w-full">关闭</Button>
          </div>
        </div>
      )}

      {/* Toggle Confirm */}
      {toggleConfirm && (
        <ConfirmDialog
          icon={toggleConfirm.action === "disable" ? Ban : Play}
          tone={toggleConfirm.action === "disable" ? "warning" : "info"}
          title={toggleConfirm.action === "disable" ? "停用智能体" : "启用智能体"}
          confirmLabel={toggleConfirm.action === "disable" ? "停用" : "启用"}
          onConfirm={() => { handleToggleStatus(toggleConfirm.row); setToggleConfirm(null); }}
          onCancel={() => setToggleConfirm(null)}
        >
          <p>
            {toggleConfirm.action === "disable"
              ? `确定停用「${toggleConfirm.row.name}」吗？停用后公开链接将显示 410 无法访问，但访问计数会保留。`
              : `确定启用「${toggleConfirm.row.name}」吗？`}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="size-5" />
      </div>
      <div className="space-y-0.5 text-center">
        <p className="text-sm text-muted-foreground">还没有智能体包装</p>
        <p className="text-xs text-muted-foreground">点「添加智能体」录入外部智能体链接，生成短码公开链接</p>
      </div>
      <button onClick={onAdd} className="mt-2 inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md ring-1 ring-[var(--blue-200)] text-[var(--blue-700)] bg-[var(--blue-50)] hover:bg-[var(--blue-100)] transition-all duration-150">
        <Plus className="size-3" />添加智能体
      </button>
    </div>
  );
}
