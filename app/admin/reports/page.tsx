"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  RefreshCw,
  Inbox,
  ArrowRightCircle,
  Briefcase,
  Compass,
  LayoutGrid,
  Sparkles,
  Clock,
  Calendar,
  CalendarDays,
  type LucideIcon,
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
import { withBase } from "@/lib/url";

interface MeData {
  adminId: number;
  name: string;
  showService: boolean;
}

type ProjectFilter = ProjectId | "all";

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

const WORK_YEARS_LABELS: Record<string, string> = {
  lt1: "0-1 年",
  "1to3": "1-3 年",
  "3to10": "3-10 年",
  gt10: "10 年以上",
};

// 简历 AI 提取时可能把字段标签误当成姓名，过滤掉这些常见误识别值
const NAME_BLACKLIST = new Set([
  "投递职位", "邮箱", "手机号", "手机", "电话号码", "电话",
  "姓名", "地址", "性别", "民族", "学历", "岗位", "邮件", "Email",
]);
function cleanName(v: string | null | undefined): string {
  if (!v) return "—";
  const trimmed = v.trim();
  if (NAME_BLACKLIST.has(trimmed)) return "—";
  return trimmed || "—";
}

function eduLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return EDUCATION_LABELS[v] ?? v;
}

function workYearsLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return WORK_YEARS_LABELS[v] ?? v;
}

