"use client";

import { useMemo } from "react";
import { ReportRenderContext } from "@/components/report/startup/report-context";
import { OverviewSection } from "@/components/report/startup/overview-section";
import { DimensionDetailsSection } from "@/components/report/startup/dimension-details-section";
import { RiskSection } from "@/components/report/startup/risk-section";
import type {
  ReportData,
  JobFormData,
  ScoringResult,
  InterviewQ1Q2,
} from "@/lib/types-startup";

interface Props {
  reportData: ReportData | null;
  interviewQ1Q2: InterviewQ1Q2 | null;
  formData: JobFormData | null;
  scoring: ScoringResult | null;
}

const TOTAL = 3;

export function StartupReportRenderer({ reportData, interviewQ1Q2, formData, scoring }: Props) {
  const ctxValue = useMemo(() => ({ exporting: false }), []);

  if (!reportData) {
    return (
      <div className="rounded-xl border border-[oklch(0.85_0.1_70)] dark:border-[oklch(0.4_0.1_65)] bg-[oklch(0.97_0.06_70)] dark:bg-[oklch(0.3_0.08_65)] px-5 py-4 text-sm text-[var(--semantic-warning)]">
        报告数据不可用（report_json 为空或解析失败）
      </div>
    );
  }

  const { overview, dimensionDetails, riskAssessment, meta } = reportData;
  const effectiveMeta = meta ?? {
    generatedAt: new Date().toISOString(),
    formData:
      formData ??
      ({
        projectName: "",
        startupCapital: "",
        productOrService: "",
        startupExperience: "none",
      } as JobFormData),
    scoring: scoring ?? ({ sixDim: [], ability: [] } as ScoringResult),
    hasResume: false,
    interviewQ1Q2: interviewQ1Q2 ?? {},
  };

  return (
    <ReportRenderContext.Provider value={ctxValue}>
      <div className="space-y-5">
        {overview && (
          <OverviewSection data={overview} meta={effectiveMeta} index={1} total={TOTAL} />
        )}
        {dimensionDetails && (
          <DimensionDetailsSection data={dimensionDetails} index={2} total={TOTAL} />
        )}
        {riskAssessment && (
          <RiskSection data={riskAssessment} index={3} total={TOTAL} />
        )}
      </div>
    </ReportRenderContext.Provider>
  );
}
