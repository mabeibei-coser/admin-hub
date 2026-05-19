"use client";

import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { useReportRender } from "./report-context";
import { SixDimRadar } from "./six-dim-radar";
import { ScoreRing } from "./score-ring";
import type { Overview, ReportMeta } from "@/lib/types-startup";

interface Props {
  data: Overview | null | undefined;
  meta?: ReportMeta;
  index: number;
  total: number;
}

function extractPersonalityLabel(raw: string): string {
  const sep = raw.indexOf("·");
  if (sep < 0) return raw.trim();
  const before = raw.slice(0, sep).trim();
  if (/^[A-Za-z]{2,6}$/.test(before)) return raw.slice(sep + 1).trim();
  return raw.trim();
}

const spring = { type: "spring" as const, stiffness: 90, damping: 22 };

export function OverviewSection({ data, index, total }: Props) {
  const { exporting } = useReportRender();

  if (!data) {
    return (
      <SectionWrapper id="overview" title="总评" index={index} total={total}>
        <div className="border-t border-[var(--blue-100)] pt-8 pb-4 text-center text-[13px] text-[var(--report-ink-muted)]">
          总评模块生成中…
        </div>
      </SectionWrapper>
    );
  }

  const personality = data.personality;
  const traits = Array.isArray(personality?.traits) ? personality.traits : [];
  const sixDim = Array.isArray(data.sixDimRadar) ? data.sixDimRadar : [];
  const personalityLabel = extractPersonalityLabel(personality?.type ?? "");

  const overallScore =
    sixDim.length > 0
      ? sixDim.reduce((sum, d) => sum + d.score, 0) / sixDim.length
      : null;
  const strongest =
    sixDim.length > 0
      ? sixDim.reduce((max, d) => (d.score > max.score ? d : max), sixDim[0])
      : null;
  const weakest =
    sixDim.length > 0
      ? sixDim.reduce((min, d) => (d.score < min.score ? d : min), sixDim[0])
      : null;

  const fadeIn = exporting
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: { ...spring, delay: 0.05 },
      };

  return (
    <SectionWrapper id="overview" title="总评" index={index} total={total}>
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-x-8 gap-y-6 items-start">
        <motion.div {...fadeIn} className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--blue-600)] mb-2.5">
            创业者类型
          </div>
          <h3
            className="text-[26px] sm:text-[30px] lg:text-[32px] font-bold text-[var(--navy-950)] tracking-tight leading-[1.15] mb-4 text-balance"
            style={{ fontFamily: "var(--font-heading-serif)" }}
          >
            {personalityLabel || personality?.type || "—"}
          </h3>

          {traits.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {traits.map((t, i) => (
                <motion.span
                  key={t}
                  initial={exporting ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
                  className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--navy-700)] border border-[var(--blue-200)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]"
                >
                  {t}
                </motion.span>
              ))}
            </div>
          )}

          {(personality?.description || data.summary) && (
            <div className="border-t border-[var(--blue-100)] pt-5">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--report-ink-muted)] mb-2">
                创业综述
              </div>
              <p className="text-[14.5px] text-[var(--navy-800)] leading-[1.8] text-pretty">
                {personality?.description || data.summary}
              </p>
            </div>
          )}
        </motion.div>

        <motion.div
          {...fadeIn}
          transition={{ ...spring, delay: 0.12 }}
          className="space-y-4"
        >
          {overallScore !== null && (
            <div className="rounded-2xl border border-[var(--blue-200)]/70 bg-gradient-to-br from-white via-white to-[var(--blue-50)]/50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_-12px_rgba(70,100,190,0.08)] flex items-center gap-5">
              <ScoreRing value={overallScore} max={5} size={96} stroke={7} />
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--report-ink-muted)] mb-1">
                  综合评分
                </div>
                <div className="text-[13px] text-[var(--navy-700)] leading-snug">
                  基于 6 个创业要素维度加权平均得出，反映项目的整体可行性与你的创业准备度。
                </div>
              </div>
            </div>
          )}

          {sixDim.length > 0 && (
            <div className="rounded-2xl border border-[var(--blue-100)] bg-white p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
              <SixDimRadar data={sixDim} />
            </div>
          )}

          {(strongest || weakest) && (
            <div className="rounded-2xl border border-[var(--blue-100)] bg-white divide-y divide-[var(--blue-100)] overflow-hidden">
              {strongest && (
                <DimensionRow
                  icon={<TrendingUp className="size-3.5" strokeWidth={2} />}
                  iconColor="text-emerald-600"
                  iconBg="bg-emerald-50"
                  label="最强维度"
                  name={strongest.name}
                  score={strongest.score}
                  conclusion={strongest.conclusion}
                  accentText="text-emerald-700"
                />
              )}
              {weakest && (
                <DimensionRow
                  icon={<AlertTriangle className="size-3.5" strokeWidth={2} />}
                  iconColor="text-amber-600"
                  iconBg="bg-amber-50"
                  label="待提升"
                  name={weakest.name}
                  score={weakest.score}
                  conclusion={weakest.conclusion}
                  accentText="text-amber-700"
                />
              )}
            </div>
          )}
        </motion.div>
      </div>
    </SectionWrapper>
  );
}

interface DimensionRowProps {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  name: string;
  score: number;
  conclusion?: string;
  accentText: string;
}

function DimensionRow({
  icon,
  iconColor,
  iconBg,
  label,
  name,
  score,
  conclusion,
  accentText,
}: DimensionRowProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span
        className={`shrink-0 mt-0.5 inline-flex items-center justify-center size-6 rounded-full ${iconBg} ${iconColor}`}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${accentText}`}>
            {label}
          </span>
          <span className="text-[10px] text-[var(--report-ink-muted)] tabular-nums">
            {score}/5
          </span>
        </div>
        <div className="text-[13px] font-semibold text-[var(--navy-900)] leading-tight">
          {name}
        </div>
        {conclusion && (
          <div className="text-[11.5px] text-[var(--report-ink-muted)] mt-0.5 leading-relaxed">
            {conclusion}
          </div>
        )}
      </div>
    </div>
  );
}
