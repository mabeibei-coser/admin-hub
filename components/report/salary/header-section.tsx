"use client";

import { Briefcase, GraduationCap, MapPin, Building2, Tag } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import type { SalaryReportData } from "@/lib/types-salary";

interface Props {
  data: SalaryReportData;
  index: number;
  total: number;
}

export function HeaderSection({ data, index, total }: Props) {
  return (
    <SectionWrapper id="header" title="查询参数" index={index} total={total}>
      <div className="flex flex-wrap gap-2 items-center">
        <Chip icon={Briefcase} label={data.position} tone="primary" />
        <Chip icon={Tag} label={data.rankLabel || data.rank} tone={data.rankCategory === "mgmt" ? "navy" : "cyan"} />
        <Chip icon={Building2} label={data.company} tone="cyan" />
        {data.education && <Chip icon={GraduationCap} label={data.education} tone="muted" />}
        {data.city && <Chip icon={MapPin} label={data.city} tone="muted" />}
      </div>
    </SectionWrapper>
  );
}

interface ChipProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: "primary" | "cyan" | "navy" | "muted";
}

const TONE_CLASSES: Record<ChipProps["tone"], string> = {
  primary:
    "bg-[var(--blue-50)] text-[var(--blue-700)] ring-[var(--blue-200)]/60",
  cyan:
    "bg-[var(--cyan-100)] text-[var(--cyan-700)] ring-[var(--cyan-200)]/60",
  navy:
    "bg-[oklch(0.94_0.04_252)] text-[var(--navy-800)] ring-[oklch(0.85_0.04_252)]/60",
  muted:
    "bg-[oklch(0.96_0.005_240)] text-[var(--report-ink-soft)] ring-[var(--border)]",
};

function Chip({ icon: Icon, label, tone }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ring-1 ${TONE_CLASSES[tone]}`}
    >
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
