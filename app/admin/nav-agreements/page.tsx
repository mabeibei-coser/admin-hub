"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Save, RefreshCw, ScrollText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Alert } from "@/components/admin/alert";
import { Button } from "@/components/ui/button";
import { withBase } from "@/lib/url";

type AgreementType = "terms" | "privacy";

interface Agreement {
  type: AgreementType;
  title: string;
  content: string;
  updatedAt: number;
}

interface ListResponse {
  rows: Agreement[];
  ready: boolean;
}

const TYPE_META: Record<AgreementType, { label: string; icon: typeof FileText; hint: string }> = {
  terms: {
    label: "服务使用协议",
    icon: ScrollText,
    hint: "用户在职业导航首页勾选「我已阅读并同意」后才能提交;此处编辑的内容会被前台用户在协议页查看到。",
  },
  privacy: {
    label: "隐私政策",
    icon: ShieldCheck,
    hint: "告知用户平台如何收集、使用、存储其个人信息。",
  },
};

function formatTs(ms: number) {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NavAgreementsPage() {
  const [rows, setRows] = useState<Agreement[]>([]);
  const [ready, setReady] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBase("/api/admin/nav-agreements"));
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `加载失败 (${res.status})`);
      }
      const data = (await res.json()) as ListResponse;
      setRows(data.rows ?? []);
      setReady(data.ready);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const getRow = (type: AgreementType): Agreement => {
    return (
      rows.find((r) => r.type === type) ?? {
        type,
        title: TYPE_META[type].label,
        content: "",
        updatedAt: 0,
      }
    );
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={FileText}
        title="职业导航协议管理"
        subtitle="编辑职业导航用户在首页看到的服务使用协议与隐私政策(Markdown 格式,保存即生效)"
        actions={
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            刷新
          </Button>
        }
      />

      {!ready && (
        <Alert tone="warning" title="career-nav 数据库未就绪">
          career-nav 数据库尚未生成或未挂载。请先启动 career-nav 服务初始化数据库后再回来编辑。
        </Alert>
      )}
      {error && <Alert tone="error" title="加载失败">{error}</Alert>}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {(["terms", "privacy"] as AgreementType[]).map((type) => (
          <AgreementEditor
            key={type}
            initial={getRow(type)}
            disabled={!ready}
            onSaved={(updated) => {
              setRows((prev) => {
                const others = prev.filter((r) => r.type !== updated.type);
                return [...others, updated].sort((a, b) => a.type.localeCompare(b.type));
              });
            }}
          />
        ))}
      </div>
    </div>
  );
}

function AgreementEditor({
  initial,
  disabled,
  onSaved,
}: {
  initial: Agreement;
  disabled: boolean;
  onSaved: (updated: Agreement) => void;
}) {
  const meta = TYPE_META[initial.type];
  const Icon = meta.icon;
  const [title, setTitle] = useState(initial.title || meta.label);
  const [content, setContent] = useState(initial.content);
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    setTitle(initial.title || meta.label);
    setContent(initial.content);
  }, [initial.title, initial.content, meta.label]);

  const dirty = title.trim() !== (initial.title || "").trim() || content !== initial.content;

  const handleSave = async () => {
    setSaving(true);
    setOkMsg(null);
    setErrMsg(null);
    try {
      const res = await fetch(withBase("/api/admin/nav-agreements"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: initial.type, title: title.trim(), content }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; type?: AgreementType; title?: string; updatedAt?: number };
      if (!res.ok) throw new Error(data.error || `保存失败 (${res.status})`);
      const updated: Agreement = {
        type: initial.type,
        title: data.title ?? title.trim(),
        content,
        updatedAt: data.updatedAt ?? Date.now(),
      };
      onSaved(updated);
      setOkMsg("已保存,前台立即生效");
    } catch (err) {
      setErrMsg((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

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
            <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{meta.hint}</p>
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
          disabled={disabled || saving}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] disabled:opacity-60"
          placeholder={meta.label}
          maxLength={80}
        />
      </label>

      <label className="block mb-3">
        <span className="text-[12px] text-muted-foreground mb-1 block">
          正文(支持 Markdown:# 标题 / ## 二级 / 段落 / **加粗** / - 列表 / [文字](链接))
        </span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          disabled={disabled || saving}
          rows={18}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-[13px] font-mono leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue-400)] disabled:opacity-60"
          placeholder={`# ${meta.label}\n\n本协议……`}
        />
        <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
          {content.length.toLocaleString()} 字符
        </div>
      </label>

      {okMsg && <Alert tone="success" className="mb-3">{okMsg}</Alert>}
      {errMsg && <Alert tone="error" className="mb-3">{errMsg}</Alert>}

      <div className="flex items-center justify-end gap-2">
        <Button
          variant="default"
          onClick={handleSave}
          disabled={disabled || saving || !dirty || !title.trim()}
        >
          <Save className="size-3.5" />
          {saving ? "保存中…" : dirty ? "保存" : "已保存"}
        </Button>
      </div>
    </section>
  );
}
