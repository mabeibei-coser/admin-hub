"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import {
  Briefcase,
  Compass,
  LogOut,
  Users,
  KeyRound,
  ShieldCheck,
  LifeBuoy,
} from "lucide-react";
import { useState, useEffect } from "react";
import { PROJECTS } from "@/lib/projects";
import { ChangePasswordDialog } from "./change-password-dialog";
import { withBase } from "@/lib/url";

type ProjectFilter = "all" | "report" | "nav";

interface MeData {
  name: string;
  username: string;
  isSuper: boolean;
  showAll: boolean;
  visibleProjects: string[];
  showService: boolean;
  showAdmins: boolean;
}

/** 图标映射：project id → icon component */
const PROJECT_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  report: Briefcase,
  nav: Compass,
};

/** 从 /api/admin/me 获取当前用户数据。加载中返回 null。 */
function useAdminMe() {
  const [data, setData] = useState<MeData | null>(null);
  useEffect(() => {
    fetch(withBase("/api/admin/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, []);
  return data;
}

export function AdminSidebar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
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
      <ChangePasswordDialog
        open={pwdDialogOpen}
        onClose={() => setPwdDialogOpen(false)}
      />

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

        <div className="px-5 mb-1">
          <div className="h-px bg-[oklch(0.93_0.006_240)]" />
        </div>

        {/* === 报告管理 section === */}
        <SectionHeader label="报告管理" />
        <nav className="px-3 flex flex-col gap-0.5">
          {(!me ? (["report", "nav"] as string[]) : me.visibleProjects).map(
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
        {(!me || me.showService) && (
          <>
            <SectionHeader label="服务管理" />
            <nav className="px-3 flex flex-col gap-0.5">
              <SidebarNavItem
                label="服务跟踪"
                icon={LifeBuoy}
                active={pathname.startsWith("/admin/service-tracking")}
                href="/admin/service-tracking"
              />
            </nav>
          </>
        )}

        {/* === 系统管理 section — 仅超管可见 === */}
        {(!me || me.showAdmins) && (
          <>
            <SectionHeader label="系统管理" />
            <nav className="px-3 flex flex-col gap-0.5">
              <SidebarNavItem
                label="管理员管理"
                icon={Users}
                active={pathname.startsWith("/admin/admins")}
                href="/admin/admins"
              />
            </nav>
          </>
        )}

        {/* === Bottom: 用户卡 + 操作 === */}
        <div className="mt-auto p-3 pt-4 border-t border-[oklch(0.93_0.006_240)]">
          {/* 用户身份块 — monogram + status dot */}
          <div className="px-2 py-2 flex items-center gap-3 mb-2 rounded-xl bg-[oklch(0.97_0.02_252_/_0.4)]">
            <div className="relative shrink-0">
              <div className="size-9 rounded-xl bg-gradient-to-br from-[var(--blue-100)] to-[var(--blue-50)] text-[var(--blue-700)] flex items-center justify-center text-sm font-semibold ring-1 ring-[var(--blue-200)]/60 shadow-sm">
                {me?.name?.slice(0, 1) ?? "—"}
              </div>
              {me?.isSuper && (
                <div className="absolute -bottom-1 -right-1 size-4 rounded-full bg-white shadow-sm flex items-center justify-center ring-1 ring-[var(--blue-200)]/60">
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
              <div className="text-[10px] text-gray-400 tabular-nums mt-0.5">
                {me?.username
                  ? `${me.username.slice(0, 3)} •••• ${me.username.slice(-4)}`
                  : ""}
              </div>
            </div>
          </div>

          <button
            onClick={() => setPwdDialogOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-600 hover:bg-[oklch(0.97_0.02_252_/_0.5)] hover:text-[var(--navy-800)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
          >
            <KeyRound className="size-4 text-gray-400" />
            修改密码
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] text-gray-600 hover:bg-[oklch(0.97_0.02_252_/_0.5)] hover:text-[var(--navy-800)] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
          >
            <LogOut className="size-4 text-gray-400" />
            {loggingOut ? "登出中…" : "登出"}
          </button>
        </div>
      </aside>
    </>
  );
}

/** 分组标题 — 全大写小字 + 间距 */
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-5 pt-5 pb-1.5">
      <div className="text-[10px] uppercase tracking-[0.14em] text-gray-400 font-semibold">
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
            : "text-gray-600 hover:bg-[oklch(0.97_0.02_252_/_0.5)] hover:text-[var(--navy-800)]"
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
        className={`size-4 transition-colors ${active ? "text-[var(--blue-700)]" : "text-gray-400 group-hover:text-gray-600"}`}
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
  const [pwdDialogOpen, setPwdDialogOpen] = useState(false);
  const me = useAdminMe();

  const currentProject = (searchParams.get("project") ?? "report") as ProjectFilter;

  // trailingSlash:true 时 pathname 是 "/admin/login/"，剥掉尾斜杠再比
  if (pathname.replace(/\/$/, "") === "/admin/login") return null;

  // 在 me 加载前显示骨架（loading 状态）
  const visibleProjects: string[] = me ? me.visibleProjects : ["report", "nav"];
  const showService = !me || me.showService;
  const inServiceTracking = pathname.startsWith("/admin/service-tracking");

  return (
    <>
      <ChangePasswordDialog
        open={pwdDialogOpen}
        onClose={() => setPwdDialogOpen(false)}
      />
      <div className="md:hidden border-b border-sidebar-border bg-sidebar px-4 py-2.5 flex items-center gap-3 overflow-x-auto">
        <Link
          href="/admin/reports"
          className="flex items-center gap-2 font-semibold shrink-0"
        >
          <div className="size-6 rounded-lg bg-gradient-to-br from-[var(--blue-600)] to-[var(--blue-700)] flex items-center justify-center shadow-sm">
            <ShieldCheck className="size-3 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-[13.5px] tracking-tight text-[var(--navy-900)]">
            谨世 ATA
          </span>
        </Link>
        <div className="h-4 w-px bg-gray-200 shrink-0" />
        <div className="flex gap-1 shrink-0 overflow-x-auto">
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
        </div>
        {/* 修改密码 — 右侧图标按钮 */}
        <button
          onClick={() => setPwdDialogOpen(true)}
          className="ml-auto shrink-0 size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-[var(--blue-50)]/60"
          aria-label="修改密码"
        >
          <KeyRound className="size-3.5" />
        </button>
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
          : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}
