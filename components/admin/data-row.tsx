import type { ReactNode } from "react";

/**
 * DataRow — 详情页 "label · value" 行的统一实现。
 *
 * 替代 reports/[id]/page.tsx 和 service-tracking-editor.tsx 里各自的 Row
 * 局部组件。字色与边框走 token，dark mode 自动适配。
 *
 * - label 列固定宽度（默认 w-28），文字色 = muted-foreground
 * - value 列吃剩余空间，foreground 色，允许 break-words
 * - 行间 border 用 --report-divider（与 reports/[id] 内嵌 list 风格保持一致）
 */

export interface DataRowProps {
  label: string;
  /** 调整 label 列宽度 — 仅用于密度需要 */
  labelWidth?: "w-20" | "w-24" | "w-28" | "w-32";
  children: ReactNode;
}

export function DataRow({
  label,
  labelWidth = "w-28",
  children,
}: DataRowProps) {
  return (
    <div className="flex gap-3 py-2 border-b border-[var(--report-divider)] last:border-0">
      <span className={`shrink-0 ${labelWidth} text-xs text-muted-foreground pt-1`}>
        {label}
      </span>
      <div className="flex-1 text-sm text-foreground break-words">{children}</div>
    </div>
  );
}
