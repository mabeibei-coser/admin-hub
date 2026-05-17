import type { NextConfig } from "next";

const BASE_PATH = "/b100";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  basePath: BASE_PATH,
  trailingSlash: true,
  // 锁定 turbopack workspace root 为本目录。git worktree 场景下，主目录
  // (admin-hub/) 和 worktree 各有一份 package-lock.json，turbopack 默认
  // 选最上层那个、导致 PostCSS plugin 解析跑到主目录 node_modules（缺包）。
  turbopack: {
    root: __dirname,
  },
  env: {
    // 让客户端代码也能拿到 basePath。Next.js 的 basePath 只对 <Link> /
    // router.push / 内置 redirect() 自动加前缀；对客户端 fetch() 和
    // window.location.href 等浏览器原生 API 不生效，需要手动通过
    // lib/url.ts 的 withBase() 拼。
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
};

export default nextConfig;
