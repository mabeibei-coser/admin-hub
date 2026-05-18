import type { ReactNode } from "react";

/**
 * StatusPill — `.status-pill` CSS class 的 React 薄包装。
 *
 * 替代散落各处的 inline `bg-green-100 text-green-700 / bg-blue-100` raw tailwind。
 * 实际样式在 [globals.css](app/globals.css:817-852)。
 */

export type StatusTone = "info" | "success" | "warning" | "neutral" | "danger";

export interface StatusPillProps {
  tone: StatusTone;
  /** 左侧圆点 — 默认开启（如希望紧凑可关掉） */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

const DOT_COLOR: Record<StatusTone, string> = {
  info: "bg-[var(--blue-500)]",
  success: "bg-[var(--semantic-positive)]",
  warning: "bg-[var(--semantic-warning)]",
  neutral: "bg-muted-foreground/70",
  danger: "bg-[var(--semantic-danger)]",
};

export function StatusPill({
  tone,
  dot = true,
  className,
  children,
}: StatusPillProps) {
  return (
    <span className={`status-pill ${className ?? ""}`} data-tone={tone}>
      {dot && (
        <span aria-hidden className={`size-1.5 rounded-full ${DOT_COLOR[tone]}`} />
      )}
      {children}
    </span>
  );
}
