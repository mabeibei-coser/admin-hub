#!/usr/bin/env node
/**
 * 从上游业务项目同步数据契约到 admin-hub。
 *
 * 用法：
 *   npm run sync-contracts           # 同步所有业务
 *   npm run sync-contracts salary    # 只同步 salary
 *   WORKSPACE=/custom/path npm run sync-contracts   # 改业务项目根目录
 *
 * 模型：每个业务项目维护 contracts/<repo-name>.ts，admin-hub sync 时拷过来
 * 覆盖 lib/types-<key>.ts。任何一边单独改 type 都不算数。
 *
 * 部署链路：开发期跑 sync → commit → 推到 GitHub → 服务器拉新版。
 * 服务器上没有上游业务源码，所以 sync 不会在生产跑。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_HUB_ROOT = path.resolve(__dirname, "..");
const WORKSPACE = process.env.WORKSPACE || "D:/_workspace/01_项目-Coding";

/**
 * 业务项目注册表。新接入业务时在这里加一行。
 *
 * - key:        admin-hub 内部用的 ProjectId（lib/projects.ts 的 key）
 * - repo:       上游项目目录名（在 WORKSPACE 下）
 * - typesFile:  admin-hub lib/<typesFile>.ts（sync 目标）
 */
// 注：hazard-detect 是 JSX 项目无 TypeScript，admin-hub 是它的单一 owner，
// 不参与 sync 流程。lib/types-hazard.ts 由 admin-hub 自己维护。
const PROJECTS = [
  { key: "salary",  repo: "salary-report",  typesFile: "types-salary.ts" },
  { key: "nav",     repo: "career-nav",     typesFile: "types-nav.ts" },
  { key: "startup", repo: "startup-dig",    typesFile: "types-startup.ts" },
  { key: "tailor",  repo: "resume-tailor",  typesFile: "types-tailor.ts" },
  { key: "report",  repo: "career-report",  typesFile: "types.ts" },
];

const onlyKey = process.argv[2];
const targets = onlyKey
  ? PROJECTS.filter((p) => p.key === onlyKey)
  : PROJECTS;

if (onlyKey && targets.length === 0) {
  console.error(`❌ 未知业务 key: ${onlyKey}`);
  console.error(`   可选：${PROJECTS.map((p) => p.key).join(", ")}`);
  process.exit(1);
}

let okCount = 0;
let skipCount = 0;
let failCount = 0;

for (const { key, repo, typesFile } of targets) {
  const source = path.join(WORKSPACE, repo, "contracts", `${repo}.ts`);
  const target = path.join(ADMIN_HUB_ROOT, "lib", typesFile);

  if (!fs.existsSync(source)) {
    console.log(`⊘  ${key.padEnd(8)} 跳过（${repo}/contracts/${repo}.ts 不存在）`);
    skipCount++;
    continue;
  }

  try {
    const raw = fs.readFileSync(source, "utf-8");
    const banner =
      "/**\n" +
      " * ⚠️ 自动生成文件，不要手改。\n" +
      ` * 来源：${repo}/contracts/${repo}.ts\n` +
      ` * 同步命令：npm run sync-contracts ${key}\n` +
      " *\n" +
      ` * 想改这份 types，先去 ${repo} 项目改 contracts/${repo}.ts，\n` +
      " * 再来 admin-hub 跑 sync，然后 commit + 部署。两边任何一边单独改都不算数。\n" +
      ` * 上次同步：${new Date().toISOString()}\n` +
      " */\n\n";
    const stripped = raw.replace(/^\s*\/\*\*[\s\S]*?\*\/\s*\n?/, "");
    fs.writeFileSync(target, banner + stripped, "utf-8");
    console.log(`✓  ${key.padEnd(8)} 已同步  ${repo} → lib/${typesFile}`);
    okCount++;
  } catch (e) {
    console.error(`✗  ${key.padEnd(8)} 失败：${e.message}`);
    failCount++;
  }
}

console.log("");
console.log(`同步汇总：成功 ${okCount} / 跳过 ${skipCount} / 失败 ${failCount}`);
console.log("下一步：git diff lib/ 看变化；有变化则 commit。");
if (failCount > 0) process.exit(1);
