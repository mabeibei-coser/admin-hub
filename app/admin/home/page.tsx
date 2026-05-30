"use client";

/**
 * 后台首页 — 登录后的默认落地页。
 *
 * 设计意图（macOS 系统偏好 / Notion 设置页 风格）：
 * 1. List 形式而不是 cards grid — 7 个项目权限 + 3 个其他模块都是 list rows，
 *    不再做"卡片矩阵"，避免 SaaS landing 的 AI 感
 * 2. 装饰只保留每行左侧的项目色色点 — 不要 icon gradient bg / ring / glow
 * 3. Hero 极简：问候 + 名字 + 一行 meta（时间 · 角色），不再有 eyebrow / 渐变线 / 数字 KPI 卡
 * 4. 权限差异通过 list 长度自然体现（少权限的人看到的 list 短）
 * 5. 修改密码用 ChangePasswordDialog；操作手册做"筹备中"占位 link
 *    退出登录不在首页（sidebar 已有，避免重复入口）
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Compass,
  Rocket,
  FilePen,
  Coins,
  AlertTriangle,
  Mic,
  Presentation,
  LifeBuoy,
  Users,
  ClipboardList,
  KeyRound,
  BookOpen,
  ArrowRight,
  Lock,
} from "lucide-react";
import { PROJECTS, type ProjectId } from "@/lib/projects";
import { ChangePasswordDialog } from "@/components/admin/change-password-dialog";
import { withBase } from "@/lib/url";

interface MeData {
  adminId: number;
  username: string;
  name: string;
  isSuper: boolean;
  showAll: boolean;
  visibleProjects: ProjectId[];
  showService: boolean;
  showAdmins: boolean;
}

interface ProjectStats {
  total?: number;
  todayCount?: number;
}

const PROJECT_ICONS: Record<ProjectId, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  report: Briefcase,
  nav: Compass,
  startup: Rocket,
  tailor: FilePen,
  salary: Coins,
  hazard: AlertTriangle,
  interview: Mic,
  teaching: Presentation,
};

/** 项目色 → 色点 + 文字配色（只用 token 变量，避免硬编码） */
const PROJECT_DOT: Record<string, { dot: string; text: string }> = {
  blue: { dot: "bg-[var(--blue-500)]", text: "text-[var(--blue-700)]" },
  green: { dot: "bg-[var(--semantic-positive)]", text: "text-[var(--semantic-positive)]" },
  purple: { dot: "bg-[var(--purple-500)]", text: "text-[var(--purple-700)]" },
  orange: { dot: "bg-[var(--orange-500)]", text: "text-[var(--orange-700)]" },
  cyan: { dot: "bg-[var(--cyan-500)]", text: "text-[var(--cyan-700)]" },
  amber: { dot: "bg-[var(--amber-500)]", text: "text-[var(--amber-700)]" },
  rose: { dot: "bg-[var(--rose-500)]", text: "text-[var(--rose-700)]" },
  indigo: { dot: "bg-[var(--indigo-500)]", text: "text-[var(--indigo-700)]" },
};

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 11) return "早上好";
  if (hour >= 11 && hour < 13) return "中午好";
  if (hour >= 13 && hour < 18) return "下午好";
  if (hour >= 18 && hour < 23) return "晚上好";
  return "夜深了";
}

