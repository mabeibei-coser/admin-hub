import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

/**
 * POST /api/teaching/gate — 智能课件(A700)登录白名单校验。
 *
 * 服务间接口：**不走 admin session**。该路径不在 /api/admin 下，proxy.ts 不拦截，
 * 用 shared secret（env TEACHING_GATE_SECRET）自校验。A700 server.js 登录时调用：
 *   手机号在 courseware_users 且 status='active' 才放行。
 *
 * 入参：body { phone }，header `x-gate-secret`
 * 出参：{ allowed: boolean }
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TEACHING_GATE_SECRET;
  if (!secret) {
    // 未配置 secret 视为配置错误，fail-closed（不放行）。A700 侧据此拒绝登录。
    return NextResponse.json({ error: "gate 未配置" }, { status: 500 });
  }
  if (req.headers.get("x-gate-secret") !== secret) {
    return NextResponse.json({ error: "无权限" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const phone = String(body?.phone ?? "").trim();
  if (!/^1\d{10}$/.test(phone)) {
    return NextResponse.json({ error: "手机号格式不正确" }, { status: 400 });
  }

  const row = getDb()
    .prepare(
      "SELECT 1 AS ok FROM courseware_users WHERE phone = ? AND status = 'active'"
    )
    .get(phone) as { ok: number } | undefined;

  return NextResponse.json({ allowed: !!row });
}
