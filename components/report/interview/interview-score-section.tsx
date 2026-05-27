"use client";

import { motion } from "framer-motion";
import { SectionWrapper } from "./section-wrapper";
import { useReportRender } from "./report-context";
import type { InterviewScore } from "@/lib/types-interview";

interface Props {
  data: InterviewScore | null | undefined;
  index: number;
  total: number;
}

const cubicEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** 10 分制评分等级标签 */
function getScoreLabel(score: number): string {
  if (score <= 4) return "待提升";
  if (score <= 6) return "中等";
  if (score <= 8) return "良好";
  return "优秀";
}

/** 10 分制颜色映射 */
function getScoreColor(score: number): string {
  if (score <= 4) return "text-amber-600";
  if (score <= 6) return "text-blue-600";
  if (score <= 8) return "text-emerald-600";
  return "text-emerald-700";
}

export function InterviewScoreSection({ data, index, total }: Props) {
  const { exporting } = useReportRender();

  if (!data) {
    return (
      <SectionWrapper id="interview-score" title="面试评分" index={index} total={total}>
        <div className="rounded-xl border border-dashed border-[var(--blue-200)] bg-[var(--blue-50)]/40 px-5 py-8 text-center text-[13.5px] text-[var(--report-ink-muted)]">
          ⏳ 面试评分模块生成中…
        </div>
      </SectionWrapper>
    );
  }

  const { totalScore, deductions, overallEvaluation } = data;

  const fadeIn = exporting
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.3 },
      };

  return (
    <SectionWrapper id="interview-score" title="面试评分" index={index} total={total}>
      {/* 总分大卡片 */}
      <motion.div {...fadeIn} className="mb-5">
        <div className="rounded-xl border border-[var(--blue-100)] bg-gradient-to-b from-white to-[var(--blue-50)]/30 p-6 break-inside-avoid">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--report-ink-muted)] mb-1">
                面试总分
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-5xl font-bold ${getScoreColor(totalScore)}`}>
                  {totalScore.toFixed(1)}
                </span>
                <span className="text-lg text-[var(--navy-600)]">/ 10</span>
              </div>
              <div className="mt-2 inline-flex items-center rounded-full bg-[var(--blue-50)] px-3 py-1 text-[11px] font-medium text-[var(--blue-700)] border border-[var(--blue-100)]">
                {getScoreLabel(totalScore)}
              </div>
            </div>
            <div className="hidden sm:block">
              <svg className="w-20 h-20 text-[var(--blue-500)]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
              </svg>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 扣分点 + 整体评价 并排布局 */}
      <motion.div {...fadeIn} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 扣分点 */}
        {deductions && deductions.length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50/40 to-white p-5 break-inside-avoid">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--report-ink-muted)]">
                扣分点
              </span>
            </div>
            <ul className="space-y-2">
              {deductions.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 text-[13.5px] text-[var(--navy-700)]">
                  <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold flex-shrink-0">
                    -{item.deductedPoints}
                  </span>
                  <span className="leading-relaxed">{item.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 整体评价 */}
        {overallEvaluation && (
          <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 to-white p-5 break-inside-avoid">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41zM12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"/>
              </svg>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--report-ink-muted)]">
                本轮面试整体评价
              </span>
            </div>
            <p className="text-[13.5px] text-[var(--navy-700)] leading-relaxed text-justify">
              {overallEvaluation}
            </p>
          </div>
        )}
      </motion.div>
    </SectionWrapper>
  );
}
