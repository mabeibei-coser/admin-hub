"use client";

import {
  Building2,
  TrendingUp,
  MessageSquareQuote,
  CheckSquare,
  Lightbulb,
} from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { asText } from "@/lib/text-normalize";
import type { WorkplaceInsight } from "@/lib/types";

export function WorkplaceInsightSection({
  data,
  index,
  total,
}: {
  data: WorkplaceInsight;
  index: number;
  total: number;
}) {
  return (
    <SectionWrapper
      id="workplace-insight"
      title="职场环境透视"
      index={index}
      total={total}
      takeaway={`${data.companyInsight?.targetLabel ?? "意向公司"}发展动向 · 网友现场观察 ${Array.isArray(data.companyInsight?.observations) ? data.companyInsight.observations.length : 0} 条 · 行业共性速览`}
      meta={<span>公司 · 现场 · 行业 · 综合</span>}
    >
      <div className="rounded-md border border-[oklch(0.87_0.1_80)]/80 bg-[oklch(0.97_0.05_80)]/60 px-3 py-2 text-[12px] leading-relaxed text-[var(--semantic-warning)] mb-5 break-inside-avoid">
        <strong className="font-semibold">说明：</strong>
        以下观察整理自招聘信息、脉脉、小红书、知乎、校招贴吧等公开反馈，仅供择业参考；观点属于公开网络发声者，不代表本报告立场。
      </div>

      {/* Block 1 · 意向公司 · 发展现状 */}
      {data.companyInsight && (
        <div className="rounded-xl border border-[var(--blue-100)] bg-card p-4 sm:p-5 mb-4 break-inside-avoid">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="size-4 text-[var(--blue-600)]" />
            <span className="text-sm font-semibold text-[var(--navy-900)]">
              1 · {data.companyInsight.targetLabel} · 发展现状
            </span>
          </div>
          <p className="text-[13.5px] leading-[1.8] text-[var(--navy-800)]">
            {asText(data.companyInsight.developmentSummary)}
          </p>
        </div>
      )}

      {/* Block 2 · 意向公司 · 小红书 / 脉脉 现场速记 */}
      {data.companyInsight && (
        <div className="rounded-xl border border-[var(--blue-100)] bg-card p-4 sm:p-5 mb-4 break-inside-avoid">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquareQuote className="size-4 text-[var(--blue-600)]" />
            <span className="text-sm font-semibold text-[var(--navy-900)]">
              2 · {data.companyInsight.targetLabel} · 小红书 / 脉脉 现场速记
            </span>
          </div>
          <p className="text-[12px] leading-[1.7] text-[var(--report-ink-muted)] mb-4">
            {asText(data.companyInsight.summary)}
          </p>

          {Array.isArray(data.companyInsight.observations) && data.companyInsight.observations.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 mb-5">
              {data.companyInsight.observations.map((ob, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--blue-100)] bg-[var(--blue-50)]/30 p-3 break-inside-avoid"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="size-1.5 rounded-full bg-[var(--blue-500)]" />
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--blue-600)]">
                      {ob.source}
                    </span>
                  </div>
                  <p className="text-[13px] leading-[1.7] text-[var(--navy-800)]">
                    {asText(ob.voice)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {Array.isArray(data.companyInsight.attentions) && data.companyInsight.attentions.length > 0 && (
            <div className="rounded-lg border-l-4 border-[var(--blue-500)] bg-[var(--blue-50)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckSquare className="size-4 text-[var(--blue-700)]" />
                <span className="text-xs font-semibold text-[var(--navy-900)]">
                  签约前必做
                </span>
              </div>
              <ul className="space-y-1.5">
                {data.companyInsight.attentions.map((a, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-[13px] leading-[1.7] text-[var(--navy-800)]"
                  >
                    <span className="text-[var(--blue-600)] shrink-0">✓</span>
                    <span>{asText(a)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Block 3 · 行业共性关注要点 */}
      <div className="rounded-xl border border-[var(--blue-100)] bg-card p-4 sm:p-5 mb-4 break-inside-avoid">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="size-4 text-[var(--blue-600)]" />
          <span className="text-sm font-semibold text-[var(--navy-900)]">
            3 · 行业共性关注要点
          </span>
        </div>
        <p className="text-[13.5px] leading-[1.75] text-[var(--navy-800)]">
          {asText(data.industryAdvice?.summary)}
        </p>
      </div>

      {/* Block 4 · 综合建议 */}
      <div className="rounded-xl border border-[var(--blue-200)] bg-gradient-to-br from-[var(--blue-50)] to-white p-4 sm:p-5 break-inside-avoid">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="size-4 text-[var(--blue-600)]" />
          <span className="text-sm font-semibold text-[var(--navy-900)]">
            综合建议
          </span>
        </div>
        <p className="text-[13.5px] leading-[1.8] text-[var(--navy-800)]">
          {asText(data.synthesis)}
        </p>
      </div>
    </SectionWrapper>
  );
}
