"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Inbox,
  RefreshCw,
  RotateCcw,
  Search,
  GraduationCap,
  UserPlus,
  Pencil,
} from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { Pagination } from "@/components/admin/pagination";
import { StatusPill, type StatusTone } from "@/components/admin/status-pill";
import { CoursewareUserDialog } from "@/components/admin/courseware-user-dialog";
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
  CU_STATUSES,
  cuStatusLabel,
  type CoursewareUserStatus,
  type CoursewareUserRow,
} from "@/lib/courseware-users";
import { withBase } from "@/lib/url";

const STATUS_TONE: Record<CoursewareUserStatus, StatusTone> = {
  active: "success",
  disabled: "neutral",
};

interface ListRow extends CoursewareUserRow {
  added_by_name: string | null;
  added_by_group_id: number | null;
  added_by_group_name: string | null;
  last_login_at: number | null;
  usage_count: number;
}

interface ListResponse {
  rows: ListRow[];
  total: number;
  page: number;
  pageSize: number;
}

const COLUMNS = [
  "添加时间",
  "手机号",
  "姓名",
  "分组",
  "备注",
  "其他备注",
  "添加人",
  "最后登录",
  "使用次数",
  "状态",
  "操作",
] as const;

function formatTs(ms: number | null | undefined) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

