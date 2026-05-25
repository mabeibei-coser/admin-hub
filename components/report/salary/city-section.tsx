"use client";

import { MapPin } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { formatNumber } from "@/lib/salary-format";
import type { CityAnalysisItem } from "@/lib/types-salary";

interface Props {
  data: CityAnalysisItem[];
  index: number;
  total: number;
}

const LEVEL_TONE: Record<string, "positive" | "neutral" | "warning"> = {
  高: "positive",
  中: "neutral",
  低: "warning",
};

export function CitySection({ data, index, total }: Props) {
  if (!data || data.length === 0) {
    return (
      <SectionWrapper id="city" title="城市对比" index={index} total={total}>
        <div className="text-[13px] text-[var(--report-ink-muted)] text-center py-4">
          暂无城市数据
        </div>
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper id="city" title="城市对比" index={index} total={total}>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {data.map((c, i) => (
          <div
            key={`${c.city}-${i}`}
            className="rounded-lg border border-[var(--report-border)] bg-white p-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1 text-[var(--navy-900)] font-semibold text-[13px]">
                <MapPin className="size-3.5 text-[var(--cyan-600)]" />
                {c.city}
              </div>
              <span
                className="status-pill"
                data-tone={LEVEL_TONE[c.salaryLevel] ?? "neutral"}
              >
                {c.salaryLevel}
              </span>
            </div>
            <div className="text-[16px] font-bold tabular-nums text-[var(--navy-900)]">
              ¥{formatNumber(c.monthlyAvg)}
              <span className="text-[10.5px] font-normal text-[var(--report-ink-muted)] ml-1">
                /月
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[var(--report-ink-muted)] tabular-nums">
              生活成本指数 {c.costIndex}（北京=100）
            </div>
            {c.advantage && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--report-ink-soft)] line-clamp-2">
                {c.advantage}
              </p>
            )}
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
