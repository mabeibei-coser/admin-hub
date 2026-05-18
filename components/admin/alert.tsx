import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";

/**
 * Alert — 后台统一的横幅/提示组件。
 * 替代散落各处的 inline `bg-red-50 / bg-amber-50 / bg-blue-50` raw tailwind。
 *
 * tone:
 *   - error    红色 — destructive / 加载失败
 *   - warning  amber — 数据降级 / PII 提醒 / 不可逆操作前置
 *   - info     蓝色 — 一般信息
 *   - success  绿色 — 操作成功
 */

export type AlertTone = "error" | "warning" | "info" | "success";

const TONE: Record<AlertTone, { wrap: string; icon: LucideIcon; iconColor: string }> = {
  error: {
    wrap: "border-[oklch(0.85_0.1_25)]/40 bg-[oklch(0.97_0.04_25)] text-[oklch(0.4_0.18_25)]",
    icon: XCircle,
    iconColor: "text-[var(--semantic-danger)]",
  },
  warning: {
    wrap: "border-[oklch(0.85_0.12_70)]/45 bg-[oklch(0.97_0.06_70)] text-[oklch(0.38_0.12_55)]",
    icon: AlertTriangle,
    iconColor: "text-[var(--semantic-warning)]",
  },
  info: {
    wrap: "border-[var(--blue-200)]/60 bg-[var(--blue-50)] text-[var(--navy-800)]",
    icon: Info,
    iconColor: "text-[var(--blue-700)]",
  },
  success: {
    wrap: "border-[oklch(0.85_0.08_155)]/45 bg-[oklch(0.96_0.04_155)] text-[oklch(0.32_0.12_155)]",
    icon: CheckCircle2,
    iconColor: "text-[var(--semantic-positive)]",
  },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
  /** 右上角动作（按钮、链接等） */
  action?: ReactNode;
  className?: string;
}

export function Alert({
  tone = "info",
  title,
  children,
  icon,
  action,
  className,
}: AlertProps) {
  const t = TONE[tone];
  const Icon = icon ?? t.icon;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm ${t.wrap} ${className ?? ""}`}
    >
      <Icon className={`size-4 mt-0.5 shrink-0 ${t.iconColor}`} strokeWidth={2.2} />
      <div className="flex-1 min-w-0">
        {title && <div className="font-medium leading-snug mb-0.5">{title}</div>}
        {children && (
          <div className={`leading-relaxed ${title ? "text-[13px] opacity-85" : ""}`}>
            {children}
          </div>
        )}
      </div>
      {action && <div className="shrink-0 ml-1">{action}</div>}
    </div>
  );
}
