"use client";

import { Factory } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import type { IndustryAnalysisItem } from "@/lib/types-salary";

interface Props {
  data: IndustryAnalysisItem[];
  index: number;
  total: number;
}

const DEMAND_TONE: Record<string, "positive" | "neutral" | "warning"> = {
  高: "positive",
  中: "neutral",
  低: "warning",
};

export function IndustrySection({ data, index, total }: Props) {
  if (!data || data.length === 0) {
    return (
      <SectionWrapper id="industry" title="细分行业分析" index={index} total={total}>
        <div className="text-[13px] text-[var(--report-ink-muted)] text-center py-4">
          暂无行业数据
        </div>
      </SectionWrapper>
    );
  }
  return (
    <SectionWrapper id="industry" title="细分行业分析" index={index} total={total}>
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-[12.5px] border-separate border-spacing-y-1.5 min-w-[680px]">
          <thead>
            <tr className="text-[11px] text-[var(--report-ink-muted)] uppercase tracking-wider">
              <th className="text-left px-2 py-1 font-medium">行业</th>
              <th className="text-left px-2 py-1 font-medium">月薪范围</th>
              <th className="text-left px-2 py-1 font-medium">年薪范围</th>
              <th className="text-center px-2 py-1 font-medium">人才需求</th>
              <th className="text-right px-2 py-1 font-medium">上年涨薪</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={`${row.industry}-${i}`}
                className="bg-white ring-1 ring-[var(--report-border)] rounded-md"
              >
                <td className="px-2 py-2 rounded-l-md">
                  <div className="flex items-center gap-1.5">
                    <Factory className="size-3.5 text-[var(--cyan-600)] shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-[var(--navy-900)] truncate">
                        {row.industry}
                      </div>
                      {row.description && (
                        <div className="text-[10.5px] text-[var(--report-ink-muted)] truncate">
                          {row.description}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-[var(--report-ink-soft)] tabular-nums whitespace-nowrap">
                  {row.monthlyRange}
                </td>
                <td className="px-2 py-2 text-[var(--report-ink-soft)] tabular-nums whitespace-nowrap">
                  {row.annualRange}
                </td>
                <td className="px-2 py-2 text-center">
                  <span
                    className="status-pill"
                    data-tone={DEMAND_TONE[row.demandLevel] ?? "neutral"}
                  >
                    {row.demandLevel}
                  </span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-[var(--cyan-700)] font-semibold rounded-r-md whitespace-nowrap">
                  {row.salaryIncrease}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionWrapper>
  );
}
