"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { ReportRenderContext } from "@/components/report/nav/report-context";
import { OverviewSection } from "@/components/report/nav/overview-section";
import StrengthSection from "@/components/report/nav/strength-section";
import PositioningSection from "@/components/report/nav/positioning-section";
import ResumeDiagnosisSection from "@/components/report/nav/resume-diagnosis-section";
import AdviceSection from "@/components/report/nav/advice-section";
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

function Q1Q2Transcript({ data }: { data: InterviewQ1Q2 }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-red-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-red-500 shrink-0" />
          <span className="text-sm font-semibold text-red-700">
            访谈内容 Q1 / Q2（含个人陈述，PII 敏感）
          </span>
        </div>
        {open ? (
          <ChevronUp className="size-4 text-red-400 shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-red-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t border-red-100 px-5 py-4 space-y-4">
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-xs text-red-700">
            ⚠️ 以下内容为用户访谈原始回答，含有个人经历等敏感信息。请勿截图传播或用于对外汇报。
          </div>
          {data.Q1 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Q1 动态访谈（AI 生成题）</div>
              <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                {data.Q1}
              </pre>
            </div>
          )}
          {data.Q2 && (
            <div>
              <div className="text-xs font-medium text-gray-500 mb-1.5">Q2 动态访谈（AI 生成题）</div>
              <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                {data.Q2}
              </pre>
            </div>
          )}
          {!data.Q1 && !data.Q2 && (
            <p className="text-sm text-gray-400">暂无访谈内容</p>
          )}
        </div>
      )}
    </div>
  );
}

export function NavReportRenderer({ reportData, interviewQ1Q2, formData, scoring }: Props) {
  const ctxValue = useMemo(() => ({ exporting: false }), []);

  if (!reportData) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
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
        {/* Q1Q2 PII section — always shown first so admin can see it before rendering */}
        {interviewQ1Q2 && (interviewQ1Q2.Q1 || interviewQ1Q2.Q2) && (
          <Q1Q2Transcript data={interviewQ1Q2} />
        )}

        {overview && (
          <OverviewSection data={overview} meta={effectiveMeta} index={1} total={TOTAL} />
        )}
        {strength && (
          <StrengthSection data={strength} index={2} total={TOTAL} />
        )}
        {positioning && (
          <PositioningSection data={positioning} index={3} total={TOTAL} />
        )}
        {resumeDiagnosis !== undefined && (
          <ResumeDiagnosisSection data={resumeDiagnosis} index={4} total={TOTAL} />
        )}
        {advice && (
          <AdviceSection data={advice} index={5} total={TOTAL} />
        )}
      </div>
    </ReportRenderContext.Provider>
  );
}
