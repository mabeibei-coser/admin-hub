// 模拟 admin-hub /api/admin/reports?project=salary 的 SQL 路径，
// 不走 auth，直接验证 SELECT / WHERE / 列对齐是否正确。
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SALARY = process.env.SALARY_DB_PATH;
const DB = process.env.DB_PATH;
console.log("ATTACH source =", SALARY);

const db = new Database(DB);
db.exec(`ATTACH DATABASE '${SALARY.replaceAll("'", "''")}' AS salary`);

const SQL = `
  SELECT sr.id, sr.created_at, 'salary' AS project,
         sr.position       AS target_position,
         sr.education      AS target_education,
         NULL              AS work_years,
         NULL              AS user_name,
         sr.user_phone     AS user_phone,
         sr.company        AS target_company,
         sr.city           AS target_city_tier,
         0                 AS has_resume,
         NULL              AS resume_filename,
         NULL              AS user_identity,
         NULL              AS uuid,
         sr.duration_ms,
         NULL              AS sections_status,
         sr.ip,
         NULL              AS tracking_id,
         sr.rank           AS salary_rank,
         sr.rank_label     AS salary_rank_label
  FROM salary.reports sr
  ORDER BY sr.created_at DESC LIMIT 5
`;
const rows = db.prepare(SQL).all();
console.log("salary list query rows:", rows.length);
for (const r of rows) {
  console.log({
    id: r.id,
    created_at: new Date(r.created_at).toISOString(),
    target_position: r.target_position,
    salary_rank_label: r.salary_rank_label,
    target_company: r.target_company,
    target_education: r.target_education,
    target_city_tier: r.target_city_tier,
    user_phone: r.user_phone,
  });
}

const detail = db
  .prepare("SELECT * FROM salary.reports WHERE id = ?")
  .get(rows[0]?.id);
console.log("\ndetail row keys:", Object.keys(detail || {}).join(", "));
if (detail) {
  const report = JSON.parse(detail.report_json);
  console.log("report.position:", report.position);
  console.log("report.cityAnalysis.length:", report.cityAnalysis.length);
  console.log("report.industryAnalysis.length:", report.industryAnalysis.length);
}

db.close();
console.log("\n✓ salary list + detail SQL 正常");
