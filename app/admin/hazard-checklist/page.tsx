"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Save, Loader2, Check } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { withBase } from "@/lib/url";

interface ScenarioPrompt {
  name: string;
  context: string;
  focus: string[];
}

interface PromptsFile {
  labels: Record<string, string>;
  prompts: Record<string, ScenarioPrompt>;
}

export default function HazardChecklistPage() {
  const [data, setData] = useState<PromptsFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    fetch(withBase("/api/admin/hazard-prompts"))
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "加载失败");
        return r.json();
      })
      .then((d: PromptsFile) => {
        setData(d);
        const ids = Object.keys(d.prompts);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (ids.length) setSelectedId(ids[0]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        正在加载场景检查项…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-sm p-4">
          {error}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const scenarioIds = Object.keys(data.prompts);
  const totalFocus = scenarioIds.reduce(
    (sum, id) => sum + data.prompts[id].focus.length,
    0,
  );

  function handleScenarioSaved(id: string, updated: ScenarioPrompt) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            labels: { ...prev.labels, [id]: updated.name },
            prompts: { ...prev.prompts, [id]: updated },
          }
        : prev,
    );
  }

  const current = selectedId ? data.prompts[selectedId] : null;

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <PageHeader
          icon={AlertTriangle}
          title="隐患检查项"
          accentColor="amber"
          subtitle={
            <>
              <span className="font-medium text-foreground">
                {scenarioIds.length}
              </span>{" "}
              个场景 ·{" "}
              <span className="font-medium text-foreground">{totalFocus}</span>{" "}
              条焦点检查项 · 这些内容会作为 AI 识图的提示词，保存后下一次用户上传图片即生效
            </>
          }
        />

        {/* 场景选择（下拉，替代原横向「场景目录」标签排） */}
        <div className="surface-panel p-4 flex flex-wrap items-center gap-3">
          <label
            htmlFor="scenario-select"
            className="text-sm font-medium text-foreground shrink-0"
          >
            选择场景
          </label>
          <select
            id="scenario-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-9 min-w-[220px] text-sm border border-input rounded-md px-3 bg-card text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber-400)]/30 cursor-pointer"
          >
            {scenarioIds.map((id) => (
              <option key={id} value={id}>
                {data.prompts[id].name}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">
            共 {scenarioIds.length} 个场景
          </span>
        </div>

        {/* 选中场景的编辑卡片（一次只显示一个） */}
        {current && (
          <ScenarioCard
            key={selectedId}
            scenarioId={selectedId}
            initial={current}
            onSaved={handleScenarioSaved}
          />
        )}
      </div>
    </div>
  );
}

interface ScenarioCardProps {
  scenarioId: string;
  initial: ScenarioPrompt;
  onSaved: (id: string, updated: ScenarioPrompt) => void;
}

function ScenarioCard({ scenarioId, initial, onSaved }: ScenarioCardProps) {
  // focus 数组 ↔ 大文本框：加载时 join 成多行文本；保存时 split 回数组（底层结构不变）
  const initialFocusText = initial.focus.join("\n");

  // savedState：上次成功保存（或加载）的快照，用于 dirty 判定
  const [savedState, setSavedState] = useState({
    name: initial.name,
    context: initial.context,
    focusText: initialFocusText,
  });
  const [name, setName] = useState(initial.name);
  const [context, setContext] = useState(initial.context);
  const [focusText, setFocusText] = useState(initialFocusText);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== savedState.name ||
    context !== savedState.context ||
    focusText !== savedState.focusText;

  // 非空行数 = 实际会保存的 focus 条数
  const focusCount = focusText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean).length;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const focusArr = focusText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const res = await fetch(
        withBase(`/api/admin/hazard-prompts/${scenarioId}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, context, focus: focusArr }),
        },
      );
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || `保存失败 (HTTP ${res.status})`);
      }
      // 规范化回填：保存后用拆分结果（去空行/去首尾空格）覆盖文本，保持显示与库一致
      const normalizedText = focusArr.join("\n");
      setFocusText(normalizedText);
      setSavedState({ name, context, focusText: normalizedText });
      setSavedAt(Date.now());
      onSaved(scenarioId, { name, context, focus: focusArr });
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface-panel p-5 sm:p-6">
      <header className="flex items-start justify-between gap-3 mb-4 pb-4 border-b border-border">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground mb-1">
            scenario id: {scenarioId}
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-[17px] font-semibold h-9 px-2 -ml-2 border-dashed"
            aria-label="场景名称"
          />
        </div>
        <div className="shrink-0 flex items-center gap-2 pt-5">
          {dirty && !saving && (
            <span className="text-[11px] text-[var(--amber-700)] bg-[var(--amber-50)] px-2 py-0.5 rounded-md ring-1 ring-[var(--amber-200)]/60">
              未保存
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="bg-[var(--amber-600)] hover:bg-[var(--amber-700)] text-white disabled:bg-muted disabled:text-muted-foreground"
            size="sm"
          >
            {saving ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                保存中…
              </>
            ) : !dirty && savedAt ? (
              <>
                <Check className="size-4" />
                已保存
              </>
            ) : (
              <>
                <Save className="size-4" />
                保存
              </>
            )}
          </Button>
        </div>
      </header>

      {/* 场景背景（不变） */}
      <div className="mb-5">
        <label className="block text-[12px] font-medium text-muted-foreground mb-1.5">
          场景背景（context）
        </label>
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={3}
          className="text-sm"
        />
      </div>

      {/* 焦点检查项：合并为一个大文本框，每行一条 */}
      <div>
        <label
          htmlFor={`focus-${scenarioId}`}
          className="block text-[12px] font-medium text-muted-foreground mb-2"
        >
          焦点检查项（focus）· 每行一条 ·{" "}
          <span className="tabular-nums">{focusCount}</span> 条
        </label>
        <Textarea
          id={`focus-${scenarioId}`}
          value={focusText}
          onChange={(e) => setFocusText(e.target.value)}
          rows={18}
          className="text-[13px] leading-relaxed font-mono"
          placeholder={"每行一条检查项，例如：\n消防安全：灭火器是否缺失或压力不足…\n电气安全：电线是否裸露…"}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          每行一条；保存时自动忽略空行、去掉每行首尾空格。
        </p>
      </div>

      {error && (
        <div className="mt-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </section>
  );
}
