"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, RefreshCw, ShieldCheck, UserCog } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
    <div className="p-6 max-w-5xl mx-auto">
      {/* 页头 */}
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">管理员管理</h1>
          <p className="text-sm text-gray-500 mt-0.5 tabular-nums">
            {loading ? "加载中…" : admins.length > 0 ? `共 ${admins.length} 人 · ${admins.filter(a => a.is_active).length} 人启用中` : "管理各老师的登录账号与菜单权限"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchAdmins} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Link
            href="/admin/admins/new"
            className={buttonVariants({ size: "sm", className: "bg-blue-600 hover:bg-blue-700" })}
          >
            <Plus className="size-3.5" />
            新建管理员
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">加载中…</div>
      ) : admins.length === 0 ? (
        <div className="text-center py-16">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="size-12 rounded-full bg-gray-50 flex items-center justify-center">
              <UserCog className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">还没有管理员</p>
              <Link href="/admin/admins/new" className="inline-block text-xs text-blue-600 hover:underline">
                立即新建第一个
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
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
                <TableRow key={admin.id} className="hover:bg-gray-50/50">
                  <TableCell className="font-medium text-gray-900">
                    <div className="flex items-center gap-1.5">
                      {admin.name}
                      {admin.is_super === 1 && (
                        <ShieldCheck className="size-3.5 text-blue-500 shrink-0" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-600 tabular-nums">
                    {admin.username}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm max-w-[160px] truncate">
                    {admin.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {menusDisplay(admin.menus_json, admin.is_super)}
                  </TableCell>
                  <TableCell className="text-center">
                    {admin.is_active ? (
                      <Badge className="bg-green-100 text-green-700 border-0 text-[11px]">
                        启用
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-500 border-0 text-[11px]">
                        停用
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/admin/admins/${admin.id}/edit`}
                      className={buttonVariants({ variant: "ghost", size: "xs", className: "focus-visible:ring-2 focus-visible:ring-blue-500/50" })}
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
