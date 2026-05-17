"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Inbox, RefreshCw, ArrowRightCircle, FileText, FolderOpen, Pencil, AlertTriangle, LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
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
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
  categoryLabel,
  statusLabel,
  CATEGORY_BADGE_CLASS,
  STATUS_BADGE_CLASS,
  formatRelative,
  type ServiceCategory,
  type ServiceStatus,
} from "@/lib/service-tracking";
import { SERVICE_PROJECT_LABELS } from "@/lib/service-tracking";
import { withBase } from "@/lib/url";

interface ListRow {
  id: number;
  source_project: "report" | "nav";
  source_report_id: number;
  user_name: string | null;
  user_phone: string | null;
  target_position: string | null;
  service_category: ServiceCategory;
  status: ServiceStatus;
  first_service_at: number;
  last_service_at: number | null;
  recorder_name: string | null;
  staff1_name: string | null;
  staff2_name: string | null;
}

interface ListResponse {
  rows: ListRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface StatsResponse {
  total: number;
  monthNew: number;
  inProgress: number;
  warning: number;
}

const COLUMNS = [
  "姓名",
  "手机号",
  "服务项目",
  "服务分类",
  "首次服务时间",
  "最新服务记录",
  "服务状态",
  "转入人",
  "操作",
] as const;

/** yyyy-mm-dd → ms (本机时区当日 00:00 / 23:59:59.999) */
function dayStartMs(s: string): number | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}
function dayEndMs(s: string): number | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

function formatTs(ms: number) {
  return new Date(ms).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminServiceTrackingPage() {
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
        <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="h-64 surface-panel" />
      </div>
    </div>
  );
}

function ListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const statusParam = searchParams.get("status") as ServiceStatus | null;
  const categoryParam = searchParams.get("category") as ServiceCategory | null;
  const nameParam = searchParams.get("name") ?? "";
  const dateFromParam = searchParams.get("date_from") ?? "";
  const dateToParam = searchParams.get("date_to") ?? "";
  const pageParam = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = 20;

  // 姓名搜索本地态：URL 同步走 onBlur / Enter，不打字时同步避免每按一键 fetch
  const [nameInput, setNameInput] = useState(nameParam);
  useEffect(() => {
    setNameInput(nameParam);
  }, [nameParam]);

  const [data, setData] = useState<ListResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (statusParam) sp.set("status", statusParam);
      if (categoryParam) sp.set("category", categoryParam);
      if (nameParam) sp.set("name", nameParam);
      const dateFromMs = dayStartMs(dateFromParam);
      const dateToMs = dayEndMs(dateToParam);
      if (dateFromMs !== null) sp.set("date_from", String(dateFromMs));
      if (dateToMs !== null) sp.set("date_to", String(dateToMs));
      sp.set("page", String(pageParam));
      sp.set("pageSize", String(pageSize));
      const [listRes, statsRes] = await Promise.all([
        fetch(withBase(`/api/admin/service-tracking?${sp}`)),
        fetch(withBase(`/api/admin/service-tracking/stats`)),
      ]);
      if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
      setData((await listRes.json()) as ListResponse);
      // stats 失败不阻塞列表
      if (statsRes.ok) setStats((await statsRes.json()) as StatsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [statusParam, categoryParam, nameParam, dateFromParam, dateToParam, pageParam]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    if (value) sp.set(key, value);
    else sp.delete(key);
    sp.delete("page");
    router.replace(`/admin/service-tracking?${sp.toString()}`);
  }

  function commitNameSearch() {
    if (nameInput.trim() !== nameParam) {
      updateParam("name", nameInput.trim());
    }
  }

  function resetFilters() {
    setNameInput("");
    router.replace(`/admin/service-tracking`);
  }

  function goPage(p: number) {
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    sp.set("page", String(p));
    router.replace(`/admin/service-tracking?${sp.toString()}`);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const hasAnyFilter = !!(statusParam || categoryParam || nameParam || dateFromParam || dateToParam);

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* 标题 — 统一 PageHeader */}
        <PageHeader
          icon={LifeBuoy}
          title="服务跟踪"
          subtitle={
            <span className="tabular-nums">
              咨询服务持续跟进记录
              {loading
                ? " · 加载中…"
                : data
                ? ` · 共 ${data.total} 条`
                : ""}
            </span>
          }
          accentColor="blue"
        />

        {/* 数据看板 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="总数" value={stats?.total} loading={loading} accent="blue" />
          <StatCard label="本月新增" value={stats?.monthNew} loading={loading} accent="emerald" />
          <StatCard label="进行中" value={stats?.inProgress} loading={loading} accent="sky" />
          <StatCard
            label="预警"
            value={stats?.warning}
            loading={loading}
            accent="rose"
            hint="状态跟进中 且 14 天未新增服务记录"
          />
        </div>

        {/* 筛选 — Tabler 风：包成轻卡 */}
        <div className="surface-panel p-4 flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-gray-500 mb-1">服务状态</div>
            <select
              value={statusParam ?? ""}
              onChange={(e) => updateParam("status", e.target.value)}
              className="h-8 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              <option value="">全部</option>
              {SERVICE_STATUSES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">服务分类</div>
            <select
              value={categoryParam ?? ""}
              onChange={(e) => updateParam("category", e.target.value)}
              className="h-8 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              <option value="">全部</option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">首次服务起始</div>
            <input
              type="date"
              value={dateFromParam}
              max={dateToParam || undefined}
              onChange={(e) => updateParam("date_from", e.target.value)}
              className="h-8 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">首次服务截止</div>
            <input
              type="date"
              value={dateToParam}
              min={dateFromParam || undefined}
              onChange={(e) => updateParam("date_to", e.target.value)}
              className="h-8 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">姓名</div>
            <input
              type="text"
              value={nameInput}
              placeholder="输入姓名"
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={commitNameSearch}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitNameSearch();
                }
              }}
              className="h-8 w-32 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            />
          </div>
          {hasAnyFilter && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-gray-500 hover:text-gray-700"
              onClick={resetFilters}
            >
              清空
            </Button>
          )}
        </div>

        {/* 桌面 Table */}
        <div className="surface-panel overflow-hidden hidden md:block">
          {error && (
            <div className="p-4 text-sm text-red-600 border-b border-red-100 bg-red-50 flex items-center justify-between">
              <span>加载失败：{error}</span>
              <Button size="sm" variant="outline" onClick={fetch_} className="h-7 text-xs">
                <RefreshCw className="size-3 mr-1" />
                重试
              </Button>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-gray-500">
                {COLUMNS.map((c) => (
                  <TableHead
                    key={c}
                    className={c === "操作" ? "text-right" : ""}
                  >
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
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="text-center py-16">
                    <EmptyState />
                  </TableCell>
                </TableRow>
              ) : (
                data?.rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="text-sm hover:bg-gray-50/60 transition-colors"
                  >
                    <TableCell className="text-gray-700 max-w-[120px] truncate">
                      {row.user_name || "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-gray-600 whitespace-nowrap">
                      {row.user_phone || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {SERVICE_PROJECT_LABELS[row.source_project] ?? row.source_project}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge value={row.service_category} />
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">
                      {formatTs(row.first_service_at)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                      {formatRelative(row.last_service_at)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={row.status} />
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {row.recorder_name || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={withBase(
                            `/api/admin/reports/${row.source_report_id}/resume?project=${row.source_project}`,
                          )}
                          download
                          title="下载简历"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 hover:ring-gray-300 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                        >
                          <FileText className="size-3" />
                          简历
                        </a>
                        <Link
                          href={`/admin/reports/${row.source_report_id}?project=${row.source_project}`}
                          title="查看用户档案"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 hover:ring-gray-300 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                        >
                          <FolderOpen className="size-3" />
                          档案
                        </Link>
                        <Link
                          href={`/admin/service-tracking/${row.id}`}
                          title="编辑服务跟踪记录"
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md ring-1 ring-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:ring-blue-300 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                        >
                          <Pencil className="size-3" />
                          服务编辑
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* 分页 */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <div className="text-xs text-gray-500 tabular-nums">
                共 <span className="font-medium text-gray-700">{data.total}</span> 条
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2.5"
                  disabled={pageParam <= 1}
                  onClick={() => goPage(pageParam - 1)}
                >
                  上一页
                </Button>
                <span className="text-xs text-gray-500 tabular-nums">
                  {pageParam} / {totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2.5"
                  disabled={pageParam >= totalPages}
                  onClick={() => goPage(pageParam + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 移动卡片 */}
        <div className="md:hidden surface-panel overflow-hidden">
          {error && (
            <div className="p-4 text-sm text-red-600 border-b border-red-100 bg-red-50">
              加载失败：{error}
            </div>
          )}
          {loading ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="h-4 w-32 bg-gray-100 rounded animate-pulse mb-2" />
                  <div className="h-3 w-48 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : data?.rows.length === 0 ? (
            <div className="py-16">
              <EmptyState />
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {data?.rows.map((row) => (
                <Link
                  key={row.id}
                  href={`/admin/service-tracking/${row.id}`}
                  className="block p-4 hover:bg-gray-50/60 active:bg-gray-100/60 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900 truncate">
                      {row.user_name || "—"}
                    </span>
                    <span className="text-xs text-gray-500 tabular-nums shrink-0 ml-2">
                      {row.user_phone || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <CategoryBadge value={row.service_category} />
                    <StatusBadge value={row.status} />
                  </div>
                  <div className="text-xs text-gray-500">
                    最新：{formatRelative(row.last_service_at)}
                  </div>
                </Link>
              ))}
            </div>
          )}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2.5"
                disabled={pageParam <= 1}
                onClick={() => goPage(pageParam - 1)}
              >
                上一页
              </Button>
              <span className="text-xs text-gray-500 tabular-nums">
                {pageParam} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs px-2.5"
                disabled={pageParam >= totalPages}
                onClick={() => goPage(pageParam + 1)}
              >
                下一页
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STAT_ACCENT: Record<string, { ring: string; label: string; value: string; icon?: string }> = {
  blue:    { ring: "ring-blue-100",    label: "text-blue-700",    value: "text-blue-900" },
  emerald: { ring: "ring-emerald-100", label: "text-emerald-700", value: "text-emerald-900" },
  sky:     { ring: "ring-sky-100",     label: "text-sky-700",     value: "text-sky-900" },
  rose:    { ring: "ring-rose-100",    label: "text-rose-700",    value: "text-rose-900" },
};

function StatCard({
  label,
  value,
  loading,
  accent,
  hint,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  accent: "blue" | "emerald" | "sky" | "rose";
  hint?: string;
}) {
  const a = STAT_ACCENT[accent];
  return (
    <div
      className={`relative rounded-xl bg-white ring-1 ${a.ring} shadow-sm shadow-gray-200/60 px-4 py-3`}
      title={hint}
    >
      <div className={`flex items-center gap-1.5 text-xs ${a.label}`}>
        {accent === "rose" && <AlertTriangle className="size-3.5" />}
        <span>{label}</span>
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${a.value}`}>
        {loading || value === undefined ? (
          <span className="inline-block h-7 w-12 rounded bg-gray-100 animate-pulse" />
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function CategoryBadge({ value }: { value: ServiceCategory }) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded border ${CATEGORY_BADGE_CLASS[value]}`}
    >
      {categoryLabel(value)}
    </span>
  );
}

function StatusBadge({ value }: { value: ServiceStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border ${STATUS_BADGE_CLASS[value]}`}
    >
      <span
        className={`size-1.5 rounded-full ${
          value === "in_progress" ? "bg-blue-500" : "bg-emerald-500"
        }`}
      />
      {statusLabel(value)}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 text-gray-400">
      <div className="size-12 rounded-full bg-gray-50 flex items-center justify-center">
        <Inbox className="size-5" />
      </div>
      <div className="space-y-0.5 text-center">
        <p className="text-sm text-gray-600">还没有转入服务的记录</p>
        <p className="text-xs text-gray-400">
          在「职业导航」列表点击「转服务」即可开始
        </p>
      </div>
      <Link
        href="/admin/reports?project=nav"
        className="mt-2 inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md ring-1 ring-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all duration-150"
      >
        <ArrowRightCircle className="size-3" />
        前往职业导航
      </Link>
    </div>
  );
}
