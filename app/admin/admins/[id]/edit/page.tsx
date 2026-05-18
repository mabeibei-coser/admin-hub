"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { UserCog } from "lucide-react";
import { AdminForm } from "@/components/admin/admin-form";
import { PageHeader } from "@/components/admin/page-header";
import { Breadcrumb } from "@/components/admin/breadcrumb";
import { Alert } from "@/components/admin/alert";
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
        <Alert tone="error">{error}</Alert>
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
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <Breadcrumb
        items={[
          { label: "管理员管理", href: "/admin/admins" },
          { label: `编辑 · ${admin.name}` },
        ]}
      />
      <PageHeader
        icon={UserCog}
        eyebrow={isSelf ? "编辑自己的账号" : `编辑：${admin.username}`}
        title={`编辑 ${admin.name}`}
        subtitle={
          isSelf
            ? "您正在编辑自己的账号（不能修改自己的状态）"
            : `修改后老师下次登录起生效`
        }
        accentColor="blue"
      />
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
