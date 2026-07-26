import { requireCredentialSuper } from "@/lib/admin-session";
import { testBananaRouterVersion } from "@/lib/credential-hub/bananarouter-validator";
import { parseMasterKey } from "@/lib/credential-hub/crypto";
import { getCredentialDb } from "@/lib/credential-hub/db";
import {
  credentialJson,
  readExactJsonObject,
  validateCredentialMutationRequest,
} from "@/lib/credential-hub/http";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const session = await requireCredentialSuper();
  if (!session) return credentialJson({ error: "无权限" }, 403);
  const requestError = validateCredentialMutationRequest(req);
  if (requestError) return credentialJson({ error: requestError }, 403);
  try {
    await readExactJsonObject(req, new Set());
  } catch (error) {
    return credentialJson(
      { error: error instanceof Error ? error.message : "请求体格式错误" },
      400,
    );
  }

  const { versionId: rawVersionId } = await params;
  const versionId = Number(rawVersionId);
  if (!Number.isSafeInteger(versionId) || versionId <= 0) {
    return credentialJson({ error: "版本 ID 无效" }, 400);
  }
  let masterKey: Buffer;
  try {
    masterKey = parseMasterKey(process.env.CREDENTIAL_MASTER_KEY);
  } catch {
    return credentialJson({ error: "凭证中心根配置未就绪" }, 503);
  }

  try {
    const result = await testBananaRouterVersion(
      getCredentialDb(),
      masterKey,
      versionId,
      session.adminId!,
    );
    return credentialJson(result);
  } catch (error) {
    if (error instanceof Error && error.message === "该凭证版本正在验证") {
      return credentialJson({ error: error.message }, 409);
    }
    return credentialJson({ error: "凭证版本验证失败" }, 400);
  }
}
