#!/usr/bin/env node
/**
 * admin-hub smoke test —— 端到端验证 auth + 跨库读 + 服务跟进。
 *
 * 用法：
 *   BASE_URL=http://localhost:3001 \
 *   ADMIN_USERNAME=<手机号> \
 *   ADMIN_PASSWORD=<明文密码> \
 *   ADMIN_SESSION_PASSWORD=<会话密钥> \
 *   node scripts/smoke-admin.mjs
 *
 * 通过条件（任一不满足即 exit 1）：
 *   1. POST /api/admin/login 返回 200 + Set-Cookie
 *   2. GET /api/admin/me（带 cookie）返回当前用户 id
 *   3. GET /api/admin/reports?project=report 返回 array
 *   4. GET /api/admin/reports?project=nav 返回 array（即使为空 array 也算通过）
 *   5. GET /api/admin/service-tracking 返回 array
 */

import { unsealData } from "iron-session";

const BASE_URL = (process.env.BASE_URL || "http://localhost:3001/b100").replace(
  /\/+$/,
  "",
);
const USERNAME = process.env.ADMIN_USERNAME;
const PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_PASSWORD = process.env.ADMIN_SESSION_PASSWORD;

if (!USERNAME || !PASSWORD || !SESSION_PASSWORD) {
  console.error(
    "❌ 缺 env: ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_SESSION_PASSWORD",
  );
  process.exit(1);
}

const checks = [];

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${name}${detail ? "  —  " + detail : ""}`);
}

function getSetCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const combined = response.headers.get("set-cookie");
  return combined ? [combined] : [];
}

function getCookiePair(response, name) {
  for (const header of getSetCookies(response)) {
    const match = header.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`));
    if (match) return match[1];
  }
  return "";
}

function api(pathname) {
  return `${BASE_URL}${pathname.endsWith("/") ? pathname : `${pathname}/`}`;
}

async function main() {
  // 1. 获取图形验证码。答案只在内存中解密，不输出验证码或 cookie。
  const captchaRes = await fetch(api("/api/admin/captcha"), {
    redirect: "manual",
  });
  const captchaCookie = getCookiePair(captchaRes, "admin_captcha");
  const captchaSeal = captchaCookie.slice("admin_captcha=".length);
  const captchaSession = captchaSeal
    ? await unsealData(decodeURIComponent(captchaSeal), {
        password: SESSION_PASSWORD,
        ttl: 300,
      })
    : {};
  const captcha = captchaSession?.text;
  record(
    "GET /api/admin/captcha",
    captchaRes.status === 200 && typeof captcha === "string",
    `status=${captchaRes.status}`,
  );
  if (!captchaCookie || typeof captcha !== "string") {
    console.error("验证码会话建立失败，停止后续测试");
    process.exit(1);
  }

  // 2. login
  const loginRes = await fetch(api("/api/admin/login"), {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/json",
      Cookie: captchaCookie,
    },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, captcha }),
  });
  const cookie = getCookiePair(loginRes, "career_admin_session");
  record(
    "POST /api/admin/login",
    loginRes.status === 200 && cookie.length > 0,
    `status=${loginRes.status}, session=${cookie ? "set" : "missing"}`,
  );
  if (!cookie) {
    console.error("登录失败，停止后续测试");
    process.exit(1);
  }

  // 3. me
  const meRes = await fetch(api("/api/admin/me"), {
    headers: { Cookie: cookie },
  });
  const meJson = meRes.ok ? await meRes.json() : null;
  record(
    "GET /api/admin/me",
    meRes.ok && meJson?.session?.adminId,
    `status=${meRes.status}, adminId=${meJson?.session?.adminId}`
  );

  // 4. reports?project=report
  const reportListRes = await fetch(
    `${api("/api/admin/reports")}?project=report&limit=5`,
    { headers: { Cookie: cookie } }
  );
  const reportListJson = reportListRes.ok ? await reportListRes.json() : null;
  record(
    "GET /api/admin/reports?project=report",
    reportListRes.ok && Array.isArray(reportListJson?.rows),
    `status=${reportListRes.status}, rows=${reportListJson?.rows?.length}`
  );

  // 5. reports?project=nav
  const navListRes = await fetch(
    `${api("/api/admin/reports")}?project=nav&limit=5`,
    { headers: { Cookie: cookie } }
  );
  const navListJson = navListRes.ok ? await navListRes.json() : null;
  // nav DB 可能为空（nav 项目本机没跑过），但 status 应是 200，rows 应是 array
  record(
    "GET /api/admin/reports?project=nav",
    navListRes.ok && Array.isArray(navListJson?.rows),
    `status=${navListRes.status}, rows=${navListJson?.rows?.length}`
  );

  // 6. service-tracking
  const stRes = await fetch(`${api("/api/admin/service-tracking")}?limit=5`, {
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
