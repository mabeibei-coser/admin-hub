"use client";

import { Wallet, TrendingUp, Clock, Coins } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { formatSalary, isSeniorRank } from "@/lib/salary-format";
import type { SalaryReportData } from "@/lib/types-salary";

interface Props {
  data: SalaryReportData;
  index: number;
  total: number;
}

export function OverviewSection({ data, index, total }: Props) {
  const senior = isSeniorRank(data.rank);
  const hasEquity = senior && data.equity.p50 > 0;

  const cards: Array<{
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    value: string;
    subtitle: string;
  }> = [
    {
      icon: Wallet,
      title: "月薪中位值",
      value: `¥ ${formatSalary(data.monthly.p50)}`,
      subtitle: `范围 ${formatSalary(data.monthly.p25)} – ${formatSalary(data.monthly.p75)}`,
    },
    {
      icon: TrendingUp,
      title: "年薪总包",
      value: `¥ ${formatSalary(data.annual.p50)}`,
      subtitle: `范围 ${formatSalary(data.annual.p25)} – ${formatSalary(data.annual.p75)}`,
    },
    {
      icon: Clock,
      title: "时薪估算",
      value: `¥ ${data.hourlyRate.p50.toFixed(0)} / 小时`,
      subtitle: `范围 ${data.hourlyRate.p25.toFixed(0)} – ${data.hourlyRate.p75.toFixed(0)} 元/小时`,
    },
    {
      icon: Coins,
      title: "年股权 / 期权价值",
      value: hasEquity ? `¥ ${formatSalary(data.equity.p50)}` : "不适用",
      subtitle: hasEquity
        ? `${formatSalary(data.equity.p25)} – ${formatSalary(data.equity.p75)}`
        : senior
          ? "该企业性质通常不提供股权"
          : "该职级通常不享有股权激励",
    },
  ];

  return (
    <SectionWrapper id="overview" title="薪酬总览" index={index} total={total}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c, i) => (
          <div
            key={i}
            className="relative overflow-hidden rounded-lg border border-[var(--report-border)] bg-white p-3.5"
          >
            <span className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--cyan-500)]" />
            <div className="flex items-center gap-1.5 mb-2 text-[var(--report-ink-muted)]">
              <c.icon className="size-4" />
              <span className="text-[11.5px] font-medium">{c.title}</span>
            </div>
            <div className="text-[18px] font-bold text-[var(--navy-900)] tabular-nums leading-tight">
              {c.value}
            </div>
            <div className="text-[11px] text-[var(--report-ink-muted)] mt-1.5">{c.subtitle}</div>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
