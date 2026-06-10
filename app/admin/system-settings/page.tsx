"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Settings, Save, RefreshCw, ScrollText, ShieldCheck, ImagePlus, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/url";

type SettingKey = "service_agreement" | "privacy_policy";

interface Setting {
  key: SettingKey;
  title: string;
  content: string;
  updatedAt: number;
}

interface ListResponse {
  rows: Setting[];
}

interface MeResponse {
  isSuper?: boolean;
}

const KEY_META: Record<
  SettingKey,
  { label: string; icon: typeof ScrollText; hint: string }
> = {
  service_agreement: {
    label: "服务使用协议",
    icon: ScrollText,
    hint: "全局通用的服务使用协议正文，支持 Markdown 与图片。所有业务都会读这一份。",
  },
  privacy_policy: {
    label: "隐私政策",
    icon: ShieldCheck,
    hint: "全局通用的隐私政策正文，告知用户平台如何收集、使用、存储个人信息。",
  },
};

function formatTs(ms: number) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SystemSettingsPage() {
  const [rows, setRows] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuper, setIsSuper] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/admin/system-settings"));
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `加载失败 (${res.status})`);
      }
      const data = (await res.json()) as ListResponse;
      setRows(data.rows ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch(withBase("/api/admin/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MeResponse | null) => setIsSuper(!!d?.isSuper))
      .catch(() => setIsSuper(false));
  }, [load]);

  const getRow = (key: SettingKey): Setting => {
    return (
      rows.find((r) => r.key === key) ?? {
        key,
        title: KEY_META[key].label,
        content: "",
        updatedAt: 0,
      }
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Settings}
        title="系统设置"
        subtitle="全局通用的服务使用协议与隐私政策。支持 Markdown 文字与粘贴/上传图片，仅超管可编辑。"
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        }
      />

      {isSuper === false && (
        <Alert tone="info" title="只读模式">
          你的账号不是超管，可以查看协议内容，但不能编辑保存。
        </Alert>
      )}
      {error && (
        <Alert tone="error" title="加载失败">
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {(["service_agreement", "privacy_policy"] as SettingKey[]).map((key) => (
          <SettingEditor
            key={key}
            initial={getRow(key)}
            canEdit={!!isSuper}
            onSaved={(updated) => {
              setRows((prev) => {
                const others = prev.filter((r) => r.key !== updated.key);
                return [...others, updated].sort((a, b) =>
                  a.key.localeCompare(b.key),
                );
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function SettingEditor({
  initial,
  canEdit,
  onSaved,
}: {
  initial: Setting;
  canEdit: boolean;
  onSaved: (updated: Setting) => void;
}) {
  const meta = KEY_META[initial.key];
  const Icon = meta.icon;
  const [title, setTitle] = useState(initial.title || meta.label);
  const [content, setContent] = useState(initial.content);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitle(initial.title || meta.label);
    setContent(initial.content);
  }, [initial.title, initial.content, meta.label]);

  const dirty =
    title.trim() !== (initial.title || "").trim() ||
    content !== initial.content;

  const insertAtCursor = (snippet: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setContent((c) => (c ? `${c}\n${snippet}` : snippet));
      return;
    }
    const start = ta.selectionStart ?? content.length;
    const end = ta.selectionEnd ?? content.length;
    const next = content.slice(0, start) + snippet + content.slice(end);
    setContent(next);
    // 光标移到插入文本之后
    requestAnimationFrame(() => {
      ta.focus();
      const cursor = start + snippet.length;
      ta.setSelectionRange(cursor, cursor);
    });
  };

  const uploadImage = useCallback(
    async (file: File) => {
      if (!canEdit) {
        setErrMsg("只有超管可以上传图片");
        return;
      }
      setUploading(true);
      setErrMsg(null);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch(
          withBase("/api/admin/system-settings/upload"),
          {
            method: "POST",
            body: fd,
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          url?: string;
        };
        if (!res.ok || !data.url) {
          throw new Error(data.error || `上传失败 (${res.status})`);
        }
        const alt = file.name.replace(/\.[^.]+$/, "") || "image";
        insertAtCursor(`\n![${alt}](${data.url})\n`);
      } catch (err) {
        setErrMsg((err as Error).message);
      } finally {
        setUploading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, content],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgItem = items.find((it) => it.type.startsWith("image/"));
      if (!imgItem) return;
      const file = imgItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      uploadImage(file);
    },
    [uploadImage],
  );

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    e.target.value = ""; // 允许重复选同一张
  };

  const handleSave = async () => {
    setSaving(true);
    setOkMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch(withBase("/api/admin/system-settings"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: initial.key, title: title.trim(), content }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        key?: SettingKey;
        title?: string;
        updatedAt?: number;
      };
      if (!res.ok) throw new Error(data.error || `保存失败 (${res.status})`);
      const updated: Setting = {
        key: initial.key,
        title: data.title ?? title.trim(),
        content,
        updatedAt: data.updatedAt ?? Date.now(),
      };
      onSaved(updated);
      setOkMsg("已保存");
    } catch (err) {
      setErrMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const disabled = !canEdit || saving;

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-9 shrink-0 rounded-xl bg-[var(--blue-50)] text-[var(--blue-700)] flex items-center justify-center ring-1 ring-[var(--blue-200)]/60">
            <Icon className="size-4" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[var(--navy-900)] tracking-tight">
              {meta.label}
            </div>
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">
              {meta.hint}
            </p>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground tabular-nums shrink-0 mt-1">
          {initial.updatedAt ? `更新于 ${formatTs(initial.updatedAt)}` : "未发布"}
        </div>
      </header>

      <label className="block mb-3">
        <span className="text-[12px] text-muted-foreground mb-1 block">页面标题</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={disabled}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] disabled:opacity-60"
          placeholder={meta.label}
          maxLength={80}
        />
      </label>

      <label className="block mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] text-muted-foreground">
            正文（支持 Markdown 文字 + 粘贴/插入图片）
          </span>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleFilePick}
              disabled={disabled || uploading}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || uploading}
              className="inline-flex items-center gap-1 text-[11.5px] text-[var(--blue-700)] hover:text-[var(--blue-800)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  上传中…
                </>
              ) : (
                <>
                  <ImagePlus className="size-3.5" />
                  插入图片
                </>
              )}
            </button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handlePaste}
          disabled={disabled}
          rows={20}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] font-mono leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] disabled:opacity-60"
          placeholder={`# ${meta.label}\n\n直接在此输入文字。需要插入图片：点击右上角「插入图片」，或直接 Ctrl+V 粘贴剪贴板里的图片。\n\n图片会自动以 ![](url) 形式插入到光标位置。`}
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            提示：图片会自动上传，并以 Markdown 语法插入到光标位置
          </span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {content.length.toLocaleString()} 字符
          </span>
        </div>
      </label>

      {okMsg && (
        <Alert tone="success" className="mb-3">
          {okMsg}
        </Alert>
      )}
      {errMsg && (
        <Alert tone="error" className="mb-3">
          {errMsg}
        </Alert>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="default"
          onClick={handleSave}
          disabled={disabled || !dirty || !title.trim()}
        >
          <Save className="size-3.5" />
          {saving ? "保存中…" : dirty ? "保存" : "已保存"}
        </Button>
      </div>
    </section>
  );
}
