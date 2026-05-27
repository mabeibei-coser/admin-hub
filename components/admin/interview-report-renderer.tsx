"use client";

import { useMemo } from "react";
import { ReportRenderContext } from "@/components/report/interview/report-context";
import { InterviewScoreSection } from "@/components/report/interview/interview-score-section";
import { JobMatchingSection } from "@/components/report/interview/job-matching-section";
import { PsychInterpretationSection } from "@/components/report/interview/psych-interpretation-section";
import { SectionErrorBoundary } from "@/components/admin/section-error-boundary";
import type { InterviewReport } from "@/lib/types-interview";

interface Props {
  reportData: InterviewReport | null;
}

const TOTAL = 3;

export function InterviewReportRenderer({ reportData }: Props) {
  const ctxValue = useMemo(() => ({ exporting: false }), []);

  if (!reportData) {
    return (
      <div className="rounded-xl border border-[oklch(0.85_0.1_70)] dark:border-[oklch(0.4_0.1_65)] bg-[oklch(0.97_0.06_70)] dark:bg-[oklch(0.3_0.08_65)] px-5 py-4 text-sm text-[var(--semantic-warning)]">
        报告数据不可用（report_json 为空或解析失败）
      </div>
    );
  }

  const { scoreSection, matchingSection, psychSection } = reportData;

  return (
    <ReportRenderContext.Provider value={ctxValue}>
      <div className="space-y-5">
        {scoreSection && (
          <SectionErrorBoundary name="面试评分">
            <InterviewScoreSection data={scoreSection} index={1} total={TOTAL} />
          </SectionErrorBoundary>
        )}
        {matchingSection && (
          <SectionErrorBoundary name="岗位匹配">
            <JobMatchingSection data={matchingSection} index={2} total={TOTAL} />
          </SectionErrorBoundary>
        )}
        {psychSection && (
          <SectionErrorBoundary name="心理素质">
            <PsychInterpretationSection data={psychSection} index={3} total={TOTAL} />
          </SectionErrorBoundary>
        )}
      </div>
    </ReportRenderContext.Provider>
  );
}
