// 文档库（doc-library）HTTP 客户端。admin-hub 不写 doc-library 的库（铁律），
// 改为 HTTP 调它的内部 admin 接口，让它自己写自己的库。
// 配置：DOC_LIB_BASE_URL（默认生产 /docs）+ DOC_LIB_SECRET（x-admin-secret）。

const DOC_LIB_BASE_URL = process.env.DOC_LIB_BASE_URL ?? "https://h100.jsai100.com/docs";
const DOC_LIB_SECRET = process.env.DOC_LIB_SECRET ?? "";

export function isDocLibConfigured(): boolean {
  return !!DOC_LIB_SECRET;
}

/** 调 doc-library admin 接口（JSON）。返回 { ok, status, data }。 */
export async function docLibFetch(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${DOC_LIB_BASE_URL}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      "x-admin-secret": DOC_LIB_SECRET,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

/** 转发 multipart 上传到 doc-library。透传前端的 FormData。 */
export async function docLibUpload(form: FormData): Promise<{ ok: boolean; status: number; data: unknown }> {
  const res = await fetch(`${DOC_LIB_BASE_URL}/api/admin/upload`, {
    method: "POST",
    headers: { "x-admin-secret": DOC_LIB_SECRET },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
