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
  Rocket,
  FilePen,
  Coins,
  AlertTriangle,
  Sparkles,
  Calendar,
  CalendarDays,
  ImageOff,
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
  /** startup 项目专属：项目名称（来自 form_data_json.projectName） */
  project_name?: string | null;
  /** startup 项目专属：启动资金（来自 form_data_json.startupCapital） */
  startup_capital?: string | null;
  /** startup 项目专属：创业经验（来自 form_data_json.startupExperience） */
  startup_experience?: string | null;
  /** tailor 项目专属：改写模式（moderate / aggressive） */
  tailor_mode?: string | null;
  /** salary 项目专属：标准职级（P5/M3 等代码） */
  salary_rank?: string | null;
  /** salary 项目专属：职级中文标签 */
  salary_rank_label?: string | null;
  /** hazard 项目专属：场景 id */
  scenario?: string | null;
  /** hazard 项目专属：场景中文名（denorm） */
  scenario_label?: string | null;
  /** hazard 项目专属：本次识别条数 */
  hazard_count?: number | null;
  /** hazard 项目专属：是否存了缩略图（1 = 有图，可走 /photo 路由）；老数据为 0 */
  has_photo?: number | null;
}

interface Stats {
  total: number;
  todayCount: number;
  resumeRate: number;
  avgDurationSec: number | null;
  /** nav / startup 项目专属：本月新增 */
  monthCount?: number;
  /** nav / startup 项目专属：本周新增 */
  weekCount?: number;
  /** nav / startup 项目专属：累计已转服务数 */
  transferredCount?: number;
}

interface ApiResponse {
  rows: ReportRow[];
  total: number;
  page: number;
  pageSize: number;
  project: ProjectFilter;
  navReady: boolean;
  startupReady: boolean;
  tailorReady: boolean;
  salaryReady: boolean;
  hazardReady: boolean;
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

// startup 启动资金档位 → 中文标签
const STARTUP_CAPITAL_LABELS: Record<string, string> = {
  lt5w: "5万以下",
  "5w-10w": "5–10万",
  "10w-30w": "10–30万",
  "30w-50w": "30–50万",
  gt50w: "50万以上",
};

// startup 创业经验 → 中文标签
const STARTUP_EXPERIENCE_LABELS: Record<string, string> = {
  none: "无经验",
  one: "1次",
  multiple: "多次",
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
  const tone =
    meta.color === "green" ? "success" : meta.color === "purple" ? "neutral" : "info";
  const dotColor =
    meta.color === "green"
      ? "bg-[var(--semantic-positive)]"
      : meta.color === "purple"
        ? "bg-[var(--purple-500)]"
        : meta.color === "orange"
          ? "bg-[var(--orange-500)]"
          : meta.color === "cyan"
            ? "bg-[var(--cyan-500)]"
            : "bg-[var(--blue-500)]";
  // purple / orange / cyan 走内联类（status-pill 的 data-tone 没枚举，直接 inline 控色）
  if (meta.color === "purple") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--purple-50)] text-[var(--purple-700)] ring-1 ring-[var(--purple-200)]/60">
        <span className={`size-1.5 rounded-full ${dotColor}`} />
        {meta.shortLabel}
      </span>
    );
  }
  if (meta.color === "orange") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--orange-50)] text-[var(--orange-700)] ring-1 ring-[var(--orange-200)]/60">
        <span className={`size-1.5 rounded-full ${dotColor}`} />
        {meta.shortLabel}
      </span>
    );
  }
  if (meta.color === "cyan") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--cyan-50)] text-[var(--cyan-700)] ring-1 ring-[var(--cyan-200)]/60">
        <span className={`size-1.5 rounded-full ${dotColor}`} />
        {meta.shortLabel}
      </span>
    );
  }
  if (meta.color === "amber") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--amber-50)] text-[var(--amber-700)] ring-1 ring-[var(--amber-200)]/60">
        <span className={`size-1.5 rounded-full bg-[var(--amber-500)]`} />
        {meta.shortLabel}
      </span>
    );
  }
  return (
    <span className="status-pill" data-tone={tone}>
      <span className={`size-1.5 rounded-full ${dotColor}`} />
      {meta.shortLabel}
    </span>
  );
}

