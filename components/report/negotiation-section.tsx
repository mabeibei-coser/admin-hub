"use client";

import { Brain, Briefcase } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import type { NegotiationTips } from "@/lib/types";

export function NegotiationSection({
  data,
  index,
  total,
}: {
  data: NegotiationTips;
  index: number;
  total: number;
}) {
  const themes = [
    {
      icon: Brain,
      label: "AI 应用经验",
      tag: "筹码 1",
      summary: data.aiExperience?.summary,
    },
    {
      icon: Briefcase,
      label: "AI 相关的企业实习成果",
      tag: "筹码 2",
      summary: data.internshipExperience?.summary,
    },
  ].filter((t) => !!t.summary);

  return (
    <SectionWrapper
      id="negotiation"
      title="谈薪要点"
      index={index}
      total={total}
      takeaway="校招能撬动薪资的只有两件事：真实的 AI 应用能力 + AI 相关的实习成果"
      meta={<span>2 个核心筹码</span>}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {themes.map((t) => {
          const Icon = t.icon;
          return (
            <div
              key={t.label}
              className="rounded-xl border border-[var(--blue-100)] bg-white p-4 sm:p-5 break-inside-avoid"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-[var(--blue-50)] p-1.5 border border-[var(--blue-100)]">
                    <Icon className="size-4 text-[var(--blue-600)]" />
                  </div>
                  <h3 className="text-base font-semibold text-[var(--navy-900)]">
                    {t.label}
                  </h3>
                </div>
                <span className="report-chip">{t.tag}</span>
              </div>
              <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
                {t.summary}
              </p>
            </div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
