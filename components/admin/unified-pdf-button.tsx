"use client";

import { Printer } from "lucide-react";
import type { ProjectId } from "@/lib/projects";

interface Props {
  project: ProjectId;
  reportId: number;
  hasData: boolean;
}

/**
 * 管理后台统一 PDF / 打印入口。
 * report 侧：在新标签打开现有预览页（含 PDF 下载按钮）。
 * nav 侧：触发浏览器打印（report 渲染已内联在详情页，直接 print）。
 */
export function UnifiedPDFButton({ project, reportId, hasData }: Props) {
  if (!hasData) return null;

  const handleClick = () => {
    if (project === "report") {
      window.open(`/admin/reports/${reportId}/preview`, "_blank", "noopener,noreferrer");
    } else {
      window.print();
    }
  };

  const label = project === "report" ? "查看报告预览" : "打印 / 另存 PDF";

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors print:hidden"
    >
      <Printer className="size-4" />
      {label}
    </button>
  );
}
