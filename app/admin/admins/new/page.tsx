import { UserPlus } from "lucide-react";
import { AdminForm } from "@/components/admin/admin-form";
import { PageHeader } from "@/components/admin/page-header";
import { Breadcrumb } from "@/components/admin/breadcrumb";

export default function NewAdminPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      <Breadcrumb
        items={[
          { label: "管理员管理", href: "/admin/admins" },
          { label: "新建" },
        ]}
      />
      <PageHeader
        icon={UserPlus}
        eyebrow="新建账号"
        title="新建管理员"
        subtitle="填写信息后，老师可用手机号登录后台"
        accentColor="blue"
      />
      <AdminForm mode="create" />
    </div>
  );
}
