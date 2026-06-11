"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import {
  Briefcase,
  Compass,
  Rocket,
  FilePen,
  Coins,
  AlertTriangle,
  Mic,
  Presentation,
  LogOut,
  Users,
  ShieldCheck,
  LifeBuoy,
  GraduationCap,
  Crown,
  FolderLock,
  ClipboardList,
  Sun,
  Moon,
  Laptop,
  Home,
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import { PROJECTS, type ProjectId } from "@/lib/projects";
import { useTheme, type Theme } from "./theme-provider";
import { withBase } from "@/lib/url";

type ProjectFilter = "all" | ProjectId;

interface MeData {
  name: string;
  username: string;
  isSuper: boolean;
  showAll: boolean;
  visibleProjects: string[];
  showService: boolean;
  showCoursewareUsers: boolean;
  showAsgMembers: boolean;
  showAsgDocuments: boolean;
  showAtaMembers: boolean;
  showAdmins: boolean;
}

/** 图标映射：project id → icon component */
const PROJECT_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  report: Briefcase,
  nav: Compass,
  startup: Rocket,
  tailor: FilePen,
  salary: Coins,
  hazard: AlertTriangle,
  interview: Mic,
  teaching: Presentation,
};

/** me.visibleProjects 加载前的兜底（与 PROJECTS 的 key 顺序一致） */
const FALLBACK_PROJECTS = ["report", "nav", "startup", "tailor", "salary", "hazard", "interview", "teaching"];

/** 从 /api/admin/me 获取当前用户数据。加载中返回 null。
 *  登录页跳过 fetch — 避免匿名用户的 401 console 噪音 + 多一次 RT。 */
