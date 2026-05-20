import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isTailorDbReady } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "未登录" }, { status: 401 });

  if (!isTailorDbReady()) {
    return NextResponse.json({ error: "简历定制数据库暂不可用" }, { status: 503 });
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "无效 ID" }, { status: 400 });

  // resume-tailor 部署在 /a100 子路径；默认直接打生产（docx 生成是无状态纯函数，本机也能调）
  const tailorBaseUrl = process.env.TAILOR_BASE_URL ?? "https://h100.jsai100.com/a100";

  const db = getAdminDb();
  const row = db
    .prepare("SELECT report_json FROM tailor.reports WHERE id = ?")
    .get(id) as { report_json: string | null } | undefined;

  if (!row) return NextResponse.json({ error: "报告不存在" }, { status: 404 });
  if (!row.report_json) return NextResponse.json({ error: "报告数据为空" }, { status: 404 });

  let reportJson: { resume?: unknown; changes?: unknown };
  try {
    reportJson = JSON.parse(row.report_json) as { resume?: unknown; changes?: unknown };
  } catch {
    return NextResponse.json({ error: "报告数据解析失败" }, { status: 500 });
  }

  if (!reportJson.resume || !reportJson.changes) {
    return NextResponse.json({ error: "报告中无简历数据" }, { status: 404 });
  }

  const docxRes = await fetch(`${tailorBaseUrl}/api/tailor/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resume: reportJson.resume, changes: reportJson.changes }),
  });

  if (!docxRes.ok) {
    const err = await docxRes.text().catch(() => "未知错误");
    return NextResponse.json({ error: `生成简历失败：${err}` }, { status: 502 });
  }

  const buffer = await docxRes.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`优化简历-${id}.docx`)}`,
      "Cache-Control": "no-store",
    },
  });
}
