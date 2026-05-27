import { NextResponse } from "next/server";
import { requireSuper } from "@/lib/admin-session";
import { readPrompts } from "@/lib/hazard-prompts";

/**
 * GET /api/admin/hazard-prompts
 * 一次性返回完整 prompts.json（labels + 36 个场景的 name/context/focus）。
 * 仅超管。
 */
export async function GET() {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  try {
    const data = readPrompts();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "读取失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
