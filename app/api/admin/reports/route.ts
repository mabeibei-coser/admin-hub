import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isNavDbReady } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { canViewMenu } from "@/lib/menus";
import { startOfMonthCN, startOfWeekCN } from "@/lib/cn-time";

export const runtime = "nodejs";

type ProjectFilter = "all" | "report" | "nav";

function parseProject(v: string | null): ProjectFilter {
  if (v === "report" || v === "nav") return v;
  return "all";
}

/**
 * 把用户请求的 project 收窄到其实际拥有的权限范围内（体验更软，不 403）。
 * 超管不限制。
 */
function clampProject(
  requested: ProjectFilter,
  session: Awaited<ReturnType<typeof requireAdmin>>
): ProjectFilter {
  if (!session) return "report";
  if (session.isSuper) return requested;
  if (canViewMenu(session, requested)) return requested;
  // 没有请求的权限，降级到第一个有权限的菜单
  if (canViewMenu(session, "report")) return "report";
  if (canViewMenu(session, "nav")) return "nav";
  if (canViewMenu(session, "all")) return "all";
  return "report"; // 兜底
}

interface ReportRow {
  id: number;
  created_at: number;
  project: "report" | "nav";
  target_position: string;
  target_education: string | null;
  work_years: string | null;
  user_name: string | null;
  user_phone: string | null;
  target_company: string | null;
  target_city_tier: string | null;
  has_resume: number;
  resume_filename: string | null;
  user_identity: string | null;
  uuid: string | null;
  duration_ms: number | null;
  sections_status: string | null;
  ip: string | null;
  /** 已转服务的 service_tracking.id；NULL = 未转。仅 nav 项目可能非 NULL。 */
  tracking_id: number | null;
}

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
    const offset = (page - 1) * pageSize;

    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const position = searchParams.get("position");
    const hasResume = searchParams.get("hasResume");
    const project = clampProject(parseProject(searchParams.get("project")), session);

    const db = getAdminDb();
    const navReady = isNavDbReady();

    // 如果 nav 库不可用，自动降级到 report-only
    const effectiveProject: ProjectFilter = !navReady && project !== "report" ? "report" : project;

    // 构建 filter 条件（应用到 UNION 两侧）
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (from) {
      conditions.push("created_at >= ?");
      params.push(new Date(from).getTime());
    }
    if (to) {
      conditions.push("created_at <= ?");
      params.push(new Date(to).getTime() + 86400000);
    }
    if (position) {
      conditions.push("target_position LIKE ?");
      params.push(`%${position}%`);
    }
    if (hasResume === "1") {
      conditions.push("has_resume = 1");
    } else if (hasResume === "0") {
      conditions.push("has_resume = 0");
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // navSelect 用 LEFT JOIN service_tracking，nav.reports 起别名 n. —— WHERE 列名要 prefix
    const conditionsNav = conditions.map((c) =>
      c.replace(/^(created_at|target_position|has_resume)\b/, "n.$1")
    );
    const whereNav = conditionsNav.length > 0 ? `WHERE ${conditionsNav.join(" AND ")}` : "";

    // 列对齐：report 库没有 user_identity / uuid / work_years / user_name / user_phone / tracking_id，select NULL 占位
    const reportSelect = `
      SELECT id, created_at, 'report' AS project,
             target_position, target_education,
             NULL AS work_years, NULL AS user_name, NULL AS user_phone,
             target_company, target_city_tier,
             has_resume, resume_filename, NULL AS user_identity, NULL AS uuid,
             duration_ms, sections_status, ip,
             NULL AS tracking_id
      FROM main.reports ${where}
    `;
    // nav 库的 target_education 列在 finalize 时写 NULL，真实学历在 form_data_json 里。
    // 用 SQLite JSON1 的 json_extract 直接抽出，省得前端解析。
    // user_name / user_phone / work_years 同理。
    // LEFT JOIN service_tracking 给每行补 tracking_id（已转服务则非 NULL）。
    const navSelect = `
      SELECT n.id, n.created_at, 'nav' AS project,
             n.target_position,
             json_extract(n.form_data_json, '$.education') AS target_education,
             json_extract(n.form_data_json, '$.workYears') AS work_years,
             json_extract(n.form_data_json, '$.name') AS user_name,
             json_extract(n.form_data_json, '$.phone') AS user_phone,
             NULL AS target_company, NULL AS target_city_tier,
             n.has_resume, n.resume_filename, n.user_identity, n.uuid,
             n.duration_ms, n.sections_status, n.ip,
             st.id AS tracking_id
      FROM nav.reports n
      LEFT JOIN main.service_tracking st
        ON st.source_project = 'nav' AND st.source_report_id = n.id
      ${whereNav}
    `;

    // 根据 project filter 决定查哪一侧或两侧 UNION
    let listQuery: string;
    let countQuery: string;
    let queryParams: (string | number)[];
    if (effectiveProject === "report") {
      listQuery = `${reportSelect} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT COUNT(*) AS c FROM main.reports ${where}`;
      queryParams = [...params];
    } else if (effectiveProject === "nav") {
      listQuery = `${navSelect} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT COUNT(*) AS c FROM nav.reports ${where}`;
      queryParams = [...params];
    } else {
      // all: UNION ALL，参数复制一遍
      listQuery = `${reportSelect} UNION ALL ${navSelect} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT (SELECT COUNT(*) FROM main.reports ${where}) + (SELECT COUNT(*) FROM nav.reports ${where}) AS c`;
      queryParams = [...params, ...params];
    }

    const total = (db.prepare(countQuery).get(...(effectiveProject === "all" ? [...params, ...params] : params)) as { c: number }).c;
    const rows = db.prepare(listQuery).all(...queryParams, pageSize, offset) as ReportRow[];

    // 统计卡片：按 project filter
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();

    function statForProject(p: ProjectFilter): {
      total: number;
      todayCount: number;
      resumeRate: number;
      avgDurationSec: number | null;
      monthCount?: number;
      weekCount?: number;
      transferredCount?: number;
    } {
      const reportPart = `SELECT COUNT(*) AS total,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today_count,
        SUM(CASE WHEN has_resume = 1 THEN 1 ELSE 0 END) AS resume_count,
        AVG(duration_ms) AS avg_dur
        FROM main.reports`;
      const navPart = `SELECT COUNT(*) AS total,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today_count,
        SUM(CASE WHEN has_resume = 1 THEN 1 ELSE 0 END) AS resume_count,
        AVG(duration_ms) AS avg_dur
        FROM nav.reports`;
      let q: string;
      let qParams: number[];
      if (p === "report") {
        q = reportPart;
        qParams = [todayTs];
      } else if (p === "nav") {
        q = navPart;
        qParams = [todayTs];
      } else {
        // 合并两侧
        q = `SELECT
          (SELECT COUNT(*) FROM main.reports) + (SELECT COUNT(*) FROM nav.reports) AS total,
          (SELECT SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) FROM main.reports) +
          (SELECT SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) FROM nav.reports) AS today_count,
          (SELECT SUM(CASE WHEN has_resume = 1 THEN 1 ELSE 0 END) FROM main.reports) +
          (SELECT SUM(CASE WHEN has_resume = 1 THEN 1 ELSE 0 END) FROM nav.reports) AS resume_count,
          (
            SELECT (
              IFNULL((SELECT SUM(duration_ms) FROM main.reports WHERE duration_ms IS NOT NULL), 0) +
              IFNULL((SELECT SUM(duration_ms) FROM nav.reports WHERE duration_ms IS NOT NULL), 0)
            ) * 1.0 / NULLIF(
              (SELECT COUNT(*) FROM main.reports WHERE duration_ms IS NOT NULL) +
              (SELECT COUNT(*) FROM nav.reports WHERE duration_ms IS NOT NULL), 0
            )
          ) AS avg_dur
        `;
        qParams = [todayTs, todayTs];
      }
      const r = db.prepare(q).get(...qParams) as {
        total: number;
        today_count: number | null;
        resume_count: number | null;
        avg_dur: number | null;
      };
      const t = r.total ?? 0;
      const resumeCount = r.resume_count ?? 0;
      const base = {
        total: t,
        todayCount: r.today_count ?? 0,
        resumeRate: t > 0 ? Math.round((resumeCount / t) * 100) : 0,
        avgDurationSec: r.avg_dur ? Math.round(r.avg_dur / 1000) : null,
      };
      // nav 项目专属：本月新增 / 本周新增 / 累计已转服务数
      if (p === "nav") {
        const monthStart = startOfMonthCN();
        const weekStart = startOfWeekCN();
        const monthRow = db
          .prepare("SELECT COUNT(*) AS c FROM nav.reports WHERE created_at >= ?")
          .get(monthStart) as { c: number };
        const weekRow = db
          .prepare("SELECT COUNT(*) AS c FROM nav.reports WHERE created_at >= ?")
          .get(weekStart) as { c: number };
        const transferRow = db
          .prepare(
            "SELECT COUNT(DISTINCT source_report_id) AS c FROM service_tracking WHERE source_project = 'nav'"
          )
          .get() as { c: number };
        return {
          ...base,
          monthCount: monthRow.c ?? 0,
          weekCount: weekRow.c ?? 0,
          transferredCount: transferRow.c ?? 0,
        };
      }
      return base;
    }

    const stats = navReady ? statForProject(effectiveProject) : statForProject("report");

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      project: effectiveProject,
      navReady,
      stats,
    });
  } catch (e) {
    console.error("[admin/reports] error:", e);
    return NextResponse.json({ error: "查询失败", detail: String(e) }, { status: 500 });
  }
}
