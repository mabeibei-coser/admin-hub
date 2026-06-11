import type { NextConfig } from "next";
import pkg from "./package.json";

const BASE_PATH = "/b100";

const nextConfig: NextConfig = {
  // better-sqlite3: native module，必须外部
  // svg-captcha: 运行时读 .ttf 字体文件，不能被打包
  serverExternalPackages: ["better-sqlite3", "svg-captcha"],
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
    // 应用版本号 — 编译时从 package.json 注入，避免在源码里写死
    // (历史曾出现 login footer v0.1.19 实际包已 v0.1.24 的不一致)
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  experimental: {
    // Next.js 16 默认 proxy/middleware 层 body 限制 10MB,含图 PPT 上传会被截断
    // 报 "Request body exceeded 10MB" + "Failed to parse body as FormData"。
    // 提到 50MB(与 doc-library multer fileSize 上限对齐;再大走专门通道)。
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
