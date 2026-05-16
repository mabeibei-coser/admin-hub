"use client";

import { LogOut } from "lucide-react";

export default function AdminLogoutButton() {
  return (
    <button
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        window.location.href = "/admin/login";
      }}
      className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-100 transition-colors"
    >
      <LogOut className="size-4" />
      登出
    </button>
  );
}
