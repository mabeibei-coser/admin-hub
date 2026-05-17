"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdminForm } from "@/components/admin/admin-form";
import { withBase } from "@/lib/url";

interface AdminRow {
  id: number;
  username: string;
  name: string;
  note: string | null;
  menus_json: string;
  is_super: number;
  is_active: number;
}

interface MeData {
  adminId: number;
  isSuper: boolean;
}

export default function EditAdminPage() {
  const { id } = useParams<{ id: string }>();
  const [admin, setAdmin] = useState<AdminRow | null>(null);
  const [me, setMe] = useState<MeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 并行拉取：目标管理员数据 + 当前登录用户信息
    Promise.all([
      fetch(withBase("/api/admin/admins")).then((r) => r.json()),
      fetch(withBase("/api/admin/me")).then((r) => r.json()),
    ])
      .then(([adminsData, meData]) => {
        const target = (adminsData.admins ?? []).find(
          (a: AdminRow) => a.id === parseInt(id, 10)
        );
        if (!target) setError("管理员不存在");
        else setAdmin(target);
        setMe(meData);
      })
      .catch(() => setError("加载失败，请刷新重试"));
  }, [id]);

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!admin || !me) {
    return (
      <div className="p-6 text-center text-sm text-gray-400">加载中…</div>
    );
  }

  const isSelf = me.adminId === admin.id;
  let menus: string[] = [];
  try {
    menus = JSON.parse(admin.menus_json);
  } catch {
    menus = [];
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin/admins"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <ChevronLeft className="size-3.5" />
          返回管理员列表
        </Link>
        <h1 className="text-xl font-semibold text-gray-900">编辑管理员</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {isSelf ? "您正在编辑自己的账号（不能修改自己的状态）" : `正在编辑：${admin.name}`}
        </p>
      </div>
      <AdminForm
        mode="edit"
        adminId={admin.id}
        isSelf={isSelf}
        defaultValues={{
          username: admin.username,
          name: admin.name,
          note: admin.note ?? "",
          menus,
          is_active: admin.is_active === 1,
          password: "",
          confirmPassword: "",
        }}
      />
    </div>
  );
}
