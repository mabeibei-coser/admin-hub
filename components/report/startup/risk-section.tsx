"use client";

import { motion } from "framer-motion";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { SectionWrapper } from "./section-wrapper";
import { useReportRender } from "./report-context";
import type { RiskAssessment } from "@/lib/types-startup";

interface Props {
  data: RiskAssessment | null | undefined;
  index: number;
  total: number;
}

const spring = { type: "spring" as const, stiffness: 90, damping: 22 };

export function RiskSection({ data, index, total }: Props) {
  const { exporting } = useReportRender();

  if (!data) {
    return (
      <SectionWrapper id="riskAssessment" title="风险评估与应对策略" index={index} total={total}>
        <div className="border-t border-[var(--blue-100)] pt-8 pb-4 text-center text-[13px] text-[var(--report-ink-muted)]">
          风险评估模块生成中…
        </div>
      </SectionWrapper>
    );
  }

  const risks = Array.isArray(data.risks) ? data.risks : [];

  return (
    <SectionWrapper id="riskAssessment" title="风险评估与应对策略" index={index} total={total}>
      <div className="divide-y divide-rose-100/70 border-y border-rose-100/70 break-inside-avoid-page">
        {risks.map((risk, i) => {
          const rowProps = exporting
            ? {}
            : {
                initial: { opacity: 0, y: 8 },
                whileInView: { opacity: 1, y: 0 },
                viewport: { once: true, margin: "-40px" },
                transition: { ...spring, delay: i * 0.05 },
              };
          return (
            <motion.div
              key={i}
              {...rowProps}
              className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-6 gap-y-3 py-5 sm:py-6"
            >
              <div className="flex sm:flex-col sm:items-start items-center gap-3 sm:gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-600 tabular-nums">
                  RISK {String(i + 1).padStart(2, "0")}
                </div>
                <h4
                  className="text-[16px] sm:text-[17px] font-bold text-[var(--navy-950)] leading-tight tracking-tight"
                  style={{ fontFamily: "var(--font-heading-serif)" }}
                >
                  {risk.riskType}
                </h4>
              </div>

              <div className="space-y-3.5 min-w-0">
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ShieldAlert className="size-3 text-rose-500" strokeWidth={2} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-600">
                      风险描述
                    </span>
                  </div>
                  <p className="text-[14px] text-[var(--navy-800)] leading-[1.75]">
                    {risk.description}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ShieldCheck className="size-3 text-emerald-600" strokeWidth={2} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                      应对策略
                    </span>
                  </div>
                  <p className="text-[14px] text-[var(--navy-800)] leading-[1.75]">
                    {risk.strategy}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </SectionWrapper>
  );
}
