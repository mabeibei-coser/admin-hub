"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import { X, Bot, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { withBase } from "@/lib/url";
import {
  WRAPPER_FOOTER_MAX_LENGTH,
  validateFooterText,
  validateSourceUrl,
  validateWrapperSuffix,
  wrapperPublicPath,
  type WrapperListRow,
} from "@/lib/wrappers";

interface Props {
  editing: WrapperListRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function subscribeToOrigin() {
  return () => undefined;
}

function getBrowserOrigin() {
  return window.location.origin;
}

function getServerOrigin() {
  return "";
}

export function WrapperDialog({ editing, onClose, onSaved }: Props) {
  const isEdit = !!editing;
  const [shortCode, setShortCode] = useState(editing?.short_code ?? "");
  const [name, setName] = useState(editing?.name ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [sourceUrl, setSourceUrl] = useState(editing?.source_url ?? "");
  const [footerText, setFooterText] = useState(editing?.footer_text ?? "");
  const [status, setStatus] = useState<"active" | "disabled">(editing?.status ?? "active");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shortCodeChecking, setShortCodeChecking] = useState(false);
  const [shortCodeExists, setShortCodeExists] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const browserOrigin = useSyncExternalStore(
    subscribeToOrigin,
    getBrowserOrigin,
    getServerOrigin,
  );

  // 访问后缀 debounce 查重（仅新建时）
  const checkShortCode = useCallback(
    (code: string) => {
      if (isEdit) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!validateWrapperSuffix(code).ok) {
        setShortCodeChecking(false);
        setShortCodeExists(false);
        return;
      }
      setShortCodeChecking(true);
      debounceRef.current = setTimeout(async () => {
        try {
          const res = await fetch(
            withBase(`/api/admin/wrappers/check-short-code?code=${encodeURIComponent(code.toLowerCase())}`)
          );
          if (res.ok) {
            const data = await res.json() as { exists: boolean };
            setShortCodeExists(data.exists);
          }
        } catch {
          // 网络错误忽略
        } finally {
          setShortCodeChecking(false);
        }
      }, 400);
    },
    [isEdit]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const shortCodeValid = validateWrapperSuffix(shortCode).ok;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedCode = shortCode.trim().toLowerCase();
    const trimmedName = name.trim();
    const trimmedNote = note.trim();
    const trimmedUrl = sourceUrl.trim();
    const trimmedFooter = footerText.trim();

    if (!isEdit) {
      const suffixCheck = validateWrapperSuffix(trimmedCode);
      if (!suffixCheck.ok) {
        setError(suffixCheck.error ?? "域名访问后缀不正确");
        return;
      }
      if (shortCodeExists) {
        setError("该访问后缀已被占用");
        return;
      }
    }
    if (!trimmedName || trimmedName.length > 100) {
      setError("智能体名称需 1-100 字");
      return;
    }
    if (!trimmedNote || trimmedNote.length > 500) {
      setError("备注需 1-500 字");
      return;
    }
    if (!trimmedUrl) {
      setError("请填写原始网址");
      return;
    }
    const sourceUrlCheck = validateSourceUrl(trimmedUrl);
    if (!sourceUrlCheck.ok) {
      setError(sourceUrlCheck.error ?? "原始网址格式不正确");
      return;
    }
    const footerCheck = validateFooterText(trimmedFooter);
    if (!footerCheck.ok) {
      setError(footerCheck.error ?? "底部说明不正确");
      return;
    }

    setSubmitting(true);
    try {
      const url = isEdit
        ? withBase(`/api/admin/wrappers/${editing!.id}`)
        : withBase("/api/admin/wrappers");
      const method = isEdit ? "PUT" : "POST";
      const payload = isEdit
        ? {
            name: trimmedName,
            note: trimmedNote,
            source_url: trimmedUrl,
            footer_text: trimmedFooter,
            status,
          }
        : {
            short_code: trimmedCode,
            name: trimmedName,
            note: trimmedNote,
            source_url: trimmedUrl,
            footer_text: trimmedFooter,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? `操作失败 (HTTP ${res.status})`);
        setSubmitting(false);
        return;
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(`提交失败：${err instanceof Error ? err.message : "网络错误"}`);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="wrap-dialog-title">
      <div className="fixed inset-0 bg-black/40" onClick={submitting ? undefined : onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-md bg-card text-card-foreground border border-border rounded-xl shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-full bg-[var(--blue-50)]">
              <Bot className="size-4 text-[var(--blue-700)]" />
            </div>
            <h2 id="wrap-dialog-title" className="text-base font-semibold text-foreground">
              {isEdit ? "编辑智能体" : "添加智能体"}
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 智能体名称 */}
          <div className="space-y-1.5">
            <Label htmlFor="wrap-name">智能体名称</Label>
            <Input
              id="wrap-name"
              placeholder="如：浦东消防AI小助手"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              style={{ fontSize: "16px" }}
            />
          </div>

          {/* 备注 */}
          <div className="space-y-1.5">
            <Label htmlFor="wrap-note">备注</Label>
            <Input
              id="wrap-note"
              placeholder="一句话介绍（1-500 字）"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              style={{ fontSize: "16px" }}
            />
            <p className="text-[11px] text-muted-foreground">仅后台可见，不会写入公开页面。</p>
          </div>

          {/* 原始网址 */}
          <div className="space-y-1.5">
            <Label htmlFor="wrap-url">原始网址</Label>
            <Input
              id="wrap-url"
              type="url"
              placeholder="https://appcenter.bigmodel.cn/..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              style={{ fontSize: "16px" }}
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <ExternalLink className="size-3" />
              当前仅支持智谱 AppCenter 的智能体分享链接。
            </p>
          </div>

          {/* 底部说明 */}
          <div className="space-y-1.5">
            <Label htmlFor="wrap-footer">底部说明</Label>
            <Textarea
              id="wrap-footer"
              rows={2}
              placeholder="如：以上内容由AI生成仅供参考，请认真阅读并核实"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              maxLength={WRAPPER_FOOTER_MAX_LENGTH}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              显示在包装页底部，最多 80 字、两行。
            </p>
          </div>

          {/* 域名访问后缀 */}
          <div className="space-y-1.5">
            <Label htmlFor="wrap-code">域名访问后缀</Label>
            {isEdit ? (
              <>
                <Input id="wrap-code" value={shortCode} readOnly disabled className="bg-muted text-muted-foreground" style={{ fontSize: "16px" }} />
                <p className="text-[11px] text-muted-foreground">保存后不再修改，避免已分享链接失效。</p>
              </>
            ) : (
              <>
                <Input
                  id="wrap-code"
                  placeholder="如：8c2f3537"
                  value={shortCode}
                  maxLength={32}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                    setShortCode(v);
                    checkShortCode(v);
                  }}
                  style={{ fontSize: "16px" }}
                  className={shortCodeExists ? "ring-2 ring-[var(--semantic-danger)]" : ""}
                  autoComplete="off"
                />
                {shortCodeValid && shortCodeChecking && (
                  <p className="text-[11px] text-muted-foreground">正在检查是否可用…</p>
                )}
                {shortCodeValid && !shortCodeChecking && shortCodeExists && (
                  <p className="text-[11px] text-[var(--semantic-danger)]">该访问后缀已被占用</p>
                )}
                {shortCodeValid && !shortCodeChecking && !shortCodeExists && (
                  <p className="text-[11px] text-[var(--semantic-positive)]">该访问后缀可用</p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  3-32 位小写字母、数字或短横线，首尾不能是短横线。
                </p>
              </>
            )}
            <p className="break-all rounded-md bg-muted px-2.5 py-2 text-[11px] text-muted-foreground">
              公开链接：{browserOrigin}{shortCode
                ? wrapperPublicPath(shortCode)
                : "/?no=访问后缀"}
            </p>
          </div>

          {/* 状态（仅编辑） */}
          {isEdit && (
            <div className="space-y-1.5">
              <Label>状态</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("active")}
                  className={`flex-1 px-3 py-2 rounded-md text-sm border transition-all ${
                    status === "active"
                      ? "ring-2 ring-[var(--semantic-positive)] bg-[oklch(0.96_0.04_155)] dark:bg-[oklch(0.3_0.08_155)] text-[var(--semantic-positive)] border-transparent"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  启用
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("disabled")}
                  className={`flex-1 px-3 py-2 rounded-md text-sm border transition-all ${
                    status === "disabled"
                      ? "ring-2 ring-[var(--semantic-warning)] bg-[oklch(0.97_0.06_70)] dark:bg-[oklch(0.3_0.08_65)] text-[var(--semantic-warning)] border-transparent"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  停用
                </button>
              </div>
              {status === "disabled" && (
                <p className="text-[11px] text-[var(--semantic-warning)]">
                  停用后公开链接会显示停用提示页。
                </p>
              )}
            </div>
          )}

          {error && (
            <p role="alert" aria-live="polite" className="text-sm text-[var(--semantic-danger)] bg-[oklch(0.97_0.04_25)] dark:bg-[oklch(0.3_0.08_25)] rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={submitting}>
              取消
            </Button>
            <Button
              type="submit"
              className="flex-1 btn-primary-glow text-white"
              disabled={submitting || (!isEdit && shortCodeExists)}
            >
              {submitting ? "保存中…" : "保存"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
