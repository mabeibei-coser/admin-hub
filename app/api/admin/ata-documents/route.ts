import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { ataDocLibFetch, isAtaDocLibConfigured } from "@/lib/ata-doc-library";

export const runtime = "nodejs";

const MENU = "ata-documents";

/**
 * GET /api/admin/ata-documents
 * 列表：转发 doc-library 的公开列表接口（带 q/category 透传）。
 */
export async function GET(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!isAtaDocLibConfigured()) {
    return NextResponse.json({ items: [], categories: [], configured: false });
  }

  const url = new URL(req.url);
  const qs = new URLSearchParams();
  const q = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const subcategory = url.searchParams.get("subcategory");
  const requiredTier = url.searchParams.get("requiredTier");
  if (q) qs.set("q", q);
  if (category) qs.set("category", category);
  if (subcategory) qs.set("subcategory", subcategory);
  if (requiredTier === "free" || requiredTier === "vip") qs.set("requiredTier", requiredTier);

  const { ok, status, data } = await ataDocLibFetch(`/api/documents${qs.toString() ? "?" + qs : ""}`);
  if (!ok) return NextResponse.json({ error: "文档库读取失败" }, { status: status || 502 });
  return NextResponse.json({ ...(data as object), configured: true });
}

/**
 * POST /api/admin/ata-documents
 * 新建文档：转发 doc-library 的 admin 写接口（doc-library 自己写自己的库）。
 */
export async function POST(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!isAtaDocLibConfigured()) {
    return NextResponse.json({ error: "文档库未配置（ATA_DOC_LIB_SECRET 缺失）" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !String(body.title ?? "").trim()) {
    return NextResponse.json({ error: "请填写文档标题" }, { status: 400 });
  }

  const { ok, status, data } = await ataDocLibFetch("/api/admin/documents", { method: "POST", body });
  if (!ok) {
    return NextResponse.json({ error: (data as { error?: string })?.error || "创建失败" }, { status: status || 502 });
  }
  return NextResponse.json(data);
}
