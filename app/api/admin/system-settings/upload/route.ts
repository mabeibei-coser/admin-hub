import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";
import { requireSuper } from "@/lib/admin-session";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * POST /api/admin/system-settings/upload
 * 表单字段 file=<File>
 * 仅超管可上传。图片落在 public/uploads/system-settings/<uuid>.<ext>，
 * 返回 url=/b100/uploads/system-settings/<uuid>.<ext>，前端可直接用 Markdown ![](url) 渲染。
 */
export async function POST(req: NextRequest) {
  const session = await requireSuper();
  if (!session) {
    return NextResponse.json({ error: "无权限（仅超管可上传）" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "文件为空" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "图片大小不能超过 5 MB" }, { status: 413 });
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "仅支持 PNG / JPG / GIF / WEBP" },
      { status: 415 },
    );
  }

  const dir = path.resolve(process.cwd(), "public", "uploads", "system-settings");
  await fs.mkdir(dir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, filename), buf);

  const url = `${BASE_PATH}/uploads/system-settings/${filename}`;
  return NextResponse.json({ ok: true, url, filename, size: file.size });
}