function readProjectFromUrl(p: string | null): ProjectFilter {
  // 历史链接 ?project=all 或不带参数时一律落到职业定位。
  if (
    p === "report" ||
    p === "nav" ||
    p === "startup" ||
    p === "tailor" ||
    p === "salary" ||
    p === "hazard"
  )
    return p;
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
  // nav / startup 专属筛选
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [userIdentity, setUserIdentity] = useState("");
  const [transferStatus, setTransferStatus] = useState<"" | "1" | "0">("");
  // startup 专属筛选
  const [startupCapital, setStartupCapital] = useState("");
  const [startupExperience, setStartupExperience] = useState("");
  // tailor 专属筛选
  const [tailorMode, setTailorMode] = useState("");
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
    // 仅 nav / startup 行能转服务（按钮渲染处已 gate）；这里 narrow 一下类型
    if (row.project !== "nav" && row.project !== "startup") return;
    setTransferRow({
      id: row.id,
      user_name: row.user_name,
      user_phone: row.user_phone,
      target_position:
        row.project === "startup"
          ? row.project_name ?? row.target_position
          : row.target_position,
      source_project: row.project,
    });
  }, []);

  // 切 project 时重置分页 + 清空 tab 专属筛选（保留通用的 from/to/position）
  useEffect(() => {
    // 跨 tab 切换时的状态重置（备选：parent 给 <Component key={project} /> 重新挂载，代价更大）
    /* eslint-disable react-hooks/set-state-in-effect */
    setPage(1);
    setHasResume("");
    setName("");
    setPhone("");
    setUserIdentity("");
    setTransferStatus("");
    setStartupCapital("");
    setStartupExperience("");
    setTailorMode("");
    /* eslint-enable react-hooks/set-state-in-effect */
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
      if (startupCapital) params.set("startupCapital", startupCapital);
      if (startupExperience) params.set("startupExperience", startupExperience);
      if (tailorMode) params.set("tailorMode", tailorMode);
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
  }, [from, to, position, hasResume, name, phone, userIdentity, transferStatus, startupCapital, startupExperience, tailorMode, project, page]);

  useEffect(() => {
    // 筛选条件变化时重新拉列表
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setStartupCapital("");
    setStartupExperience("");
    setTailorMode("");
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
    transferStatus ||
    startupCapital ||
    startupExperience ||
    tailorMode
  );

  // 只在 navReady===false / startupReady===false 时提示（避免 pm2 重启首次请求的短暂 false 污染状态）
  const navDegraded = data && project === "nav" && !data.navReady;
  const startupDegraded = data && project === "startup" && !data.startupReady;
  const tailorDegraded = data && project === "tailor" && !data.tailorReady;
  const salaryDegraded = data && project === "salary" && !data.salaryReady;
  const hazardDegraded = data && project === "hazard" && !data.hazardReady;

  // 列定义（项目专属）
  const columns = useMemo(() => {
    if (project === "report")
      return ["时间", "姓名", "手机号", "服务项目", "意向岗位", "学历", "意向公司", "操作"];
    if (project === "startup")
      return ["时间", "姓名", "手机号", "服务项目", "项目名称", "启动资金", "创业经验", "转服务状态", "操作"];
    if (project === "tailor")
      return ["时间", "姓名", "手机号", "服务项目", "目标岗位", "改写模式", "操作"];
    if (project === "salary")
      return [
        "时间",
        "手机号",
        "服务项目",
        "岗位名称",
        "标准职级",
        "企业性质",
        "最高学历",
        "所在城市",
        "操作",
      ];
    if (project === "hazard")
      return ["时间", "手机号", "服务项目", "检查场景", "识别条数", "耗时", "缩略图", "操作"];
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
          icon={
            project === "nav"
              ? Compass
              : project === "startup"
                ? Rocket
                : project === "tailor"
                  ? FilePen
                  : project === "salary"
                    ? Coins
                    : project === "hazard"
                      ? AlertTriangle
                      : Briefcase
          }
          title={currentProjectLabel}
          subtitle={PROJECTS[project].description ?? null}
          accentColor={
            project === "nav"
              ? "green"
              : project === "startup"
                ? "purple"
                : project === "tailor"
                  ? "orange"
                  : project === "salary"
                    ? "cyan"
                    : project === "hazard"
                      ? "amber"
                      : "blue"
          }
        />

        {/* nav / startup 降级提示 */}
        {navDegraded && (
          <Alert tone="warning">
            「职业导航」数据源暂不可用，已自动切到「职业定位」。请联系开发人员检查{" "}
            <code>NAV_DB_PATH</code>。
          </Alert>
        )}
        {startupDegraded && (
          <Alert tone="warning">
            「创业诊断」数据源暂不可用，已自动切到「职业定位」。请联系开发人员检查{" "}
            <code>STARTUP_DB_PATH</code>。
          </Alert>
        )}
        {tailorDegraded && (
          <Alert tone="warning">
            「简历定制」数据源暂不可用，已自动切到「职业定位」。请联系开发人员检查{" "}
            <code>TAILOR_DB_PATH</code>。
          </Alert>
        )}
        {salaryDegraded && (
          <Alert tone="warning">
            「薪酬查询」数据源暂不可用，已自动切到「职业定位」。请联系开发人员检查{" "}
            <code>SALARY_DB_PATH</code>。
          </Alert>
        )}
        {hazardDegraded && (
          <Alert tone="warning">
            「隐患识别」数据源暂不可用，已自动切到「职业定位」。请联系开发人员检查{" "}
            <code>HAZARD_DB_PATH</code>。
          </Alert>
        )}

        {/* KPI 卡片 4 张 — 顶部工作台 */}
        <KpiStrip data={data} project={project} loading={loading} />

        {/* 过滤栏 — 包成轻卡 */}
        <div className="surface-panel p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="filter-from" className="block text-xs text-muted-foreground mb-1">开始日期</label>
            <Input
              id="filter-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 text-sm w-36 bg-card text-foreground border border-input cursor-pointer"
            />
          </div>
          <div>
            <label htmlFor="filter-to" className="block text-xs text-muted-foreground mb-1">结束日期</label>
            <Input
              id="filter-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 text-sm w-36 bg-card text-foreground border border-input cursor-pointer"
            />
          </div>
          {project === "nav" ? (
            <>
              <div>
                <label htmlFor="filter-name" className="block text-xs text-muted-foreground mb-1">姓名</label>
                <Input
                  id="filter-name"
                  placeholder="关键词"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-phone" className="block text-xs text-muted-foreground mb-1">手机号</label>
                <Input
                  id="filter-phone"
                  placeholder="关键词"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-identity" className="block text-xs text-muted-foreground mb-1">用户身份</label>
                <select
                  id="filter-identity"
                  value={userIdentity}
                  onChange={(e) => setUserIdentity(e.target.value)}
                  className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] cursor-pointer"
                >
                  <option value="">全部</option>
                  <option value="recent_grad">应届毕业生</option>
                  <option value="young_unemployed">35岁以下求职者</option>
                  <option value="general_unemployed">35岁以上求职者</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-position" className="block text-xs text-muted-foreground mb-1">意向岗位</label>
                <Input
                  id="filter-position"
                  placeholder="关键词"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-transfer" className="block text-xs text-muted-foreground mb-1">转服务状态</label>
                <select
                  id="filter-transfer"
                  value={transferStatus}
                  onChange={(e) =>
                    setTransferStatus(e.target.value as "" | "1" | "0")
                  }
                  className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] cursor-pointer"
                >
                  <option value="">全部</option>
                  <option value="1">已转入服务</option>
                  <option value="0">未转入</option>
                </select>
              </div>
            </>
          ) : project === "startup" ? (
            <>
              <div>
                <label htmlFor="filter-name" className="block text-xs text-muted-foreground mb-1">姓名</label>
                <Input
                  id="filter-name"
                  placeholder="关键词"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-phone" className="block text-xs text-muted-foreground mb-1">手机号</label>
                <Input
                  id="filter-phone"
                  placeholder="关键词"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-project" className="block text-xs text-muted-foreground mb-1">项目名称</label>
                <Input
                  id="filter-project"
                  placeholder="关键词"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-capital" className="block text-xs text-muted-foreground mb-1">启动资金</label>
                <select
                  id="filter-capital"
                  value={startupCapital}
                  onChange={(e) => setStartupCapital(e.target.value)}
                  className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] cursor-pointer"
                >
                  <option value="">全部</option>
                  <option value="lt5w">5万以下</option>
                  <option value="5w-10w">5–10万</option>
                  <option value="10w-30w">10–30万</option>
                  <option value="30w-50w">30–50万</option>
                  <option value="gt50w">50万以上</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-experience" className="block text-xs text-muted-foreground mb-1">创业经验</label>
                <select
                  id="filter-experience"
                  value={startupExperience}
                  onChange={(e) => setStartupExperience(e.target.value)}
                  className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] cursor-pointer"
                >
                  <option value="">全部</option>
                  <option value="none">无经验</option>
                  <option value="one">1次</option>
                  <option value="multiple">多次</option>
                </select>
              </div>
              <div>
                <label htmlFor="filter-transfer" className="block text-xs text-muted-foreground mb-1">转服务状态</label>
                <select
                  id="filter-transfer"
                  value={transferStatus}
                  onChange={(e) =>
                    setTransferStatus(e.target.value as "" | "1" | "0")
                  }
                  className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] cursor-pointer"
                >
                  <option value="">全部</option>
                  <option value="1">已转入服务</option>
                  <option value="0">未转入</option>
                </select>
              </div>
            </>
          ) : project === "tailor" ? (
            <>
              <div>
                <label htmlFor="filter-name" className="block text-xs text-muted-foreground mb-1">姓名</label>
                <Input
                  id="filter-name"
                  placeholder="关键词"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-position" className="block text-xs text-muted-foreground mb-1">目标岗位</label>
                <Input
                  id="filter-position"
                  placeholder="关键词"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-mode" className="block text-xs text-muted-foreground mb-1">改写模式</label>
                <select
                  id="filter-mode"
                  value={tailorMode}
                  onChange={(e) => setTailorMode(e.target.value)}
                  className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] cursor-pointer"
                >
                  <option value="">全部</option>
                  <option value="moderate">适中</option>
                  <option value="aggressive">激进</option>
                </select>
              </div>
            </>
          ) : project === "salary" ? (
            <>
              <div>
                <label htmlFor="filter-phone" className="block text-xs text-muted-foreground mb-1">手机号</label>
                <Input
                  id="filter-phone"
                  placeholder="关键词"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-position" className="block text-xs text-muted-foreground mb-1">岗位名称</label>
                <Input
                  id="filter-position"
                  placeholder="关键词"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-36 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </>
          ) : project === "hazard" ? (
            <>
              <div>
                <label htmlFor="filter-phone" className="block text-xs text-muted-foreground mb-1">手机号</label>
                <Input
                  id="filter-phone"
                  placeholder="关键词"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-position" className="block text-xs text-muted-foreground mb-1">检查场景</label>
                <Input
                  id="filter-position"
                  placeholder="如：医院 / 仓库"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-36 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label htmlFor="filter-name" className="block text-xs text-muted-foreground mb-1">姓名</label>
                <Input
                  id="filter-name"
                  placeholder="关键词"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-sm w-32 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>
              <div>
                <label htmlFor="filter-position" className="block text-xs text-muted-foreground mb-1">意向岗位</label>
                <Input
                  id="filter-position"
                  placeholder="关键词"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="h-8 text-sm w-36 bg-card text-foreground border border-input"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
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
          <Table className={project === "hazard" ? "table-fixed" : ""}>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground border-b border-[var(--report-border)]">
                {columns.map((c) => {
                  // hazard 表格：所有标题居中（语义对称）；
                  // 列宽显式定值，唯独"检查场景"留 auto，吃掉剩余空间——
                  // 数字/缩略图列保持紧凑（80-90px），居中后两侧空白可控；
                  // 多余空间集中在"检查场景"列内部，文字左对齐时右侧空白就像段落留白，自然。
                  const centered =
                    project === "hazard" ||
                    c === "操作" ||
                    c === "详情" ||
                    c === "转服务状态";
                  const width =
                    project === "hazard"
                      ? c === "时间"
                        ? "w-[140px]"
                        : c === "手机号"
                          ? "w-[130px]"
                          : c === "服务项目"
                            ? "w-[100px]"
                            : c === "识别条数"
                              ? "w-[90px]"
                              : c === "耗时"
                                ? "w-[80px]"
                                : c === "缩略图"
                                  ? "w-[90px]"
                                  : c === "操作"
                                    ? "w-[110px]"
                                    : "" // 检查场景留空，吃剩余空间
                      : "";
                  return (
                    <TableHead
                      key={c}
                      className={`${centered ? "text-center" : ""} ${width}`}
                    >
                      {c}
                    </TableHead>
                  );
                })}
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
                    startupReady={data?.startupReady ?? true}
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

  // salary / hazard 项目：报告总数 / 本月新增 / 本周新增 / 今日新增（同款 KPI）
  if (project === "salary" || project === "hazard") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DataCard
          label="报告总数"
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
          label="今日新增"
          value={data?.stats.todayCount}
          icon={Sparkles}
          loading={skeleton}
        />
      </div>
    );
  }

  // tailor 项目：报告总数 / 本月新增 / 本周新增 / 今日新增
  if (project === "tailor") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DataCard
          label="报告总数"
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
          label="今日新增"
          value={data?.stats.todayCount}
          icon={Sparkles}
          loading={skeleton}
        />
      </div>
    );
  }

  // nav / startup 项目：总报告数 / 本月新增 / 本周新增 / 转服务数量（KPI 结构相同）
  if (project === "nav" || project === "startup") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DataCard
          label="报告总数"
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

  // report / all：报告总数 / 本月新增 / 本周新增 / 今日新增
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <DataCard
        label="报告总数"
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
        label="今日新增"
        value={data?.stats.todayCount}
        icon={Sparkles}
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
  startupReady,
}: {
  row: ReportRow;
  project: ProjectFilter;
  onTransfer: (row: ReportRow) => void;
  navReady: boolean;
  startupReady: boolean;
}) {
  const durationCell = row.duration_ms
    ? `${Math.round(row.duration_ms / 1000)}s`
    : "—";

  // tab=startup：项目名称 + 启动资金 + 创业经验 + 转服务状态
  if (project === "startup") {
    const startupMeta = PROJECTS.startup;
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
        <TableCell>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--purple-700)]">
            <span className="size-1.5 rounded-full bg-[var(--purple-500)]" />
            {startupMeta.label}
          </span>
        </TableCell>
        <TableCell className="font-medium max-w-[140px] truncate">
          {row.project_name || row.target_position || "—"}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {row.startup_capital
            ? STARTUP_CAPITAL_LABELS[row.startup_capital] ?? row.startup_capital
            : "—"}
        </TableCell>
        <TableCell className="text-muted-foreground">
          {row.startup_experience
            ? STARTUP_EXPERIENCE_LABELS[row.startup_experience] ?? row.startup_experience
            : "—"}
        </TableCell>
        <TableCell className="text-center">
          <span
            title={transferred ? "已转入服务" : "未转入"}
            className={`inline-block size-3 rounded-full ${transferred ? "bg-[var(--semantic-positive)] shadow-[0_0_0_3px_oklch(0.72_0.18_155_/_0.22)]" : "bg-muted-foreground/40"}`}
          />
        </TableCell>
        <TableCell>
          <RowActions row={row} onTransfer={onTransfer} navReady={navReady} startupReady={startupReady} />
        </TableCell>
      </TableRow>
    );
  }

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
        <TableCell>
          <RowActions row={row} onTransfer={onTransfer} navReady={navReady} startupReady={startupReady} />
        </TableCell>
      </TableRow>
    );
  }

  // tab=salary：时间 / 手机号 / 服务项目 / 岗位名称 / 标准职级 / 企业性质 / 最高学历 / 所在城市 / 操作
  if (project === "salary") {
    const salaryMeta = PROJECTS.salary;
    return (
      <TableRow className="text-sm hover:bg-[var(--blue-50)]/40 transition-colors duration-150">
        <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
          {formatTs(row.created_at)}
        </TableCell>
        <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
          {row.user_phone || "—"}
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--cyan-700)]">
            <span className="size-1.5 rounded-full bg-[var(--cyan-500)]" />
            {salaryMeta.label}
          </span>
        </TableCell>
        <TableCell className="font-medium max-w-[140px] truncate">
          {row.target_position || "—"}
        </TableCell>
        <TableCell
          className="text-muted-foreground max-w-[180px] truncate"
          title={row.salary_rank_label || row.salary_rank || undefined}
        >
          {row.salary_rank_label || row.salary_rank || "—"}
        </TableCell>
        <TableCell className="text-muted-foreground max-w-[110px] truncate">
          {row.target_company || "—"}
        </TableCell>
        <TableCell className="text-muted-foreground max-w-[110px] truncate">
          {row.target_education || "—"}
        </TableCell>
        <TableCell className="text-muted-foreground max-w-[110px] truncate">
          {row.target_city_tier || "—"}
        </TableCell>
        <TableCell>
          <RowActions row={row} onTransfer={onTransfer} navReady={navReady} startupReady={startupReady} />
        </TableCell>
      </TableRow>
    );
  }

  // tab=hazard：时间 / 手机号 / 服务项目 / 检查场景 / 识别条数 / 耗时 / 缩略图 / 操作
  if (project === "hazard") {
    const hazardMeta = PROJECTS.hazard;
    const count = row.hazard_count ?? 0;
    return (
      <TableRow className="text-sm hover:bg-[var(--blue-50)]/40 transition-colors duration-150">
        <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
          {formatTs(row.created_at)}
        </TableCell>
        <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
          {row.user_phone || "—"}
        </TableCell>
        <TableCell>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--amber-700)]">
            <span className="size-1.5 rounded-full bg-[var(--amber-500)]" />
            {hazardMeta.label}
          </span>
        </TableCell>
        <TableCell
          className="font-medium truncate"
          title={row.scenario_label || row.scenario || undefined}
        >
          {row.scenario_label || row.target_position || "—"}
        </TableCell>
        <TableCell className="text-center tabular-nums text-foreground">
          {count}
        </TableCell>
        <TableCell className="text-center tabular-nums text-xs text-muted-foreground">
          {durationCell}
        </TableCell>
        <TableCell>
          <div className="flex items-center justify-center">
            <HazardThumb id={row.id} hasPhoto={!!row.has_photo} />
          </div>
        </TableCell>
        <TableCell>
          <RowActions row={row} onTransfer={onTransfer} navReady={navReady} startupReady={startupReady} />
        </TableCell>
      </TableRow>
    );
  }

  // tab=tailor：时间 / 姓名 / 手机号 / 服务项目 / 目标岗位 / 改写模式 / 操作
  if (project === "tailor") {
    const tailorMeta = PROJECTS.tailor;
    const modeLabel =
      row.tailor_mode === "moderate"
        ? "适中"
        : row.tailor_mode === "aggressive"
          ? "激进"
          : "—";
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
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--orange-700)]">
            <span className="size-1.5 rounded-full bg-[var(--orange-500)]" />
            {tailorMeta.label}
          </span>
        </TableCell>
        <TableCell className="font-medium max-w-[140px] truncate">
          {row.target_position || "—"}
        </TableCell>
        <TableCell className="text-muted-foreground">{modeLabel}</TableCell>
        <TableCell>
          <RowActions row={row} onTransfer={onTransfer} navReady={navReady} startupReady={startupReady} />
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
        <RowActions row={row} onTransfer={onTransfer} navReady={navReady} startupReady={startupReady} />
      </TableCell>
    </TableRow>
  );
}