function formatTsWithTime(ms: number | null | undefined) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CoursewareUsersPage() {
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

  const nameParam = searchParams.get("name") ?? "";
  const phoneParam = searchParams.get("phone") ?? "";
  const statusParam = searchParams.get("status") as CoursewareUserStatus | null;
  const pageParam = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = 20;

  // 筛选草稿态：输入只改本地，点「搜索」才提交到 URL
  const [nameInput, setNameInput] = useState(nameParam);
  const [phoneInput, setPhoneInput] = useState(phoneParam);
  const [statusInput, setStatusInput] = useState<string>(statusParam ?? "");

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 新建/编辑弹窗
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ListRow | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (nameParam) sp.set("name", nameParam);
      if (phoneParam) sp.set("phone", phoneParam);
      if (statusParam) sp.set("status", statusParam);
      sp.set("page", String(pageParam));
      sp.set("pageSize", String(pageSize));
      const res = await fetch(withBase(`/api/admin/courseware-users?${sp}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ListResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [nameParam, phoneParam, statusParam, pageParam]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetch_();
  }, [fetch_]);

  function applyFilters() {
    const sp = new URLSearchParams();
    if (nameInput.trim()) sp.set("name", nameInput.trim());
    if (phoneInput.trim()) sp.set("phone", phoneInput.trim());
    if (statusInput) sp.set("status", statusInput);
    router.replace(`/admin/courseware-users?${sp.toString()}`);
  }

  function resetFilters() {
    setNameInput("");
    setPhoneInput("");
    setStatusInput("");
    router.replace(`/admin/courseware-users`);
  }

  function goPage(p: number) {
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    sp.set("page", String(p));
    router.replace(`/admin/courseware-users?${sp.toString()}`);
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(row: ListRow) {
    setEditing(row);
    setDialogOpen(true);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="relative p-6">
      <div aria-hidden className="list-header-aurora" />
      <div className="relative max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={GraduationCap}
          title="课件用户"
          subtitle={
            <span className="tabular-nums">
              智能课件白名单 · 加入并启用的手机号才能登录
              {loading ? " · 加载中…" : data ? ` · 共 ${data.total} 人` : ""}
            </span>
          }
          accentColor="blue"
        />

        {/* 筛选 + 添加 */}
        <div className="surface-panel p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="cu-filter-name" className="block text-xs text-muted-foreground mb-1">
              姓名
            </label>
            <input
              id="cu-filter-name"
              type="text"
              value={nameInput}
              placeholder="输入姓名"
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyFilters();
                }
              }}
              className="h-8 w-32 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30"
            />
          </div>
          <div>
            <label htmlFor="cu-filter-phone" className="block text-xs text-muted-foreground mb-1">
              手机号
            </label>
            <input
              id="cu-filter-phone"
              type="text"
              value={phoneInput}
              placeholder="输入手机号"
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyFilters();
                }
              }}
              className="h-8 w-36 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30"
            />
          </div>
          <div>
            <label htmlFor="cu-filter-status" className="block text-xs text-muted-foreground mb-1">
              状态
            </label>
            <select
              id="cu-filter-status"
              value={statusInput}
              onChange={(e) => setStatusInput(e.target.value)}
              className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30 cursor-pointer"
            >
              <option value="">全部</option>
              {CU_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
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
            <UserPlus />
            添加用户
          </Button>
        </div>

        {error && (
          <Alert
            tone="error"
            action={
              <Button size="sm" variant="outline" onClick={fetch_} className="h-7 text-xs">
                <RefreshCw className="size-3 mr-1" />
                重试
              </Button>
            }
          >
            {error}
          </Alert>
        )}

        {/* 桌面 Table */}
        <div className="surface-panel overflow-hidden hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground border-b border-[var(--report-border)]">
                {COLUMNS.map((c) => (
                  <TableHead key={c} className={c === "操作" ? "text-center" : ""}>
                    {c}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    {COLUMNS.map((c) => (
                      <TableCell key={c} className="py-4">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
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
                    <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                      {formatTsWithTime(row.created_at)}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                      {row.phone}
                    </TableCell>
                    <TableCell className="text-foreground max-w-[120px] truncate">
                      {row.name || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.added_by_group_name ? (
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs ring-1 ring-[var(--blue-200)] text-[var(--blue-700)] bg-[var(--blue-50)]">
                          {row.added_by_group_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground max-w-[140px] truncate"
                      title={row.note || undefined}
                    >
                      {row.note || "—"}
                    </TableCell>
                    <TableCell
                      className="text-xs text-muted-foreground max-w-[140px] truncate"
                      title={row.note2 || undefined}
                    >
                      {row.note2 || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.added_by_name || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                      {formatTs(row.last_login_at)}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground">
                      {row.usage_count}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={STATUS_TONE[row.status]}>
                        {cuStatusLabel(row.status)}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(row)}
                          title="编辑"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-[var(--blue-200)] text-[var(--blue-700)] bg-[var(--blue-50)] hover:bg-[var(--blue-100)] hover:ring-[var(--blue-300)] transition-all duration-150 cursor-pointer"
                        >
                          <Pencil className="size-3" />
                          编辑
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {data && (
            <Pagination
              page={pageParam}
              totalPages={totalPages}
              total={data.total}
              onPageChange={goPage}
            />
          )}
        </div>

        {/* 移动卡片 */}
        <div className="md:hidden surface-panel overflow-hidden">
          {loading ? (
            <div className="divide-y divide-[var(--report-divider)]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse mb-2" />
                  <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : data?.rows.length === 0 ? (
            <div className="py-16">
              <EmptyState onAdd={openCreate} />
            </div>
          ) : (
            <div className="divide-y divide-[var(--report-divider)]">
              {data?.rows.map((row) => (
                <div key={row.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground truncate">
                      {row.name || "—"}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                      {row.phone}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <StatusPill tone={STATUS_TONE[row.status]}>
                      {cuStatusLabel(row.status)}
                    </StatusPill>
                    <span className="text-xs text-muted-foreground">
                      使用 {row.usage_count} 次
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    最后登录：{formatTs(row.last_login_at)} · 添加人：{row.added_by_name || "—"}
                    {row.added_by_group_name ? ` · 分组：${row.added_by_group_name}` : ""}
                  </div>
                  {(row.note || row.note2) && (
                    <div className="text-xs text-muted-foreground mb-2 space-y-0.5">
                      {row.note && <div>备注：{row.note}</div>}
                      {row.note2 && <div>其他备注：{row.note2}</div>}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEdit(row)}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-[var(--blue-200)] text-[var(--blue-700)] bg-[var(--blue-50)]"
                    >
                      <Pencil className="size-3" />
                      编辑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {data && (
            <Pagination
              page={pageParam}
              totalPages={totalPages}
              onPageChange={goPage}
              compact
            />
          )}
        </div>
      </div>

      {/* 新建 / 编辑 弹窗 */}
      <CoursewareUserDialog
        open={dialogOpen}
        editing={editing}
        onClose={() => setDialogOpen(false)}
        onSaved={fetch_}
      />
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
        <p className="text-sm text-muted-foreground">还没有课件用户</p>
        <p className="text-xs text-muted-foreground">
          点「添加用户」加入手机号，被加入的人才能登录智能课件
        </p>
      </div>
      <button
        onClick={onAdd}
        className="mt-2 inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md ring-1 ring-[var(--blue-200)] text-[var(--blue-700)] bg-[var(--blue-50)] hover:bg-[var(--blue-100)] transition-all duration-150"
      >
        <UserPlus className="size-3" />
        添加用户
      </button>
    </div>
  );
}
