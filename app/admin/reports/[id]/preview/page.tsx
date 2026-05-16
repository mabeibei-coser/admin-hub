"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { ReportRenderContext } from "@/components/report/report-context";
import { OverviewSection } from "@/components/report/overview-section";
import { SalarySection } from "@/components/report/salary-section";
import { PositionInfoSection } from "@/components/report/position-info-section";
import { ResumeDiagnosisSection } from "@/components/report/resume-diagnosis-section";
import { NegotiationSection } from "@/components/report/negotiation-section";
import { WorkplaceInsightSection } from "@/components/report/workplace-insight-section";
import type { ReportData, JobFormData, QuizAnswer } from "@/lib/types";

interface StoredFile {
  formData: JobFormData;
  quizAnswers: QuizAnswer[];
  reportData: ReportData;
  sectionsStatus: Record<string, unknown>;
}

interface ApiResponse {
  meta: Record<string, unknown>;
  reportData: StoredFile | null;
}

const TOTAL = 6;

export default function ReportPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/reports/${id}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ApiResponse>;
      })
      .then((d) => setApiData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id]);

  const ctxValue = useMemo(() => ({ exporting: false }), []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[var(--blue-50)]/60 to-white">
        <Loader2 className="size-8 animate-spin text-[var(--blue-500)]" />
      </div>
    );
  }

  if (error || !apiData?.reportData?.reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[var(--blue-50)]/60 to-white px-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="mx-auto size-10 text-amber-500" />
          <div className="text-lg font-semibold text-gray-800">报告数据不可用</div>
          <div className="text-sm text-gray-500">{error ?? "报告文件缺失或已损坏"}</div>
        </div>
      </div>
    );
  }

  const { reportData: report, formData } = apiData.reportData;
  const meta = apiData.meta;
  const position = (meta.target_position as string) ?? formData?.targetPosition ?? "—";
  const education = (meta.target_education as string) ?? formData?.targetEducation ?? "";
  const createdAt = meta.created_at
    ? new Date(meta.created_at as number).toLocaleString("zh-CN")
    : "—";

  return (
    <ReportRenderContext.Provider value={ctxValue}>
      {/* 管理员预览横幅 */}
      <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2">
        <AlertTriangle className="size-3.5 shrink-0" />
        <span>
          管理员预览 · 报告 #{id} · 岗位：{position} · 生成时间：{createdAt}
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {report.overview && (
          <OverviewSection data={report.overview} index={1} total={TOTAL} />
        )}
        {report.salary && (
          <SalarySection
            data={report.salary}
            positionName={position}
            targetEducation={education}
            index={2}
            total={TOTAL}
          />
        )}
        {report.positionInfo && (
          <PositionInfoSection
            data={report.positionInfo}
            positionName={position}
            index={3}
            total={TOTAL}
          />
        )}
        {report.resumeDiagnosis && (
          <ResumeDiagnosisSection
            data={report.resumeDiagnosis}
            index={4}
            total={TOTAL}
          />
        )}
        {report.salaryNegotiation && (
          <NegotiationSection
            data={report.salaryNegotiation}
            index={5}
            total={TOTAL}
          />
        )}
        {report.workplaceInsight && (
          <WorkplaceInsightSection
            data={report.workplaceInsight}
            index={6}
            total={TOTAL}
          />
        )}
      </div>
    </ReportRenderContext.Provider>
  );
}
