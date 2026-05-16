"use client";

import { cn } from "@/lib/utils";
import type { ProjectOption } from "@/lib/projects";

interface Props {
  value: ProjectOption["id"];
  options: ProjectOption[];
  onChange: (id: ProjectOption["id"]) => void;
  /**
   * 当 options 数量 > 4 时建议外面切换到 DropdownMenu 实现。
   * V1 内置 Tabs/Segmented 风格，最多 4 个项目舒适显示。
   */
  className?: string;
}

/**
 * 项目切换器：admin 列表顶部的 Tabs 风格 segmented control。
 * 接受 PROJECT_OPTIONS 直接驱动（含 "全部" 入口）。
 */
export function ProjectSwitcher({ value, options, onChange, className }: Props) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-gray-100 p-1 text-sm",
        className
      )}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              "px-3 py-1.5 rounded-md transition-colors text-sm font-medium",
              active
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
