import { requireCredentialSuper } from "@/lib/admin-session";
import { parseMasterKey } from "@/lib/credential-hub/crypto";
import { getCredentialDb } from "@/lib/credential-hub/db";
import {
  credentialJson,
  readExactJsonObject,
  validateCredentialMutationRequest,
} from "@/lib/credential-hub/http";
import { A100_PILOT, isA100PilotLogicalKey } from "@/lib/credential-hub/pilot";
import { bindCredential, createCandidate } from "@/lib/credential-hub/service";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireCredentialSuper();
  if (!session) return credentialJson({ error: "无权限" }, 403);
  const requestError = validateCredentialMutationRequest(req);
  if (requestError) return credentialJson({ error: requestError }, 403);

  const { id } = await params;
  if (!isA100PilotLogicalKey(id)) {
    return credentialJson({ error: "试点凭证不存在" }, 404);
  }

  let body: Record<string, unknown>;
  try {
    body = await readExactJsonObject(req, new Set(["apiKey"]));
  } catch (error) {
    return credentialJson(
      { error: error instanceof Error ? error.message : "请求体格式错误" },
      400,
    );
  }
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (apiKey.length < 16 || apiKey.length > 4096) {
    return credentialJson({ error: "API Key 格式或长度无效" }, 400);
  }

  let masterKey: Buffer;
  try {
    masterKey = parseMasterKey(process.env.CREDENTIAL_MASTER_KEY);
  } catch {
    return credentialJson({ error: "凭证中心根配置未就绪" }, 503);
  }

  try {
    const db = getCredentialDb();
    const result = db.transaction(() => {
      const candidate = createCandidate(db, masterKey, {
        logicalKey: A100_PILOT.logicalKey,
        provider: A100_PILOT.provider,
        capability: A100_PILOT.capability,
        secret: apiKey,
        endpoint: A100_PILOT.endpoint,
        model: A100_PILOT.model,
        protocol: A100_PILOT.protocol,
        createdByAdminId: session.adminId,
      });
      const bindingId = bindCredential(db, {
        projectId: A100_PILOT.projectId,
        capability: A100_PILOT.capability,
        role: A100_PILOT.role,
        credentialId: candidate.credentialId,
      });
      return { ...candidate, bindingId };
    })();
    return credentialJson({ ok: true, ...result }, 201);
  } catch {
    return credentialJson({ error: "候选版本创建失败" }, 400);
  }
}
