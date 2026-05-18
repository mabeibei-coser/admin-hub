"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  RefreshCw,
  Inbox,
  ArrowRightCircle,
  Briefcase,
  Compass,
  Sparkles,
  Clock,
  Calendar,
  CalendarDays,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROJECTS, type ProjectId } from "@/lib/projects";
import {
  TransferServiceDialog,
  type TransferTargetRow,
} from "@/components/admin/transfer-service-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { DataCard } from "@/components/admin/data-card";
import { Alert } from "@/components/admin/alert";
import { Pagination } from "@/components/admin/pagination";
import { withBase } from "@/lib/url";

interface MeData {
  adminId: number;
  name: string;
  showService: boolean;
}

/**
 * 「全部」tab 已下线（删除入口；API 仍兼容历史 ?project=all 请求）。
 * 前端类型收窄为 report | nav，所有 "all" 分支已删除。
 */
type ProjectFilter = ProjectId;

interface ReportRow {
  id: number;
  created_at: number;
  project: ProjectId;
  target_position: string;
  target_education: string | null;
  work_years: string | null;
  user_name: string | null;
  user_phone: string | null;
  target_company: string | null;
  target_city_tier: string | null;
  has_resume: number;
  resume_filename: string | null;
  user_identity: string | null;
  uuid: string | null;
  duration_ms: number | null;
  /** 已转服务的 service_tracking.id；NULL = 未转 */
  tracking_id: number | null;
}

interface Stats {
  total: number;
  todayCount: number;
  resumeRate: number;
  avgDurationSec: number | null;
  /** nav 项目专属：本月新增 */
  monthCount?: number;
  /** nav 项目专属：本周新增 */
  weekCount?: number;
  /** nav 项目专属：累计已转服务数 */
  transferredCount?: number;
}

interface ApiResponse {
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
  project: ProjectFilter;
  navReady: boolean;
  stats: Stats;
}

const IDENTITY_LABELS: Record<string, string> = {
  recent_grad: "应届毕业生",
  young_unemployed: "35岁以下求职者",
  general_unemployed: "35岁以上求职者",
};

// nav 的 form_data_json 学历是 code，admin 显示要映射成中文
const EDUCATION_LABELS: Record<string, string> = {
  junior_high: "初中及以下",
  high_school: "高中/中专/技校",
  junior_college: "高职/大专",
  bachelor: "本科",
  master_plus: "硕士及以上",
};

function eduLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return EDUCATION_LABELS[v] ?? v;
}

function formatTs(ms: number) {
  // 手写格式确保 YYYY/MM/DD HH:mm 稳定输出（locale 行为差异避坑）
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ProjectBadge({ project }: { project: ProjectId }) {
  const meta = PROJECTS[project];
  const tone = meta.color === "green" ? "success" : "info";
  const dotColor =
    meta.color === "green" ? "bg-[var(--semantic-positive)]" : "bg-[var(--blue-500)]";
  return (
    <span className="status-pill" data-tone={tone}>
      <span className={`size-1.5 rounded-full ${dotColor}`} />
      {meta.shortLabel}
    </span>
  );
}

function readProjectFromUrl(p: string | null): ProjectFilter {
  // 历史链接 ?project=all 或不带参数时一律落到职业定位。
  if (p === "report" || p === "nav") return p;
  return "report";
}

/** Page wrapper — Suspense 让 useSearchParams 能在 static prerender 通过 */
export default function AdminReportsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminReportsContent />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-32 surface-panel" />
        <div className="h-8 w-72 rounded bg-muted animate-pulse" />
        <div className="h-64 surface-panel" />
      </div>
    </div>
  );
}

