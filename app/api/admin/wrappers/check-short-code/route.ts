import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { isShortCodeUsed } from "@/lib/wrappers-db";

const MENU = "wrappers";

/**
 * GET /api/admin/wrappers/check-short-code?code=xxx&excludeId=yyy
 * 前端 debounce 调用来查重。编辑时 excludeId 排除自身。
 */
export async function GET(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const excludeIdStr = url.searchParams.get("excludeId");

  if (!code) {
    return NextResponse.json({ exists: false });
  }

  const excludeId = excludeIdStr ? Number(excludeIdStr) : undefined;
  const exists = isShortCodeUsed(code, excludeId);
  return NextResponse.json({ exists });
}
