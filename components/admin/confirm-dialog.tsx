"use client";

import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * ConfirmDialog — 通用确认弹窗（mount/unmount 控制，不带 open prop）。
 *
 * 替代项目里散落的 inline modal（如 service-tracking-editor 的 ConfirmHandoffModal）。
 * 所有颜色走 token，dark mode 自动适配。
 *
 * 调用方式：
 *   {state && (
 *     <ConfirmDialog
 *       icon={UserCog}
 *       tone="warning"
 *       title="转交确认"
 *       confirmLabel="确认转交"
 *       onCancel={...}
 *       onConfirm={...}
 *     >
 *       <p>…</p>
 *     </ConfirmDialog>
 *   )}
 */

export type ConfirmTone = "warning" | "danger" | "info";

const ICON_BG: Record<ConfirmTone, string> = {
  warning:
    "bg-[oklch(0.95_0.08_70)] text-[var(--semantic-warning)] dark:bg-[oklch(0.3_0.08_65)] dark:text-[oklch(0.85_0.12_70)]",
  danger:
    "bg-[oklch(0.95_0.05_25)] text-[var(--semantic-danger)] dark:bg-[oklch(0.3_0.08_25)] dark:text-[oklch(0.85_0.14_25)]",
  info: "bg-[var(--blue-50)] text-[var(--blue-700)]",
};

const CONFIRM_BTN: Record<ConfirmTone, string> = {
  warning:
    "bg-[var(--semantic-warning)] hover:brightness-110 text-white shadow-[0_1px_2px_oklch(0.4_0.1_70_/_0.2),0_4px_14px_oklch(0.62_0.14_55_/_0.25)]",
  danger:
    "bg-[var(--semantic-danger)] hover:brightness-110 text-white shadow-[0_1px_2px_oklch(0.4_0.1_25_/_0.2),0_4px_14px_oklch(0.55_0.2_25_/_0.25)]",
  info: "bg-[var(--blue-600)] hover:brightness-110 text-white",
};

export interface ConfirmDialogProps {
  icon: LucideIcon;
  tone?: ConfirmTone;
  title: string;
  /** body 内容 */
  children: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  icon: Icon,
  tone = "warning",
  title,
  children,
  confirmLabel = "确认",
  cancelLabel = "取消",
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={busy ? undefined : onCancel}
      />
      <div className="relative z-10 w-full max-w-xs rounded-xl bg-card text-card-foreground shadow-xl p-5 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`flex size-8 items-center justify-center rounded-full ${ICON_BG[tone]}`}>
              <Icon className="size-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            aria-label="关闭"
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="text-sm text-foreground leading-relaxed">{children}</div>
        <div className="flex gap-2 mt-5">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 h-8 rounded-lg px-3 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)]/30 ${CONFIRM_BTN[tone]}`}
          >
            {busy ? "处理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
