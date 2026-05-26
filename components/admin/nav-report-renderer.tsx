"use client";

import { useMemo } from "react";
import { ReportRenderContext } from "@/components/report/nav/report-context";
import { OverviewSection } from "@/components/report/nav/overview-section";
import StrengthSection from "@/components/report/nav/strength-section";
import PositioningSection from "@/components/report/nav/positioning-section";
import ResumeDiagnosisSection from "@/components/report/nav/resume-diagnosis-section";
import AdviceSection from "@/components/report/nav/advice-section";
import { SectionErrorBoundary } from "@/components/admin/section-error-boundary";
import type {
  ReportData,
  JobFormData,
  ScoringResult,
  InterviewQ1Q2,
} from "@/lib/types-nav";

interface Props {
  reportData: ReportData | null;
  interviewQ1Q2: InterviewQ1Q2 | null;
  formData: JobFormData | null;
  scoring: ScoringResult | null;
}

const TOTAL = 5;

export function NavReportRenderer({ reportData, interviewQ1Q2, formData, scoring }: Props) {
  const ctxValue = useMemo(() => ({ exporting: false }), []);

  if (!reportData) {
    return (
      <div className="rounded-xl border border-[oklch(0.85_0.1_70)] dark:border-[oklch(0.4_0.1_65)] bg-[oklch(0.97_0.06_70)] dark:bg-[oklch(0.3_0.08_65)] px-5 py-4 text-sm text-[var(--semantic-warning)]">
        报告数据不可用（report_json 为空或解析失败）
      </div>
    );
  }

  const { overview, strength, positioning, resumeDiagnosis, advice, meta } = reportData;
  const effectiveMeta = meta ?? {
    generatedAt: new Date().toISOString(),
    formData: formData ?? ({ targetPosition: "", identity: "recent_grad", education: "", workYears: "" } as JobFormData),
    scoring: scoring ?? ({ fourDim: [], ability: [] } as ScoringResult),
    hasResume: false,
    interviewQ1Q2: interviewQ1Q2 ?? {},
  };

  return (
    <ReportRenderContext.Provider value={ctxValue}>
      <div className="space-y-5">
        {overview && (
          <SectionErrorBoundary name="职业概览">
            <OverviewSection data={overview} meta={effectiveMeta} index={1} total={TOTAL} />
          </SectionErrorBoundary>
        )}
        {strength && (
          <SectionErrorBoundary name="优势分析">
            <StrengthSection data={strength} index={2} total={TOTAL} />
          </SectionErrorBoundary>
        )}
        {positioning && (
          <SectionErrorBoundary name="职业定位">
            <PositioningSection data={positioning} index={3} total={TOTAL} />
          </SectionErrorBoundary>
        )}
        {resumeDiagnosis !== undefined && (
          <SectionErrorBoundary name="简历诊断">
            <ResumeDiagnosisSection data={resumeDiagnosis} index={4} total={TOTAL} />
          </SectionErrorBoundary>
        )}
        {advice && (
          <SectionErrorBoundary name="建议">
            <AdviceSection data={advice} index={5} total={TOTAL} />
          </SectionErrorBoundary>
        )}
      </div>
    </ReportRenderContext.Provider>
  );
}
