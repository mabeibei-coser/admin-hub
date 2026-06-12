import { NextResponse } from "next/server";

const DOC_LIB_BASE_URL = process.env.DOC_LIB_BASE_URL ?? "https://h100.jsai100.com/docs";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeName) return new NextResponse(null, { status: 400 });

  try {
    const res = await fetch(`${DOC_LIB_BASE_URL}/api/preview/${safeName}`);
    if (!res.ok) return new NextResponse(null, { status: res.status });

    const contentType = res.headers.get("content-type") ?? "image/png";
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
