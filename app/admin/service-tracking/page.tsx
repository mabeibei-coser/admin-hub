"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Inbox, RefreshCw, ArrowRightCircle } from "lucide-react";
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

interface ListRow {
  id: number;
  source_project: "report" | "nav";
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
        <div className="h-64 rounded-xl bg-white ring-1 ring-gray-100 shadow-sm shadow-gray-200/60" />
      </div>
    </div>
  );
}

function ListContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const statusParam = searchParams.get("status") as ServiceStatus | null;
  const categoryParam = searchParams.get("category") as ServiceCategory | null;
  const pageParam = Number(searchParams.get("page") ?? "1") || 1;
  const pageSize = 20;

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams();
      if (statusParam) sp.set("status", statusParam);
      if (categoryParam) sp.set("category", categoryParam);
      sp.set("page", String(pageParam));
      sp.set("pageSize", String(pageSize));
      const res = await fetch(`/api/admin/service-tracking?${sp}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ListResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [statusParam, categoryParam, pageParam]);

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

  function goPage(p: number) {
    const sp = new URLSearchParams(Array.from(searchParams.entries()));
    sp.set("page", String(p));
    router.replace(`/admin/service-tracking?${sp.toString()}`);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        {/* 标题 */}
        <div className="relative">
          <div
            aria-hidden
            className="absolute -top-1 left-0 h-0.5 w-12 rounded-full bg-gradient-to-r from-blue-500 to-violet-400"
          />
          <div className="space-y-1 pt-2">
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
                服务跟踪
              </h1>
              <span className="text-xs text-gray-500">咨询服务持续跟进记录</span>
            </div>
            <p className="text-sm text-gray-500 tabular-nums">
              {loading ? "加载中…" : data ? `共 ${data.total} 条` : "—"}
            </p>
          </div>
        </div>

        {/* 筛选 */}
        <div className="flex flex-wrap gap-3 items-end px-1">
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
        </div>

        {/* 桌面 Table */}
        <div className="bg-white rounded-xl ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 overflow-hidden hidden md:block">
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
                      <Link
                        href={`/admin/service-tracking/${row.id}`}
                        className="inline-flex items-center justify-center min-h-[28px] sm:min-h-0 text-xs px-2.5 py-1 rounded-md ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 hover:ring-gray-300 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                      >
                        服务详情
                      </Link>
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
        <div className="md:hidden bg-white rounded-xl ring-1 ring-gray-100 shadow-sm shadow-gray-200/60 overflow-hidden">
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
