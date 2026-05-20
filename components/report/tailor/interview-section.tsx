"use client";

import type { TailorInterviewQuestion } from "@/lib/types-tailor";

interface Props {
  interview: TailorInterviewQuestion[];
  index: number;
  total: number;
}

export function InterviewSection({ interview, index, total }: Props) {
  return (
    <section className="rounded-2xl border border-[var(--report-border)] bg-white dark:bg-[var(--card)] overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--report-divider)]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-[0.15em] text-[var(--orange-600)] uppercase">
            {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
          <h2 className="text-[15px] font-semibold text-[var(--report-ink)]">岗位高频面试题</h2>
        </div>
        <span className="text-xs text-[var(--report-ink-muted)]">{interview.length} 题</span>
      </div>

      {/* body */}
      <div className="divide-y divide-[var(--report-divider)]">
        {interview.map((q, i) => (
          <div key={i} className="px-5 py-4 space-y-3">
            <p className="text-[14px] font-semibold text-[var(--report-ink)] leading-snug">
              Q{i + 1}. {q.question}
            </p>
            <p className="text-[12.5px] text-[var(--report-ink-muted)] leading-relaxed">
              <span className="font-medium text-[var(--report-ink-soft)]">考察意图：</span>{q.why}
            </p>
            {q.sampleAnswer && (
              <div className="rounded-lg bg-[var(--blue-50)] dark:bg-[var(--blue-100)] border border-[var(--blue-100)] dark:border-[var(--blue-200)] px-3 py-2.5">
                <p className="text-[11px] font-semibold text-[var(--blue-700)] uppercase tracking-wide mb-1">参考答案</p>
                <p className="text-[13px] text-[var(--report-ink-soft)] leading-relaxed">{q.sampleAnswer}</p>
              </div>
            )}
            {q.keypoints && q.keypoints.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {q.keypoints.map((kp, ki) => (
                  <span
                    key={ki}
                    className="px-2 py-0.5 rounded-full bg-[var(--orange-50)] text-[var(--orange-700)] text-[11px] font-medium border border-[var(--orange-100)]"
                  >
                    {kp}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
