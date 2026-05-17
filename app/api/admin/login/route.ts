import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/admin-session";
import { getCaptchaSession } from "@/lib/captcha-session";

const CAPTCHA_TTL_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, captcha } = body ?? {};

    if (
      !username ||
      typeof username !== "string" ||
      username.trim().length < 3
    ) {
      return NextResponse.json({ error: "请输入用户名" }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "请输入密码" }, { status: 400 });
    }
    if (!captcha || typeof captcha !== "string") {
      return NextResponse.json({ error: "请输入验证码" }, { status: 400 });
    }

    // 校验图形验证码 — 无论成败都销毁，防重放
    const captchaSession = await getCaptchaSession();
    const expected = captchaSession.text;
    const age = captchaSession.createdAt
      ? Date.now() - captchaSession.createdAt
      : Infinity;
    await captchaSession.destroy();

    if (!expected || age > CAPTCHA_TTL_MS) {
      return NextResponse.json(
        { error: "验证码已过期，请刷新" },
        { status: 400 }
      );
    }
    if (captcha.trim().toLowerCase() !== expected) {
      return NextResponse.json({ error: "验证码错误" }, { status: 400 });
    }

    const result = await loginAdmin(username.trim(), password);

    if (!result.ok) {
      // 统一对外文案，防止账号枚举；reason 仅服务端日志可见
      console.info(
        `[admin/login] login failed: username=${username} reason=${result.reason}`
      );
      return NextResponse.json(
        { error: "用户名或密码错误" },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin/login] error:", e);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}
