import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/db";
import fs from "fs";

export const runtime = "nodejs";

type Project = "report" | "nav";

function parseProject(v: string | null): Project | null {
  if (v === "report" || v === "nav") return v;
  return null;
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
        { error: "缺少 project 参数（report|nav）" },
        { status: 400 }
      );
    }

    const db = getAdminDb();
    const table = project === "nav" ? "nav.reports" : "main.reports";

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

    if (project === "nav") {
      // career-nav: 直接从 report_json 列拿（T3 polish 后这是单一真相来源）
      // 关键防御：绝对不能走 readReportFromDisk（跨进程文件读必然失败）
      const reportJson = row.report_json as string | null;
      if (reportJson) {
        try {
          reportData = JSON.parse(reportJson);
        } catch (e) {
          console.error("[admin/reports] nav report_json parse failed:", e);
        }
      }
      const q1q2Json = row.interview_q1q2_json as string | null;
      if (q1q2Json) {
        try {
          interviewQ1Q2 = JSON.parse(q1q2Json);
        } catch {
          /* swallow */
        }
      }
      const formJson = row.form_data_json as string | null;
      if (formJson) {
        try {
          formData = JSON.parse(formJson);
        } catch {
          /* swallow */
        }
      }
      const quizJson = row.quiz_answers_json as string | null;
      if (quizJson) {
        try {
          quizAnswers = JSON.parse(quizJson);
        } catch {
          /* swallow */
        }
      }
      const scoringJson = row.scoring_json as string | null;
      if (scoringJson) {
        try {
          scoring = JSON.parse(scoringJson);
        } catch {
          /* swallow */
        }
      }
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
