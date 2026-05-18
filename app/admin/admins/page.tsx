"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, RefreshCw, ShieldCheck, UserCog, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { StatusPill } from "@/components/admin/status-pill";
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

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    fetchAdmins();
  }, [fetchAdmins]);

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

      {/* 列表 */}
      {loading ? (
        <div className="surface-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="text-xs text-muted-foreground border-b border-[var(--report-border)]">
                <TableHead className="w-28">姓名</TableHead>
                <TableHead className="w-36">用户名</TableHead>
                <TableHead>备注</TableHead>
                <TableHead className="w-48">菜单权限</TableHead>
                <TableHead className="w-20 text-center">状态</TableHead>
                <TableHead className="w-28 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {Array.from({ length: 6 }).map((__, j) => (
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
              <Link href="/admin/admins/new" className="inline-block text-xs text-[var(--blue-700)] hover:underline">
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
                <TableHead>备注</TableHead>
                <TableHead className="w-48">菜单权限</TableHead>
                <TableHead className="w-20 text-center">状态</TableHead>
                <TableHead className="w-28 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins.map((admin) => (
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
                  <TableCell className="text-muted-foreground text-sm max-w-[160px] truncate">
                    {admin.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {menusDisplay(admin.menus_json, admin.is_super)}
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
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
