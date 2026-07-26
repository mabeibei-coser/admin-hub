import { requireCredentialSuper } from "@/lib/admin-session";
import { getCredentialDb } from "@/lib/credential-hub/db";
import {
  credentialJson,
  readExactJsonObject,
  validateCredentialMutationRequest,
} from "@/lib/credential-hub/http";
import {
  activateVersion,
  getCredentialIdForVersion,
} from "@/lib/credential-hub/service";

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
  try {
    const db = getCredentialDb();
    const credentialId = getCredentialIdForVersion(db, versionId);
    if (!credentialId) return credentialJson({ error: "版本不存在" }, 404);
    activateVersion(db, credentialId, versionId, session.adminId);
    return credentialJson({ ok: true, credentialId, versionId });
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("尚未通过验证")
        ? "候选版本尚未通过验证"
        : "凭证版本启用失败";
    return credentialJson({ error: message }, 400);
  }
}
