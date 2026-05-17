import type { NextConfig } from "next";

const BASE_PATH = "/b100";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  basePath: BASE_PATH,
  trailingSlash: true,
  env: {
    // 让客户端代码也能拿到 basePath。Next.js 的 basePath 只对 <Link> /
    // router.push / 内置 redirect() 自动加前缀；对客户端 fetch() 和
    // window.location.href 等浏览器原生 API 不生效，需要手动通过
    // lib/url.ts 的 withBase() 拼。
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
};

export default nextConfig;
