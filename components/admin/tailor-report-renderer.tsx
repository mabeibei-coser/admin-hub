"use client";

import type { TailorReport } from "@/lib/types-tailor";
import { SuggestionsSection } from "@/components/report/tailor/suggestions-section";
import { InterviewSection } from "@/components/report/tailor/interview-section";
import { SectionErrorBoundary } from "@/components/admin/section-error-boundary";

interface Props {
  reportData: TailorReport | null;
}

const TOTAL = 2;

export function TailorReportRenderer({ reportData }: Props) {
  if (!reportData) {
    return (
      <div className="rounded-xl border border-[oklch(0.85_0.1_50)] dark:border-[oklch(0.4_0.1_50)] bg-[oklch(0.97_0.03_50)] dark:bg-[oklch(0.3_0.05_50)] px-5 py-4 text-sm text-[var(--orange-700)]">
        报告数据不可用（report_json 为空或解析失败）
      </div>
    );
  }

  const { suggestions, interview } = reportData;

  return (
    <div className="space-y-5">
      {suggestions && suggestions.length > 0 && (
        <SectionErrorBoundary name="改写建议">
          <SuggestionsSection suggestions={suggestions} index={1} total={TOTAL} />
        </SectionErrorBoundary>
      )}
      {interview && interview.length > 0 && (
        <SectionErrorBoundary name="面试问答">
          <InterviewSection interview={interview} index={2} total={TOTAL} />
        </SectionErrorBoundary>
      )}
    </div>
  );
}
