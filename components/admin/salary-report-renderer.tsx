"use client";

import { useMemo } from "react";
import { ReportRenderContext } from "@/components/report/salary/report-context";
import { HeaderSection } from "@/components/report/salary/header-section";
import { OverviewSection } from "@/components/report/salary/overview-section";
import { MarketSection } from "@/components/report/salary/market-section";
import { CitySection } from "@/components/report/salary/city-section";
import { IndustrySection } from "@/components/report/salary/industry-section";
import type { SalaryReportData } from "@/lib/types-salary";

interface Props {
  reportData: SalaryReportData | null;
}

const TOTAL = 5;

export function SalaryReportRenderer({ reportData }: Props) {
  const ctxValue = useMemo(() => ({ exporting: false }), []);

  if (!reportData) {
    return (
      <div className="rounded-xl border border-[oklch(0.85_0.1_70)] bg-[oklch(0.97_0.06_70)] px-5 py-4 text-sm text-[var(--semantic-warning)]">
        报告数据不可用（report_json 为空或解析失败）
      </div>
    );
  }

  return (
    <ReportRenderContext.Provider value={ctxValue}>
      <div className="space-y-5">
        <HeaderSection data={reportData} index={1} total={TOTAL} />
        <OverviewSection data={reportData} index={2} total={TOTAL} />
        <MarketSection data={reportData} index={3} total={TOTAL} />
        <CitySection data={reportData.cityAnalysis} index={4} total={TOTAL} />
        <IndustrySection data={reportData.industryAnalysis} index={5} total={TOTAL} />
      </div>
    </ReportRenderContext.Provider>
  );
}
