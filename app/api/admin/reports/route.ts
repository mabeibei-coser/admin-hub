import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isNavDbReady, isStartupDbReady, isTailorDbReady } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";
import { canViewMenu } from "@/lib/menus";
import { startOfMonthCN, startOfWeekCN } from "@/lib/cn-time";

export const runtime = "nodejs";

type ProjectFilter = "all" | "report" | "nav" | "startup" | "tailor";

function parseProject(v: string | null): ProjectFilter {
  if (v === "report" || v === "nav" || v === "startup" || v === "tailor") return v;
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
  if (canViewMenu(session, "startup")) return "startup";
  if (canViewMenu(session, "tailor")) return "tailor";
  if (canViewMenu(session, "all")) return "all";
  return "report"; // 兜底
}

interface ReportRow {
  id: number;
  created_at: number;
  project: "report" | "nav" | "startup" | "tailor";
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
  /** 已转服务的 service_tracking.id；NULL = 未转。 */
  tracking_id: number | null;
  /** startup 项目专属：项目名称（来自 form_data_json.projectName） */
  project_name?: string | null;
  /** startup 项目专属：启动资金（来自 form_data_json.startupCapital） */
  startup_capital?: string | null;
  /** startup 项目专属：创业经验（来自 form_data_json.startupExperience） */
  startup_experience?: string | null;
  /** tailor 项目专属：改写模式（moderate / aggressive） */
  tailor_mode?: string | null;
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
    // nav 专属筛选（姓名/手机号/用户身份/转服务状态）—— 列只存在于 nav 库或 service_tracking
    const name = searchParams.get("name");
    const phone = searchParams.get("phone");
    const userIdentity = searchParams.get("userIdentity");
    const transferStatus = searchParams.get("transferStatus"); // "1"=已转 "0"=未转
    // startup 专属筛选
    const startupCapital = searchParams.get("startupCapital");
    const startupExperience = searchParams.get("startupExperience");
    // tailor 专属筛选
    const tailorMode = searchParams.get("tailorMode"); // "moderate" | "aggressive"
    const project = clampProject(parseProject(searchParams.get("project")), session);

    const db = getAdminDb();
    const navReady = isNavDbReady();
    const startupReady = isStartupDbReady();
    const tailorReady = isTailorDbReady();

    // 如果指定项目的库不可用，自动降级到 report-only
    let effectiveProject: ProjectFilter = project;
    if (project === "nav" && !navReady) effectiveProject = "report";
    else if (project === "startup" && !startupReady) effectiveProject = "report";
    else if (project === "tailor" && !tailorReady) effectiveProject = "report";

    // 通用 conditions（应用到 report 和 nav 两侧）
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

    // nav 专属 conditions（已带 n./st. prefix，只用于 navSelect 和 nav count）
    const navOnlyConditions: string[] = [];
    const navOnlyParams: (string | number)[] = [];
    if (name) {
      navOnlyConditions.push("json_extract(n.form_data_json, '$.name') LIKE ?");
      navOnlyParams.push(`%${name}%`);
    }
    if (phone) {
      navOnlyConditions.push("json_extract(n.form_data_json, '$.phone') LIKE ?");
      navOnlyParams.push(`%${phone}%`);
    }
    if (userIdentity) {
      navOnlyConditions.push("n.user_identity = ?");
      navOnlyParams.push(userIdentity);
    }
    if (transferStatus === "1") {
      navOnlyConditions.push("st.id IS NOT NULL");
    } else if (transferStatus === "0") {
      navOnlyConditions.push("st.id IS NULL");
    }

