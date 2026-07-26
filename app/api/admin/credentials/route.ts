import { requireCredentialSuper } from "@/lib/admin-session";
import { getCredentialDb } from "@/lib/credential-hub/db";
import { credentialJson } from "@/lib/credential-hub/http";
import { A100_PILOT } from "@/lib/credential-hub/pilot";
import { listCredentialAdminViews } from "@/lib/credential-hub/service";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireCredentialSuper();
  if (!session) return credentialJson({ error: "无权限" }, 403);

  try {
    return credentialJson({
      pilot: A100_PILOT,
      credentials: listCredentialAdminViews(getCredentialDb()),
    });
  } catch {
    return credentialJson({ error: "凭证中心暂不可用" }, 503);
  }
}
