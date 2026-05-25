import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/db";
import fs from "fs";

export const runtime = "nodejs";

type Project = "report" | "nav" | "startup" | "tailor" | "salary";

function parseProject(v: string | null): Project | null {
  if (
    v === "report" ||
    v === "nav" ||
    v === "startup" ||
    v === "tailor" ||
    v === "salary"
  )
    return v;
  return null;
}

// JSON 解析：startup/nav 共用同样的字段名，抽成 helper 避免重复
function safeJsonParse<T = unknown>(raw: unknown): T | null {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "无效 ID" }, { status: 400 });
    }

    const project = parseProject(req.nextUrl.searchParams.get("project"));
    if (!project) {
      return NextResponse.json(
        { error: "缺少 project 参数（report|nav|startup|tailor|salary）" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const tableMap: Record<Project, string> = {
      report: "main.reports",
      nav: "nav.reports",
      startup: "startup.reports",
      tailor: "tailor.reports",
      salary: "salary.reports",
    };
    const table = tableMap[project];

    // 注：SQLite 不支持 prepared statement 参数化表名，project 已在白名单内枚举（report|nav），可安全插入
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 });
    }

    let reportData: unknown = null;
    let interviewQ1Q2: unknown = null;
    let formData: unknown = null;
    let quizAnswers: unknown = null;
    let scoring: unknown = null;

    if (project === "nav" || project === "startup") {
      // career-nav / startup-diagnostic: 直接从 report_json 列拿（finalize 后这是单一真相来源）
      // 两者 JSON 列字段名完全一致：report_json / interview_q1q2_json / form_data_json
      // / quiz_answers_json / scoring_json
      reportData = safeJsonParse(row.report_json);
      interviewQ1Q2 = safeJsonParse(row.interview_q1q2_json);
      formData = safeJsonParse(row.form_data_json);
      quizAnswers = safeJsonParse(row.quiz_answers_json);
      scoring = safeJsonParse(row.scoring_json);
    } else if (project === "tailor") {
      // resume-tailor：report_json 含完整 TailorReport（suggestions+interview+resume+changes）
      // form_data_json 含 TailorFormData（去掉了 parsedResume/resumeText 大字段）
      reportData = safeJsonParse(row.report_json);
      formData = safeJsonParse(row.form_data_json);
      // tailor 无 quiz / scoring / interviewQ1Q2（interview 在 reportData 里）
    } else if (project === "salary") {
      // salary-report：report_json 含完整 SalaryReportData（薪资数据 + 行业 + 城市 + 高薪特征）
      // 表单参数（position/company/rank/education/city）就是直接列，前端从 meta 取
      reportData = safeJsonParse(row.report_json);
      // salary 无 form_data_json / quiz / scoring / interviewQ1Q2
    } else {
      // career-report: 从磁盘读 data/reports/{id}.json（沿用现有逻辑）
      const storagePath = row.report_storage_path as string | null;
      if (storagePath) {
        try {
          const file = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
          reportData = file.reportData ?? file;
          formData = file.formData;
          quizAnswers = file.quizAnswers;
        } catch {
          /* file missing or corrupt */
        }
      }
    }

    return NextResponse.json({
      project,
      meta: row,
      reportData,
      interviewQ1Q2,
      formData,
      quizAnswers,
      scoring,
    });
  } catch (e) {
    console.error("[admin/reports/[id]] error:", e);
    return NextResponse.json({ error: "查询失败", detail: String(e) }, { status: 500 });
  }
}
