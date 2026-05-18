"use client";

import { FileSearch } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import type { ResumeDiagnosis } from "@/lib/types";

const PRIORITY_TONE: Record<"high" | "medium" | "low", "danger" | "warning" | "positive"> = {
  high: "danger",
  medium: "warning",
  low: "positive",
};
const PRIORITY_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "高",
  medium: "中",
  low: "低",
};

// 简历分数档位 → 主色 / 渐变 / 轨道底色
function getScoreTier(score: number) {
  if (score >= 85) {
    return {
      label: "优秀",
      main: "var(--blue-700)",
      gradient:
        "linear-gradient(90deg, var(--blue-500), var(--blue-700))",
      track: "color-mix(in oklch, var(--blue-500) 12%, white)",
      chipBg: "color-mix(in oklch, var(--blue-500) 14%, white)",
    };
  }
  if (score >= 70) {
    return {
      label: "合格",
      main: "var(--blue-600)",
      gradient:
        "linear-gradient(90deg, var(--blue-400), var(--blue-600))",
      track: "color-mix(in oklch, var(--blue-400) 12%, white)",
      chipBg: "color-mix(in oklch, var(--blue-400) 14%, white)",
    };
  }
  if (score >= 55) {
    return {
      label: "需改进",
      main: "oklch(0.55 0.14 55)",
      gradient:
        "linear-gradient(90deg, oklch(0.78 0.12 60), oklch(0.62 0.15 50))",
      track: "oklch(0.96 0.04 60)",
      chipBg: "oklch(0.94 0.06 60)",
    };
  }
  return {
    label: "待改进",
    main: "oklch(0.5 0.16 25)",
    gradient:
      "linear-gradient(90deg, oklch(0.75 0.12 25), oklch(0.55 0.18 25))",
    track: "oklch(0.96 0.04 25)",
    chipBg: "oklch(0.94 0.06 25)",
  };
}

export function ResumeDiagnosisSection({
  data,
  index,
  total,
}: {
  data: ResumeDiagnosis;
  index: number;
  total: number;
}) {
  // Guard: overallScore may be NaN / undefined — fall back to 0
  const rawScore = typeof data.overallScore === "number" && isFinite(data.overallScore)
    ? data.overallScore
    : 0;
  const score = Math.max(0, Math.min(100, rawScore));
  const tier = getScoreTier(score);
  const scoreLabel = isFinite(rawScore) ? String(score) : "--";
  const scoreLevel = tier.label;

  // Guard: recommendations may be undefined or not an array
  const recs = Array.isArray(data.recommendations) ? data.recommendations : [];
  const highCount = recs.filter((r) => r?.priority === "high").length;
  const takeaway = `简历 ${scoreLabel} / 100 · ${scoreLevel}${highCount > 0 ? ` · ${highCount} 条高优先级建议待处理` : ""}`;

  return (
    <SectionWrapper
      id="resume-diagnosis"
      title="简历诊断"
      index={index}
      total={total}
      takeaway={takeaway}
      meta={<span>{recs.length} 条建议</span>}
    >
      {/* Score hero */}
      <div className="rounded-xl border border-[var(--blue-200)] bg-gradient-to-br from-[var(--blue-50)] to-card p-4 sm:p-5 mb-5 break-inside-avoid">
        <div className="flex items-center gap-4 mb-3">
          <div className="rounded-full bg-card p-2.5 border border-[var(--blue-200)] shrink-0">
            <FileSearch className="size-5" style={{ color: tier.main }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[var(--report-ink-muted)] mb-0.5">
              简历整体完成度
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className="tabular-nums text-3xl font-bold"
                style={{ color: tier.main }}
              >
                {scoreLabel}
              </span>
              <span className="text-xs text-[var(--report-ink-muted)]">
                / 100
              </span>
              <span
                className="ml-1 px-2 py-0.5 rounded-md text-[11px] font-semibold"
                style={{
                  color: tier.main,
                  background: tier.chipBg,
                }}
              >
                {scoreLevel}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end shrink-0">
            <span className="text-[10px] font-mono tracking-wider uppercase text-[var(--report-ink-muted)]">
              Score
            </span>
            <span
              className="tabular-nums text-xs font-semibold"
              style={{ color: tier.main }}
            >
              {scoreLabel}%
            </span>
          </div>
        </div>

        {/* 整条渐变进度条：高度 10px，按档位色，带目标刻度 */}
        <div
          className="relative rounded-full overflow-hidden"
          style={{ height: 10, background: tier.track }}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{
              width: `${score}%`,
              background: tier.gradient,
              boxShadow: "0 1px 3px oklch(0.45 0.18 250 / 0.18)",
            }}
          />
          {/* 70 分合格线刻度（装饰） */}
          <span
            className="absolute top-0 bottom-0 w-px bg-card/70"
            style={{ left: "70%" }}
            aria-hidden
          />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-[var(--report-ink-muted)]">
          <span>0</span>
          <span style={{ marginLeft: "calc(70% - 10px)" }}>合格线 70</span>
          <span>100</span>
        </div>
      </div>

      {/* Recommendations */}
      {recs.length > 0 && (
        <ol className="space-y-3">
          {recs.map((r, i) => {
            // Guard: individual fields may be missing or empty strings
            const title = r?.title?.trim() || "（待补充）";
            const issue = r?.issue?.trim() || "—";
            const suggestion = r?.suggestion?.trim() || "—";
            const snippet = r?.quotedSnippet?.trim() || "";
            // Guard: priority may be missing/unknown — fall back to "medium"
            const validPriorities = ["high", "medium", "low"] as const;
            const priority: "high" | "medium" | "low" =
              validPriorities.includes(r?.priority as "high" | "medium" | "low")
                ? (r.priority as "high" | "medium" | "low")
                : "medium";

            return (
              <li
                key={i}
                className="rounded-xl border border-[var(--blue-100)] bg-card p-4 break-inside-avoid"
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className="shrink-0 tabular-nums text-sm font-bold text-[var(--blue-500)] w-5 pt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-[15px] font-semibold text-[var(--navy-900)]">
                        {title}
                      </h4>
                      <span
                        className="report-chip"
                        data-tone={PRIORITY_TONE[priority]}
                      >
                        优先级 {PRIORITY_LABEL[priority]}
                      </span>
                    </div>
                  </div>
                </div>

                {snippet && (
                  <div className="report-quote ml-8 mb-3">
                    <span className="opacity-60 mr-1 not-italic">原文</span>
                    {snippet}
                  </div>
                )}

                <div className="ml-8 space-y-1.5 text-[13.5px] leading-[1.75]">
                  <p>
                    <span className="inline-block w-10 text-[11px] font-semibold tracking-wider uppercase text-[var(--semantic-warning)] align-baseline">
                      问题
                    </span>
                    <span className="text-[var(--navy-800)]">{issue}</span>
                  </p>
                  <p>
                    <span className="inline-block w-10 text-[11px] font-semibold tracking-wider uppercase text-[var(--semantic-positive)] align-baseline">
                      建议
                    </span>
                    <span className="text-[var(--navy-800)]">{suggestion}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </SectionWrapper>
  );
}
