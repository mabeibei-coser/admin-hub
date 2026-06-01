import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { docLibFetch, isDocLibConfigured } from "@/lib/doc-library";

export const runtime = "nodejs";

const MENU = "asg-documents";

/** PUT /api/admin/asg-documents/[id] — 编辑文档（转发 doc-library）。 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireMenu(MENU);
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!isDocLibConfigured()) {
    return NextResponse.json({ error: "文档库未配置" }, { status: 500 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "请求体格式错误" }, { status: 400 });

  const { ok, status, data } = await docLibFetch(`/api/admin/documents/${id}`, { method: "PUT", body });
  if (!ok) {
    return NextResponse.json({ error: (data as { error?: string })?.error || "更新失败" }, { status: status || 502 });
  }
  return NextResponse.json(data);
}

/** DELETE /api/admin/asg-documents/[id] — 删除文档（转发 doc-library）。 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireMenu(MENU);
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!isDocLibConfigured()) {
    return NextResponse.json({ error: "文档库未配置" }, { status: 500 });
  }
  const { id } = await params;
  const { ok, status, data } = await docLibFetch(`/api/admin/documents/${id}`, { method: "DELETE" });
  if (!ok) {
    return NextResponse.json({ error: (data as { error?: string })?.error || "删除失败" }, { status: status || 502 });
  }
  return NextResponse.json(data);
}
