"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { Crown, Star } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { useReportRender } from "./report-context";
import type { PositionInfo } from "@/lib/types";

// 统一渐变，和薪资条形图一致；档位靠 chip + 分数色表达
const BAR_GRADIENT =
  "linear-gradient(90deg, var(--blue-400), var(--blue-500))";
const BAR_GRADIENT_WEAK =
  "linear-gradient(90deg, oklch(0.82 0.05 240), var(--blue-300))";

function getScoreStyle(score: number): {
  gradient: string;
  tierLabel: string;
  tierColor: string;
} {
  if (score >= 85) {
    return {
      gradient: BAR_GRADIENT,
      tierLabel: "优",
      tierColor: "var(--blue-500)",
    };
  }
  if (score >= 70) {
    return {
      gradient: BAR_GRADIENT,
      tierLabel: "良",
      tierColor: "var(--blue-500)",
    };
  }
  if (score >= 60) {
    return {
      gradient: BAR_GRADIENT,
      tierLabel: "中",
      tierColor: "var(--blue-400)",
    };
  }
  return {
    gradient: BAR_GRADIENT_WEAK,
    tierLabel: "待强化",
    tierColor: "oklch(0.55 0.06 240)",
  };
}

const PRIORITY_META: Record<
  "primary" | "secondary",
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  primary: {
    label: "首选",
    icon: Crown,
    tone: "border-[var(--blue-500)] bg-[var(--blue-500)]/5 text-[var(--blue-700)]",
  },
  secondary: {
    label: "次选",
    icon: Star,
    tone: "border-[var(--blue-300)] bg-card text-[var(--navy-700)]",
  },
};

function SubPositionCard({
  sub,
  exporting,
}: {
  sub: PositionInfo["subPositions"][number];
  exporting: boolean;
}) {
  const meta = PRIORITY_META[sub.priority] ?? PRIORITY_META.secondary;
  const Icon = meta.icon;
  const safeCompetencies = Array.isArray(sub.coreCompetencies) ? sub.coreCompetencies : [];
  const safeResponsibilities = Array.isArray(sub.coreResponsibilities) ? sub.coreResponsibilities : [];
  const radarData = safeCompetencies.map((c) => ({
    subject: c.name,
    value: c.score,
    fullMark: 100,
  }));

  return (
    <div className="rounded-xl border border-[var(--blue-100)] bg-card p-4 sm:p-5 break-inside-avoid">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${meta.tone}`}
        >
          <Icon className="size-3.5" />
          {meta.label}
        </span>
        <h3 className="text-base sm:text-lg font-semibold text-[var(--navy-900)]">
          {sub.name}
        </h3>
      </div>

      <div className="grid gap-5 md:grid-cols-5">
        <div className="md:col-span-3 space-y-4">
          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-[var(--report-ink-muted)] mb-2">
              核心职责
            </div>
            <ul className="space-y-1.5 text-[13.5px] text-[var(--navy-800)]">
              {safeResponsibilities.map((r, i) => (
                <li key={i} className="flex gap-2 leading-relaxed">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--blue-500)]" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-[11px] font-semibold tracking-wider uppercase text-[var(--report-ink-muted)] mb-2">
              核心能力
            </div>
            <div className="space-y-1.5">
              {safeCompetencies.map((c, i) => {
                const style = getScoreStyle(c.score);
                return (
                  <div key={i}>
                    <div className="flex items-baseline justify-between mb-0.5 text-[12px]">
                      <span className="text-[var(--navy-800)] font-medium">
                        {c.name}
                      </span>
                      <span className="inline-flex items-baseline gap-1.5">
                        <span
                          className="tabular-nums font-semibold"
                          style={{ color: style.tierColor }}
                        >
                          {c.score}
                        </span>
                        <span
                          className="px-1.5 py-[1px] rounded text-[10px] font-medium"
                          style={{
                            color: style.tierColor,
                            background: `color-mix(in oklch, ${style.tierColor} 12%, transparent)`,
                          }}
                        >
                          {style.tierLabel}
                        </span>
                      </span>
                    </div>
                    <div
                      className="bg-[var(--blue-100)] rounded-full overflow-hidden"
                      style={{ height: 4 }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(c.score, 100)}%`,
                          background: style.gradient,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="md:col-span-2 min-h-[200px] flex items-center">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="var(--blue-200)" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fontSize: 10, fill: "var(--navy-700)" }}
              />
              <Radar
                dataKey="value"
                stroke="var(--blue-500)"
                fill="var(--blue-500)"
                fillOpacity={0.28}
                isAnimationActive={!exporting}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 为什么适合你 */}
      {sub.fitReason && (
        <div className="mt-4 rounded-lg border-l-4 border-[var(--blue-500)] bg-[var(--blue-50)]/60 px-4 py-3">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-[var(--blue-700)] mb-1.5">
            为什么适合你
          </div>
          <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
            {sub.fitReason}
          </p>
        </div>
      )}
    </div>
  );
}

export function PositionInfoSection({
  data,
  positionName,
  index,
  total,
}: {
  data: PositionInfo;
  positionName: string;
  index: number;
  total: number;
}) {
  const { exporting } = useReportRender();
  const subPositions = Array.isArray(data?.subPositions) ? data.subPositions : [];
  const primary = subPositions.find((s) => s.priority === "primary");
  const secondary = subPositions.find((s) => s.priority === "secondary");
  const takeaway = primary
    ? secondary
      ? `最匹配方向：${primary.name}（首选），${secondary.name}（次选）`
      : `最匹配方向：${primary.name}（首选）`
    : `共 ${subPositions.length} 个细分方向可选`;

  return (
    <SectionWrapper
      id="position-info"
      title={`${positionName}细分岗位分析`}
      index={index}
      total={total}
      takeaway={takeaway}
      meta={<span>{subPositions.length} 个细分方向</span>}
    >
      <div className="space-y-4">
        {subPositions.map((sub, i) => (
          <SubPositionCard key={i} sub={sub} exporting={exporting} />
        ))}
      </div>
    </SectionWrapper>
  );
}
