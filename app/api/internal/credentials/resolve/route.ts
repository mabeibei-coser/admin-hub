import { parseMasterKey } from "@/lib/credential-hub/crypto";
import { getCredentialDb } from "@/lib/credential-hub/db";
import { credentialJson } from "@/lib/credential-hub/http";
import { readBearerToken } from "@/lib/credential-hub/internal-contract";
import {
  authenticateProjectTokenIdentity,
  resolveProjectCredentials,
} from "@/lib/credential-hub/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let db: ReturnType<typeof getCredentialDb>;
  try {
    db = getCredentialDb();
  } catch {
    return credentialJson({ error: "凭证中心存储未就绪" }, 503);
  }
  const token = readBearerToken(req.headers.get("authorization"));
  const identity = token
    ? authenticateProjectTokenIdentity(db, token, "credentials:resolve")
    : null;
  if (!identity) return credentialJson({ error: "未授权" }, 401);

  const url = new URL(req.url);
  if ([...url.searchParams.keys()].some((key) => key !== "project")) {
    return credentialJson({ error: "查询参数无效" }, 400);
  }
  const projectId = url.searchParams.get("project")?.trim() ?? "";
  if (!projectId || identity.projectId !== projectId) {
    return credentialJson({ error: "未授权" }, 401);
  }

  let masterKey: Buffer;
  try {
    masterKey = parseMasterKey(process.env.CREDENTIAL_MASTER_KEY);
  } catch {
    return credentialJson({ error: "凭证中心根配置未就绪" }, 503);
  }

  try {
    const credentials = resolveProjectCredentials(db, projectId, masterKey);
    if (credentials.length === 0) {
      return credentialJson({ error: "项目当前没有已启用凭证" }, 503);
    }
    return credentialJson({ projectId, credentials });
  } catch {
    return credentialJson({ error: "凭证解析失败" }, 503);
  }
}
