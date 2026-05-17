"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import {
  LayoutGrid,
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
const PROJECT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
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

  const currentProject = (searchParams.get("project") ?? "all") as ProjectFilter;

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

      <aside className="hidden md:flex md:flex-col md:w-56 lg:w-60 shrink-0 border-r border-gray-200 bg-white">
        {/* Logo: 圆点 + 文字 + 账号尾号 */}
        <div className="px-5 py-4 border-b border-gray-100">
          <Link
            href="/admin/reports"
            className="flex items-center gap-2.5 font-semibold"
          >
            <div className="size-1.5 rounded-full bg-[var(--blue-700)] shrink-0" />
            <div className="leading-tight">
              <div className="text-sm tracking-tight text-[var(--navy-800)]">
                谨世 ATA
              </div>
              {me?.username && (
                <div className="text-[10px] tabular-nums text-gray-500 font-normal">
                  · {me.username.slice(-4)}
                </div>
              )}
            </div>
          </Link>
        </div>

        {/* 报告管理 section */}
        <SectionHeader label="报告管理" />
        <nav className="px-3 flex flex-col gap-0.5">
          {/* 全部 */}
          {(!me || me.showAll) && (
            <SidebarNavItem
              label="全部"
              icon={LayoutGrid}
              active={currentProject === "all" && pathname === "/admin/reports"}
              href="/admin/reports?project=all"
            />
          )}
          {/* 各项目 */}
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

        {/* 服务管理 section — 有 service 权限或加载中显示 */}
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

        {/* 系统管理 section — 仅超管可见 */}
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

        {/* Bottom: 用户块 + 操作 */}
        <div className="mt-auto p-3 border-t border-gray-100">
          {/* 用户身份块 — monogram */}
          <div className="px-3 py-2.5 flex items-center gap-2.5 mb-1">
            <div className="relative shrink-0">
              <div className="size-8 rounded-full bg-[var(--blue-50)] text-[var(--blue-700)] flex items-center justify-center text-[13px] font-semibold ring-1 ring-[var(--blue-200)]/60">
                {me?.name?.slice(0, 1) ?? "—"}
              </div>
              {me?.isSuper && (
                <ShieldCheck className="absolute -bottom-0.5 -right-0.5 size-3 text-[var(--blue-700)] bg-white rounded-full" />
              )}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-medium text-[var(--navy-800)] truncate">
                {me?.name ?? "—"}
              </div>
              <div className="text-[10px] text-gray-400 tabular-nums">
                {me?.username
                  ? `${me.username.slice(0, 3)} •••• ${me.username.slice(-4)}`
                  : ""}
                {me?.isSuper && (
                  <span className="ml-1 text-[var(--blue-700)]">· 超管</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={() => setPwdDialogOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
          >
            <KeyRound className="size-4 text-gray-400" />
            修改密码
          </button>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]"
          >
            <LogOut className="size-4 text-gray-400" />
            {loggingOut ? "登出中…" : "登出"}
          </button>
        </div>
      </aside>
    </>
  );
}

/** 分组标题：xxs label + 横向分割线 */
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-5 pt-5 pb-2 flex items-center gap-2">
      <div className="text-xs text-gray-400 font-medium shrink-0">{label}</div>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

/** 单行 nav item — 激活态：纯 bg + 蓝色文字，无左竖线 */
function SidebarNavItem({
  label,
  icon: Icon,
  active,
  href,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]
        ${
          active
            ? "bg-[var(--blue-50)] text-[var(--blue-700)] font-medium"
            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        }
      `}
    >
      <Icon
        className={`size-4 ${active ? "text-[var(--blue-700)]" : "text-gray-400"}`}
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

  const currentProject = (searchParams.get("project") ?? "all") as ProjectFilter;

  // trailingSlash:true 时 pathname 是 "/admin/login/"，剥掉尾斜杠再比
  if (pathname.replace(/\/$/, "") === "/admin/login") return null;

  // 在 me 加载前显示骨架（loading 状态）
  const showAll = !me || me.showAll;
  const visibleProjects: string[] = me ? me.visibleProjects : ["report", "nav"];
  const showService = !me || me.showService;
  const inServiceTracking = pathname.startsWith("/admin/service-tracking");

  return (
    <>
      <ChangePasswordDialog
        open={pwdDialogOpen}
        onClose={() => setPwdDialogOpen(false)}
      />
      <div className="md:hidden border-b border-gray-200 bg-white px-4 py-2 flex items-center gap-3 overflow-x-auto">
        <Link
          href="/admin/reports"
          className="flex items-center gap-1.5 font-semibold shrink-0"
        >
          <div className="size-1.5 rounded-full bg-[var(--blue-700)] shrink-0" />
          <span className="text-sm tracking-tight text-[var(--navy-800)]">
            谨世 ATA
          </span>
        </Link>
        <div className="h-4 w-px bg-gray-200 shrink-0" />
        <div className="flex gap-1 shrink-0 overflow-x-auto">
          {showAll && (
            <MobilePill
              href="/admin/reports?project=all"
              active={currentProject === "all" && !inServiceTracking}
              label="全部"
            />
          )}
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
