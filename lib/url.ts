/**
 * 给路径加上 Next.js basePath 前缀。
 *
 * 用于客户端 fetch() 和 window.location.href 等浏览器原生 API —— Next.js 的
 * basePath 配置不会自动作用到这些 API 上。`<Link>` / `router.push` / `redirect()`
 * 等 Next.js 内置导航会自动加 basePath，**不要**再用这个 helper 包装。
 *
 * 用法：
 *   fetch(withBase("/api/admin/login"))
 *   window.location.href = withBase("/admin/reports")
 *   <a href={withBase(`/api/admin/reports/${id}/resume`)}>下载</a>
 */
export function withBase(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}
