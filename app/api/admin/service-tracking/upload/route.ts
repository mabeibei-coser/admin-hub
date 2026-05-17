import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { requireMenu } from "@/lib/admin-session";
import {
  ATTACHMENT_ALLOWED_EXT,
  ATTACHMENT_MAX_BYTES,
  type ServiceRecordAttachment,
} from "@/lib/service-tracking";

export const runtime = "nodejs";

/**
 * POST /api/admin/service-tracking/upload
 * multipart/form-data，字段名 `file`，单文件。
 *
 * 流程：会话校验 → 大小/扩展名校验 → 写盘到 <DATA_DIR>/service-attachments/<uuid>/<filename>
 * → 返回元数据。前端把返回值塞进 RecordForm 的 attachments state，保存记录时随 JSON 一起提交。
 *
 * 没有「试用一会儿就丢」的孤儿清理逻辑：用户上传后取消的 dir 会留在盘上。HR 场景里这种很罕见；
 * 真要清，写个 sweeper 比较 attachments_json 引用集合 vs 磁盘目录列表即可，留作后续。
 */
export async function POST(req: NextRequest) {
  const session = await requireMenu("service");
  if (!session) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "请求体解析失败" }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "文件为空" }, { status: 400 });
  }
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `文件超过 ${Math.round(ATTACHMENT_MAX_BYTES / 1024 / 1024)} MB 上限`,
      },
      { status: 400 },
    );
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ATTACHMENT_ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `不支持的文件类型：${ext || "无扩展名"}` },
      { status: 400 },
    );
  }

  const id = randomUUID();
  const DATA_DIR = path.resolve(process.cwd(), "data");
  const destDir = path.join(DATA_DIR, "service-attachments", id);
  fs.mkdirSync(destDir, { recursive: true });
  // 文件名清洗：去掉路径分隔符 / .. 防穿越；保留中文
  const safeName = file.name.replace(/[/\\]/g, "_").replace(/\.\./g, "_");
  const destPath = path.join(destDir, safeName);
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(destPath, buf);

  const meta: ServiceRecordAttachment = {
    id,
    filename: safeName,
    mime: file.type || "application/octet-stream",
    size: file.size,
  };
  return NextResponse.json(meta);
}
