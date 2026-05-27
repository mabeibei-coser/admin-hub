"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Save,
  Plus,
  Trash2,
  Loader2,
  Check,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
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

  useEffect(() => {
    fetch(withBase("/api/admin/hazard-prompts"))
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "加载失败");
        return r.json();
      })
      .then((d: PromptsFile) => setData(d))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        正在加载 36 个场景的检查项…
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

      <nav className="sticky top-0 z-10 -mx-4 px-4 sm:-mx-6 sm:px-6 bg-card/95 backdrop-blur border-y border-border py-2.5">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-1.5">
          场景目录
        </div>
        <div className="flex flex-wrap gap-1">
          {scenarioIds.map((id) => (
            <a
              key={id}
              href={`#scenario-${id}`}
              className="px-2 py-0.5 text-[11.5px] rounded-md bg-muted text-muted-foreground hover:bg-[var(--amber-50)] hover:text-[var(--amber-700)] transition-colors"
            >
              {data.prompts[id].name}
            </a>
          ))}
        </div>
      </nav>

      <div className="space-y-4">
        {scenarioIds.map((id) => (
          <ScenarioCard
            key={id}
            scenarioId={id}
            initial={data.prompts[id]}
          />
        ))}
      </div>
    </div>
    </div>
  );
}

interface ScenarioCardProps {
  scenarioId: string;
  initial: ScenarioPrompt;
}

function ScenarioCard({ scenarioId, initial }: ScenarioCardProps) {
  // savedState：上次成功保存（或加载）的快照，用于 dirty 判定
  const [savedState, setSavedState] = useState<ScenarioPrompt>({
    name: initial.name,
    context: initial.context,
    focus: [...initial.focus],
  });
  const [name, setName] = useState(initial.name);
  const [context, setContext] = useState(initial.context);
  const [focus, setFocus] = useState<string[]>([...initial.focus]);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== savedState.name ||
    context !== savedState.context ||
    focus.length !== savedState.focus.length ||
    focus.some((f, i) => f !== savedState.focus[i]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        withBase(`/api/admin/hazard-prompts/${scenarioId}`),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, context, focus }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || `保存失败 (HTTP ${res.status})`);
      }
      setSavedState({ name, context, focus: [...focus] });
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function updateFocus(i: number, value: string) {
    setFocus(focus.map((x, j) => (j === i ? value : x)));
  }
  function removeFocus(i: number) {
    setFocus(focus.filter((_, j) => j !== i));
  }
  function addFocus() {
    setFocus([...focus, ""]);
  }
  function moveFocus(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= focus.length) return;
    const next = [...focus];
    [next[i], next[j]] = [next[j], next[i]];
    setFocus(next);
  }

  return (
    <section
      id={`scenario-${scenarioId}`}
      className="surface-panel p-5 sm:p-6 scroll-mt-32"
    >
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

      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[12px] font-medium text-muted-foreground">
            焦点检查项（focus）·{" "}
            <span className="tabular-nums">{focus.length}</span> 条
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={addFocus}
            className="h-7 px-2 text-xs gap-1"
          >
            <Plus className="size-3.5" />
            添加
          </Button>
        </div>
        <div className="space-y-1.5">
          {focus.map((f, i) => (
            <div key={i} className="flex gap-1.5 group">
              <div className="text-[11px] tabular-nums text-muted-foreground pt-2.5 w-7 text-right shrink-0">
                {i + 1}.
              </div>
              <Textarea
                value={f}
                onChange={(e) => updateFocus(i, e.target.value)}
                rows={2}
                className="text-[13px] flex-1 min-h-[42px]"
              />
              <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  type="button"
                  onClick={() => moveFocus(i, -1)}
                  disabled={i === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                  aria-label="上移"
                >
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveFocus(i, 1)}
                  disabled={i === focus.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed p-0.5"
                  aria-label="下移"
                >
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => removeFocus(i)}
                className="text-muted-foreground hover:text-rose-600 px-1.5 self-start pt-2 shrink-0"
                aria-label="删除"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </section>
  );
}
