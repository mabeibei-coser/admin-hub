const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    // oklch() fallback —— 给搜狗 / QQ / 360 等基于较旧 Chromium 内核的浏览器补 rgb fallback。
    // preserve: true 保留原 oklch() declaration，新浏览器仍用 oklch 精确色，旧浏览器降级到前面那行 rgb。
    "@csstools/postcss-oklab-function": { preserve: true },
  },
};

export default config;