function useAdminMe() {
  const pathname = usePathname();
  const onLoginPage = pathname.replace(/\/$/, "") === "/admin/login";
  const [data, setData] = useState<MeData | null>(null);
  useEffect(() => {
    if (onLoginPage) return;
    fetch(withBase("/api/admin/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [onLoginPage]);
  return data;
}

export function AdminSidebar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const me = useAdminMe();

  const currentProject = (searchParams.get("project") ?? "report") as ProjectFilter;

  // trailingSlash:true 时 pathname 是 "/admin/login/"，剥掉尾斜杠再比
  if (pathname.replace(/\/$/, "") === "/admin/login") return null;

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch(withBase("/api/admin/logout"), { method: "POST" });
      window.location.href = withBase("/admin/login");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <>
      <aside className="hidden md:flex md:flex-col md:w-60 lg:w-64 shrink-0 border-r border-sidebar-border bg-sidebar">
        {/* === Logo block — 标志性 brand mark === */}
        <div className="px-5 pt-5 pb-4">
          <Link
            href="/admin/reports"
            className="flex items-center gap-3 rounded-xl px-1 py-1 -mx-1 hover:bg-[oklch(0.97_0.02_252_/_0.6)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
          >
            <div className="size-9 rounded-xl bg-gradient-to-br from-[var(--blue-600)] to-[var(--blue-700)] flex items-center justify-center shadow-[0_4px_12px_oklch(0.55_0.2_252_/_0.3),inset_0_1px_0_oklch(1_0_0_/_0.2)] shrink-0">
              <ShieldCheck className="size-4.5 text-white" strokeWidth={2.4} />
            </div>
            <div className="leading-tight min-w-0">
              <div className="text-[15px] font-semibold tracking-tight text-[var(--navy-900)] truncate">
                谨世 ATA
              </div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--blue-600)] font-medium">
                admin&nbsp;hub
              </div>
            </div>
          </Link>
        </div>

        {/* === 用户卡 + 主题切换 === */}
        <div className="px-3 pb-3">
          {/* 用户身份块 — monogram + 名字 + 右侧 LogOut */}
          <div className="px-2 py-2 flex items-center gap-3 mb-2 rounded-xl bg-[oklch(0.97_0.02_252_/_0.4)]">
            <div className="relative shrink-0">
              <div className="size-9 rounded-xl bg-gradient-to-br from-[var(--blue-100)] to-[var(--blue-50)] text-[var(--blue-700)] flex items-center justify-center text-sm font-semibold ring-1 ring-[var(--blue-200)]/60 shadow-sm">
                {me?.name?.slice(0, 1) ?? "—"}
              </div>
              {me?.isSuper && (
                <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-card shadow-sm flex items-center justify-center ring-1 ring-[var(--blue-200)]/60">
                  <ShieldCheck className="size-2.5 text-[var(--blue-700)]" strokeWidth={2.5} />
                </div>
              )}
            </div>
            <div className="min-w-0 leading-tight flex-1">
              <div className="text-[13px] font-medium text-[var(--navy-900)] truncate flex items-center gap-1.5">
                {me?.name ?? "—"}
                {me?.isSuper && (
                  <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--blue-700)] bg-[var(--blue-50)] px-1.5 py-0.5 rounded-md ring-1 ring-[var(--blue-200)]/50">
                    超管
                  </span>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                {me?.username
                  ? `${me.username.slice(0, 3)} •••• ${me.username.slice(-4)}`
                  : ""}
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title={loggingOut ? "登出中…" : "登出"}
              aria-label="登出"
              className="shrink-0 size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] cursor-pointer"
            >
              <LogOut className="size-3.5" strokeWidth={2} />
            </button>
          </div>

          <ThemeSwitcher />
        </div>

        <div className="px-5 mb-1">
          <div className="h-px bg-[oklch(0.93_0.006_240)]" />
        </div>

        {/* === 首页 — 常驻顶部入口 === */}
        <nav className="px-3 pt-3 flex flex-col gap-0.5">
          <SidebarNavItem
            label="首页"
            icon={Home}
            active={pathname === "/admin/home" || pathname === "/admin/home/"}
            href="/admin/home"
          />
        </nav>

        {/* === 报告管理 section === */}
        <SectionHeader label="报告管理" />
        <nav className="px-3 flex flex-col gap-0.5">
          {(!me ? FALLBACK_PROJECTS : me.visibleProjects).map(
            (pid) => {
              const meta = PROJECTS[pid as keyof typeof PROJECTS];
              if (!meta) return null;
              const Icon = PROJECT_ICONS[pid] ?? Briefcase;
              return (
                <SidebarNavItem
                  key={pid}
                  label={meta.label}
                  icon={Icon}
                  active={
                    currentProject === pid && pathname === "/admin/reports"
                  }
                  href={`/admin/reports?project=${pid}`}
                />
              );
            }
          )}
        </nav>

        {/* === 服务管理 section === */}
        {(!me || me.showService || me.showCoursewareUsers || me.showAsgDocuments) && (
          <>
            <SectionHeader label="服务管理" />
            <nav className="px-3 flex flex-col gap-0.5">
              {(!me || me.showService) && (
                <SidebarNavItem
                  label="服务跟踪"
                  icon={LifeBuoy}
                  active={pathname.startsWith("/admin/service-tracking")}
                  href="/admin/service-tracking"
                />
              )}
              {(!me || me.showCoursewareUsers) && (
                <SidebarNavItem
                  label="课件用户"
                  icon={GraduationCap}
                  active={pathname.startsWith("/admin/courseware-users")}
                  href="/admin/courseware-users"
                />
              )}
              {(!me || me.showAsgDocuments) && (
                <SidebarNavItem
                  label="文档资料"
                  icon={FolderLock}
                  active={pathname.startsWith("/admin/asg-documents")}
                  href="/admin/asg-documents"
                />
              )}
            </nav>
          </>
        )}

        {/* === 系统管理 section === */}
        {(!me || me.showAdmins || me.showAsgMembers || me.showAtaMembers) && (
          <>
            <SectionHeader label="系统管理" />
            <nav className="px-3 flex flex-col gap-0.5">
              {(!me || me.showAdmins) && (
                <SidebarNavItem
                  label="管理员管理"
                  icon={Users}
                  active={pathname.startsWith("/admin/admins")}
                  href="/admin/admins"
                />
              )}
              {(!me || me.showAdmins) && (
                <SidebarNavItem
                  label="隐患检查项"
                  icon={ClipboardList}
                  active={pathname.startsWith("/admin/hazard-checklist")}
                  href="/admin/hazard-checklist"
                />
              )}
              {(!me || me.showAdmins) && (
                <SidebarNavItem
                  label="系统设置"
                  icon={Settings}
                  active={pathname.startsWith("/admin/site-settings")}
                  href="/admin/site-settings"
                />
              )}
              {(!me || me.showAsgMembers) && (
                <SidebarNavItem
                  label="安防平台用户"
                  icon={Crown}
                  active={pathname.startsWith("/admin/asg-members")}
                  href="/admin/asg-members"
                />
              )}
              {(!me || me.showAtaMembers) && (
                <SidebarNavItem
                  label="薪资查询用户"
                  icon={Crown}
                  active={pathname.startsWith("/admin/ata-members")}
                  href="/admin/ata-members"
                />
              )}
            </nav>
          </>
        )}

      </aside>
    </>
  );
}

/** 三段切换：浅色 / 暗色 / 跟随系统 */
function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const options: { value: Theme; icon: typeof Sun; title: string }[] = [
    { value: "light", icon: Sun, title: "浅色" },
    { value: "dark", icon: Moon, title: "暗色" },
    { value: "system", icon: Laptop, title: "跟随系统" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="主题"
      className="mb-1.5 px-2 py-1 grid grid-cols-3 gap-1 rounded-lg bg-[oklch(0.97_0.02_252_/_0.4)] dark:bg-[oklch(1_0_0_/_0.04)]"
    >
      {options.map(({ value, icon: Icon, title }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            title={title}
            onClick={() => setTheme(value)}
            className={`h-7 flex items-center justify-center rounded-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30 ${
              active
                ? "bg-white text-[var(--blue-700)] shadow-sm ring-1 ring-[var(--blue-200)]/60 dark:bg-white/10 dark:text-white dark:ring-white/15"
                : "text-muted-foreground hover:text-foreground dark:text-white/50 dark:hover:text-white/80"
            }`}
          >
            <Icon className="size-3.5" strokeWidth={active ? 2.4 : 2} />
          </button>
        );
      })}
    </div>
  );
}

