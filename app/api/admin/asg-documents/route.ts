import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { docLibFetch, isDocLibConfigured } from "@/lib/doc-library";

export const runtime = "nodejs";

const MENU = "asg-documents";

/**
 * GET /api/admin/asg-documents
 * 列表：转发 doc-library 的公开列表接口（带 q/category 透传）。
 */
export async function GET(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!isDocLibConfigured()) {
    return NextResponse.json({ items: [], categories: [], configured: false });
  }

  const url = new URL(req.url);
  const qs = new URLSearchParams();
  const q = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  if (q) qs.set("q", q);
  if (category) qs.set("category", category);

  const { ok, status, data } = await docLibFetch(`/api/documents${qs.toString() ? "?" + qs : ""}`);
  if (!ok) return NextResponse.json({ error: "文档库读取失败" }, { status: status || 502 });
  return NextResponse.json({ ...(data as object), configured: true });
}

/**
 * POST /api/admin/asg-documents
 * 新建文档：转发 doc-library 的 admin 写接口（doc-library 自己写自己的库）。
 */
export async function POST(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!isDocLibConfigured()) {
    return NextResponse.json({ error: "文档库未配置（DOC_LIB_SECRET 缺失）" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !String(body.title ?? "").trim()) {
    return NextResponse.json({ error: "请填写文档标题" }, { status: 400 });
  }

  const { ok, status, data } = await docLibFetch("/api/admin/documents", { method: "POST", body });
  if (!ok) {
    return NextResponse.json({ error: (data as { error?: string })?.error || "创建失败" }, { status: status || 502 });
  }
  return NextResponse.json(data);
}