    // startup 专属 conditions（已带 s./st. prefix）
    const startupOnlyConditions: string[] = [];
    const startupOnlyParams: (string | number)[] = [];
    if (name) {
      startupOnlyConditions.push("json_extract(s.form_data_json, '$.name') LIKE ?");
      startupOnlyParams.push(`%${name}%`);
    }
    if (phone) {
      startupOnlyConditions.push("json_extract(s.form_data_json, '$.phone') LIKE ?");
      startupOnlyParams.push(`%${phone}%`);
    }
    if (position) {
      // startup 复用 position URL 参数作为「项目名称」搜索（form_data_json.projectName）
      startupOnlyConditions.push("json_extract(s.form_data_json, '$.projectName') LIKE ?");
      startupOnlyParams.push(`%${position}%`);
    }
    if (startupCapital) {
      startupOnlyConditions.push("json_extract(s.form_data_json, '$.startupCapital') = ?");
      startupOnlyParams.push(startupCapital);
    }
    if (startupExperience) {
      startupOnlyConditions.push("json_extract(s.form_data_json, '$.startupExperience') = ?");
      startupOnlyParams.push(startupExperience);
    }
    if (transferStatus === "1") {
      startupOnlyConditions.push("st.id IS NOT NULL");
    } else if (transferStatus === "0") {
      startupOnlyConditions.push("st.id IS NULL");
    }

    // navSelect 用 LEFT JOIN service_tracking，nav.reports 起别名 n. —— WHERE 列名要 prefix
    const conditionsNav = [
      ...conditions.map((c) =>
        c.replace(/^(created_at|target_position|has_resume)\b/, "n.$1")
      ),
      ...navOnlyConditions,
    ];
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

    // nav count 也要 LEFT JOIN service_tracking，否则 transferStatus filter 用不了
    const navCountFrom = `
      FROM nav.reports n
      LEFT JOIN main.service_tracking st
        ON st.source_project = 'nav' AND st.source_report_id = n.id
    `;

    // startup 用 LEFT JOIN service_tracking，startup.reports 起别名 s.
    // form_data_json 里抽出 projectName / startupCapital / startupExperience 等业务字段
    // 学历/工作年限/用户身份/意向公司/城市能级用 NULL 占位（startup 没有这些概念）
    // startup 的"意向岗位"语义上等价于"项目名称"，所以 target_position 也用 projectName 填，前端列展示一致
    const startupConditionsCombined = [
      ...conditions
        .filter((c) => !c.startsWith("target_position"))
        .map((c) =>
          c.replace(/^(created_at|has_resume)\b/, "s.$1")
        ),
      ...startupOnlyConditions,
    ];
    const whereStartup = startupConditionsCombined.length > 0
      ? `WHERE ${startupConditionsCombined.join(" AND ")}`
      : "";
    const startupSelect = `
      SELECT s.id, s.created_at, 'startup' AS project,
             json_extract(s.form_data_json, '$.projectName') AS target_position,
             NULL AS target_education,
             NULL AS work_years,
             json_extract(s.form_data_json, '$.name') AS user_name,
             json_extract(s.form_data_json, '$.phone') AS user_phone,
             NULL AS target_company, NULL AS target_city_tier,
             s.has_resume, s.resume_filename, NULL AS user_identity, s.uuid,
             s.duration_ms, s.sections_status, s.ip,
             st.id AS tracking_id,
             json_extract(s.form_data_json, '$.projectName') AS project_name,
             json_extract(s.form_data_json, '$.startupCapital') AS startup_capital,
             json_extract(s.form_data_json, '$.startupExperience') AS startup_experience
      FROM startup.reports s
      LEFT JOIN main.service_tracking st
        ON st.source_project = 'startup' AND st.source_report_id = s.id
      ${whereStartup}
    `;
    const startupCountFrom = `
      FROM startup.reports s
      LEFT JOIN main.service_tracking st
        ON st.source_project = 'startup' AND st.source_report_id = s.id
    `;
    // startup base params 重建（不复用通用 params，因为 position 走 startupOnlyParams）
    // 顺序与 conditions 一致：from / to / hasResume（hasResume 是字面量无 param）
    const startupBaseParams: (string | number)[] = [];
    if (from) startupBaseParams.push(new Date(from).getTime());
    if (to) startupBaseParams.push(new Date(to).getTime() + 86400000);

