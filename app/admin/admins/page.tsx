"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users,
  FolderTree,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { StatusPill } from "@/components/admin/status-pill";
import { AdminGroupDialog } from "@/components/admin/admin-group-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ASSIGNABLE_MENUS } from "@/lib/menus";
import { withBase } from "@/lib/url";

interface AdminRow {
  id: number;
  username: string;
  name: string;
  note: string | null;
  menus_json: string;
  is_super: number;
  is_active: number;
  created_at: number;
  group_id: number | null;
  group_name: string | null;
}

const MENU_LABEL: Record<string, string> = Object.fromEntries(
  ASSIGNABLE_MENUS.map((m) => [m.key, m.label])
);

function menusDisplay(menusJson: string, isSuper: number): string {
  if (isSuper) return "超管（全部）";
  try {
    const keys: string[] = JSON.parse(menusJson);
    if (!keys.length) return "—";
    return keys.map((k) => MENU_LABEL[k] ?? k).join("、");
  } catch {
    return "—";
  }
}

function formatTs(ms: number | null | undefined) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

// 筛选下拉用：包含「全部 / 未分组 / 各分组」三种值
// "" 表示「全部」，"none" 表示「未分组」，数字字符串表示对应分组 id
type GroupFilterValue = "" | "none" | string;

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupFilter, setGroupFilter] = useState<GroupFilterValue>("");

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/admin/admins"));
      if (!res.ok) throw new Error((await res.json()).error ?? "加载失败");
      const data = await res.json();
      setAdmins(data.admins ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // mount 时拉一次列表（fetchAdmins 内部会 setState；这是初始数据加载，没有别的写法）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAdmins();
  }, [fetchAdmins]);

  // 从当前列表里推导出可筛选的分组（去重 + 保持顺序）
  const groupOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const a of admins) {
      if (a.group_id != null && a.group_name) {
        if (!seen.has(a.group_id)) seen.set(a.group_id, a.group_name);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [admins]);

  const filteredAdmins = useMemo(() => {
    if (!groupFilter) return admins;
    if (groupFilter === "none") return admins.filter((a) => a.group_id == null);
    const gid = parseInt(groupFilter, 10);
    return admins.filter((a) => a.group_id === gid);
  }, [admins, groupFilter]);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* 页头 — 统一 PageHeader */}
      <PageHeader
        icon={Users}
        title="管理员管理"
        subtitle={
          <span className="tabular-nums">
            {loading
              ? "加载中…"
              : admins.length > 0
              ? `共 ${admins.length} 人 · ${admins.filter((a) => a.is_active).length} 人启用中`
              : "管理各老师的登录账号与菜单权限"}
          </span>
        }
        accentColor="blue"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchAdmins} disabled={loading}>
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              刷新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGroupDialogOpen(true)}
            >
              <FolderTree className="size-3.5" />
              分组管理
            </Button>
            <Link
              href="/admin/admins/new"
              className={buttonVariants({ size: "sm", className: "btn-primary-glow text-white" })}
            >
              <Plus className="size-3.5" />
              新建管理员
            </Link>
          </>
        }
      />

      {error && (
        <Alert
          tone="error"
          action={
            <Button size="sm" variant="outline" onClick={fetchAdmins} className="h-7 text-xs">
              <RefreshCw className="size-3 mr-1" />
              重试
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* 筛选条 */}
      {!loading && admins.length > 0 && (
        <div className="surface-panel p-3 flex flex-wrap items-end gap-3">
          <div>
            <label
              htmlFor="admin-filter-group"
              className="block text-xs text-muted-foreground mb-1"
            >
              分组
            </label>
            <select
              id="admin-filter-group"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value as GroupFilterValue)}
              className="h-8 text-sm border border-input rounded-md px-2 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30 cursor-pointer"
            >
              <option value="">全部</option>
              <option value="none">未分组</option>
              {groupOptions.map((g) => (
                <option key={g.id} value={String(g.id)}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          {groupFilter && (
            <span className="text-xs text-muted-foreground pb-1.5">
              共筛出 {filteredAdmins.length} 人
            </span>
          )}
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="surface-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground border-b border-[var(--report-border)]">
                <TableHead className="w-28">姓名</TableHead>
                <TableHead className="w-36">用户名</TableHead>
                <TableHead className="w-28">分组</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="w-48">菜单权限</TableHead>
                <TableHead className="w-28">创建时间</TableHead>
                <TableHead className="w-20 text-center">状态</TableHead>
                <TableHead className="w-28 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {Array.from({ length: 8 }).map((__, j) => (
                    <TableCell key={j} className="py-4">
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : admins.length === 0 ? (
        <div className="text-center py-16">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <UserCog className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">还没有管理员</p>
              <Link
                href="/admin/admins/new"
                className={buttonVariants({ variant: "outline", size: "sm", className: "mt-1" })}
              >
                <Plus className="size-3.5" />
                立即新建第一个
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="surface-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground border-b border-[var(--report-border)]">
                <TableHead className="w-28">姓名</TableHead>
                <TableHead className="w-36">用户名</TableHead>
                <TableHead className="w-28">分组</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="w-48">菜单权限</TableHead>
                <TableHead className="w-28">创建时间</TableHead>
                <TableHead className="w-20 text-center">状态</TableHead>
                <TableHead className="w-28 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAdmins.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-10 text-sm text-muted-foreground"
                  >
                    没有匹配的管理员
                  </TableCell>
                </TableRow>
              ) : (
                filteredAdmins.map((admin) => (
                  <TableRow key={admin.id} className="row-hover">
                    <TableCell className="font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        {admin.name}
                        {admin.is_super === 1 && (
                          <ShieldCheck className="size-3.5 text-[var(--blue-700)] shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {admin.username}
                    </TableCell>
                    <TableCell className="text-sm">
                      {admin.group_name ? (
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs ring-1 ring-[var(--blue-200)] text-[var(--blue-700)] bg-[var(--blue-50)]">
                          {admin.group_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[160px] truncate">
                      {admin.note ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {menusDisplay(admin.menus_json, admin.is_super)}
                    </TableCell>
                    <TableCell className="tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                      {formatTs(admin.created_at)}
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusPill tone={admin.is_active ? "success" : "neutral"}>
                        {admin.is_active ? "启用" : "停用"}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/admins/${admin.id}/edit`}
                        className={buttonVariants({ variant: "ghost", size: "xs", className: "focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30" })}
                      >
                        编辑
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AdminGroupDialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        onChanged={fetchAdmins}
      />
    </div>
  );
}
