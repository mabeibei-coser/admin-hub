"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * ThemeProvider — 后台主题切换（light / dark / system）。
 *
 * globals.css 已有 `.dark { ... }` 暗色 token，这里把它接线起来：
 *   - 持久化到 localStorage("admin.theme")
 *   - "system" 跟随 prefers-color-scheme
 *   - 切换时给 <html> 加/去 `dark` class
 *
 * SSR 时默认 light 渲染；客户端首次 mount 后 sync 真实 preference，
 * 避免 hydration mismatch (flash)。如果担心 flash，可以在 layout 加 inline
 * <script> 抢先注入 — 后台用户量小，先用最简单方案。
 */

export type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  /** 用户选择的主题 (light/dark/system) */
  theme: Theme;
  /** 当前实际应用的主题 (light 或 dark) — system 时由 OS 决定 */
  resolvedTheme: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "admin.theme";

function applyTheme(theme: Theme): "light" | "dark" {
  const root = document.documentElement;
  let resolved: "light" | "dark" = "light";
  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } else {
    resolved = theme;
  }
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = resolved;
  return resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR-safe default
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  // 首次 mount: 读 localStorage + 应用
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "system";
    setThemeState(stored);
    setResolvedTheme(applyTheme(stored));
  }, []);

  // theme=system 时跟随 OS 切换
  useEffect(() => {
    if (theme !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolvedTheme(applyTheme("system"));
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
    setResolvedTheme(applyTheme(t));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
