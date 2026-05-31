// ─────────────────────────────────────────────────────────────────────────
// templates/lib/session.js
// 适用：Vite + Express 形态。直接 cp 到项目根的 lib/session.js。
// 替换：<PROJECT> → 项目名大写；<your_project> → 项目名小写下划线（cookie 名用）
// 来源：基于 salary-report (A500) 实战版本提炼。
// ─────────────────────────────────────────────────────────────────────────

import { getIronSession } from "iron-session";

export const sessionOptions = {
  // ⚠️ 密钥必须 ≥32 字符。生成命令：
  // node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
  password: process.env.<PROJECT>_SESSION_PASSWORD,

  cookieName: "<your_project>_user_session",   // ⚠️ 全小写 + 下划线

  cookieOptions: {
    // 本地 dev 用 .env.local 设 <PROJECT>_COOKIE_SECURE=false；生产 HTTPS 留空（默认 true）
    secure:
      process.env.<PROJECT>_COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    // 子路径部署时（如 /a500/）必须在 .env 设 <PROJECT>_COOKIE_PATH=/a500
    path: process.env.<PROJECT>_COOKIE_PATH || "/",
    maxAge: 60 * 60 * 24 * 30, // 30 天
  },
};

export async function getSession(req, res) {
  if (!sessionOptions.password) {
    throw new Error("<PROJECT>_SESSION_PASSWORD env 未配置");
  }
  return getIronSession(req, res, sessionOptions);
}
