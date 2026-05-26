"use client";

import { ArrowUp, ArrowDown, Minus, Users, TrendingUp } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import {
  formatNumber,
  generateMarketSummary,
  getComparisonStyle,
} from "@/lib/salary-format";
import type { SalaryReportData } from "@/lib/types-salary";

interface Props {
  data: SalaryReportData;
  index: number;
  total: number;
}

const VBW = 420;
const VBH = 200;
const PAD = { l: 26, r: 30, t: 32, b: 30 };
const PW = VBW - PAD.l - PAD.r;
const PH = VBH - PAD.t - PAD.b;

export function MarketSection({ data, index, total }: Props) {
  const { diffPct } = data.marketComparison;
  const style = getComparisonStyle(diffPct);
  const summary = generateMarketSummary(data.position, data.company, diffPct, data.monthly.p50);

  const DiffIcon = diffPct > 5 ? ArrowUp : diffPct < -5 ? ArrowDown : Minus;

  // 近 5 年薪酬趋势（SVG 折线）
  const trend = Array.isArray(data.salaryTrend) && data.salaryTrend.length >= 2 ? data.salaryTrend : [];
  let trendPoints: Array<{ year: number; monthly: number; x: number; y: number }> = [];
  let linePath = "";
  let areaPath = "";
  let growthPct = 0;
  if (trend.length >= 2) {
    const vals = trend.map((d) => d.monthly);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);
    const range = Math.max(maxV - minV, 1);
    trendPoints = trend.map((d, i) => {
      const x = PAD.l + (PW * i) / (trend.length - 1);
      const ratio = (d.monthly - minV) / range;
      const y = PAD.t + PH * 0.92 - ratio * PH * 0.78;
      return { ...d, x, y };
    });
    linePath = trendPoints.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(" ");
    const baseY = PAD.t + PH;
    areaPath = `${linePath} L${trendPoints[trendPoints.length - 1].x},${baseY} L${trendPoints[0].x},${baseY} Z`;
    growthPct = Math.round(((trend[trend.length - 1].monthly / trend[0].monthly) - 1) * 100);
  }

  return (
    <SectionWrapper id="market" title="市场定位分析" index={index} total={total}>
      <div className="grid md:grid-cols-12 gap-4">
        <div className="md:col-span-5 rounded-lg border border-[var(--report-border)] bg-[var(--cyan-50)] p-4">
          <div className="text-[11px] text-[var(--report-ink-muted)]">当前月薪 vs 市场均值</div>
          <div className="mt-1 text-[26px] font-bold text-[var(--navy-900)] tabular-nums leading-none">
            ¥{formatNumber(data.monthly.p50)}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <DiffIcon className="size-4" />
            <span className="text-[18px] font-semibold tabular-nums">
              {diffPct > 0 ? "+" : ""}
              {diffPct}%
            </span>
            <span className="status-pill ml-2" data-tone={style.tone}>
              {style.text}
            </span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--report-ink-soft)]">
            {summary}
          </p>
        </div>

        <div className="md:col-span-7">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11.5px] font-medium text-[var(--report-ink-muted)]">
              该岗位近 5 年薪酬水平
            </div>
            {trendPoints.length >= 2 && (
              <div className="flex items-center gap-1">
                <TrendingUp
                  className={`size-3.5 ${growthPct >= 0 ? "text-[var(--semantic-success)]" : "text-[var(--semantic-danger)]"}`}
                />
                <span
                  className={`text-[11px] font-semibold tabular-nums ${growthPct >= 0 ? "text-[var(--semantic-success)]" : "text-[var(--semantic-danger)]"}`}
                >
                  5 年累计 {growthPct >= 0 ? "+" : ""}
                  {growthPct}%
                </span>
              </div>
            )}
          </div>

          {trendPoints.length >= 2 ? (
            <div className="rounded-lg border border-[var(--report-border)] bg-white p-1.5">
              <svg viewBox={`0 0 ${VBW} ${VBH}`} className="w-full h-auto block">
                <defs>
                  <linearGradient id="salaryTrendArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyan-600)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--cyan-600)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {[0.25, 0.5, 0.75].map((r) => (
                  <line
                    key={r}
                    x1={PAD.l}
                    x2={VBW - PAD.r}
                    y1={PAD.t + PH * r}
                    y2={PAD.t + PH * r}
                    stroke="rgba(0,0,0,0.06)"
                    strokeDasharray="3 4"
                  />
                ))}

                <path d={areaPath} fill="url(#salaryTrendArea)" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="var(--cyan-600)"
                  strokeWidth="2.2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {trendPoints.map((p, i) => {
                  const isLast = i === trendPoints.length - 1;
                  return (
                    <g key={p.year}>
                      {isLast && <circle cx={p.x} cy={p.y} r={8} fill="var(--cyan-200)" opacity={0.5} />}
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isLast ? 4.5 : 2.6}
                        fill="var(--cyan-700)"
                        stroke={isLast ? "var(--cyan-500)" : "none"}
                        strokeWidth={isLast ? 2 : 0}
                      />
                      <text
                        x={p.x}
                        y={p.y - 11}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight={isLast ? 700 : 500}
                        fill={isLast ? "var(--cyan-800)" : "var(--report-ink-soft)"}
                        fontFamily="ui-monospace, monospace"
                      >
                        ¥{(p.monthly / 1000).toFixed(1)}k
                      </text>
                      <text
                        x={p.x}
                        y={VBH - 8}
                        textAnchor="middle"
                        fontSize="10.5"
                        fontWeight={isLast ? 700 : 400}
                        fill={isLast ? "var(--navy-900)" : "var(--report-ink-muted)"}
                      >
                        {p.year}
                        {isLast ? "（当前）" : ""}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[var(--report-border)] px-3 py-6 text-center text-[12px] text-[var(--report-ink-muted)]">
              暂无近 5 年趋势数据
            </div>
          )}
        </div>
      </div>

      {data.highEarnerTraits && (
        <div className="mt-4 rounded-lg border border-[var(--report-border)] bg-[oklch(0.985_0.006_240)] p-3">
          <div className="flex items-center gap-1.5 mb-1 text-[var(--cyan-700)]">
            <Users className="size-4" />
            <span className="text-[11.5px] font-semibold">较高薪资人群特点</span>
          </div>
          <p className="text-[12.5px] leading-relaxed text-[var(--report-ink-soft)]">
            {data.highEarnerTraits}
          </p>
        </div>
      )}
    </SectionWrapper>
  );
}
