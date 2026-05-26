import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isHazardDbReady } from "@/lib/db";

export const runtime = "nodejs";

/**
 * 隐患识别报告原图接口。
 *
 * 列表只透出 has_photo 标识；前端 <img> 单独请求这里取真正的图片二进制，
 * 避免列表 payload 把几十张 base64（每张 200–500KB）都塞进来。
 *
 * 鉴权：proxy.ts 已对 /api/admin/* 做 session gate，本路由依赖该上游闸门。
 * project 当前固定 hazard——其他业务暂不存原图。
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json({ error: "无效 ID" }, { status: 400 });
    }

    const project = req.nextUrl.searchParams.get("project");
    if (project !== "hazard") {
      return NextResponse.json(
        { error: "仅 hazard 项目支持原图查询" },
        { status: 400 }
      );
    }

    if (!isHazardDbReady()) {
      return NextResponse.json(
        { error: "hazard 数据源不可用" },
        { status: 503 }
      );
    }

    const db = getAdminDb();

    // hazard-detect 老 schema 没有 image_base64 列时，直接判 404；前端列表那侧 has_photo=0 不会触发请求
    const cols = db
      .prepare("PRAGMA hazard.table_info(reports)")
      .all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === "image_base64")) {
      return NextResponse.json({ error: "无原图" }, { status: 404 });
    }

    const row = db
      .prepare(
        "SELECT image_base64, image_mime FROM hazard.reports WHERE id = ?"
      )
      .get(id) as { image_base64: string | null; image_mime: string | null } | undefined;

    if (!row) {
      return NextResponse.json({ error: "报告不存在" }, { status: 404 });
    }
    if (!row.image_base64) {
      // 老数据没存图——返回 404 让 <img onError> 走占位
      return NextResponse.json({ error: "无原图" }, { status: 404 });
    }

    const mime = row.image_mime && /^image\/(jpe?g|png|webp)$/.test(row.image_mime)
      ? row.image_mime
      : "image/jpeg";
    const buf = Buffer.from(row.image_base64, "base64");

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.byteLength),
        // 报告记录不可变，照片永不变更——给浏览器长缓存
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("[admin/reports/photo] error:", e);
    return NextResponse.json(
      { error: "查询失败", detail: String(e) },
      { status: 500 }
    );
  }
}