function AdminReportsContent() {
  const searchParams = useSearchParams();
  const project = readProjectFromUrl(searchParams.get("project"));

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [position, setPosition] = useState("");
  const [hasResume, setHasResume] = useState<"" | "1" | "0">("");
  // nav 专属筛选
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [userIdentity, setUserIdentity] = useState("");
  const [transferStatus, setTransferStatus] = useState<"" | "1" | "0">("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 转服务弹窗：dialog state 上提到顶层（plan §8 决策）
  const [transferRow, setTransferRow] = useState<TransferTargetRow | null>(null);
  const [me, setMe] = useState<MeData | null>(null);
  useEffect(() => {
    fetch(withBase("/api/admin/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: MeData | null) =>
          d &&
          setMe({ adminId: d.adminId, name: d.name, showService: d.showService })
      )
      .catch(() => {});
  }, []);
  const handleTransfer = useCallback((row: ReportRow) => {
    setTransferRow({
      id: row.id,
      user_name: row.user_name,
      user_phone: row.user_phone,
      target_position: row.target_position,
    });
  }, []);

  // 切 project 时重置分页 + 清空 tab 专属筛选（保留通用的 from/to/position）
  useEffect(() => {
    setPage(1);
    setHasResume("");
    setName("");
    setPhone("");
    setUserIdentity("");
    setTransferStatus("");
  }, [project]);

  // localStorage 记最近一次（侧栏未来可用作 default）
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("admin.lastProject", project);
    }
  }, [project]);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (position) params.set("position", position);
      if (hasResume) params.set("hasResume", hasResume);
      if (name) params.set("name", name);
      if (phone) params.set("phone", phone);
      if (userIdentity) params.set("userIdentity", userIdentity);
      if (transferStatus) params.set("transferStatus", transferStatus);
      params.set("project", project);
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));

      const res = await fetch(withBase(`/api/admin/reports?${params}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [from, to, position, hasResume, name, phone, userIdentity, transferStatus, project, page]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  const totalPages = data ? Math.ceil(data.total / pageSize) : 1;

  function handleSearch() {
    setPage(1);
    fetch_();
  }

  function resetFilters() {
    setFrom("");
    setTo("");
    setPosition("");
    setHasResume("");
    setName("");
    setPhone("");
    setUserIdentity("");
    setTransferStatus("");
    setPage(1);
  }

  const hasFilters = !!(
    from ||
    to ||
    position ||
    hasResume ||
    name ||
    phone ||
    userIdentity ||
    transferStatus
  );

  // 只在 navReady===false 时提示（避免 pm2 重启首次请求的短暂 false 污染状态）
  const navDegraded = data && !data.navReady;

  // 列定义（项目专属）
  const columns = useMemo(() => {
    if (project === "report")
      return ["时间", "姓名", "手机号", "项目", "岗位", "学历", "公司", "城市", "简历", "耗时", "操作"];
    // 职业导航：HR 关心节奏 + 用户身份 + 服务转化状态
    return ["时间", "姓名", "手机号", "服务项目", "意向岗位", "用户身份", "转服务状态", "操作"];
  }, [project]);

  // 当前 project 的中文显示（标题用）
  const currentProjectLabel = `${PROJECTS[project].label}报告`;

  return (
    <div className="relative p-6">
      {/* 顶部 aurora 装饰带 — 登录页深色玻璃 panel 的轻量内页呼应 */}
      <div aria-hidden className="list-header-aurora" />
      <TransferServiceDialog
        open={!!transferRow}
        row={transferRow}
        me={me}
        onClose={() => {
          setTransferRow(null);
          // dialog 关闭（成功/取消都触发）后重拉列表，刷新转服务状态列
          fetch_();
        }}
      />
      <div className="relative max-w-7xl mx-auto space-y-5">
        {/* 标题 — 统一 PageHeader（圆形 icon avatar + 顶部装饰条） */}
        <PageHeader
          icon={project === "nav" ? Compass : Briefcase}
          title={currentProjectLabel}
          subtitle={PROJECTS[project].description ?? null}
          accentColor={project === "nav" ? "green" : "blue"}
        />

        {/* nav 降级提示 */}
        {navDegraded && (
          <Alert tone="warning">
            「职业导航」数据源暂不可用，已自动切到「职业定位」。请联系开发人员检查{" "}
            <code>NAV_DB_PATH</code>。
          </Alert>
        )}

        {/* KPI 卡片 4 张 — 顶部工作台 */}
        <KpiStrip data={data} project={project} loading={loading} />

        {/* 过滤栏 — 包成轻卡 */}
        <div className="surface-panel p-4 flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-muted-foreground mb-1">开始日期</div>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-sm w-36 bg-card text-foreground ring-1 ring-[var(--report-border)]"
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">结束日期</div>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-sm w-36 bg-card text-foreground ring-1 ring-[var(--report-border)]"
            />
          </div>
          {project === "nav" ? (
            <>
              <div>
                <div className="text-xs text-muted-foreground mb-1">姓名</div>
                <Input
                  placeholder="关键词"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground ring-1 ring-[var(--report-border)]"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">手机号</div>
                <Input
                  placeholder="关键词"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground ring-1 ring-[var(--report-border)]"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">用户身份</div>
                <select
                  value={userIdentity}
                  onChange={(e) => setUserIdentity(e.target.value)}
                  className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
                >
                  <option value="">全部</option>
                  <option value="recent_grad">应届毕业生</option>
                  <option value="young_unemployed">35岁以下求职者</option>
                  <option value="general_unemployed">35岁以上求职者</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">意向岗位</div>
                <Input
                  placeholder="关键词"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground ring-1 ring-[var(--report-border)]"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">转服务状态</div>
                <select
                  value={transferStatus}
                  onChange={(e) =>
                    setTransferStatus(e.target.value as "" | "1" | "0")
                  }
                  className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
                >
                  <option value="">全部</option>
                  <option value="1">已转入服务</option>
                  <option value="0">未转入</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="text-xs text-muted-foreground mb-1">意向岗位</div>
                <Input
                  placeholder="关键词"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-36 bg-card text-foreground ring-1 ring-[var(--report-border)]"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">简历</div>
                <select
                  value={hasResume}
                  onChange={(e) =>
                    setHasResume(e.target.value as "" | "1" | "0")
                  }
                  className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
                >
                  <option value="">全部</option>
                  <option value="1">有简历</option>
                  <option value="0">无简历</option>
                </select>
              </div>
            </>
          )}
          <div className="flex gap-1.5 ml-auto sm:ml-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSearch}
              className="h-8 border-[var(--blue-200)] text-[var(--blue-700)] hover:bg-[var(--blue-50)] hover:border-[var(--blue-300)]"
            >
              搜索
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-muted-foreground hover:text-foreground"
              onClick={resetFilters}
            >
              重置
            </Button>
          </div>
        </div>

        {/* 错误提示（桌面/移动共用） */}
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
            加载失败：{error}
          </Alert>
        )}

        {/* 桌面表格 */}
        <div className="surface-panel overflow-hidden hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground border-b border-[var(--report-border)]">
                {columns.map((c) => (
                  <TableHead
                    key={c}
                    className={c === "操作" || c === "详情" ? "text-center" : ""}
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
                    {columns.map((c) => (
                      <TableCell key={c} className="py-4">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data?.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-16">
                    <EmptyState
                      hasFilters={hasFilters}
                      project={project}
                      onReset={resetFilters}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                data?.rows.map((row) => (
                  <ReportRowItem
                    key={`${row.project}-${row.id}`}
                    row={row}
                    project={project}
                    onTransfer={handleTransfer}
                    navReady={data?.navReady ?? true}
                  />
                ))
              )}
            </TableBody>
          </Table>

          {data && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={data.total}
              onPageChange={setPage}
            />
          )}
        </div>

        {/* 移动卡片视图 */}
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
              <EmptyState
                hasFilters={hasFilters}
                project={project}
                onReset={resetFilters}
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--report-divider)]">
              {data?.rows.map((row) => (
                <ReportMobileCard
                  key={`m-${row.project}-${row.id}`}
                  row={row}
                />
              ))}
            </div>
          )}
          {data && (
            <Pagination
              page={page}
              totalPages={totalPages}
              total={data.total}
              onPageChange={setPage}
              compact
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** —— 4 张数据卡片 — report / nav 分流，用统一 DataCard —— */
function KpiStrip({
  data,
  project,
  loading,
}: {
  data: ApiResponse | null;
  project: ProjectFilter;
  loading: boolean;
}) {
  const skeleton = loading && data === null;

  // nav 项目：总报告数 / 本月新增 / 本周新增 / 转服务数量
  if (project === "nav") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DataCard
          label="总报告数"
          value={data?.stats.total}
          icon={FileText}
          loading={skeleton}
          highlight
        />
        <DataCard
          label="本月新增"
          value={data?.stats.monthCount}
          icon={Calendar}
          loading={skeleton}
        />
        <DataCard
          label="本周新增"
          value={data?.stats.weekCount}
          icon={CalendarDays}
          loading={skeleton}
        />
        <DataCard
          label="转服务数量"
          value={data?.stats.transferredCount}
          icon={ArrowRightCircle}
          loading={skeleton}
          accent="green"
        />
      </div>
    );
  }

  // report / all：今日新增 / 累计总数 / 简历上传率 / 平均耗时
  const resumeRate = data?.stats.resumeRate;
  const avgDur = data?.stats.avgDurationSec;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <DataCard
        label="今日新增"
        value={data?.stats.todayCount}
        icon={Sparkles}
        loading={skeleton}
        highlight
      />
      <DataCard
        label="累计总数"
        value={data?.stats.total}
        icon={Inbox}
        loading={skeleton}
      />
      <DataCard
        label="简历上传率"
        value={resumeRate !== undefined ? `${resumeRate}%` : undefined}
        icon={FileText}
        loading={skeleton}
      />
      <DataCard
        label="平均耗时"
        value={avgDur ? `${avgDur}s` : undefined}
        icon={Clock}
        loading={skeleton}
      />
    </div>
  );
}

/** 空状态 — 区分"无数据"vs"筛选无结果" */
function EmptyState({
  hasFilters,
  project,
  onReset,
}: {
  hasFilters: boolean;
  project: ProjectFilter;
  onReset: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center">
          <Inbox className="size-5" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm text-muted-foreground">当前筛选无结果</p>
          <p className="text-xs text-muted-foreground">试着调整日期或岗位关键词</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-1 h-7 text-xs"
          onClick={onReset}
        >
          清空筛选
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-3 text-muted-foreground">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center">
        <Inbox className="size-5" />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm text-muted-foreground">
          {PROJECTS[project].label} 暂无报告
        </p>
        <p className="text-xs text-muted-foreground">
          当用户完成测评后，结果会出现在这里
        </p>
      </div>
    </div>
  );
}

/** 单行：根据 project filter 渲染对应列 */
function ReportRowItem({
  row,
  project,
  onTransfer,
  navReady,
}: {
  row: ReportRow;
  project: ProjectFilter;
  onTransfer: (row: ReportRow) => void;
  navReady: boolean;
}) {
  const durationCell = row.duration_ms
    ? `${Math.round(row.duration_ms / 1000)}s`
    : "—";

  // tab=report：全列
  if (project === "report") {
    return (
      <TableRow className="text-sm hover:bg-[var(--blue-50)]/40 transition-colors duration-150">
        <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
          {formatTs(row.created_at)}
        </TableCell>
        <TableCell className="text-foreground max-w-[100px] truncate">
          {row.user_name || "—"}
        </TableCell>
        <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
          {row.user_phone || "—"}
        </TableCell>
        <TableCell>
          <ProjectBadge project={row.project} />
        </TableCell>
        <TableCell className="font-medium max-w-[140px] truncate">
          {row.target_position}
        </TableCell>
        <TableCell className="text-muted-foreground">{eduLabel(row.target_education)}</TableCell>
        <TableCell className="text-muted-foreground max-w-[120px] truncate">
          {row.target_company || "—"}
        </TableCell>
        <TableCell className="text-muted-foreground">{row.target_city_tier || "—"}</TableCell>
        <TableCell>
          {row.has_resume ? (
            <span className="inline-flex items-center gap-1 text-[var(--semantic-positive)] bg-[var(--semantic-positive)]/8 border border-[var(--semantic-positive)]/30 rounded px-1.5 py-0.5 text-[11px]">
              <FileText className="size-3" />有
            </span>
          ) : (
            <span className="text-muted-foreground text-[11px]">无</span>
          )}
        </TableCell>
        <TableCell className="tabular-nums text-xs text-muted-foreground">
          {durationCell}
        </TableCell>
        <TableCell>
          <RowActions row={row} onTransfer={onTransfer} navReady={navReady} />
        </TableCell>
      </TableRow>
    );
  }

  // tab=nav：HR 关心节奏 + 用户身份 + 服务转化状态
  // 列：时间 / 姓名 / 手机号 / 服务项目 / 意向岗位 / 用户身份 / 转服务状态 / 操作
  const navMeta = PROJECTS.nav;
  const transferred = row.tracking_id != null;
  return (
    <TableRow className="text-sm hover:bg-[var(--blue-50)]/40 transition-colors duration-150">
      <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
        {formatTs(row.created_at)}
      </TableCell>
      <TableCell className="text-foreground max-w-[100px] truncate">
        {row.user_name || "—"}
      </TableCell>
      <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
        {row.user_phone || "—"}
      </TableCell>
      {/* 服务项目：完整名称"职业导航"（不再用 shortLabel 缩写） */}
      <TableCell>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--semantic-positive)]">
          <span className="size-1.5 rounded-full bg-[var(--semantic-positive)]" />
          {navMeta.label}
        </span>
      </TableCell>
      <TableCell className="font-medium max-w-[140px] truncate">
        {row.target_position}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {row.user_identity
          ? IDENTITY_LABELS[row.user_identity] ?? row.user_identity
          : "—"}
      </TableCell>
      {/* 转服务状态：纯色点（绿=已转入 灰=未转入） */}
      <TableCell className="text-center">
        <span
          title={transferred ? "已转入服务" : "未转入"}
          className={`inline-block size-3 rounded-full ${transferred ? "bg-[var(--semantic-positive)] shadow-[0_0_0_3px_oklch(0.72_0.18_155_/_0.22)]" : "bg-muted-foreground/40"}`}
        />
      </TableCell>
      <TableCell>
        <RowActions row={row} onTransfer={onTransfer} navReady={navReady} />
      </TableCell>
    </TableRow>
  );
}

// 统一的操作按钮基础类（简历/档案/转服务共用，保证设计一致性）
const ACTION_BTN_BASE =
  "inline-flex items-center gap-1 min-h-[28px] sm:min-h-0 text-xs px-2.5 py-1 rounded-md ring-1 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2";
const ACTION_BTN_NEUTRAL =
  "ring-border text-foreground bg-card hover:bg-muted hover:ring-muted-foreground/30 focus-visible:ring-[var(--blue-400)]";
const ACTION_BTN_POSITIVE =
  "ring-[var(--semantic-positive)]/30 text-[var(--semantic-positive)] bg-[var(--semantic-positive)]/12 hover:bg-[var(--semantic-positive)]/18 focus-visible:ring-[var(--semantic-positive)]/50";
const ACTION_BTN_DISABLED =
  "ring-border text-muted-foreground bg-muted cursor-not-allowed";

function RowActions({
  row,
  onTransfer,
  navReady,
}: {
  row: ReportRow;
  onTransfer: (row: ReportRow) => void;
  navReady: boolean;
}) {
  // 只在 nav 行显示「转服务」按钮（plan §8，V1 决策）
  const canTransfer = row.project === "nav" && navReady;
  const transferred = row.tracking_id != null;
  return (
    <div className="flex items-center justify-center gap-2">
      {/* 简历：有则显示，无则不可见占位（保证档案/转服务列位置固定） */}
      {row.project === "nav" ? (
        row.has_resume ? (
          <a
            href={withBase(`/api/admin/reports/${row.id}/resume?project=${row.project}`)}
            download
            className={`${ACTION_BTN_BASE} ${ACTION_BTN_NEUTRAL}`}
          >
            简历
          </a>
        ) : (
          <span aria-hidden className={`${ACTION_BTN_BASE} invisible`}>简历</span>
        )
      ) : (
        row.has_resume ? (
          <a
            href={withBase(`/api/admin/reports/${row.id}/resume?project=${row.project}`)}
            download
            className={`${ACTION_BTN_BASE} ${ACTION_BTN_NEUTRAL}`}
          >
            简历
          </a>
        ) : null
      )}
      <Link
        href={`/admin/reports/${row.id}?project=${row.project}`}
        className={`${ACTION_BTN_BASE} ${ACTION_BTN_NEUTRAL}`}
      >
        档案
      </Link>
      {row.project === "nav" && (
        transferred ? (
          <Link
            href={`/admin/service-tracking/${row.tracking_id}`}
            title="查看服务跟踪记录"
            className={`${ACTION_BTN_BASE} ${ACTION_BTN_POSITIVE}`}
          >
            <ArrowRightCircle className="size-3" />
            转服务
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => canTransfer && onTransfer(row)}
            disabled={!canTransfer}
            title={canTransfer ? "转入服务跟踪" : "数据库暂不可用"}
            className={`${ACTION_BTN_BASE} ${canTransfer ? ACTION_BTN_NEUTRAL : ACTION_BTN_DISABLED}`}
          >
            <ArrowRightCircle className="size-3" />
            转服务
          </button>
        )
      )}
    </div>
  );
}

/** 移动端单卡 — 信息密度压缩，整卡 link 到详情页 */
function ReportMobileCard({ row }: { row: ReportRow }) {
  const transferred = row.tracking_id != null;
  const durationSec = row.duration_ms
    ? `${Math.round(row.duration_ms / 1000)}s`
    : null;
  return (
    <Link
      href={`/admin/reports/${row.id}?project=${row.project}`}
      className="block p-4 hover:bg-[var(--blue-50)]/40 active:bg-[var(--blue-100)]/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-medium text-foreground truncate min-w-0">
          {row.user_name || "—"}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {row.user_phone || "—"}
        </span>
      </div>
      <div className="text-sm text-foreground truncate mb-1.5">
        {row.target_position}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">{formatTs(row.created_at)}</span>
        <div className="flex items-center gap-2">
          {row.has_resume === 1 && (
            <span className="inline-flex items-center gap-0.5 text-[var(--semantic-positive)]">
              <FileText className="size-3" />简历
            </span>
          )}
          {durationSec && <span className="tabular-nums">{durationSec}</span>}
          {row.project === "nav" && (
            <span
              aria-label={transferred ? "已转入服务" : "未转入"}
              className={`size-2 rounded-full ${transferred ? "bg-[var(--semantic-positive)] shadow-[0_0_0_2px_oklch(0.72_0.18_155_/_0.22)]" : "bg-muted-foreground/40"}`}
            />
          )}
        </div>
      </div>
    </Link>
  );
}
