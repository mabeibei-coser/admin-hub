import type { LucideIcon } from "lucide-react";

type AccentColor = "blue" | "green" | "neutral";

const ACCENT_BG: Record<AccentColor, string> = {
  blue: "bg-[var(--blue-700)]",
  green: "bg-[var(--semantic-positive)]",
  neutral: "bg-[var(--blue-500)]",
};

const ICON_BG: Record<AccentColor, string> = {
  blue: "bg-[var(--blue-50)] text-[var(--blue-700)] ring-[var(--blue-200)]/60",
  green: "bg-[var(--semantic-positive)]/10 text-[var(--semantic-positive)] ring-[var(--semantic-positive)]/20",
  neutral: "bg-[var(--blue-50)] text-[var(--blue-500)] ring-[var(--blue-200)]/60",
};

export interface PageHeaderProps {
  /** 圆形 icon avatar（左侧，Tabler 风） */
  icon?: LucideIcon;
  /** 主标题 */
  title: string;
  /** 副标题 / 描述 */
  subtitle?: React.ReactNode;
  /** 顶部 3px 装饰条颜色（admin-hub 既有视觉特征） */
  accentColor?: AccentColor;
  /** 右侧操作区（按钮组等） */
  actions?: React.ReactNode;
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  accentColor = "blue",
  actions,
}: PageHeaderProps) {
  return (
    <div className="relative">
      <div
        aria-hidden
        className={`absolute -top-1 left-0 h-[3px] w-16 rounded-full ${ACCENT_BG[accentColor]}`}
      />
      <div className="pt-2 flex items-start gap-4">
        {Icon && (
          <div
            className={`shrink-0 size-10 rounded-xl flex items-center justify-center ring-1 ${ICON_BG[accentColor]}`}
          >
            <Icon className="size-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-[var(--navy-800)] tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <div className="text-sm text-gray-500 mt-1">{subtitle}</div>
          )}
        </div>
        {actions && (
          <div className="shrink-0 hidden md:flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