    // tailor 专属 conditions（t. prefix，user_name/user_phone/job_title 均为直接列）
    const tailorOnlyConditions: string[] = [];
    const tailorOnlyParams: (string | number)[] = [];
    if (name) {
      tailorOnlyConditions.push("t.user_name LIKE ?");
      tailorOnlyParams.push(`%${name}%`);
    }
    if (phone) {
      tailorOnlyConditions.push("t.user_phone LIKE ?");
      tailorOnlyParams.push(`%${phone}%`);
    }
    if (tailorMode) {
      tailorOnlyConditions.push("t.mode = ?");
      tailorOnlyParams.push(tailorMode);
    }
    // position 参数复用作 job_title 搜索
    const tailorConditionsCombined = [
      ...conditions
        .filter((c) => !c.startsWith("target_position") && !c.startsWith("has_resume"))
        .map((c) => c.replace(/^(created_at)\b/, "t.$1")),
      ...(position ? [`t.job_title LIKE ?`] : []),
      ...tailorOnlyConditions,
    ];
    const whereTailor =
      tailorConditionsCombined.length > 0
        ? `WHERE ${tailorConditionsCombined.join(" AND ")}`
        : "";
    const tailorSelect = `
      SELECT t.id, t.created_at, 'tailor' AS project,
             t.job_title AS target_position,
             NULL AS target_education,
             NULL AS work_years,
             t.user_name,
             t.user_phone,
             NULL AS target_company, NULL AS target_city_tier,
             0 AS has_resume,
             t.resume_filename, NULL AS user_identity, t.uuid,
             t.duration_ms, NULL AS sections_status, t.ip,
             NULL AS tracking_id,
             t.mode AS tailor_mode
      FROM tailor.reports t
      ${whereTailor}
    `;
    // tailor base params（from / to）+ position 如有 + tailorOnlyParams
    const tailorBaseParams: (string | number)[] = [];
    if (from) tailorBaseParams.push(new Date(from).getTime());
    if (to) tailorBaseParams.push(new Date(to).getTime() + 86400000);
    if (position) tailorBaseParams.push(`%${position}%`);