function formatDate(d: Date): string {
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${week}`;
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminHomePage() {
  const [me, setMe] = useState<MeData | null>(null);
  const [meError, setMeError] = useState<string | null>(null);
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, ProjectStats>>({});

  useEffect(() => {
    fetch(withBase("/api/admin/me"))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: MeData) => setMe(d))
      .catch(() => setMeError("加载用户信息失败"));
  }, []);

  // 时间 — mount 后才设，避免 SSR/CSR hydration 不一致
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // 并发拉当前用户能看到的项目 stats（pageSize=1 只为拿 stats）
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        me.visibleProjects.map(async (pid) => {
          try {
            const res = await fetch(
              withBase(`/api/admin/reports?project=${pid}&page=1&pageSize=1`)
            );
            if (!res.ok) return [pid, {}] as const;
            const json = (await res.json()) as { stats?: ProjectStats };
            return [pid, json.stats ?? {}] as const;
          } catch {
            return [pid, {}] as const;
          }
        })
      );
      if (cancelled) return;
      setStatsMap(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [me]);

  const greeting = useMemo(() => (now ? getGreeting(now.getHours()) : "你好"), [now]);

  const todayTotal = useMemo(
    () => Object.values(statsMap).reduce((s, x) => s + (x.todayCount ?? 0), 0),
    [statsMap]
  );
  const grandTotal = useMemo(
    () => Object.values(statsMap).reduce((s, x) => s + (x.total ?? 0), 0),
    [statsMap]
  );

  return (
    <div className="px-6 py-10 sm:py-14">
      <ChangePasswordDialog
        open={pwdDialogOpen}
        onClose={() => setPwdDialogOpen(false)}
      />

      <div className="max-w-3xl mx-auto">
        {/* ============ Hero · 极简问候 ============ */}
        <header className="mb-12 sm:mb-16">
          <h1 className="text-[40px] sm:text-[48px] font-semibold text-[var(--navy-900)] tracking-[-0.025em] leading-[1.05]">
            {greeting}
            {me?.name && (
              <span className="text-muted-foreground/70 font-normal">，</span>
            )}
            {me?.name && (
              <span className="text-[var(--navy-900)]">{me.name}</span>
            )}
          </h1>
          <div className="mt-4 flex items-center flex-wrap gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
            {me && (
              <span>
                {me.isSuper ? (
                  <span className="text-[var(--blue-700)] font-medium">超级管理员</span>
                ) : (
                  <span>管理员</span>
                )}
              </span>
            )}
            {now && (
              <>
                <Dot />
                <span className="tabular-nums">
                  {formatDate(now)} · {formatTime(now)}
                </span>
              </>
            )}
            {me && me.visibleProjects.length > 0 && (
              <>
                <Dot />
                <span className="tabular-nums">
                  今日新增 {todayTotal} · 共 {grandTotal} 份报告
                </span>
              </>
            )}
          </div>
        </header>

        {meError && (
          <div className="mb-10 text-sm text-[var(--semantic-danger)] flex items-center gap-2">
            <AlertTriangle className="size-4" />
            {meError}，请刷新页面重试
          </div>
        )}

        {/* ============ 报告管理 list ============ */}
        <Section title="报告管理">
          {!me ? (
            <SkeletonList count={3} />
          ) : me.visibleProjects.length === 0 ? (
            <EmptyState>还没有分配项目权限，请联系超管开通</EmptyState>
          ) : (
            <List>
              {me.visibleProjects.map((pid) => {
                const meta = PROJECTS[pid];
                if (!meta) return null;
                const Icon = PROJECT_ICONS[pid] ?? Briefcase;
                const palette = PROJECT_DOT[meta.color] ?? PROJECT_DOT.blue;
                const stat = statsMap[pid];
                return (
                  <ListRow
                    key={pid}
                    href={`/admin/reports?project=${pid}`}
                    icon={Icon}
                    title={meta.label}
                    description={meta.description ?? ""}
                    dotClass={palette.dot}
                    iconTextClass={palette.text}
                    value={typeof stat?.total === "number" ? String(stat.total) : "—"}
                    valueHint={
                      typeof stat?.todayCount === "number" && stat.todayCount > 0
                        ? `+${stat.todayCount}`
                        : null
                    }
                  />
                );
              })}
            </List>
          )}
        </Section>

        {/* ============ 服务与系统 list ============ */}
        {(me?.showService || me?.showAdmins) && (
          <Section title="服务与系统">
            <List>
              {me.showService && (
                <ListRow
                  href="/admin/service-tracking"
                  icon={LifeBuoy}
                  title="服务跟踪"
                  description="咨询服务持续跟进记录"
                  dotClass="bg-muted-foreground/40"
                  iconTextClass="text-muted-foreground"
                />
              )}
              {me.showAdmins && (
                <>
                  <ListRow
                    href="/admin/admins"
                    icon={Users}
                    title="管理员管理"
                    description="增删管理员、调整权限"
                    dotClass="bg-muted-foreground/40"
                    iconTextClass="text-muted-foreground"
                    badge="超管"
                  />
                  <ListRow
                    href="/admin/hazard-checklist"
                    icon={ClipboardList}
                    title="隐患检查项"
                    description="维护隐患识别的检查清单"
                    dotClass="bg-muted-foreground/40"
                    iconTextClass="text-muted-foreground"
                    badge="超管"
                  />
                </>
              )}
            </List>
          </Section>
        )}

        {/* ============ 账户 ============ */}
        <Section title="账户">
          <div className="flex flex-wrap gap-x-6 gap-y-3 text-[13.5px] pt-1">
            <button
              type="button"
              onClick={() => setPwdDialogOpen(true)}
              className="group inline-flex items-center gap-2 text-[var(--navy-800)] hover:text-[var(--blue-700)] transition-colors focus-visible:outline-none focus-visible:underline underline-offset-4 cursor-pointer"
            >
              <KeyRound className="size-4 text-muted-foreground group-hover:text-[var(--blue-700)] transition-colors" strokeWidth={1.8} />
              修改密码
            </button>
            <span
              className="inline-flex items-center gap-2 text-muted-foreground/70 cursor-not-allowed"
              title="操作手册筹备中"
            >
              <BookOpen className="size-4" strokeWidth={1.8} />
              操作手册
              <span className="inline-flex items-center gap-0.5 text-[10.5px] uppercase tracking-wider text-muted-foreground/80 bg-muted px-1.5 py-px rounded">
                <Lock className="size-2.5" strokeWidth={2.4} />
                筹备中
              </span>
            </span>
          </div>
        </Section>

        {/* 底部 footer */}
        <footer className="mt-16 pt-6 border-t border-[var(--report-divider)] flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
          <span>© {new Date().getFullYear()} 谨世 ATA · admin-hub</span>
          {process.env.NEXT_PUBLIC_APP_VERSION && (
            <>
              <Dot subtle />
              <span className="tabular-nums">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

/* ============ 子组件 ============ */

function Dot({ subtle = false }: { subtle?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-1 rounded-full ${subtle ? "bg-muted-foreground/40" : "bg-muted-foreground/50"}`}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10 sm:mb-12">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-[var(--report-divider)] border-y border-[var(--report-divider)]">
      {children}
    </ul>
  );
}

