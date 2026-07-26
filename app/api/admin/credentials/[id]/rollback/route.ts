import { requireCredentialSuper } from "@/lib/admin-session";
import { getCredentialDb } from "@/lib/credential-hub/db";
import {
  credentialJson,
  readExactJsonObject,
  validateCredentialMutationRequest,
} from "@/lib/credential-hub/http";
import { isA100PilotLogicalKey } from "@/lib/credential-hub/pilot";
import {
  getCredentialIdByLogicalKey,
  rollbackCredential,
} from "@/lib/credential-hub/service";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
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

  const { id } = await params;
  if (!isA100PilotLogicalKey(id)) {
    return credentialJson({ error: "试点凭证不存在" }, 404);
  }
  try {
    const db = getCredentialDb();
    const credentialId = getCredentialIdByLogicalKey(db, id);
    if (!credentialId) return credentialJson({ error: "凭证不存在" }, 404);
    const versionId = rollbackCredential(db, credentialId, session.adminId);
    return credentialJson({ ok: true, credentialId, versionId });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("没有可回滚")
        ? "没有可回滚的旧版本"
        : "凭证回滚失败";
    return credentialJson({ error: message }, 400);
  }
}
