#!/usr/bin/env node
/**
 * 从 salary-report 项目同步契约文件到 admin-hub。
 *
 * 用法：
 *   npm run sync-salary
 *   SALARY_REPO_PATH=/custom/path npm run sync-salary
 *
 * 默认从 D:/_workspace/01_项目-Coding/salary-report/contracts/salary-report.ts 拉取，
 * 覆盖到 admin-hub 的 lib/types-salary.ts。
 *
 * 流程：开发期手动跑，把 salary-report 的最新契约拷过来；commit 进 admin-hub repo；
 * 部署上线。服务器上没有 salary-report 源码，所以 sync 不会在生产跑。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_HUB_ROOT = path.resolve(__dirname, "..");

const DEFAULT_SOURCE =
  "D:/_workspace/01_项目-Coding/salary-report/contracts/salary-report.ts";
const SOURCE = process.env.SALARY_REPO_PATH
  ? path.join(process.env.SALARY_REPO_PATH, "contracts/salary-report.ts")
  : DEFAULT_SOURCE;
const TARGET = path.join(ADMIN_HUB_ROOT, "lib/types-salary.ts");

if (!fs.existsSync(SOURCE)) {
  console.error("❌ 找不到 salary-report 契约文件：");
  console.error("   " + SOURCE);
  console.error("");
  console.error("请确认 salary-report 项目存在；或用 SALARY_REPO_PATH 指定。");
  process.exit(1);
}

const raw = fs.readFileSync(SOURCE, "utf-8");
const banner =
  "/**\n" +
  " * ⚠️ 自动生成文件，不要手改。\n" +
  " * 来源：salary-report/contracts/salary-report.ts\n" +
  " * 同步命令：npm run sync-salary\n" +
  " *\n" +
  " * 想改这份 types，先去 salary-report 项目改 contracts/salary-report.ts，\n" +
  " * 再来 admin-hub 跑 sync，然后 commit + 部署。两边任何一边单独改都不算数。\n" +
  ` * 上次同步：${new Date().toISOString()}\n` +
  " */\n\n";
// 去掉 contracts 文件自己的头注释（首个 /** ... */ 块），把 banner 加上
const stripped = raw.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*\n?/, "");
const out = banner + stripped;

fs.writeFileSync(TARGET, out, "utf-8");
console.log("✅ 已同步 salary contracts");
console.log("   FROM: " + SOURCE);
console.log("   TO:   " + TARGET);
console.log("");
console.log("下一步：git diff lib/types-salary.ts 看变化；有变化则 commit。");