interface ListRowProps {
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  dotClass: string;
  iconTextClass: string;
  value?: string;
  valueHint?: string | null;
  badge?: string;
}

function ListRow({
  href,
  icon: Icon,
  title,
  description,
  dotClass,
  iconTextClass,
  value,
  valueHint,
  badge,
}: ListRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 py-3.5 px-2 -mx-2 rounded-md hover:bg-[oklch(0.97_0.02_252_/_0.5)] transition-colors focus-visible:outline-none focus-visible:bg-[oklch(0.97_0.02_252_/_0.5)] focus-visible:ring-1 focus-visible:ring-[var(--blue-300)]"
      >
        {/* 项目色点 — 唯一的色彩信号 */}
        <span
          aria-hidden
          className={`size-1.5 rounded-full shrink-0 ${dotClass}`}
        />
        {/* 细线 icon — 不带 bg / ring / glow */}
        <Icon
          className={`size-[18px] shrink-0 ${iconTextClass}`}
          strokeWidth={1.8}
        />
        <div className="flex-1 min-w-0 flex items-baseline gap-2.5">
          <span className="text-[14.5px] font-medium text-[var(--navy-900)] tracking-tight">
            {title}
          </span>
          <span className="text-[12.5px] text-muted-foreground truncate">
            {description}
          </span>
          {badge && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 bg-muted px-1.5 py-px rounded shrink-0">
              {badge}
            </span>
          )}
        </div>
        {value !== undefined && (
          <div className="shrink-0 flex items-baseline gap-1.5 tabular-nums">
            {valueHint && (
              <span className="text-[11px] text-[var(--semantic-positive)] font-medium">
                {valueHint}
              </span>
            )}
            <span className="text-[15px] font-medium text-[var(--navy-800)]">
              {value}
            </span>
          </div>
        )}
        <ArrowRight
          className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-[var(--blue-700)] group-hover:translate-x-0.5 transition-all"
          strokeWidth={2}
        />
      </Link>
    </li>
  );
}

function SkeletonList({ count }: { count: number }) {
  return (
    <ul className="divide-y divide-[var(--report-divider)] border-y border-[var(--report-divider)]">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 py-3.5 px-2">
          <span className="size-1.5 rounded-full bg-muted" />
          <span className="size-[18px] rounded bg-muted" />
          <span className="flex-1 h-3.5 bg-muted rounded animate-pulse max-w-xs" />
          <span className="size-3 bg-muted rounded animate-pulse" />
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-8 text-center text-[13px] text-muted-foreground border-y border-[var(--report-divider)]">
      {children}
    </div>
  );
}