/** 隐患识别列表缩略图。
 *  hasPhoto=false（老数据 / 入库前的记录）→ 灰底占位；
 *  hasPhoto=true → <img> 单独请求 /api/admin/reports/[id]/photo，点击新窗口看原图。
 *  loading=lazy + decoding=async，避免一次列表滚动炸 20 个图片请求。
 */
function HazardThumb({ id, hasPhoto }: { id: number; hasPhoto: boolean }) {
  if (!hasPhoto) {
    return (
      <span
        title="此条报告无原图（早于本次接入）"
        className="inline-flex items-center justify-center size-12 rounded-md bg-muted text-muted-foreground/60 ring-1 ring-border"
      >
        <ImageOff className="size-4" />
      </span>
    );
  }
  const src = withBase(`/api/admin/reports/${id}/photo?project=hazard`);
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      title="点击查看原图"
      className="inline-block size-12 rounded-md overflow-hidden ring-1 ring-border bg-muted hover:ring-[var(--amber-300)] transition-shadow"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 动态 API 路由，next/image 优化没意义且要白名单 */}
      <img
        src={src}
        alt="隐患照片缩略图"
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover"
      />
    </a>
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
  startupReady,
}: {
  row: ReportRow;
  onTransfer: (row: ReportRow) => void;
  navReady: boolean;
  startupReady: boolean;
}) {
  // nav / startup 行均支持「转服务」按钮（v1 决策）
  const supportsTransfer = row.project === "nav" || row.project === "startup";
  const dbReady =
    row.project === "nav" ? navReady : row.project === "startup" ? startupReady : false;
  const canTransfer = supportsTransfer && dbReady;
  const transferred = row.tracking_id != null;
  // hazard 报告内嵌在档案页中，列表无需独立的"报告"按钮入口
  const showReportButton = row.project !== "hazard";
  return (
    <div className="flex items-center justify-center gap-2">
      {showReportButton && (
        <Link
          href={`/admin/reports/${row.id}/preview?project=${row.project}`}
          target="_blank"
          className={`${ACTION_BTN_BASE} ${ACTION_BTN_NEUTRAL}`}
        >
          报告
        </Link>
      )}
      <Link
        href={`/admin/reports/${row.id}?project=${row.project}`}
        className={`${ACTION_BTN_BASE} ${ACTION_BTN_NEUTRAL}`}
      >
        档案
      </Link>
      {supportsTransfer && (
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
  // salary / hazard 没有姓名，主标识用手机号；其它项目主标识用姓名 + 副位手机号
  const noNameProject = row.project === "salary" || row.project === "hazard";
  const primary = noNameProject
    ? row.user_phone || "—"
    : row.user_name || "—";
  const secondary = row.project === "salary"
    ? (row.target_company || "—")
    : row.project === "hazard"
      ? (row.hazard_count != null ? `${row.hazard_count} 条隐患` : "—")
      : (row.user_phone || "—");
  return (
    <Link
      href={`/admin/reports/${row.id}?project=${row.project}`}
      className="block p-4 hover:bg-[var(--blue-50)]/40 active:bg-[var(--blue-100)]/50 transition-colors"
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-medium text-foreground truncate min-w-0 tabular-nums">
          {primary}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
          {secondary}
        </span>
      </div>
      <div className="text-sm text-foreground truncate mb-1.5">
        {row.project === "hazard" ? (row.scenario_label || row.target_position) : row.target_position}
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
          {(row.project === "nav" || row.project === "startup") && (
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
