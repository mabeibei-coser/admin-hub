import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AdminForm } from "@/components/admin/admin-form";

export default function NewAdminPage() {
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
        <h1 className="text-xl font-semibold text-gray-900">新建管理员</h1>
        <p className="text-sm text-gray-500 mt-0.5">填写信息后，老师可用手机号登录后台</p>
      </div>
      <AdminForm mode="create" />
    </div>
  );
}
