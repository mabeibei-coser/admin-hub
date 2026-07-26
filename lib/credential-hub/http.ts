import { NextResponse } from "next/server.js";

const MAX_ADMIN_BODY_BYTES = 8 * 1024;

export function credentialJson(
  body: Record<string, unknown>,
  status = 200,
): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export function validateCredentialMutationRequest(req: Request): string | null {
  const contentType = req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") return "请求格式必须是 JSON";
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_ADMIN_BODY_BYTES) {
    return "请求内容过大";
  }
  const origin = req.headers.get("origin");
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",", 1)[0].trim();
  const expectedHost = forwardedHost || req.headers.get("host");
  if (!origin || !expectedHost) return "缺少同源校验信息";
  try {
    const originUrl = new URL(origin);
    if (
      !new Set(["http:", "https:"]).has(originUrl.protocol) ||
      originUrl.host !== expectedHost
    ) {
      return "跨站请求已拒绝";
    }
  } catch {
    return "跨站请求已拒绝";
  }
  return null;
}

export async function readExactJsonObject(
  req: Request,
  allowedKeys: ReadonlySet<string>,
): Promise<Record<string, unknown>> {
  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_ADMIN_BODY_BYTES) {
    throw new Error("请求内容过大");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("请求体格式错误");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("请求体格式错误");
  }
  const body = parsed as Record<string, unknown>;
  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    throw new Error("请求包含未允许的字段");
  }
  return body;
}
