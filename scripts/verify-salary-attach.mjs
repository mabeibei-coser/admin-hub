// 验证 admin-hub 能正确 ATTACH salary-report 的 sqlite 并看到 reports 表。
// 用法：node scripts/verify-salary-attach.mjs
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

// 手动读 .env.local（dotenv/config 默认读 .env）
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const SALARY_DB_PATH = process.env.SALARY_DB_PATH;
const DB_PATH = process.env.DB_PATH;
console.log("SALARY_DB_PATH =", SALARY_DB_PATH);
console.log("DB_PATH        =", DB_PATH);

if (!SALARY_DB_PATH) {
  console.error("✗ SALARY_DB_PATH 未配置");
  process.exit(1);
}
if (!fs.existsSync(SALARY_DB_PATH)) {
  console.error("✗ salary db 文件不存在:", SALARY_DB_PATH);
  process.exit(1);
}

// 直接 ATTACH 到内存库验证（不动 admin-hub 的真实 DB）
const db = new Database(":memory:");
const safe = SALARY_DB_PATH.replaceAll("'", "''");
db.exec(`ATTACH DATABASE '${safe}' AS salary`);

const tables = db
  .prepare("SELECT name FROM salary.sqlite_master WHERE type='table' ORDER BY name")
  .all();
console.log("salary.* tables:", tables.map((t) => t.name).join(", "));

if (!tables.find((t) => t.name === "reports")) {
  console.error("✗ salary.reports 表不存在");
  process.exit(1);
}

const cols = db.prepare("PRAGMA salary.table_info(reports)").all();
console.log("salary.reports cols:", cols.map((c) => c.name).join(", "));

const count = db.prepare("SELECT COUNT(*) AS c FROM salary.reports").get();
console.log("salary.reports count:", count.c);

console.log("✓ ATTACH 链路正常");
db.close();
