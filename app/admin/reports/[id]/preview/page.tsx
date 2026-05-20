"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { ReportRenderContext } from "@/components/report/report-context";
import { OverviewSection } from "@/components/report/overview-section";
import { SalarySection } from "@/components/report/salary-section";
import { PositionInfoSection } from "@/components/report/position-info-section";
import { ResumeDiagnosisSection } from "@/components/report/resume-diagnosis-section";
import { NegotiationSection } from "@/components/report/negotiation-section";
import { WorkplaceInsightSection } from "@/components/report/workplace-insight-section";
import { NavReportRenderer } from "@/components/admin/nav-report-renderer";
import { StartupReportRenderer } from "@/components/admin/startup-report-renderer";
import { TailorReportRenderer } from "@/components/admin/tailor-report-renderer";
import type { ReportData, JobFormData } from "@/lib/types";
import type {
  ReportData as NavReportData,
  JobFormData as NavJobFormData,
  ScoringResult,
  InterviewQ1Q2,
} from "@/lib/types-nav";
import type {
  ReportData as StartupReportData,
  JobFormData as StartupJobFormData,
  ScoringResult as StartupScoringResult,
  InterviewQ1Q6 as StartupInterviewQ1Q6,
} from "@/lib/types-startup";
import type { TailorReport } from "@/lib/types-tailor";
import { withBase } from "@/lib/url";

type Project = "report" | "nav" | "startup" | "tailor";

interface ApiResponse {
  project: Project;
  meta: Record<string, unknown>;
  reportData: ReportData | NavReportData | StartupReportData | null;
  interviewQ1Q2?: InterviewQ1Q2 | StartupInterviewQ1Q6 | null;
  formData: JobFormData | NavJobFormData | StartupJobFormData | null;
  scoring?: ScoringResult | StartupScoringResult | null;
}

const TOTAL_REPORT = 6;

export default function ReportPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const rawProject = searchParams.get("project");
  const project: Project =
    rawProject === "nav"
      ? "nav"
      : rawProject === "startup"
        ? "startup"
        : rawProject === "tailor"
          ? "tailor"
          : "report";

  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(withBase(`/api/admin/reports/${id}?project=${project}`))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ApiResponse>;
      })
      .then((d) => setApiData(d))
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, [id, project]);

  const ctxValue = useMemo(() => ({ exporting: false }), []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[var(--blue-50)]/60 to-white">
        <Loader2 className="size-8 animate-spin text-[var(--blue-500)]" />
      </div>
    );
  }

  if (error || !apiData?.reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[var(--blue-50)]/60 to-white px-6">
        <div className="max-w-md text-center space-y-3">
          <AlertTriangle className="mx-auto size-10 text-[var(--semantic-warning)]" />
          <div className="text-lg font-semibold text-foreground">报告数据不可用</div>
          <div className="text-sm text-muted-foreground">{error ?? "报告文件缺失或已损坏"}</div>
        </div>
      </div>
    );
  }

  const meta = apiData.meta;
  const position = (meta.target_position as string) ?? "—";
  const createdAt = meta.created_at
    ? new Date(meta.created_at as number).toLocaleString("zh-CN")
    : "—";

  const banner = (
    <div className="sticky top-0 z-50 bg-[oklch(0.97_0.06_70)] dark:bg-[oklch(0.3_0.08_65)] border-b border-[oklch(0.85_0.1_70)] dark:border-[oklch(0.4_0.1_65)] px-4 py-2 text-xs text-[var(--semantic-warning)] flex items-center gap-2">
      <AlertTriangle className="size-3.5 shrink-0" />
      <span>
        管理员预览 · 报告 #{id} · 岗位：{position} · 生成时间：{createdAt}
      </span>
    </div>
  );

  if (project === "nav") {
    return (
      <>
        {banner}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <NavReportRenderer
            reportData={apiData.reportData as NavReportData}
            interviewQ1Q2={(apiData.interviewQ1Q2 as InterviewQ1Q2 | undefined) ?? null}
            formData={apiData.formData as NavJobFormData | null}
            scoring={(apiData.scoring as ScoringResult | undefined) ?? null}
          />
        </div>
      </>
    );
  }

  if (project === "startup") {
    return (
      <>
        {banner}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <StartupReportRenderer
            reportData={apiData.reportData as StartupReportData}
            interviewQ1Q2={(apiData.interviewQ1Q2 as StartupInterviewQ1Q6 | undefined) ?? null}
            formData={apiData.formData as StartupJobFormData | null}
            scoring={(apiData.scoring as StartupScoringResult | undefined) ?? null}
          />
        </div>
      </>
    );
  }

  if (project === "tailor") {
    return (
      <>
        {banner}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          <TailorReportRenderer reportData={apiData.reportData as unknown as TailorReport | null} />
        </div>
      </>
    );
  }

  // report 项目
  const report = apiData.reportData as ReportData;
  const formData = apiData.formData as JobFormData | null;
  const education =
    (meta.target_education as string) ?? formData?.targetEducation ?? "";

  return (
    <ReportRenderContext.Provider value={ctxValue}>
      {banner}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {report.overview && (
          <OverviewSection data={report.overview} index={1} total={TOTAL_REPORT} />
        )}
        {report.salary && (
          <SalarySection
            data={report.salary}
            positionName={position}
            targetEducation={education}
            index={2}
            total={TOTAL_REPORT}
          />
        )}
        {report.positionInfo && (
          <PositionInfoSection
            data={report.positionInfo}
            positionName={position}
            index={3}
            total={TOTAL_REPORT}
          />
        )}
        {report.resumeDiagnosis && (
          <ResumeDiagnosisSection
            data={report.resumeDiagnosis}
            index={4}
            total={TOTAL_REPORT}
          />
        )}
        {report.salaryNegotiation && (
          <NegotiationSection
            data={report.salaryNegotiation}
            index={5}
            total={TOTAL_REPORT}
          />
        )}
        {report.workplaceInsight && (
          <WorkplaceInsightSection
            data={report.workplaceInsight}
            index={6}
            total={TOTAL_REPORT}
          />
        )}
      </div>
    </ReportRenderContext.Provider>
  );
}