    // 根据 project filter 决定查哪一侧或两侧 UNION
    let listQuery: string;
    let countQuery: string;
    let queryParams: (string | number)[];
    let countParams: (string | number)[];
    if (effectiveProject === "report") {
      listQuery = `${reportSelect} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT COUNT(*) AS c FROM main.reports ${where}`;
      queryParams = [...params];
      countParams = [...params];
    } else if (effectiveProject === "nav") {
      listQuery = `${navSelect} ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT COUNT(*) AS c ${navCountFrom} ${whereNav}`;
      queryParams = [...params, ...navOnlyParams];
      countParams = [...params, ...navOnlyParams];
    } else if (effectiveProject === "startup") {
      listQuery = `${startupSelect} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT COUNT(*) AS c ${startupCountFrom} ${whereStartup}`;
      queryParams = [...startupBaseParams, ...startupOnlyParams];
      countParams = [...startupBaseParams, ...startupOnlyParams];
    } else if (effectiveProject === "tailor") {
      listQuery = `${tailorSelect} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT COUNT(*) AS c FROM tailor.reports t ${whereTailor}`;
      queryParams = [...tailorBaseParams, ...tailorOnlyParams];
      countParams = [...tailorBaseParams, ...tailorOnlyParams];
    } else {
      // all: UNION ALL，report 用 params，nav 用 params + navOnlyParams
      listQuery = `${reportSelect} UNION ALL ${navSelect} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      countQuery = `SELECT (SELECT COUNT(*) FROM main.reports ${where}) + (SELECT COUNT(*) ${navCountFrom} ${whereNav}) AS c`;
      queryParams = [...params, ...params, ...navOnlyParams];
      countParams = [...params, ...params, ...navOnlyParams];
    }

    const total = (db.prepare(countQuery).get(...countParams) as { c: number }).c;
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
      // startup 项目专属：与 nav 同款 KPI（本月/本周/已转服务）
      if (p === "startup") {
        const monthStart = startOfMonthCN();
        const weekStart = startOfWeekCN();
        const stRow = db
          .prepare("SELECT COUNT(*) AS c FROM startup.reports WHERE created_at >= ?")
          .get(monthStart) as { c: number };
        const swRow = db
          .prepare("SELECT COUNT(*) AS c FROM startup.reports WHERE created_at >= ?")
          .get(weekStart) as { c: number };
        const transferRow = db
          .prepare(
            "SELECT COUNT(DISTINCT source_report_id) AS c FROM service_tracking WHERE source_project = 'startup'"
          )
          .get() as { c: number };
        // startup base 的 total/today_count/resume_count 要重新算（statForProject 走 'all' 分支不够通用）
        const totalRow = db
          .prepare(`SELECT COUNT(*) AS total,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today_count,
            SUM(CASE WHEN has_resume = 1 THEN 1 ELSE 0 END) AS resume_count,
            AVG(duration_ms) AS avg_dur
            FROM startup.reports`)
          .get(todayTs) as {
            total: number;
            today_count: number | null;
            resume_count: number | null;
            avg_dur: number | null;
          };
        const tt = totalRow.total ?? 0;
        const rc = totalRow.resume_count ?? 0;
        return {
          total: tt,
          todayCount: totalRow.today_count ?? 0,
          resumeRate: tt > 0 ? Math.round((rc / tt) * 100) : 0,
          avgDurationSec: totalRow.avg_dur ? Math.round(totalRow.avg_dur / 1000) : null,
          monthCount: stRow.c ?? 0,
          weekCount: swRow.c ?? 0,
          transferredCount: transferRow.c ?? 0,
        };
      }
      // tailor 项目专属：本月/本周（无转服务）
      if (p === "tailor") {
        const monthStart = startOfMonthCN();
        const weekStart = startOfWeekCN();
        const totalRow = db
          .prepare(`SELECT COUNT(*) AS total,
            SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS today_count,
            AVG(duration_ms) AS avg_dur
            FROM tailor.reports`)
          .get(todayTs) as {
            total: number;
            today_count: number | null;
            avg_dur: number | null;
          };
        const monthRow = db
          .prepare("SELECT COUNT(*) AS c FROM tailor.reports WHERE created_at >= ?")
          .get(monthStart) as { c: number };
        const weekRow = db
          .prepare("SELECT COUNT(*) AS c FROM tailor.reports WHERE created_at >= ?")
          .get(weekStart) as { c: number };
        const tt = totalRow.total ?? 0;
        return {
          total: tt,
          todayCount: totalRow.today_count ?? 0,
          resumeRate: 0,
          avgDurationSec: totalRow.avg_dur ? Math.round(totalRow.avg_dur / 1000) : null,
          monthCount: monthRow.c ?? 0,
          weekCount: weekRow.c ?? 0,
        };
      }
      return base;
    }

    let stats;
    if (effectiveProject === "tailor" && tailorReady) {
      stats = statForProject("tailor");
    } else if (effectiveProject === "startup" && startupReady) {
      stats = statForProject("startup");
    } else if (effectiveProject === "nav" && navReady) {
      stats = statForProject("nav");
    } else if (effectiveProject === "report") {
      stats = statForProject("report");
    } else if (navReady) {
      stats = statForProject(effectiveProject);
    } else {
      stats = statForProject("report");
    }

    return NextResponse.json({
      rows,
      total,
      page,
      pageSize,
      project: effectiveProject,
      navReady,
      startupReady,
      tailorReady,
      stats,
    });
  } catch (e) {
    console.error("[admin/reports] error:", e);
    return NextResponse.json({ error: "查询失败", detail: String(e) }, { status: 500 });
  }
}
