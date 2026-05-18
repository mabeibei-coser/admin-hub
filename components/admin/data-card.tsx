import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * DataCard — 列表页顶部数据看板卡的统一实现。
 * 替代旧的 reports/KpiCard 和 service-tracking/StatCard 两套并行设计。
 *
 * - `accent` 控制 icon 背景渐变 + ring + 右上角 glow 色（与品牌 token 对齐）
 * - `highlight` 让数字走 `.kpi-number` 渐变（主推 / 当日新增等"最重要的那个"）
 * - 无 icon 时也成立（保留排布占位，避免单页混用两种间距）
 * - hover lift + 阴影由 `.surface-panel` + transition 提供
 */

export type DataCardAccent = "blue" | "green" | "amber" | "rose" | "sky";

const ICON_BG: Record<DataCardAccent, string> = {
  blue: "bg-gradient-to-br from-[var(--blue-100)] to-[var(--blue-50)] text-[var(--blue-700)] ring-[var(--blue-200)]/50",
  green:
    "bg-gradient-to-br from-[oklch(0.94_0.06_155)] to-[oklch(0.97_0.03_155)] text-[var(--semantic-positive)] ring-[oklch(0.85_0.08_155)]/40",
  amber:
    "bg-gradient-to-br from-[oklch(0.95_0.08_75)] to-[oklch(0.97_0.04_70)] text-[var(--semantic-warning)] ring-[oklch(0.85_0.1_70)]/45",
  rose:
    "bg-gradient-to-br from-[oklch(0.95_0.05_25)] to-[oklch(0.97_0.025_25)] text-[var(--semantic-danger)] ring-[oklch(0.85_0.08_25)]/45",
  sky:
    "bg-gradient-to-br from-[oklch(0.92_0.06_230)] to-[oklch(0.96_0.03_230)] text-[oklch(0.45_0.16_230)] ring-[oklch(0.82_0.1_230)]/45",
};

const GLOW_COLOR: Record<DataCardAccent, string> = {
  blue: "oklch(0.7_0.16_245_/_0.1)",
  green: "oklch(0.65_0.16_155_/_0.1)",
  amber: "oklch(0.78_0.16_70_/_0.1)",
  rose: "oklch(0.7_0.18_25_/_0.1)",
  sky: "oklch(0.7_0.16_230_/_0.1)",
};

export interface DataCardProps {
  label: string;
  value: number | string | undefined | null;
  icon?: LucideIcon;
  loading?: boolean;
  accent?: DataCardAccent;
  /** 让数字走 .kpi-number 渐变（主推卡用） */
  highlight?: boolean;
  /** hover tooltip 用 */
  hint?: string;
  /** 数字旁边可选小字（单位 / 副标签） */
  trailingHint?: ReactNode;
}

export function DataCard({
  label,
  value,
  icon: Icon,
  loading = false,
  accent = "blue",
  highlight = false,
  hint,
  trailingHint,
}: DataCardProps) {
  return (
    <div
      className="surface-panel relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_oklch(0.3_0.06_252_/_0.08),0_18px_36px_oklch(0.55_0.2_252_/_0.12)] group"
      title={hint}
    >
      {/* 右上角微弱渐变 — hover 时加强 */}
      <div
        aria-hidden
        className="absolute -top-10 -right-10 size-32 rounded-full pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity"
        style={{
          background: `radial-gradient(circle, ${GLOW_COLOR[accent]}, transparent 65%)`,
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="text-[10.5px] text-muted-foreground font-semibold tracking-[0.16em] uppercase pt-0.5 min-w-0 truncate">
          {label}
        </div>
        {Icon && (
          <div
            className={`shrink-0 size-9 rounded-xl flex items-center justify-center ring-1 shadow-[0_2px_6px_oklch(0.55_0.2_252_/_0.08)] ${ICON_BG[accent]}`}
          >
            <Icon className="size-4.5" strokeWidth={2.2} />
          </div>
        )}
      </div>
      {loading || value === undefined || value === null ? (
        <div className="h-10 w-20 bg-muted rounded animate-pulse mt-4" />
      ) : (
        <div className="flex items-baseline gap-1.5 mt-4">
          <div
            className={`${
              highlight ? "kpi-number" : "text-[var(--navy-800)]"
            } text-[34px] md:text-[40px] font-semibold tabular-nums tracking-tight leading-none`}
          >
            {value}
          </div>
          {trailingHint && (
            <div className="text-xs text-muted-foreground font-medium tabular-nums">
              {trailingHint}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
