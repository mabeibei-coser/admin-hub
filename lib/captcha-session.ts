/**
 * 图形验证码 — 独立 iron-session cookie。
 * 与 admin_session 同密钥但 cookieName 不同，互不影响。
 * TTL 5 分钟，登录尝试后立即销毁（无论成败），防重放。
 */
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface CaptchaSession {
  text?: string;
  createdAt?: number;
}

const captchaOptions: SessionOptions = {
  password: process.env.ADMIN_SESSION_PASSWORD!,
  cookieName: "admin_captcha",
  cookieOptions: {
    secure:
      process.env.ADMIN_COOKIE_SECURE !== "false" &&
      process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    path: "/b100",
    maxAge: 5 * 60, // 5 分钟
  },
};

export async function getCaptchaSession() {
  return getIronSession<CaptchaSession>(await cookies(), captchaOptions);
}
