// 文档库（doc-library）HTTP 客户端。admin-hub 不写 doc-library 的库（铁律），
// 改为 HTTP 调它的内部 admin 接口，让它自己写自己的库。
// 配置：DOC_LIB_BASE_URL（默认生产 /docs）+ DOC_LIB_SECRET（x-admin-secret）。

const DOC_LIB_BASE_URL = process.env.DOC_LIB_BASE_URL ?? "https://h100.jsai100.com/docs";
const DOC_LIB_SECRET = process.env.DOC_LIB_SECRET ?? "";

export function isDocLibConfigured(): boolean {
  return !!DOC_LIB_SECRET;
}

// 把 Node fetch 的 TypeError("fetch failed") 翻成人话。Node fetch 在网络层失败时
// 抛 TypeError，真正的原因（ECONNREFUSED / 域名解析失败 / 超时）藏在 .cause 里。
// 不翻一下的话，上层 route 会直接 500 + 空 body，前端 res.json() 抛
// "Unexpected end of JSON input"——天书。
function describeFetchErr(err: unknown): string {
  if (!(err instanceof Error)) return "调用文档库失败：未知错误";
  const cause = (err as { cause?: { code?: string; message?: string } }).cause;
  const code = cause?.code;
  if (code === "ECONNREFUSED") return `无法连接文档库服务（${DOC_LIB_BASE_URL}）——请确认 doc-library 已启动`;
  if (code === "ENOTFOUND") return `文档库域名解析失败（${DOC_LIB_BASE_URL}）`;
  if (code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT" || /timeout/i.test(cause?.message ?? "")) {
    return "文档库响应超时";
  }
  return `调用文档库失败：${err.message}${cause?.message ? `（${cause.message}）` : ""}`;
}

/** 调 doc-library admin 接口（JSON）。返回 { ok, status, data }。 */
export async function docLibFetch(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
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
  } catch (err) {
    return { ok: false, status: 0, data: { error: describeFetchErr(err) } };
  }
}

/** 转发 multipart 上传到 doc-library。透传前端的 FormData。 */
export async function docLibUpload(form: FormData): Promise<{ ok: boolean; status: number; data: unknown }> {
  try {
    const res = await fetch(`${DOC_LIB_BASE_URL}/api/admin/upload`, {
      method: "POST",
      headers: { "x-admin-secret": DOC_LIB_SECRET },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { error: describeFetchErr(err) } };
  }
}
