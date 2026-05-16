"use client";

import { TrendingUp, Wrench, UserCircle2 } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import type { Overview } from "@/lib/types";

export function OverviewSection({
  data,
  index,
  total,
}: {
  data: Overview;
  index: number;
  total: number;
}) {
  return (
    <SectionWrapper
      id="overview"
      title="定位总览"
      index={index}
      total={total}
      takeaway={data.positioning || undefined}
    >
      {data.summary && (
        <p className="text-[14.5px] leading-[1.8] text-[var(--navy-800)] mb-6">
          {data.summary}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {data.strength && (
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 break-inside-avoid">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="size-4 text-emerald-600" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-emerald-700">
                核心优势
              </span>
            </div>
            {data.strength.title && (
              <h3 className="text-base sm:text-lg font-semibold text-[var(--navy-900)] mb-2">
                {data.strength.title}
              </h3>
            )}
            {data.strength.detail && (
              <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
                {data.strength.detail}
              </p>
            )}
          </div>
        )}

        {data.improvement && (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 break-inside-avoid">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="size-4 text-amber-600" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-amber-700">
                待补齐
              </span>
            </div>
            {data.improvement.title && (
              <h3 className="text-base sm:text-lg font-semibold text-[var(--navy-900)] mb-2">
                {data.improvement.title}
              </h3>
            )}
            {data.improvement.detail && (
              <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
                {data.improvement.detail}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 职业性格画像 */}
      {data.personality && (
        <div className="rounded-xl border border-[var(--blue-200)] bg-gradient-to-br from-[var(--blue-50)] to-white p-4 sm:p-5 break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <UserCircle2 className="size-4 text-[var(--blue-600)]" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--blue-700)]">
              职业性格
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {data.personality.type && (
              <span className="inline-flex items-center rounded-full bg-[var(--blue-500)] px-2.5 py-1 text-[13px] font-semibold text-white">
                {data.personality.type}
              </span>
            )}
            {Array.isArray(data.personality.traits) &&
              data.personality.traits.length > 0 &&
              data.personality.traits.map((t) => (
                <span key={t} className="report-chip">
                  {t}
                </span>
              ))}
          </div>
          {data.personality.description && (
            <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
              {data.personality.description}
            </p>
          )}
        </div>
      )}
    </SectionWrapper>
  );
}
