import { Suspense } from "react";
import { AdminSidebar, AdminMobileBar } from "@/components/admin/admin-sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 左侧 sidebar (desktop) — useSearchParams 需要 Suspense 包裹才能 prerender */}
      <Suspense fallback={<div className="hidden md:block md:w-56 lg:w-60 shrink-0 border-r border-gray-200 bg-white" />}>
        <AdminSidebar />
      </Suspense>

      <div className="flex-1 flex flex-col min-w-0">
        {/* 移动端顶部小条 */}
        <Suspense fallback={null}>
          <AdminMobileBar />
        </Suspense>
        {/* 主内容 */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
