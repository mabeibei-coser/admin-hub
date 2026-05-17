import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminDb, isNavDbReady } from "@/lib/db";
import fs from "fs";
import path from "path";
import { ChevronLeft, Download, AlertTriangle } from "lucide-react";
import { withBase } from "@/lib/url";
import type { JobFormData, QuizAnswer } from "@/lib/types";
import type { JobFormData as NavJobFormData, QuizAnswer as NavQuizAnswer, ReportData as NavReportData, InterviewQ1Q2, QuizBank, QuizQuestion as NavQuizQuestion } from "@/lib/types-nav";
import { PROJECTS } from "@/lib/projects";

type ProjectId = "report" | "nav";

function parseProject(v: string | undefined): ProjectId {
  return v === "nav" ? "nav" : "report";
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-50 last:border-0">
      <span className="shrink-0 w-28 text-xs text-gray-500 pt-0.5">{label}</span>
      <span className="text-sm text-gray-800 break-all">{value ?? "—"}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
      {children}
    </div>
  );
}

const IDENTITY_LABELS: Record<string, string> = {
  recent_grad: "应届毕业生",
  young_unemployed: "35岁以下求职者",
  general_unemployed: "35岁以上求职者",
};

const EDUCATION_LABELS: Record<string, string> = {
  junior_high: "初中及以下",
  high_school: "高中/中专/技校",
  junior_college: "高职/大专",
  bachelor: "本科",
  master_plus: "硕士及以上",
};

const WORK_YEARS_LABELS: Record<string, string> = {
  lt1: "0-1 年",
  "1to3": "1-3 年",
  "3to10": "3-10 年",
  gt10: "10 年以上",
};

function eduLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return EDUCATION_LABELS[v] ?? v;
}

function workYearsLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return WORK_YEARS_LABELS[v] ?? v;
}

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const [{ id: idStr }, sp] = await Promise.all([params, searchParams]);
  const id = parseInt(idStr);
  if (isNaN(id)) notFound();

  const project = parseProject(sp.project);
  const projectMeta = PROJECTS[project];

  if (project === "nav" && !isNavDbReady()) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
            <ChevronLeft className="size-4" />报告列表
          </Link>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            职业导航数据库暂不可用，无法加载此报告。
          </div>
        </div>
      </div>
    );
  }

  const db = getAdminDb();
  const table = project === "nav" ? "nav.reports" : "main.reports";
  const row = db
    .prepare(`SELECT * FROM ${table} WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;

  if (!row) notFound();

  // ─── Parse data by project ────────────────────────────────────────────────
  let reportData: NavReportData | null = null;
  let interviewQ1Q2: InterviewQ1Q2 | null = null;
  let interviewQuestions: { Q1?: string; Q2?: string } | null = null;
  let navFormData: NavJobFormData | null = null;
  let navQuizAnswers: NavQuizAnswer[] | null = null;
  let navQuizBankMap = new Map<string, { text: string; options: { label: string; text: string }[] }>();
  let reportFormData: JobFormData | null = null;
  let reportQuizAnswers: QuizAnswer[] = [];

  if (project === "nav") {
    try { reportData = JSON.parse(row.report_json as string) as NavReportData; } catch { /* empty */ }
    try { interviewQ1Q2 = JSON.parse(row.interview_q1q2_json as string) as InterviewQ1Q2; } catch { /* empty */ }
    try { navFormData = JSON.parse(row.form_data_json as string) as NavJobFormData; } catch { /* empty */ }
    try { navQuizAnswers = JSON.parse(row.quiz_answers_json as string) as NavQuizAnswer[]; } catch { /* empty */ }
    // 访谈 Q1/Q2 题干（career-nav v0.10.13+ 持久化；老档案为 null）
    try {
      const iqStr = row.interview_questions_json as string | null;
      if (iqStr) interviewQuestions = JSON.parse(iqStr) as { Q1?: string; Q2?: string };
    } catch { /* empty */ }
    // 量表题 lookup map：合并 quiz-bank.json 固定题（SJT-01/02）+ db 里持久化的动态题（SJT-03~08）
    const navDbPath = process.env.NAV_DB_PATH;
    if (navDbPath) {
      try {
        const bank = JSON.parse(fs.readFileSync(path.join(path.dirname(navDbPath), "quiz-bank.json"), "utf-8")) as QuizBank;
        for (const q of bank.fixedQuestions) {
          navQuizBankMap.set(q.id, { text: q.text, options: q.options.map((o) => ({ label: o.label, text: o.text })) });
        }
      } catch { /* quiz bank missing or unreadable */ }
    }
    try {
      const dqStr = row.dynamic_questions_json as string | null;
      if (dqStr) {
        const dynamicQs = JSON.parse(dqStr) as NavQuizQuestion[];
        for (const q of dynamicQs) {
          navQuizBankMap.set(q.id, { text: q.text, options: q.options.map((o) => ({ label: o.label, text: o.text })) });
        }
      }
    } catch { /* dynamic questions missing or unreadable */ }
  } else {
    const storagePath = row.report_storage_path as string | null;
    if (storagePath) {
      try {
        const file = JSON.parse(fs.readFileSync(storagePath, "utf-8")) as Record<string, unknown>;
        const raw = (file.reportData ?? file) as Record<string, unknown>;
        reportFormData = (file.formData ?? raw.formData) as JobFormData | null;
        reportQuizAnswers = ((file.quizAnswers ?? raw.quizAnswers) as QuizAnswer[]) ?? [];
      } catch { /* missing or corrupt */ }
    }
  }

  const hasResumeFile =
    (row.has_resume as number) === 1 &&
    (row.resume_storage_path as string | null) &&
    fs.existsSync(row.resume_storage_path as string);

  const hasReportData = project === "nav" ? !!reportData : !!reportFormData;

  return (
    <div className="min-h-screen bg-gray-50 p-6 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* 返回 + 面包屑 */}
        <div className="flex items-center gap-2 print:hidden">
          <Link
            href="/admin/reports"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="size-4" />
            报告列表
          </Link>
          <span className="text-gray-300">/</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              project === "nav"
                ? "bg-green-100 text-green-700"
                : "bg-blue-100 text-blue-700"
            }`}
          >
            {projectMeta.label}
          </span>
        </div>

        {/* ── 基本信息 ─────────────────────────────────────────────────── */}
        <Card title="基本信息">
          <Row label="ID" value={String(row.id as number)} />
          <Row
            label="创建时间"
            value={new Date(row.created_at as number).toLocaleString("zh-CN")}
          />
          {/* 姓名 / 手机号（nav 侧从 form_data_json 取；report 侧暂无） */}
          {project === "nav" && (
            <>
              <Row label="姓名" value={navFormData?.name ?? null} />
              <Row label="手机号" value={navFormData?.phone ?? null} />
            </>
          )}
          <Row label="意向岗位" value={row.target_position as string} />
          {/* nav 侧学历优先取 form_data_json，列里的 target_education 总是 NULL */}
          <Row
            label="学历"
            value={
              project === "nav"
                ? eduLabel(navFormData?.education)
                : eduLabel(row.target_education as string | null)
            }
          />

          {project === "nav" ? (
            <>
              <Row label="工作年限" value={workYearsLabel(navFormData?.workYears)} />
              <Row
                label="用户身份"
                value={IDENTITY_LABELS[row.user_identity as string] ?? (row.user_identity as string | null)}
              />
            </>
          ) : (
            <>
              <Row label="意向公司" value={row.target_company as string | null} />
              <Row label="城市能级" value={row.target_city_tier as string | null} />
            </>
          )}

          <Row
            label="简历文件"
            value={
              (row.has_resume as number) ? (
                hasResumeFile ? (
                  <a
                    href={withBase(`/api/admin/reports/${String(row.id as number)}/resume?project=${project}`)}
                    download
                    className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                  >
                    <Download className="size-3.5" />
                    {row.resume_filename as string}
                  </a>
                ) : (
                  <span className="text-amber-600 text-xs">
                    文件已丢失（{row.resume_filename as string}）
                  </span>
                )
              ) : (
                "未上传"
              )
            }
          />
          <Row
            label="报告附件"
            value={
              hasReportData ? (
                <Link
                  href={`/admin/reports/${String(row.id as number)}/preview?project=${project}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                >
                  <Download className="size-3.5" />
                  {project === "nav" ? "职业导航报告" : "职业定位报告"}
                </Link>
              ) : (
                <span className="text-gray-400">未生成</span>
              )
            }
          />
        </Card>

        {/* ── 量表作答（report 侧） ───────────────────────────────────── */}
        {project === "report" && reportQuizAnswers.length > 0 && (
          <Card title={`测评作答（${reportQuizAnswers.length} 题）`}>
            <div className="space-y-2">
              {reportQuizAnswers.map((a, i) => (
                <div key={a.questionId} className="text-sm">
                  <span className="text-gray-400 text-xs mr-2">Q{i + 1}</span>
                  <span className="text-gray-700">{a.questionText}</span>
                  <div className="ml-6 mt-0.5 text-xs text-blue-700 bg-blue-50 inline-block px-2 py-0.5 rounded">
                    {a.selectedKey}. {a.selectedLabel}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── 量表作答（nav 侧） ─────────────────────────────────────── */}
        {project === "nav" && navQuizAnswers && navQuizAnswers.length > 0 && (
          <Card title={`量表作答（${navQuizAnswers.length} 题）`}>
            <div className="divide-y divide-gray-50">
              {navQuizAnswers.map((a, i) => {
                const q = navQuizBankMap.get(a.questionId);
                const opt = q?.options.find((o) => o.label === a.selectedLabel);
                return (
                  <div key={a.questionId} className="py-2.5">
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className="text-gray-400 text-xs shrink-0 mt-0.5">Q{i + 1}</span>
                      <div>
                        <span className="text-xs font-mono text-gray-400 mr-1.5">{a.questionId}</span>
                        <span className="text-sm text-gray-700">{q?.text ?? "—"}</span>
                      </div>
                    </div>
                    <div className="ml-6 text-xs text-blue-700 bg-blue-50 inline-flex items-center gap-1 px-2 py-0.5 rounded">
                      <span className="font-semibold">{a.selectedLabel}.</span>
                      <span>{opt?.text ?? a.selectedLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* ── 访谈内容（nav 侧）— Q1/Q2 完整展开 ────────────────────── */}
        {project === "nav" &&
          interviewQ1Q2 &&
          (interviewQ1Q2.Q1 || interviewQ1Q2.Q2) && (
            <Card title="访谈内容（Q1 / Q2）">
              <div className="space-y-3">
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-start gap-1.5">
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  以下内容为用户访谈原始回答，含个人陈述、PII 敏感信息。请勿截图传播或对外汇报。
                </div>
                {interviewQ1Q2.Q1 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1.5">
                      Q1 动态访谈（AI 生成题）
                    </div>
                    {interviewQuestions?.Q1 && (
                      <div className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-1.5 leading-relaxed">
                        <span className="text-blue-600 font-medium mr-1">题：</span>
                        {interviewQuestions.Q1}
                      </div>
                    )}
                    <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                      {interviewQ1Q2.Q1}
                    </pre>
                  </div>
                )}
                {interviewQ1Q2.Q2 && (
                  <div>
                    <div className="text-xs font-medium text-gray-500 mb-1.5">
                      Q2 动态访谈（AI 生成题）
                    </div>
                    {interviewQuestions?.Q2 && (
                      <div className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-1.5 leading-relaxed">
                        <span className="text-blue-600 font-medium mr-1">题：</span>
                        {interviewQuestions.Q2}
                      </div>
                    )}
                    <pre className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                      {interviewQ1Q2.Q2}
                    </pre>
                  </div>
                )}
              </div>
            </Card>
          )}
      </div>
    </div>
  );
}
