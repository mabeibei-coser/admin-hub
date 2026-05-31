// ─────────────────────────────────────────────────────────────────────────
// templates/vite.config.js
// 适用：Vite + Express 形态。直接 cp 到项目根 vite.config.js。
// 来源：基于 salary-report (A500) 实战版本提炼。
// ─────────────────────────────────────────────────────────────────────────

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';   // Vue 项目改成 vue plugin
import fs from 'node:fs';
import path from 'node:path';

// 直接从 .env.local 文件 parse PORT（API 后端端口），避免被 process.env.PORT 覆盖。
// 场景：preview wrapper / 外部脚本会注入 process.env.PORT 来指定 vite 监听端口，
// 此时 loadEnv 会把 process.env.PORT 合并进 env，导致 apiPort 跟 vite 端口同值，
// proxy 死循环。这个 helper 绕过 loadEnv，直接读文件。
function readApiPortFromEnvLocal() {
  try {
    const file = path.resolve(process.cwd(), '.env.local');
    const txt = fs.readFileSync(file, 'utf8');
    const m = txt.match(/^\s*PORT\s*=\s*(\d+)\s*$/m);
    return m ? m[1] : '4001';
  } catch {
    return '4001';
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiPort = readApiPortFromEnvLocal();

  return {
    // 子路径部署时设 VITE_BASE_PATH=/a500/；本地 dev 用默认 '/'
    base: env.VITE_BASE_PATH || '/',
    plugins: [react()],
    server: {
      // vite dev server 端口。无 process.env.PORT 时用 3000；被外部脚本注入时跟随。
      port: Number(process.env.PORT) || 3000,
      strictPort: !!process.env.PORT,
      open: !process.env.PORT,
      proxy: {
        // 浏览器在 dev 下访问 /api/* 会被反代到 Express 后端
        '/api': {
          target: `http://localhost:${apiPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
