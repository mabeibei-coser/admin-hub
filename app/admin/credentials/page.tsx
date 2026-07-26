import { redirect } from "next/navigation";

import { CredentialCenter } from "@/components/admin/credential-center";
import { requireCredentialSuper } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export default async function CredentialsPage() {
  const session = await requireCredentialSuper();
  if (!session) redirect("/admin/reports");
  return <CredentialCenter />;
}
