"use client";

import { Coins, Factory, Star } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import type { SalaryInsight } from "@/lib/types";

function formatMoney(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString("en-US");
}

// 防御：JSON 可能把薪资返成字符串 "9,820"
function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

// 5 条用同一个渐变，靠宽度拉差距 + 金色角标标 rank 1
const BAR_GRADIENT =
  "linear-gradient(90deg, var(--blue-400), var(--blue-500))";
const TOP_SHADOW = "0 1px 3px oklch(0.45 0.18 250 / 0.22)";

export function SalarySection({
  data,
  positionName,
  targetEducation,
  index,
  total,
}: {
  data: SalaryInsight;
  positionName: string;
  targetEducation: string;
  index: number;
  total: number;
}) {
  // 防御：quartiles 整体可能缺失
  const quartiles = data.quartiles ?? { low: NaN, median: NaN, high: NaN, unit: "" };
  const unit = quartiles.unit || "元/月";

  // 排序：严格按薪资从高到低，数字健壮化
  const ranked = (Array.isArray(data.industryComparison) ? data.industryComparison : [])
    .map((row) => ({
      industry: row.industry,
      avgSalary: toNum(row.avgSalary),
    }))
    .filter((r) => r.avgSalary > 0 && r.industry)
    .sort((a, b) => b.avgSalary - a.avgSalary)
    .slice(0, 5);

  const industryMax = ranked.length
    ? Math.max(...ranked.map((r) => r.avgSalary))
    : 0;
  const industryMin = ranked.length
    ? Math.min(...ranked.map((r) => r.avgSalary))
    : 0;
  const industrySpan = Math.max(industryMax - industryMin, 1);

  const userInd = data.userIndustry
    ? {
        industry: data.userIndustry.industry,
        avgSalary: toNum(data.userIndustry.avgSalary),
        note: data.userIndustry.note,
      }
    : undefined;

  // 意向行业在 top-5 里是第几名（未上榜则为 -1）
  const userRankInTop5 = userInd
    ? ranked.findIndex((r) => r.industry === userInd.industry)
    : -1;

  // 意向行业相对 top-5 中位的偏离百分比（用于"高/低于行业中位"的兜底文案）
  const medianTop5 = ranked.length
    ? ranked[Math.floor(ranked.length / 2)].avgSalary
    : 0;
  const deltaPct =
    userInd && medianTop5 > 0
      ? Math.round(((userInd.avgSalary - medianTop5) / medianTop5) * 100)
      : 0;

  const takeaway = `${positionName}应届校招中位约 ${formatMoney(quartiles.median)} ${unit}（低分位 ${formatMoney(quartiles.low)} / 高分位 ${formatMoney(quartiles.high)}）`;

  return (
    <SectionWrapper
      id="salary"
      title={`${positionName}岗位薪资`}
      index={index}
      total={total}
      takeaway={takeaway}
      meta={<span>【{targetEducation}】应届校招起薪 · {unit}</span>}
    >
      {/* Quartile KPI row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <QuartileTile label="低分位" value={quartiles.low} unit={unit} />
        <QuartileTile
          label="中位"
          value={quartiles.median}
          unit={unit}
          highlight
        />
        <QuartileTile label="高分位" value={quartiles.high} unit={unit} />
      </div>

      {/* 意向行业 · 星标卡 */}
      {userInd && userInd.avgSalary > 0 && (
        <div className="relative rounded-xl border-2 border-amber-300/80 bg-gradient-to-br from-amber-50 to-white p-4 sm:p-5 mb-4 break-inside-avoid shadow-sm">
          <div className="flex items-start gap-3">
            <div className="shrink-0 size-9 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow-md flex items-center justify-center">
              <Star className="size-4 text-white fill-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                  你的意向行业
                </span>
                {userRankInTop5 >= 0 && (
                  <span className="text-[10px] text-amber-700/80">
                    · 在 top 5 中排名第 {userRankInTop5 + 1}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-base sm:text-lg font-bold text-[var(--navy-900)]">
                  {userInd.industry}
                </span>
                <span className="tabular-nums text-lg font-bold text-amber-700">
                  {formatMoney(userInd.avgSalary)}
                  <span className="ml-1 text-xs font-normal text-[var(--report-ink-muted)]">
                    {unit}
                  </span>
                </span>
              </div>
              <p className="mt-1 text-[12.5px] leading-[1.65] text-[var(--navy-700)]">
                {userInd.note ||
                  (deltaPct !== 0
                    ? `较 top-5 中位 ${deltaPct >= 0 ? "高" : "低"} ${Math.abs(deltaPct)}%`
                    : "与行业中位持平")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 行业对比 · 前 5（严格按薪资排序） */}
      {ranked.length > 0 && (
      <div className="rounded-xl border border-[var(--blue-100)] bg-white p-4 sm:p-5 mb-5 break-inside-avoid">
        <div className="flex items-center gap-2 mb-4">
          <Factory className="size-4 text-[var(--blue-600)]" />
          <span className="text-sm font-semibold text-[var(--navy-800)]">
            本岗位 · 行业薪资排名 · 前 5
          </span>
        </div>
        <ul className="divide-y divide-[var(--report-divider)]">
          {ranked.map((row, i) => {
            const widthPct = Math.round(
              ((row.avgSalary - industryMin) / industrySpan) * 85 + 15
            );
            const isTop = i === 0;
            const isUserInd = userInd && row.industry === userInd.industry;
            return (
              <li
                key={`${row.industry}-${i}`}
                className="flex items-center gap-3 py-2.5 text-[13.5px]"
              >
                <span
                  className={
                    isTop
                      ? "tabular-nums w-5 h-5 inline-flex items-center justify-center rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold shrink-0"
                      : "tabular-nums text-[var(--report-ink-muted)] w-5 text-center shrink-0"
                  }
                >
                  {i + 1}
                </span>
                <span
                  className={
                    "font-medium w-20 sm:w-28 shrink-0 flex items-center gap-1 " +
                    (isUserInd
                      ? "text-amber-700"
                      : "text-[var(--navy-800)]")
                  }
                >
                  {row.industry}
                  {isUserInd && (
                    <Star className="size-3 fill-amber-400 text-amber-400 shrink-0" />
                  )}
                </span>
                <div
                  className="flex-1 bg-[var(--blue-100)] rounded-full overflow-hidden"
                  style={{ height: 8 }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${widthPct}%`,
                      background: BAR_GRADIENT,
                      boxShadow: isTop ? TOP_SHADOW : "none",
                    }}
                  />
                </div>
                <span className="tabular-nums font-semibold text-[var(--navy-900)] w-20 text-right shrink-0">
                  {formatMoney(row.avgSalary)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      )}

      {/* 数据来源标注 */}
      <p className="mt-4 text-right text-[11px] font-mono text-[var(--report-ink-muted)]">
        数据来源：谨世核心薪酬 L2 数据库 · 2026 版
      </p>
    </SectionWrapper>
  );
}

function QuartileTile({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: number;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-xl border-2 border-[var(--blue-500)] bg-[var(--blue-500)]/5 p-2.5 sm:p-4 flex flex-col items-start min-w-0"
          : "rounded-xl border border-[var(--blue-100)] bg-white p-2.5 sm:p-4 flex flex-col items-start min-w-0"
      }
    >
      <Coins className="size-3.5 sm:size-4 text-[var(--blue-600)] mb-1.5 sm:mb-2" />
      <span className="text-[10px] sm:text-[11px] text-[var(--report-ink-muted)] tracking-wider uppercase mb-1">
        {label}
      </span>
      <div className="report-kpi">
        <span className="n">
          {Number.isFinite(value) ? value.toLocaleString("en-US") : "--"}
        </span>
        <span className="u">{unit}</span>
      </div>
    </div>
  );
}
