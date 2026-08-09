import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { validateWrapperSuffix } from "@/lib/wrappers";
import { isShortCodeUsed } from "@/lib/wrappers-db";

const MENU = "wrappers";

/**
 * GET /api/admin/wrappers/check-short-code?code=xxx
 * 前端 debounce 调用来查重。访问后缀创建后不可修改，无需排除已有记录。
 */
export async function GET(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() || "";

  if (!code) {
    return NextResponse.json({ exists: false });
  }

  const suffixCheck = validateWrapperSuffix(code);
  if (!suffixCheck.ok) {
    return NextResponse.json({ error: suffixCheck.error }, { status: 400 });
  }

  const exists = isShortCodeUsed(code);
  return NextResponse.json({ exists });
}
