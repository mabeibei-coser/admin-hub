import { getCredentialDb } from "@/lib/credential-hub/db";
import {
  credentialJson,
  readExactJsonObject,
} from "@/lib/credential-hub/http";
import {
  parseProjectCredentialEvent,
  readBearerToken,
} from "@/lib/credential-hub/internal-contract";
import {
  authenticateProjectTokenIdentity,
  recordProjectCredentialEvent,
} from "@/lib/credential-hub/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_KEYS = new Set([
  "bindingId",
  "credentialVersion",
  "status",
  "latencyMs",
  "errorCategory",
]);

export async function POST(req: Request) {
  let db: ReturnType<typeof getCredentialDb>;
  try {
    db = getCredentialDb();
  } catch {
    return credentialJson({ error: "凭证中心存储未就绪" }, 503);
  }
  const token = readBearerToken(req.headers.get("authorization"));
  const identity = token
    ? authenticateProjectTokenIdentity(db, token, "credentials:events")
    : null;
  if (!identity) return credentialJson({ error: "未授权" }, 401);

  const contentType = req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return credentialJson({ error: "请求格式必须是 JSON" }, 400);
  }

  try {
    const raw = await readExactJsonObject(req, EVENT_KEYS);
    const event = parseProjectCredentialEvent(raw, identity.projectId);
    const eventId = recordProjectCredentialEvent(db, event);
    return credentialJson({ ok: true, eventId }, 201);
  } catch (error) {
    const message =
      error instanceof Error &&
      (error.message.includes("未允许") ||
        error.message.includes("无效") ||
        error.message.includes("必须") ||
        error.message.includes("不能包含"))
        ? error.message
        : "事件不属于该项目";
    return credentialJson({ error: message }, 400);
  }
}