function formatTs(ms: number) {
  // 手写格式确保 YYYY/MM/DD HH:mm 稳定输出（locale 行为差异避坑）
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** KPI 卡右上的 icon avatar — squircle + 蓝调渐变 + 微 shadow */
function KpiIcon({
  icon: Icon,
  size = "md",
}: {
  icon: LucideIcon;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={`shrink-0 rounded-xl bg-gradient-to-br from-[var(--blue-100)] to-[var(--blue-50)] flex items-center justify-center ring-1 ring-[var(--blue-200)]/50 shadow-[0_2px_6px_oklch(0.55_0.2_252_/_0.08)] ${
        size === "sm" ? "size-8" : "size-10"
      }`}
    >
      <Icon
        className={`text-[var(--blue-700)] ${size === "sm" ? "size-4" : "size-5"}`}
        strokeWidth={2.2}
      />
    </div>
  );
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
  // 「全部」tab 已下线（仅删除入口；后端 API 还兼容 project=all）。
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
        <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
        <div className="h-32 surface-panel" />
        <div className="h-8 w-72 rounded bg-gray-100 animate-pulse" />
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
  const [expandedRow, setExpandedRow] = useState<string | null>(null); // id+project key

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

  // 切 project 时重置分页 + 收起 expand + 清空 tab 专属筛选（保留通用的 from/to/position）
  useEffect(() => {
    setPage(1);
    setExpandedRow(null);
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

  // 表格列模式：tab=all 时只显示通用列 + 展开按钮；单项目时显示项目专属列
  const showProjectSpecific = project !== "all";
  // 只在 navReady===false 时提示（避免 pm2 重启首次请求的短暂 false 污染状态）
  const navDegraded = data && !data.navReady;

  // 列定义（通用 + 项目专属）
  // 通用列把"姓名"+"手机号"放在"时间"之后（report 项目没这俩字段，显示 "—"）
  const columns = useMemo(() => {
    if (project === "report")
      return ["时间", "姓名", "手机号", "项目", "岗位", "学历", "公司", "城市", "简历", "耗时", "操作"];
    // 职业导航：HR 关心节奏 + 用户身份 + 服务转化状态
    if (project === "nav")
      return ["时间", "姓名", "手机号", "服务项目", "意向岗位", "用户身份", "转服务状态", "操作"];
    return ["时间", "姓名", "手机号", "项目", "岗位", "耗时", "详情"]; // all
  }, [project]);

  // 当前 project 的中文显示（标题用）
  const currentProjectLabel =
    project === "all" ? "全部报告" : `${PROJECTS[project as ProjectId].label}报告`;

  return (
    <div className="p-6">
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
      <div className="max-w-7xl mx-auto space-y-5">
        {/* 标题 — 统一 PageHeader（圆形 icon avatar + 顶部装饰条） */}
        <PageHeader
          icon={
            project === "nav"
              ? Compass
              : project === "report"
              ? Briefcase
              : LayoutGrid
          }
          title={currentProjectLabel}
          subtitle={
            project !== "all"
              ? PROJECTS[project as ProjectId].description ?? null
              : "两个项目报告聚合视图"
          }
          accentColor={
            project === "nav" ? "green" : project === "report" ? "blue" : "neutral"
          }
        />

        {/* nav 降级提示 */}
        {navDegraded && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <div>
              「职业导航」数据源暂不可用，已自动切到「职业定位」。请联系开发人员检查{" "}
              <code>NAV_DB_PATH</code>。
            </div>
          </div>
        )}

        {/* Today Strip — 单卡 actionable 工作台 */}
        <TodayStrip data={data} project={project} loading={loading} />

        {/* Project Filter Pill Bar — 焦点级切换 */}
        <ProjectPillBar project={project} showService={me?.showService} />

        {/* 过滤栏 — Tabler 风：包成轻卡 */}
        <div className="surface-panel p-4 flex flex-wrap gap-3 items-end">
          <div>
            <div className="text-xs text-gray-500 mb-1">开始日期</div>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-sm w-36 bg-white ring-1 ring-[var(--report-border)]"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">结束日期</div>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-sm w-36 bg-white ring-1 ring-[var(--report-border)]"
            />
          </div>
          {project === "nav" ? (
            <>
              <div>
                <div className="text-xs text-gray-500 mb-1">姓名</div>
                <Input
                  placeholder="关键词"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm w-32 bg-white ring-1 ring-[var(--report-border)]"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">手机号</div>
                <Input
                  placeholder="关键词"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-sm w-32 bg-white ring-1 ring-[var(--report-border)]"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">用户身份</div>
                <select
                  value={userIdentity}
                  onChange={(e) => setUserIdentity(e.target.value)}
                  className="h-8 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
                >
                  <option value="">全部</option>
                  <option value="recent_grad">应届毕业生</option>
                  <option value="young_unemployed">35岁以下求职者</option>
                  <option value="general_unemployed">35岁以上求职者</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">意向岗位</div>
                <Input
                  placeholder="关键词"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-32 bg-white ring-1 ring-[var(--report-border)]"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">转服务状态</div>
                <select
                  value={transferStatus}
                  onChange={(e) =>
                    setTransferStatus(e.target.value as "" | "1" | "0")
                  }
                  className="h-8 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
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
                <div className="text-xs text-gray-500 mb-1">意向岗位</div>
                <Input
                  placeholder="关键词"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-36 bg-white ring-1 ring-[var(--report-border)]"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">简历</div>
                <select
                  value={hasResume}
                  onChange={(e) =>
                    setHasResume(e.target.value as "" | "1" | "0")
                  }
                  className="h-8 text-sm border border-input rounded-md px-2 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
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
              className="h-8 text-gray-500 hover:text-gray-700"
              onClick={resetFilters}
            >
              重置
            </Button>
          </div>
        </div>

        {/* 表格 */}
        <div className="surface-panel overflow-hidden">
          {error && (
            <div className="p-4 text-sm text-red-600 border-b border-red-100 bg-red-50 flex items-center justify-between">
              <span>加载失败：{error}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={fetch_}
                className="h-7 text-xs"
              >
                <RefreshCw className="size-3 mr-1" />
                重试
              </Button>
            </div>
          )}
          <Table>
            <TableHeader className="sticky top-0 bg-white z-10">
              <TableRow className="text-xs text-gray-500 border-b border-[var(--report-border)]">
                {columns.map((c) => (
                  <TableHead
                    key={c}
                    className={c === "操作" || c === "详情" ? "text-right" : ""}
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
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
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
                data?.rows.map((row) => {
                  const rowKey = `${row.project}-${row.id}`;
                  const expanded = expandedRow === rowKey;
                  return (
                    <ReportRowItem
                      key={rowKey}
                      row={row}
                      project={project}
                      showProjectSpecific={showProjectSpecific}
                      expanded={expanded}
                      onToggleExpand={() =>
                        setExpandedRow((prev) => (prev === rowKey ? null : rowKey))
                      }
                      onTransfer={handleTransfer}
                      navReady={data?.navReady ?? true}
                    />
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* 分页 */}
          {data && totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--report-border)]">
              <div className="text-xs text-gray-500 tabular-nums">
                共{" "}
                <span className="font-medium text-gray-700">{data.total}</span>{" "}
                条
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2.5 hover:bg-[var(--blue-50)]/40"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  上一页
                </Button>
                <div className="px-2 text-xs text-gray-600 tabular-nums whitespace-nowrap">
                  <span className="font-semibold text-gray-900">{page}</span>
                  <span className="text-gray-300 mx-1">/</span>
                  <span>{totalPages}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2.5 hover:bg-[var(--blue-50)]/40"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Today Strip — 替代 4-StatCard 横排，actionable 工作台 */
function TodayStrip({
  data,
  project,
  loading,
}: {
  data: ApiResponse | null;
  project: ProjectFilter;
  loading: boolean;
}) {
  // nav 项目：本月新增 / 本周新增 / 已转服务（三栏并列）
  if (project === "nav") {
    return <NavStatStrip data={data} loading={loading} />;
  }

  const todayCount = data?.stats.todayCount;
  const total = data?.stats.total;
  const resumeRate = data?.stats.resumeRate;
  const avgDur = data?.stats.avgDurationSec;

  return (
    <div className="surface-panel relative overflow-hidden p-6">
      {/* 右上角微弱品牌渐变 — 让单卡看起来更"指挥中心"而非平面 */}
      <div
        aria-hidden
        className="absolute -top-12 -right-12 size-48 rounded-full bg-[radial-gradient(circle,oklch(0.7_0.16_245_/_0.12),transparent_65%)] pointer-events-none"
      />
      <div className="relative grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
        {/* 左 5 栏：今日新增大数字 */}
        <div className="md:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10.5px] text-gray-500 font-semibold tracking-[0.16em] uppercase">
              今日新增
            </div>
            <KpiIcon icon={Sparkles} />
          </div>
          {loading && data === null ? (
            <div className="h-12 w-24 bg-gray-100 rounded animate-pulse mt-3" />
          ) : (
            <div className="kpi-number text-[44px] md:text-[52px] font-semibold leading-none mt-3">
              {todayCount ?? "—"}
            </div>
          )}
          <div className="text-xs text-gray-500 mt-3 tabular-nums">
            累计{" "}
            <span className="font-semibold text-[var(--navy-800)]">
              {total ?? "—"}
            </span>{" "}
            份{project === "all" && " · 两个项目合计"}
          </div>
        </div>

        {/* 中间分隔（仅桌面） */}
        <div
          aria-hidden
          className="hidden md:block md:col-span-1 h-full w-px bg-gradient-to-b from-transparent via-[var(--report-border)] to-transparent mx-auto"
        />

        {/* 右 6 栏：两个 secondary KPI */}
        <div className="md:col-span-6 grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10.5px] text-gray-500 font-semibold tracking-[0.16em] uppercase">
                简历上传率
              </div>
              <KpiIcon icon={FileText} size="sm" />
            </div>
            {loading && data === null ? (
              <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mt-3" />
            ) : (
              <div className="text-[26px] font-semibold tabular-nums tracking-tight leading-none mt-3 text-[var(--navy-800)]">
                {resumeRate !== undefined ? `${resumeRate}%` : "—"}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10.5px] text-gray-500 font-semibold tracking-[0.16em] uppercase">
                平均耗时
              </div>
              <KpiIcon icon={Clock} size="sm" />
            </div>
            {loading && data === null ? (
              <div className="h-8 w-16 bg-gray-100 rounded animate-pulse mt-3" />
            ) : (
              <div className="text-[26px] font-semibold tabular-nums tracking-tight leading-none mt-3 text-[var(--navy-800)]">
                {avgDur ? `${avgDur}s` : "—"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** nav 项目专属统计卡：本月新增 / 本周新增 / 已转服务（按北京时间自然月、周一为始） */
function NavStatStrip({
  data,
  loading,
}: {
  data: ApiResponse | null;
  loading: boolean;
}) {
  const total = data?.stats.total;
  const monthCount = data?.stats.monthCount;
  const weekCount = data?.stats.weekCount;
  const transferredCount = data?.stats.transferredCount;
  const skeleton = loading && data === null;

  const Cell = ({
    label,
    value,
    icon,
    highlight,
  }: {
    label: string;
    value: number | undefined;
    icon: LucideIcon;
    highlight?: boolean;
  }) => (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10.5px] text-gray-500 font-semibold tracking-[0.16em] uppercase">
          {label}
        </div>
        <KpiIcon icon={icon} size="sm" />
      </div>
      {skeleton ? (
        <div className="h-10 w-20 bg-gray-100 rounded animate-pulse mt-3" />
      ) : (
        <div
          className={`${highlight ? "kpi-number" : "text-[var(--navy-800)]"} text-[32px] md:text-[38px] font-semibold tabular-nums tracking-tight leading-none mt-3`}
        >
          {value ?? "—"}
        </div>
      )}
    </div>
  );

  return (
    <div className="surface-panel relative overflow-hidden p-6">
      <div
        aria-hidden
        className="absolute -top-12 -right-12 size-48 rounded-full bg-[radial-gradient(circle,oklch(0.7_0.16_245_/_0.12),transparent_65%)] pointer-events-none"
      />
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
        <Cell label="总报告数" value={total} icon={FileText} highlight />
        <Cell label="本月新增" value={monthCount} icon={Calendar} />
        <Cell label="本周新增" value={weekCount} icon={CalendarDays} />
        <Cell label="转服务数量" value={transferredCount} icon={ArrowRightCircle} />
      </div>
    </div>
  );
}

/** Project Filter Pill Bar — 焦点级 project 切换 */
function ProjectPillBar({
  project,
  showService,
}: {
  project: ProjectFilter;
  showService: boolean | undefined;
}) {
  const pills: Array<{ href: string; label: string; active: boolean }> = [
    {
      href: "/admin/reports?project=all",
      label: "全部",
      active: project === "all",
    },
    {
      href: "/admin/reports?project=report",
      label: PROJECTS.report.label,
      active: project === "report",
    },
    {
      href: "/admin/reports?project=nav",
      label: PROJECTS.nav.label,
      active: project === "nav",
    },
  ];
  if (showService) {
    pills.push({
      href: "/admin/service-tracking",
      label: "服务跟踪",
      active: false,
    });
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[oklch(0.95_0.012_252_/_0.6)] ring-1 ring-[oklch(0.9_0.018_252_/_0.5)]">
      {pills.map((p) => (
        <Link
          key={p.href}
          href={p.href}
          className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
            p.active
              ? "bg-white text-[var(--blue-700)] shadow-[0_1px_2px_oklch(0.3_0.1_252_/_0.08),0_4px_12px_oklch(0.55_0.2_252_/_0.1)]"
              : "text-gray-600 hover:text-[var(--navy-800)] hover:bg-white/50"
          }`}
        >
          {p.label}
        </Link>
      ))}
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
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <div className="size-12 rounded-full bg-gray-50 flex items-center justify-center">
          <Inbox className="size-5" />
        </div>
        <div className="space-y-0.5">
          <p className="text-sm text-gray-600">当前筛选无结果</p>
          <p className="text-xs text-gray-400">试着调整日期或岗位关键词</p>
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
    <div className="flex flex-col items-center gap-3 text-gray-400">
      <div className="size-12 rounded-full bg-gray-50 flex items-center justify-center">
        <Inbox className="size-5" />
      </div>
      <div className="space-y-0.5">
        <p className="text-sm text-gray-600">
          {project === "all"
            ? "还没有人提交报告"
            : `${PROJECTS[project as ProjectId].label} 暂无报告`}
        </p>
        <p className="text-xs text-gray-400">
          当用户完成测评后，结果会出现在这里
        </p>
      </div>
    </div>
  );
}

/** 单行：根据 project filter 渲染对应列；tab=all 时只显示通用 + 展开按钮 */
function ReportRowItem({
  row,
  project,
  showProjectSpecific,
  expanded,
  onToggleExpand,
  onTransfer,
  navReady,
}: {
  row: ReportRow;
  project: ProjectFilter;
  showProjectSpecific: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onTransfer: (row: ReportRow) => void;
  navReady: boolean;
}) {
  void PROJECTS[row.project]; // 保留 import 引用（meta 此处暂不直接展示）
  const durationCell = row.duration_ms
    ? `${Math.round(row.duration_ms / 1000)}s`
    : "—";

  if (!showProjectSpecific) {
    // tab=all：通用列（时间/姓名/手机号/项目/岗位/耗时/详情）+ 展开按钮
    return (
      <>
        <TableRow
          className="text-sm cursor-pointer hover:bg-[var(--blue-50)]/40 transition-colors duration-150"
          onClick={onToggleExpand}
        >
          <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">
            {formatTs(row.created_at)}
          </TableCell>
          <TableCell className="text-gray-700 max-w-[100px] truncate">
            {cleanName(row.user_name)}
          </TableCell>
          <TableCell className="tabular-nums text-xs text-gray-600 whitespace-nowrap">
            {row.user_phone || "—"}
          </TableCell>
          <TableCell>
            <ProjectBadge project={row.project} />
          </TableCell>
          <TableCell className="font-medium max-w-[180px] truncate">
            {row.target_position}
          </TableCell>
          <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">
            {durationCell}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex items-center justify-end gap-2">
              <Link
                href={`/admin/reports/${row.id}?project=${row.project}`}
                className="inline-flex items-center justify-center min-h-[28px] sm:min-h-0 text-xs px-2.5 py-1 rounded-md ring-1 ring-gray-200 text-gray-700 hover:bg-gray-50 hover:ring-gray-300 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
                onClick={(e) => e.stopPropagation()}
              >
                详情
              </Link>
              {expanded ? (
                <ChevronDown className="size-4 text-gray-400" />
              ) : (
                <ChevronRight className="size-4 text-gray-400" />
              )}
            </div>
          </TableCell>
        </TableRow>
        {expanded && (
          <TableRow className="bg-gray-50/50">
            <TableCell colSpan={7} className="px-4 py-3 text-xs">
              <ExpandedDetails row={row} />
            </TableCell>
          </TableRow>
        )}
      </>
    );
  }

  // tab=report：全列
  if (project === "report") {
    return (
      <TableRow className="text-sm hover:bg-[var(--blue-50)]/40 transition-colors duration-150">
        <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">
          {formatTs(row.created_at)}
        </TableCell>
        <TableCell className="text-gray-700 max-w-[100px] truncate">
          {row.user_name || "—"}
        </TableCell>
        <TableCell className="tabular-nums text-xs text-gray-600 whitespace-nowrap">
          {row.user_phone || "—"}
        </TableCell>
        <TableCell>
          <ProjectBadge project={row.project} />
        </TableCell>
        <TableCell className="font-medium max-w-[140px] truncate">
          {row.target_position}
        </TableCell>
        <TableCell className="text-gray-600">{eduLabel(row.target_education)}</TableCell>
        <TableCell className="text-gray-600 max-w-[120px] truncate">
          {row.target_company || "—"}
        </TableCell>
        <TableCell className="text-gray-600">{row.target_city_tier || "—"}</TableCell>
        <TableCell>
          {row.has_resume ? (
            <span className="inline-flex items-center gap-1 text-[var(--semantic-positive)] bg-[var(--semantic-positive)]/8 border border-[var(--semantic-positive)]/30 rounded px-1.5 py-0.5 text-[11px]">
              <FileText className="size-3" />有
            </span>
          ) : (
            <span className="text-gray-400 text-[11px]">无</span>
          )}
        </TableCell>
        <TableCell className="tabular-nums text-xs text-gray-500">
          {durationCell}
        </TableCell>
        <TableCell className="text-right">
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
      <TableCell className="tabular-nums text-xs text-gray-500 whitespace-nowrap">
        {formatTs(row.created_at)}
      </TableCell>
      <TableCell className="text-gray-700 max-w-[100px] truncate">
        {row.user_name || "—"}
      </TableCell>
      <TableCell className="tabular-nums text-xs text-gray-600 whitespace-nowrap">
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
      <TableCell className="text-gray-600">
        {row.user_identity
          ? IDENTITY_LABELS[row.user_identity] ?? row.user_identity
          : "—"}
      </TableCell>
      {/* 转服务状态：已转入服务 / 未转入 */}
      <TableCell>
        {transferred ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--semantic-positive)]">
            <span className="size-1.5 rounded-full bg-[var(--semantic-positive)]" />
            已转入服务
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400">
            <span className="size-1.5 rounded-full bg-gray-300" />
            未转入
          </span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <RowActions row={row} onTransfer={onTransfer} navReady={navReady} />
      </TableCell>
    </TableRow>
  );
}

// 统一的操作按钮基础类（简历/档案/转服务共用，保证设计一致性）
const ACTION_BTN_BASE =
  "inline-flex items-center gap-1 min-h-[28px] sm:min-h-0 text-xs px-2.5 py-1 rounded-md ring-1 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2";
const ACTION_BTN_NEUTRAL =
  "ring-gray-200 text-gray-700 bg-white hover:bg-gray-50 hover:ring-gray-300 focus-visible:ring-[var(--blue-400)]";
const ACTION_BTN_POSITIVE =
  "ring-[var(--semantic-positive)]/30 text-[var(--semantic-positive)] bg-[var(--semantic-positive)]/12 hover:bg-[var(--semantic-positive)]/18 focus-visible:ring-[var(--semantic-positive)]/50";
const ACTION_BTN_DISABLED =
  "ring-gray-200 text-gray-400 bg-gray-50 cursor-not-allowed";

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
    <div className="flex items-center justify-end gap-2">
      {row.has_resume ? (
        <a
          href={withBase(`/api/admin/reports/${row.id}/resume?project=${row.project}`)}
          download
          className={`${ACTION_BTN_BASE} ${ACTION_BTN_NEUTRAL}`}
        >
          简历
        </a>
      ) : null}
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
            已转服务
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

function ExpandedDetails({ row }: { row: ReportRow }) {
  if (row.project === "report") {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-600">
        <div>
          <span className="text-gray-400">学历：</span>
          {eduLabel(row.target_education)}
        </div>
        <div>
          <span className="text-gray-400">公司：</span>
          {row.target_company ?? "—"}
        </div>
        <div>
          <span className="text-gray-400">城市：</span>
          {row.target_city_tier ?? "—"}
        </div>
        <div>
          <span className="text-gray-400">简历：</span>
          {row.has_resume ? (
            <a
              href={withBase(`/api/admin/reports/${row.id}/resume?project=${row.project}`)}
              download
              className="text-[var(--blue-700)] hover:underline"
            >
              下载
            </a>
          ) : (
            "无"
          )}
        </div>
      </div>
    );
  }
  // nav
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-600">
      <div>
        <span className="text-gray-400">用户身份：</span>
        {row.user_identity
          ? IDENTITY_LABELS[row.user_identity] ?? row.user_identity
          : "—"}
      </div>
      <div>
        <span className="text-gray-400">学历：</span>
        {eduLabel(row.target_education)}
      </div>
      <div>
        <span className="text-gray-400">工作年限：</span>
        {workYearsLabel(row.work_years)}
      </div>
      <div>
        <span className="text-gray-400">手机号：</span>
        {row.user_phone || "—"}
      </div>
      <div>
        <span className="text-gray-400">简历：</span>
        {row.has_resume ? (
          <a
            href={withBase(`/api/admin/reports/${row.id}/resume?project=${row.project}`)}
            download
            className="text-[var(--blue-700)] hover:underline"
          >
            下载
          </a>
        ) : (
          "无"
        )}
      </div>
    </div>
  );
}
