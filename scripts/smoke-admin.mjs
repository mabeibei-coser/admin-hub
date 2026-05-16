#!/usr/bin/env node
/**
 * admin-hub smoke test —— 端到端验证 auth + 跨库读 + 服务跟进。
 *
 * 用法：
 *   BASE_URL=http://localhost:3001 \
 *   ADMIN_USERNAME=<手机号> \
 *   ADMIN_PASSWORD=<明文密码> \
 *   node scripts/smoke-admin.mjs
 *
 * 通过条件（任一不满足即 exit 1）：
 *   1. POST /api/admin/login 返回 200 + Set-Cookie
 *   2. GET /api/admin/me（带 cookie）返回当前用户 id
 *   3. GET /api/admin/reports?project=report 返回 array
 *   4. GET /api/admin/reports?project=nav 返回 array（即使为空 array 也算通过）
 *   5. GET /api/admin/service-tracking 返回 array
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const USERNAME = process.env.ADMIN_USERNAME;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!USERNAME || !PASSWORD) {
  console.error("❌ 缺 env: ADMIN_USERNAME / ADMIN_PASSWORD");
  process.exit(1);
}

const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? "  —  " + detail : ""}`);
}

async function main() {
  // 1. login
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  const setCookie = loginRes.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0]; // 取第一个 cookie name=value
  record(
    "POST /api/admin/login",
    loginRes.status === 200 && cookie.length > 0,
    `status=${loginRes.status}, cookie=${cookie.slice(0, 30)}...`
  );
  if (!cookie) {
    console.error("登录失败，停止后续测试");
    process.exit(1);
  }

  // 2. me
  const meRes = await fetch(`${BASE_URL}/api/admin/me`, {
    headers: { Cookie: cookie },
  });
  const meJson = meRes.ok ? await meRes.json() : null;
  record(
    "GET /api/admin/me",
    meRes.ok && meJson?.session?.adminId,
    `status=${meRes.status}, adminId=${meJson?.session?.adminId}`
  );

  // 3. reports?project=report
  const reportListRes = await fetch(
    `${BASE_URL}/api/admin/reports?project=report&limit=5`,
    { headers: { Cookie: cookie } }
  );
  const reportListJson = reportListRes.ok ? await reportListRes.json() : null;
  record(
    "GET /api/admin/reports?project=report",
    reportListRes.ok && Array.isArray(reportListJson?.rows),
    `status=${reportListRes.status}, rows=${reportListJson?.rows?.length}`
  );

  // 4. reports?project=nav
  const navListRes = await fetch(
    `${BASE_URL}/api/admin/reports?project=nav&limit=5`,
    { headers: { Cookie: cookie } }
  );
  const navListJson = navListRes.ok ? await navListRes.json() : null;
  // nav DB 可能为空（nav 项目本机没跑过），但 status 应是 200，rows 应是 array
  record(
    "GET /api/admin/reports?project=nav",
    navListRes.ok && Array.isArray(navListJson?.rows),
    `status=${navListRes.status}, rows=${navListJson?.rows?.length}`
  );

  // 5. service-tracking
  const stRes = await fetch(`${BASE_URL}/api/admin/service-tracking?limit=5`, {
    headers: { Cookie: cookie },
  });
  const stJson = stRes.ok ? await stRes.json() : null;
  record(
    "GET /api/admin/service-tracking",
    stRes.ok && Array.isArray(stJson?.rows),
    `status=${stRes.status}, rows=${stJson?.rows?.length}`
  );

  // 汇总
  const failed = checks.filter((c) => !c.ok);
  console.log("");
  console.log(`总计 ${checks.length} 项，通过 ${checks.length - failed.length}，失败 ${failed.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("smoke 脚本异常：", err);
  process.exit(1);
});
