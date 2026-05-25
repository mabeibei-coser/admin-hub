"use client";

import { ArrowUp, ArrowDown, Minus, Users } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import {
  formatNumber,
  generateMarketSummary,
  getComparisonStyle,
} from "@/lib/salary-format";
import type { SalaryReportData } from "@/lib/types-salary";

interface Props {
  data: SalaryReportData;
  index: number;
  total: number;
}

export function MarketSection({ data, index, total }: Props) {
  const { diffPct } = data.marketComparison;
  const style = getComparisonStyle(diffPct);
  const summary = generateMarketSummary(data.position, data.company, diffPct, data.monthly.p50);

  const DiffIcon = diffPct > 5 ? ArrowUp : diffPct < -5 ? ArrowDown : Minus;

  const topMonthly = data.marketRanking[0]?.monthly || 1;

  return (
    <SectionWrapper id="market" title="市场定位分析" index={index} total={total}>
      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-5 rounded-lg border border-[var(--report-border)] bg-[var(--cyan-50)] p-4">
          <div className="text-[11px] text-[var(--report-ink-muted)]">当前月薪 vs 市场均值</div>
          <div className="mt-1 text-[26px] font-bold text-[var(--navy-900)] tabular-nums leading-none">
            ¥{formatNumber(data.monthly.p50)}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <DiffIcon className="size-4" />
            <span className="text-[18px] font-semibold tabular-nums">
              {diffPct > 0 ? "+" : ""}
              {diffPct}%
            </span>
            <span className="status-pill ml-2" data-tone={style.tone}>
              {style.text}
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--report-ink-soft)]">
            {summary}
          </p>
        </div>

        <div className="md:col-span-7">
          <div className="text-[11.5px] font-medium text-[var(--report-ink-muted)] mb-2">
            该岗位在不同企业性质中的薪酬排名
          </div>
          <div className="flex flex-col gap-1.5">
            {data.marketRanking.map((item, idx) => {
              const isCurrent = item.company === data.company;
              const barWidth = `${Math.max(8, (item.monthly / topMonthly) * 100)}%`;
              return (
                <div
                  key={`${item.company}-${idx}`}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 ${
                    isCurrent
                      ? "bg-[var(--cyan-50)] ring-1 ring-[var(--cyan-200)]"
                      : ""
                  }`}
                >
                  <span className="w-5 text-[11px] font-bold tabular-nums text-[var(--cyan-700)]">
                    #{idx + 1}
                  </span>
                  <span
                    className={`w-[72px] text-[12px] truncate ${
                      isCurrent
                        ? "font-semibold text-[var(--navy-900)]"
                        : "text-[var(--report-ink-soft)]"
                    }`}
                  >
                    {item.company}
                  </span>
                  <div className="flex-1 relative h-5">
                    <div
                      className="absolute inset-y-0 left-0 rounded bg-gradient-to-r from-[var(--cyan-500)] to-[var(--cyan-600)] flex items-center justify-end pr-1.5"
                      style={{ width: barWidth }}
                    >
                      <span className="text-[10.5px] font-semibold text-white tabular-nums">
                        ¥{(item.monthly / 1000).toFixed(1)}k
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {data.highEarnerTraits && (
        <div className="mt-4 rounded-lg border border-[var(--report-border)] bg-[oklch(0.985_0.006_240)] p-3">
          <div className="flex items-center gap-1.5 mb-1 text-[var(--cyan-700)]">
            <Users className="size-4" />
            <span className="text-[11.5px] font-semibold">较高薪资人群特点</span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-[var(--report-ink-soft)]">
            {data.highEarnerTraits}
          </p>
        </div>
      )}
    </SectionWrapper>
  );
}
