import { NextRequest, NextResponse } from "next/server";
import { loginAdmin } from "@/lib/admin-session";
import { isValidCnMobile } from "@/lib/phone";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body ?? {};

    if (!username || typeof username !== "string") {
      return NextResponse.json({ error: "请输入手机号" }, { status: 400 });
    }
    if (!isValidCnMobile(username)) {
      return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
    }
    if (!password || typeof password !== "string") {
      return NextResponse.json({ error: "请输入密码" }, { status: 400 });
    }

    const result = await loginAdmin(username, password);

    if (!result.ok) {
      // 统一对外文案，防止账号枚举；reason 仅服务端日志可见
      console.info(`[admin/login] login failed: username=${username} reason=${result.reason}`);
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
