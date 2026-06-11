"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Save, FileText, ShieldCheck, Check } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { Button } from "@/components/ui/button";
import { RichContentEditor } from "@/components/admin/rich-content-editor";
import { withBase } from "@/lib/url";

type DocKey = "legal_terms" | "legal_privacy";
interface DocState {
  content: string;
  updatedAt: number;
}

const fmtDateTime = (ms: number) => {
  if (!ms) return "尚未保存";
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const META: { key: DocKey; title: string; icon: typeof FileText; desc: string }[] = [
  { key: "legal_terms", title: "服务使用协议", icon: FileText, desc: "登录页勾选项中「服务使用协议」链接打开的内容" },
  { key: "legal_privacy", title: "隐私政策", icon: ShieldCheck, desc: "登录页勾选项中「隐私政策」链接打开的内容" },
];

export default function SiteSettingsPage() {
  const [docs, setDocs] = useState<Record<DocKey, DocState>>({
    legal_terms: { content: "", updatedAt: 0 },
    legal_privacy: { content: "", updatedAt: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<DocKey | null>(null);
  const [savedKey, setSavedKey] = useState<DocKey | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/admin/site-settings"), { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      setDocs({ legal_terms: data.terms, legal_privacy: data.privacy });
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setContent = (key: DocKey, content: string) =>
    setDocs((prev) => ({ ...prev, [key]: { ...prev[key], content } }));

  const save = async (key: DocKey) => {
    setSavingKey(key);
    setError(null);
    setSavedKey(null);
    try {
      const res = await fetch(withBase("/api/admin/site-settings"), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, content: docs[key].content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "保存失败");
      setDocs((prev) => ({ ...prev, [key]: { ...prev[key], updatedAt: data.updatedAt } }));
      setSavedKey(key);
      window.setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="relative p-6">
      <div aria-hidden className="list-header-aurora" />
      <div className="relative max-w-4xl mx-auto space-y-5">
        <PageHeader
          icon={Settings}
          title="系统设置"
          subtitle="编辑「服务使用协议」与「隐私政策」，保存后即在薪酬域登录页生效"
          accentColor="indigo"
        />

        <Alert tone="info" title="这两段内容会联动薪酬登录页">
          用户在登录页勾选「我已阅读并同意…」时，点其中的「服务使用协议 / 隐私政策」就会打开这里编辑的内容。支持直接打字与粘贴图片。
        </Alert>

        {error && <Alert tone="error">{error}</Alert>}

        {loading ? (
          <div className="py-16 text-center text-muted-foreground">加载中…</div>
        ) : (
          META.map((m) => (
            <DocEditorCard
              key={m.key}
              meta={m}
              content={docs[m.key].content}
              updatedAt={docs[m.key].updatedAt}
              saving={savingKey === m.key}
              saved={savedKey === m.key}
              disabled={savingKey !== null}
              onChange={(html) => setContent(m.key, html)}
              onSave={() => save(m.key)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DocEditorCard({
  meta,
  content,
  updatedAt,
  saving,
  saved,
  disabled,
  onChange,
  onSave,
}: {
  meta: { key: string; title: string; icon: typeof FileText; desc: string };
  content: string;
  updatedAt: number;
  saving: boolean;
  saved: boolean;
  disabled: boolean;
  onChange: (html: string) => void;
  onSave: () => void;
}) {
  const Icon = meta.icon;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 size-9 rounded-xl bg-[var(--blue-50)] text-[var(--blue-700)] ring-1 ring-[var(--blue-200)]/60 flex items-center justify-center">
            <Icon className="size-4.5" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--navy-900)]">{meta.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.desc}</p>
          </div>
        </div>
        <div className="shrink-0 pt-1 text-[11px] text-muted-foreground tabular-nums">
          更新于 {fmtDateTime(updatedAt)}
        </div>
      </div>

      <RichContentEditor
        value={content}
        onChange={onChange}
        disabled={saving}
        placeholder={`在此输入${meta.title}正文…`}
      />

      <div className="mt-3 flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--semantic-positive)]">
            <Check className="size-3.5" /> 已保存
          </span>
        )}
        <Button onClick={onSave} disabled={disabled} size="sm">
          <Save className="size-3.5" /> {saving ? "保存中…" : "保存"}
        </Button>
      </div>
    </section>
  );
}
