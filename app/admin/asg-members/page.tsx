"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Inbox, RefreshCw, RotateCcw, Search, Crown, Users, Wallet, TrendingUp, Eye } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { Pagination } from "@/components/admin/pagination";
import { StatusPill } from "@/components/admin/status-pill";
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
import { AsgMemberDetailDialog } from "@/components/admin/asg-member-detail-dialog";

interface MemberRow {
  phone: string;
  isVip: boolean;
  vipExpireAt: number;
  totalPaidCents: number;
  orderCount: number;
  paidOrderCount: number;
  updatedAt: number;
  createdAt: number | null;
}

interface Stats {
  totalMembers: number;
  vipMembers: number;
  totalRevenueCents: number;
  newThisWeek: number;
}

interface ListResponse {
  rows: MemberRow[];
  total: number;
  page: number;
  pageSize: number;
  ready: boolean;
  stats?: Stats;
}

const COLUMNS = ["手机号", "会员状态", "VIP 到期", "累计付款", "成功订单", "注册日期", "更新时间", "操作"] as const;

function fmtDate(ms: number | null | undefined) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDateTime(ms: number | null | undefined) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const yuan = (cents: number) => `¥${(cents / 100).toFixed(2)}`;

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="flex size-10 items-center justify-center rounded-lg" style={{ background: accent ?? "var(--muted)" }}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-semibold tabular-nums text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function AsgMembersInner() {
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"" | "vip" | "normal">("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailPhone, setDetailPhone] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState(false);

  // 拉 me 判断是否超管（决定详情弹窗是否显示编辑控件）
  useEffect(() => {
    let cancelled = false;
    fetch(withBase("/api/admin/me"), { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { isSuper?: boolean } | null) => {
        if (cancelled) return;
        setIsSuper(!!d?.isSuper);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (phone) params.set("phone", phone);
      if (status) params.set("status", status);
      const res = await fetch(withBase(`/api/admin/asg-members?${params}`), { credentials: "include" });
      const data: ListResponse = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "加载失败");
      setRows(data.rows);
      setTotal(data.total);
      setReady(data.ready);
      if (data.stats) setStats(data.stats);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, phone, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const resetFilters = () => {
    setPhone("");
    setStatus("");
    setPage(1);
  };
  const hasFilters = phone || status;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Crown}
        title="安防会员"
        subtitle="安全隐患域 VIP 会员名单与收款（只读）"
        accentColor="orange"
      />

      {/* KPI — 4 个统计卡 */}
      {stats && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Users className="size-5 text-slate-600" />} label="会员总数" value={String(stats.totalMembers)} />
          <StatCard icon={<TrendingUp className="size-5 text-sky-600" />} label="本周新增" value={String(stats.newThisWeek)} accent="rgba(14,165,233,0.12)" />
          <StatCard icon={<Crown className="size-5 text-amber-600" />} label="VIP 会员" value={String(stats.vipMembers)} accent="rgba(245,158,11,0.12)" />
          <StatCard icon={<Wallet className="size-5 text-emerald-600" />} label="累计收款" value={yuan(stats.totalRevenueCents)} accent="rgba(16,185,129,0.12)" />
        </div>
      )}

      {/* 筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={phone}
            onChange={(e) => { setPhone(e.target.value); setPage(1); }}
            placeholder="搜索手机号"
            className="h-9 w-52 rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as "" | "vip" | "normal"); setPage(1); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全部状态</option>
          <option value="vip">VIP 会员</option>
          <option value="normal">普通用户</option>
        </select>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={resetFilters}>
            <RotateCcw className="size-3.5" /> 重置
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={load} className="ml-auto">
          <RefreshCw className="size-3.5" /> 刷新
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {!ready && !loading && (
        <Alert tone="warning">会员数据库暂不可用（asg100 可能未部署或尚无会员）</Alert>
      )}

      {/* 表格 */}
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
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="size-8 opacity-40" />
                    <span>{hasFilters ? "没有符合条件的会员" : "暂无会员"}</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.phone}>
                  <TableCell className="font-mono tabular-nums">{r.phone}</TableCell>
                  <TableCell>
                    <StatusPill tone={r.isVip ? "success" : "neutral"}>
                      {r.isVip ? "VIP" : "普通"}
                    </StatusPill>
                  </TableCell>
                  <TableCell className="tabular-nums">{r.isVip ? fmtDate(r.vipExpireAt) : "—"}</TableCell>
                  <TableCell className="tabular-nums font-medium">{yuan(r.totalPaidCents)}</TableCell>
                  <TableCell className="tabular-nums">{r.paidOrderCount}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{fmtDate(r.createdAt)}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{fmtDateTime(r.updatedAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDetailPhone(r.phone)}
                      className="text-[var(--blue-700)] hover:bg-[var(--blue-50)]"
                    >
                      <Eye className="size-3.5" /> 详情
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={page}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
        total={total}
        onPageChange={setPage}
      />

      {detailPhone && (
        <AsgMemberDetailDialog
          phone={detailPhone}
          isSuper={isSuper}
          onClose={() => setDetailPhone(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

export default function AsgMembersPage() {
  return (
    <Suspense fallback={<div className="p-8 text-muted-foreground">加载中…</div>}>
      <AsgMembersInner />
    </Suspense>
  );
}
