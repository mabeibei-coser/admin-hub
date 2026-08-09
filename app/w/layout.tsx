/**
 * 公开包装页专用 layout。
 *
 * 不覆盖 root layout 的 <html>/<body>（Next.js App Router 不允许），
 * 但用 <style> 注入 !important 规则覆盖：
 * 1. 强制 body 浅色背景（防止 admin 暗色模式影响）
 * 2. 强制 colorScheme 为 light
 */

export default function PublicWrapperLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        /* 强制浅色模式，不受 admin 后台暗色主题影响 */
        html, body { overflow: hidden !important; background: #fff !important; color-scheme: light !important; }
        body.dark { background: #fff !important; }
        html.dark { color-scheme: light !important; }
      `}</style>
      {children}
    </>
  );
}