/** 分组标题 — 全大写小字 + 间距 */
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-5 pt-5 pb-1.5">
      <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
        {label}
      </div>
    </div>
  );
}

/** 单行 nav item — 激活态：左侧 accent bar + 蓝色文字 + 微 bg */
function SidebarNavItem({
  label,
  icon: Icon,
  active,
  href,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`
        relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13.5px] transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]
        ${
          active
            ? "bg-[oklch(0.96_0.03_252)] text-[var(--blue-700)] font-medium shadow-[inset_0_0_0_1px_oklch(0.87_0.07_252_/_0.4)]"
            : "text-muted-foreground hover:bg-[oklch(0.97_0.02_252_/_0.5)] hover:text-[var(--navy-800)]"
        }
      `}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-[var(--blue-700)]"
        />
      )}
      <Icon
        className={`size-4 transition-colors ${active ? "text-[var(--blue-700)]" : "text-muted-foreground group-hover:text-foreground"}`}
        strokeWidth={active ? 2.4 : 2}
      />
      <span className="flex-1">{label}</span>
    </Link>
  );
}

/** Mobile top bar — 移动端折叠成顶部小条，同样按权限过滤 */
export function AdminMobileBar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const me = useAdminMe();

  const currentProject = (searchParams.get("project") ?? "report") as ProjectFilter;

  // trailingSlash:true 时 pathname 是 "/admin/login/"，剥掉尾斜杠再比
  if (pathname.replace(/\/$/, "") === "/admin/login") return null;

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch(withBase("/api/admin/logout"), { method: "POST" });
      window.location.href = withBase("/admin/login");
    } catch {
      setLoggingOut(false);
    }
  }

  // 在 me 加载前显示骨架（loading 状态）
  const visibleProjects: string[] = me ? me.visibleProjects : FALLBACK_PROJECTS;
  const showService = !me || me.showService;
  const showCoursewareUsers = !me || me.showCoursewareUsers;
  const showAsgMembers = !me || me.showAsgMembers;
  const showAsgDocuments = !me || me.showAsgDocuments;
  const showAtaMembers = !me || me.showAtaMembers;
  const inServiceTracking = pathname.startsWith("/admin/service-tracking");
  const inCoursewareUsers = pathname.startsWith("/admin/courseware-users");
  const inAsgMembers = pathname.startsWith("/admin/asg-members");
  const inAsgDocuments = pathname.startsWith("/admin/asg-documents");
  const inAtaMembers = pathname.startsWith("/admin/ata-members");

  return (
    <>
      <div className="md:hidden border-b border-sidebar-border bg-sidebar px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
        <Link
          href="/admin/reports"
          className="flex items-center gap-2 font-semibold shrink-0"
        >
          <div className="size-7 rounded-xl bg-gradient-to-br from-[var(--blue-600)] to-[var(--blue-700)] flex items-center justify-center shadow-sm">
            <ShieldCheck className="size-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[13.5px] tracking-tight text-[var(--navy-900)]">
            谨世 ATA
          </span>
        </Link>
        <div className="h-4 w-px bg-border shrink-0" />
        <div className="flex gap-1.5 shrink-0 overflow-x-auto">
          <MobilePill
            href="/admin/home"
            active={pathname === "/admin/home" || pathname === "/admin/home/"}
            label="首页"
          />
          {visibleProjects.map((pid) => {
            const meta = PROJECTS[pid as keyof typeof PROJECTS];
            if (!meta) return null;
            return (
              <MobilePill
                key={pid}
                href={`/admin/reports?project=${pid}`}
                active={currentProject === pid && !inServiceTracking}
                label={meta.label}
              />
            );
          })}
          {showService && (
            <MobilePill
              href="/admin/service-tracking"
              active={inServiceTracking}
              label="服务跟踪"
            />
          )}
          {showCoursewareUsers && (
            <MobilePill
              href="/admin/courseware-users"
              active={inCoursewareUsers}
              label="课件用户"
            />
          )}
          {showAsgDocuments && (
            <MobilePill
              href="/admin/asg-documents"
              active={inAsgDocuments}
              label="文档资料"
            />
          )}
          {showAsgMembers && (
            <MobilePill
              href="/admin/asg-members"
              active={inAsgMembers}
              label="安防平台用户"
            />
          )}
          {showAtaMembers && (
            <MobilePill
              href="/admin/ata-members"
              active={inAtaMembers}
              label="薪资查询用户"
            />
          )}
        </div>
        {/* 右侧操作：退出登录 */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 cursor-pointer transition-colors"
            aria-label="退出登录"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

function MobilePill({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-colors ${
        active
          ? "bg-[var(--blue-50)] text-[var(--blue-700)] font-medium ring-1 ring-[var(--blue-200)]/60"
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}
