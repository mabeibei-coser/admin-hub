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
    noise: 1,
    color: false,
    // 不设 background → SVG 背景透明（玻璃卡片背景透过来）
    width: 120,
    height: 44,
    fontSize: 50,
  });

  // svg-captcha 把字符渲染为 <path fill="...">，噪点为 <path stroke="...">。
  // 深色玻璃背景上白色字符对比度最高；噪点保留但降到几乎不可见。
  const svgData = captcha.data
    .replace(/<rect[^>]*\/>/g, "")                                  // 移除背景矩形 → 透明
    .replace(/\bfill="(?!none")([^"]*)"/g, 'fill="#ffffff"')        // 字符路径改白色
    .replace(/\bstroke="[^"]*"/g, 'stroke="rgba(255,255,255,0.2)"'); // 噪点降至微弱白色

  const s = await getCaptchaSession();
  s.text = captcha.text.toLowerCase();
  s.createdAt = Date.now();
  await s.save();

  return new NextResponse(svgData, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      Pragma: "no-cache",
    },
  });
}
