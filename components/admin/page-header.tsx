import type { LucideIcon } from "lucide-react";

// accent 含义: blue=主品牌 / green=正向语义 / primary=低饱和主色(降级展示用)
// 旧名 "neutral" 误导(实际还是蓝调), 保留作为 alias 不破坏调用方。
type AccentColor = "blue" | "green" | "primary" | "purple";
type LegacyAccent = AccentColor | "neutral";

const ICON_BG: Record<AccentColor, string> = {
  blue: "bg-gradient-to-br from-[var(--blue-100)] to-[var(--blue-50)] text-[var(--blue-700)] ring-[var(--blue-200)]/60",
  green:
    "bg-gradient-to-br from-[oklch(0.94_0.06_155)] to-[oklch(0.97_0.03_155)] text-[var(--semantic-positive)] ring-[oklch(0.85_0.08_155)]/40",
  primary:
    "bg-gradient-to-br from-[var(--blue-50)] to-[oklch(0.99_0.006_240)] text-[var(--blue-600)] ring-[var(--blue-200)]/50",
  purple:
    "bg-gradient-to-br from-[var(--purple-100)] to-[var(--purple-50)] text-[var(--purple-700)] ring-[var(--purple-200)]/60",
};

export interface PageHeaderProps {
  /** 圆角 icon avatar（左侧） */
  icon?: LucideIcon;
  /** 主标题 */
  title: string;
  /** 副标题 / 描述 */
  subtitle?: React.ReactNode;
  /** Eyebrow 小标签（标题上方一行，全大写小字） */
  eyebrow?: string;
  /** Accent 色调 */
  accentColor?: LegacyAccent;
  /** 右侧操作区（按钮组等） */
  actions?: React.ReactNode;
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  eyebrow,
  accentColor = "blue",
  actions,
}: PageHeaderProps) {
  // 老的 "neutral" → 等价 "primary"
  const accent: AccentColor =
    accentColor === "neutral" ? "primary" : accentColor;
  return (
    <div className="relative flex items-start gap-4">
      {Icon && (
        <div
          className={`shrink-0 size-12 rounded-2xl flex items-center justify-center ring-1 shadow-[0_2px_8px_oklch(0.55_0.2_252_/_0.1)] ${ICON_BG[accent]}`}
        >
          <Icon className="size-5" strokeWidth={2.2} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--blue-600)] mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[26px] sm:text-[28px] font-semibold text-[var(--navy-900)] tracking-tight leading-[1.15]">
          {title}
        </h1>
        {subtitle && (
          <div className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            {subtitle}
          </div>
        )}
      </div>
      {actions && (
        <div className="shrink-0 hidden md:flex items-center gap-2 pt-1">
          {actions}
        </div>
      )}
    </div>
  );
}
