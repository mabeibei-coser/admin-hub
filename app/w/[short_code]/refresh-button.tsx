"use client";

/**
 * 「新对话」按钮 — 客户端小岛组件。
 * 点击刷新 iframe（加 timestamp query 强制 reload）。
 */
export function RefreshButton() {
  return (
    <button
      className="wp-refresh"
      onClick={() => {
        const f = document.querySelector<HTMLIFrameElement>("#wrapper-page iframe");
        if (!f) return;
        const url = new URL(f.src);
        url.searchParams.set("_r", String(Date.now()));
        f.src = url.toString();
      }}
    >
      新对话
    </button>
  );
}
