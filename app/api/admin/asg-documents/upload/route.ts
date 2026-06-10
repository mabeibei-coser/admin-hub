import { NextRequest, NextResponse } from "next/server";
import { requireMenu } from "@/lib/admin-session";
import { docLibUpload, isDocLibConfigured } from "@/lib/doc-library";

export const runtime = "nodejs";

const MENU = "asg-documents";

/**
 * POST /api/admin/asg-documents/upload
 * 透传 multipart 上传（附件 attachment + 预览图 preview）到 doc-library。
 * doc-library 把文件落到它自己的磁盘，返回元信息供前端拼进 createDocument。
 */
export async function POST(req: NextRequest) {
  const session = await requireMenu(MENU);
  if (!session) return NextResponse.json({ error: "无权限" }, { status: 403 });
  if (!isDocLibConfigured()) {
    return NextResponse.json({ error: "文档库未配置" }, { status: 500 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `解析上传数据失败：${err instanceof Error ? err.message : "未知错误"}` },
      { status: 400 }
    );
  }

  const { ok, status, data } = await docLibUpload(form);
  if (!ok) {
    return NextResponse.json(
      { error: (data as { error?: string })?.error || "上传失败" },
      { status: status || 502 }
    );
  }
  return NextResponse.json(data);
}
