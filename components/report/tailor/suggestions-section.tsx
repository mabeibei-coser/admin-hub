"use client";

import type { TailorSuggestion } from "@/lib/types-tailor";

interface Props {
  suggestions: TailorSuggestion[];
  index: number;
  total: number;
}

export function SuggestionsSection({ suggestions, index, total }: Props) {
  return (
    <section className="rounded-2xl border border-[var(--report-border)] bg-white dark:bg-[var(--card)] overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--report-divider)]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-[0.15em] text-[var(--orange-600)] uppercase">
            {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <h2 className="text-[15px] font-semibold text-[var(--report-ink)]">简历优化建议</h2>
        </div>
        <span className="text-xs text-[var(--report-ink-muted)]">{suggestions.length} 条</span>
      </div>

      {/* body */}
      <div className="divide-y divide-[var(--report-divider)]">
        {suggestions.map((s, i) => (
          <div key={i} className="px-5 py-4 space-y-2">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0 size-5 rounded-full bg-[var(--orange-100)] text-[var(--orange-700)] text-[11px] font-bold flex items-center justify-center">
                {i + 1}
              </span>
              <p className="text-[14px] font-semibold text-[var(--report-ink)]">{s.title}</p>
            </div>
            <div className="ml-7 space-y-1.5">
              <p className="text-[13px] text-[var(--report-ink-soft)] leading-relaxed">
                <span className="font-medium text-[var(--report-ink)]">问题：</span>{s.problem}
              </p>
              <p className="text-[13px] text-[var(--report-ink-soft)] leading-relaxed">
                <span className="font-medium text-[var(--report-ink)]">建议：</span>{s.action}
              </p>
              {s.example && (
                <div className="mt-2 rounded-lg bg-[var(--orange-50)] border border-[var(--orange-100)] px-3 py-2 text-[12.5px] text-[var(--orange-700)] leading-relaxed">
                  示例：{s.example}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
