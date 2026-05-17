/**
 * GET /api/admin/captcha
 * 返回 SVG 图形验证码 + 在 admin_captcha cookie 里存答案（iron-session 加密）。
 * 5 分钟有效。/api/admin/login 校验时无论成败都销毁。
 */
import { NextResponse } from "next/server";
import svgCaptcha from "svg-captcha";
import { getCaptchaSession } from "@/lib/captcha-session";

// 强制动态：每次访问生成新图，且要操作 cookie
export const dynamic = "force-dynamic";

export async function GET() {
  const captcha = svgCaptcha.create({
    size: 4,
    ignoreChars: "0o1ilI", // 视觉易混淆的字符
    noise: 2,
    color: true,
    background: "#1e293b", // navy 调，匹配登录页深色背景
    width: 120,
    height: 44,
    fontSize: 50,
  });

  const s = await getCaptchaSession();
  s.text = captcha.text.toLowerCase();
  s.createdAt = Date.now();
  await s.save();

  return new NextResponse(captcha.data, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}
